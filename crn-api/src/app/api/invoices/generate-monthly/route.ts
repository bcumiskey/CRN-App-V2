import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { created, error, validationError } from "@/lib/responses";
import { generateInvoiceNumber } from "@/lib/job-numbers";
import { z } from "zod";

// ---------------------------------------------------------------------------
// POST /api/invoices/generate-monthly — Generate monthly invoice for owner
// ---------------------------------------------------------------------------

const generateMonthlySchema = z.object({
  ownerId: z.string().min(1),
  billingPeriod: z.string().min(1), // e.g. "April 2026"
});

/**
 * Parse a billing period string like "April 2026" into start/end date strings.
 */
function parseBillingPeriod(period: string): { startDate: string; endDate: string } | null {
  const months = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ];

  const parts = period.trim().split(/\s+/);
  if (parts.length !== 2) return null;

  const monthIdx = months.indexOf(parts[0].toLowerCase());
  const year = parseInt(parts[1], 10);
  if (monthIdx === -1 || isNaN(year)) return null;

  const startDate = `${year}-${String(monthIdx + 1).padStart(2, "0")}-01`;
  // Last day of month
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  const endDate = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return { startDate, endDate };
}

export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = generateMonthlySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    // Validate owner
    const owner = await prisma.propertyOwner.findUnique({
      where: { id: data.ownerId },
      select: { id: true, name: true, paymentTerms: true },
    });
    if (!owner) return error("Owner not found", 404);

    // Parse billing period to date range
    const dateRange = parseBillingPeriod(data.billingPeriod);
    if (!dateRange) {
      return error("Invalid billing period format. Expected e.g. 'April 2026'");
    }

    // Find completed, uninvoiced jobs for this owner's properties in the period
    const jobs = await prisma.job.findMany({
      where: {
        status: "COMPLETED",
        invoiceLineItems: { none: {} },
        property: { ownerId: data.ownerId },
        scheduledDate: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      include: {
        property: { select: { id: true, name: true } },
      },
      orderBy: { scheduledDate: "asc" },
    });

    if (jobs.length === 0) {
      return error("No uninvoiced completed jobs found for this owner in the specified period");
    }

    const invoiceNumber = await generateInvoiceNumber();
    const today = new Date().toISOString().split("T")[0];

    // Build line items from jobs
    const lineItems = jobs.map((job, idx) => ({
      description: `${job.property.name} - ${job.jobType} (${job.scheduledDate})`,
      amount: job.totalFee,
      date: job.scheduledDate,
      jobId: job.id,
      category: "cleaning",
      sortOrder: idx,
    }));

    const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        ownerId: data.ownerId,
        type: "monthly",
        billingPeriod: data.billingPeriod,
        invoiceDate: today,
        paymentTerms: owner.paymentTerms,
        subtotal,
        total: subtotal,
        lineItems: {
          create: lineItems,
        },
      },
      include: {
        owner: { select: { id: true, name: true } },
        lineItems: true,
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "create",
      entityType: "invoice",
      entityId: invoice.id,
      summary: `Generated monthly invoice ${invoiceNumber} for ${owner.name} (${data.billingPeriod})`,
      details: { jobCount: jobs.length, subtotal },
    });

    return created(invoice);
  } catch (err) {
    console.error("[POST /api/invoices/generate-monthly]", err);
    return error("Failed to generate monthly invoice", 500);
  }
}

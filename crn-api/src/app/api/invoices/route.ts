import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, created, error, validationError } from "@/lib/responses";
import { generateInvoiceNumber } from "@/lib/job-numbers";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/invoices — List invoices with filters
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const ownerId = params.get("ownerId");
  const propertyId = params.get("propertyId");
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");
  const limit = Math.min(Number(params.get("limit") || 50), 200);
  const offset = Number(params.get("offset") || 0);

  const where: Record<string, unknown> = {};
  if (status) {
    where.status = { in: status.split(",").map((s) => s.trim()) };
  }
  if (ownerId) where.ownerId = ownerId;
  if (propertyId) where.propertyId = propertyId;
  if (startDate || endDate) {
    where.invoiceDate = {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {}),
    };
  }

  try {
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true } },
          property: { select: { id: true, name: true } },
          _count: { select: { lineItems: true } },
        },
        orderBy: { invoiceDate: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.invoice.count({ where }),
    ]);

    return success({ invoices, total, limit, offset });
  } catch (err) {
    console.error("[GET /api/invoices]", err);
    return error("Failed to fetch invoices", 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/invoices — Create invoice
// ---------------------------------------------------------------------------

const lineItemSchema = z.object({
  description: z.string().min(1),
  amount: z.number(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  jobId: z.string().optional(),
  category: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

const createInvoiceSchema = z.object({
  ownerId: z.string().min(1),
  type: z.enum(["per_job", "monthly", "custom"]),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  propertyId: z.string().optional(),
  billingPeriod: z.string().optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  lineItems: z.array(lineItemSchema).optional(),
});

export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = createInvoiceSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    // Validate owner exists
    const owner = await prisma.propertyOwner.findUnique({
      where: { id: data.ownerId },
      select: { id: true, paymentTerms: true },
    });
    if (!owner) return error("Owner not found", 404);

    const invoiceNumber = await generateInvoiceNumber();
    const paymentTerms = data.paymentTerms ?? owner.paymentTerms;

    // Calculate totals from line items
    const lineItems = data.lineItems ?? [];
    const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        ownerId: data.ownerId,
        propertyId: data.propertyId,
        type: data.type,
        billingPeriod: data.billingPeriod,
        invoiceDate: data.invoiceDate,
        paymentTerms,
        subtotal,
        total: subtotal,
        notes: data.notes,
        internalNotes: data.internalNotes,
        lineItems: lineItems.length > 0
          ? {
              create: lineItems.map((li, idx) => ({
                description: li.description,
                amount: li.amount,
                date: li.date,
                jobId: li.jobId,
                category: li.category,
                sortOrder: li.sortOrder ?? idx,
              })),
            }
          : undefined,
      },
      include: {
        owner: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
        lineItems: true,
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "create",
      entityType: "invoice",
      entityId: invoice.id,
      summary: `Created invoice ${invoiceNumber}`,
    });

    return created(invoice);
  } catch (err) {
    console.error("[POST /api/invoices]", err);
    return error("Failed to create invoice", 500);
  }
}

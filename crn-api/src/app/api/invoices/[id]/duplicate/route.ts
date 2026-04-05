import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { created, error, notFound } from "@/lib/responses";
import { generateInvoiceNumber } from "@/lib/job-numbers";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// POST /api/invoices/[id]/duplicate — Duplicate invoice as new draft
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const source = await prisma.invoice.findUnique({
      where: { id },
      include: { lineItems: true },
    });
    if (!source) return notFound("Invoice not found");

    const invoiceNumber = await generateInvoiceNumber();
    const today = new Date().toISOString().split("T")[0];

    const duplicate = await prisma.invoice.create({
      data: {
        invoiceNumber,
        ownerId: source.ownerId,
        propertyId: source.propertyId,
        type: source.type,
        billingPeriod: source.billingPeriod,
        invoiceDate: today,
        paymentTerms: source.paymentTerms,
        subtotal: source.subtotal,
        discount: source.discount,
        total: source.total,
        notes: source.notes,
        internalNotes: source.internalNotes,
        lineItems: {
          create: source.lineItems.map((li) => ({
            description: li.description,
            amount: li.amount,
            date: li.date,
            category: li.category,
            sortOrder: li.sortOrder,
            // Do not copy jobId — duplicated line items are unlinked
          })),
        },
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
      entityId: duplicate.id,
      summary: `Duplicated invoice ${source.invoiceNumber} as ${invoiceNumber}`,
    });

    return created(duplicate);
  } catch (err) {
    console.error("[POST /api/invoices/[id]/duplicate]", err);
    return error("Failed to duplicate invoice", 500);
  }
}

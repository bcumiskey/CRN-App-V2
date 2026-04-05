import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/invoices/[id] — Invoice detail
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true, phone: true } },
        property: { select: { id: true, name: true, address: true } },
        lineItems: {
          include: {
            job: { select: { id: true, jobNumber: true, scheduledDate: true, status: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!invoice) return notFound("Invoice not found");

    return success(invoice);
  } catch (err) {
    console.error("[GET /api/invoices/[id]]", err);
    return error("Failed to fetch invoice", 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/invoices/[id] — Update invoice (draft only)
// ---------------------------------------------------------------------------

const updateInvoiceSchema = z.object({
  ownerId: z.string().optional(),
  propertyId: z.string().nullable().optional(),
  type: z.enum(["per_job", "monthly", "custom"]).optional(),
  billingPeriod: z.string().nullable().optional(),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  paymentTerms: z.string().optional(),
  discount: z.number().min(0).optional(),
  notes: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = updateInvoiceSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) return notFound("Invoice not found");

    if (existing.status !== "draft") {
      return error("Only draft invoices can be edited", 409);
    }

    // Recalculate total if discount changed
    const updateData: Record<string, unknown> = { ...data };
    if (data.discount !== undefined) {
      updateData.total = existing.subtotal - data.discount;
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        owner: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
        lineItems: true,
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "invoice",
      entityId: id,
      summary: `Updated invoice ${existing.invoiceNumber}`,
      details: data as Record<string, unknown>,
    });

    return success(invoice);
  } catch (err) {
    console.error("[PATCH /api/invoices/[id]]", err);
    return error("Failed to update invoice", 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/invoices/[id] — Delete draft invoice
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) return notFound("Invoice not found");

    if (existing.status !== "draft") {
      return error(
        "Only draft invoices can be deleted. Sent or paid invoices must be voided instead.",
        409
      );
    }

    await prisma.invoice.delete({ where: { id } });

    await logAudit({
      userId: result.user.userId,
      action: "delete",
      entityType: "invoice",
      entityId: id,
      summary: `Deleted draft invoice ${existing.invoiceNumber}`,
    });

    return success({ deleted: true, invoiceNumber: existing.invoiceNumber });
  } catch (err) {
    console.error("[DELETE /api/invoices/[id]]", err);
    return error("Failed to delete invoice", 500);
  }
}

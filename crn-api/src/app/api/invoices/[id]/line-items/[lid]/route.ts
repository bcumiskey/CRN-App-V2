import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string; lid: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/invoices/[id]/line-items/[lid] — Update line item
// ---------------------------------------------------------------------------

const updateLineItemSchema = z.object({
  description: z.string().min(1).optional(),
  amount: z.number().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  category: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id, lid } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = updateLineItemSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    const lineItem = await prisma.invoiceLineItem.findFirst({
      where: { id: lid, invoiceId: id },
    });
    if (!lineItem) return notFound("Line item not found");

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, discount: true },
    });
    if (!invoice) return notFound("Invoice not found");

    if (invoice.status !== "draft") {
      return error("Can only edit line items on draft invoices", 409);
    }

    const updated = await prisma.invoiceLineItem.update({
      where: { id: lid },
      data,
    });

    // If amount changed and line item is linked to a job, sync job totalFee
    if (data.amount !== undefined && data.amount !== lineItem.amount && lineItem.jobId) {
      await prisma.job.update({
        where: { id: lineItem.jobId },
        data: { totalFee: data.amount },
      });

      await logAudit({
        userId: result.user.userId,
        action: "update",
        entityType: "job",
        entityId: lineItem.jobId,
        summary: `Synced job totalFee to ${data.amount} from invoice line item update`,
        details: { previousAmount: lineItem.amount, newAmount: data.amount },
      });
    }

    // Recalculate invoice totals
    const allLineItems = await prisma.invoiceLineItem.findMany({
      where: { invoiceId: id },
      select: { amount: true },
    });
    const newSubtotal = allLineItems.reduce((sum, li) => sum + li.amount, 0);
    await prisma.invoice.update({
      where: { id },
      data: {
        subtotal: newSubtotal,
        total: newSubtotal - invoice.discount,
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "invoice_line_item",
      entityId: lid,
      summary: `Updated line item on invoice ${id}`,
      details: data as Record<string, unknown>,
    });

    return success(updated);
  } catch (err) {
    console.error("[PATCH /api/invoices/[id]/line-items/[lid]]", err);
    return error("Failed to update line item", 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/invoices/[id]/line-items/[lid] — Remove line item
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id, lid } = await params;

  try {
    const lineItem = await prisma.invoiceLineItem.findFirst({
      where: { id: lid, invoiceId: id },
    });
    if (!lineItem) return notFound("Line item not found");

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, discount: true },
    });
    if (!invoice) return notFound("Invoice not found");

    if (invoice.status !== "draft") {
      return error("Can only remove line items from draft invoices", 409);
    }

    // If job-linked, revert job status to COMPLETED
    if (lineItem.jobId) {
      await prisma.job.update({
        where: { id: lineItem.jobId },
        data: { status: "COMPLETED" },
      });

      await logAudit({
        userId: result.user.userId,
        action: "update",
        entityType: "job",
        entityId: lineItem.jobId,
        summary: `Reverted job to COMPLETED after removing invoice line item`,
      });
    }

    await prisma.invoiceLineItem.delete({ where: { id: lid } });

    // Recalculate invoice totals
    const allLineItems = await prisma.invoiceLineItem.findMany({
      where: { invoiceId: id },
      select: { amount: true },
    });
    const newSubtotal = allLineItems.reduce((sum, li) => sum + li.amount, 0);
    await prisma.invoice.update({
      where: { id },
      data: {
        subtotal: newSubtotal,
        total: newSubtotal - invoice.discount,
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "delete",
      entityType: "invoice_line_item",
      entityId: lid,
      summary: `Removed line item from invoice ${id}`,
    });

    return success({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/invoices/[id]/line-items/[lid]]", err);
    return error("Failed to remove line item", 500);
  }
}

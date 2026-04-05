import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { created, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// POST /api/invoices/[id]/line-items — Add line item
// ---------------------------------------------------------------------------

const createLineItemSchema = z.object({
  description: z.string().min(1),
  amount: z.number(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  jobId: z.string().optional(),
  category: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export async function POST(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = createLineItemSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, subtotal: true, discount: true },
    });
    if (!invoice) return notFound("Invoice not found");

    if (invoice.status !== "draft") {
      return error("Can only add line items to draft invoices", 409);
    }

    const lineItem = await prisma.invoiceLineItem.create({
      data: {
        invoiceId: id,
        description: data.description,
        amount: data.amount,
        date: data.date,
        jobId: data.jobId,
        category: data.category,
        sortOrder: data.sortOrder ?? 0,
      },
    });

    // Recalculate invoice totals
    const newSubtotal = invoice.subtotal + data.amount;
    await prisma.invoice.update({
      where: { id },
      data: {
        subtotal: newSubtotal,
        total: newSubtotal - invoice.discount,
      },
    });

    return created(lineItem);
  } catch (err) {
    console.error("[POST /api/invoices/[id]/line-items]", err);
    return error("Failed to add line item", 500);
  }
}

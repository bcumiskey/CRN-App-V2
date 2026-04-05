import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/invoices/[id]/mark-paid — Mark invoice as paid
// ---------------------------------------------------------------------------

const markPaidSchema = z.object({
  paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  paymentMethod: z.string().optional(),
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

  const parsed = markPaidSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return notFound("Invoice not found");

    if (invoice.status === "void") {
      return error("Cannot mark a voided invoice as paid", 409);
    }
    if (invoice.status === "paid") {
      return error("Invoice is already paid", 409);
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: "paid",
        paidDate: data.paidDate,
        paidAt: new Date(),
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "invoice",
      entityId: id,
      summary: `Marked invoice ${invoice.invoiceNumber} as paid`,
      details: { paidDate: data.paidDate, paymentMethod: data.paymentMethod },
    });

    return success(updated);
  } catch (err) {
    console.error("[PATCH /api/invoices/[id]/mark-paid]", err);
    return error("Failed to mark invoice as paid", 500);
  }
}

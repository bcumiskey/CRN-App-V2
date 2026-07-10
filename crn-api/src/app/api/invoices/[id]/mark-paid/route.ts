import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { bankersRound } from "crn-shared";
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
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        lineItems: { select: { jobId: true } },
        payments: { select: { amount: true } },
      },
    });
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

    // Record the remaining balance as a Payment row so the payment ledger
    // stays complete (partial payments may already cover part of the total)
    const remainingBalance = bankersRound(
      invoice.total - invoice.payments.reduce((sum, p) => sum + p.amount, 0)
    );
    if (remainingBalance > 0) {
      await prisma.payment.create({
        data: {
          invoiceId: id,
          amount: remainingBalance,
          date: data.paidDate,
          method: data.paymentMethod ?? null,
        },
      });
    }

    // Reflect the payment on the jobs billed by this invoice so job-level
    // payment flags agree with invoice-level payment status
    const jobIds = invoice.lineItems
      .map((li) => li.jobId)
      .filter((jobId): jobId is string => jobId !== null);

    if (jobIds.length > 0) {
      await prisma.job.updateMany({
        where: { id: { in: jobIds } },
        data: {
          clientPaid: true,
          clientPaidDate: data.paidDate,
          clientPaidMethod: data.paymentMethod,
        },
      });
    }

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

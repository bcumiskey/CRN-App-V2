import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound } from "@/lib/responses";
import { bankersRound } from "crn-shared";

type RouteContext = { params: Promise<{ id: string; pid: string }> };

// ---------------------------------------------------------------------------
// DELETE /api/invoices/[id]/payments/[pid] — Remove a mis-entered payment
//
// Recomputes the invoice balance after removal. If the invoice was paid and
// the balance goes back above zero, the paid status is reverted to "sent"
// (paidDate/paidAt cleared, linked jobs un-stamped) — the invoice is owed
// again and re-enters the outstanding pipeline.
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id, pid } = await params;

  try {
    const payment = await prisma.payment.findFirst({
      where: { id: pid, invoiceId: id },
    });
    if (!payment) return notFound("Payment not found");

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { lineItems: { select: { jobId: true } } },
    });
    if (!invoice) return notFound("Invoice not found");

    await prisma.payment.delete({ where: { id: pid } });

    const remaining = await prisma.payment.findMany({
      where: { invoiceId: id },
      select: { amount: true },
    });
    const amountPaid = bankersRound(
      remaining.reduce((sum, p) => sum + p.amount, 0)
    );
    const balance = bankersRound(invoice.total - amountPaid);

    let invoiceStatus = invoice.status;

    // Removing the payment re-opens a paid invoice — revert to "sent" and
    // undo the mark-paid effects
    if (invoice.status === "paid" && balance > 0) {
      await prisma.invoice.update({
        where: { id },
        data: {
          status: "sent",
          paidDate: null,
          paidAt: null,
        },
      });
      invoiceStatus = "sent";

      // Un-stamp the jobs billed by this invoice so job-level payment flags
      // agree with invoice-level payment status
      const jobIds = invoice.lineItems
        .map((li) => li.jobId)
        .filter((jobId): jobId is string => jobId !== null);

      if (jobIds.length > 0) {
        await prisma.job.updateMany({
          where: { id: { in: jobIds } },
          data: {
            clientPaid: false,
            clientPaidDate: null,
            clientPaidMethod: null,
          },
        });
      }
    }

    await logAudit({
      userId: result.user.userId,
      action: "delete",
      entityType: "invoice",
      entityId: id,
      summary: `Removed payment of $${payment.amount.toFixed(2)} from invoice ${invoice.invoiceNumber}`,
      details: {
        paymentId: pid,
        amount: payment.amount,
        date: payment.date,
        method: payment.method,
        amountPaid,
        balance,
        invoiceStatus,
      },
    });

    return success({ deleted: true, invoiceStatus, amountPaid, balance });
  } catch (err) {
    console.error("[DELETE /api/invoices/[id]/payments/[pid]]", err);
    return error("Failed to remove payment", 500);
  }
}

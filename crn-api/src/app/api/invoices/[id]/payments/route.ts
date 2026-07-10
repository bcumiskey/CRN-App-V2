import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { bankersRound } from "crn-shared";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// POST /api/invoices/[id]/payments — Record a (possibly partial) payment
//
// Creates a Payment row and recomputes the invoice balance. If the payment
// settles the invoice (balance <= 0), applies the full mark-paid effects:
// status → paid, paidDate/paidAt stamped, and linked jobs flagged clientPaid.
// Overpayment is allowed but flagged with a warning in the response.
// ---------------------------------------------------------------------------

const createPaymentSchema = z.object({
  amount: z.number().positive("Amount must be greater than zero"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  method: z.string().optional(),
  notes: z.string().optional(),
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

  const parsed = createPaymentSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        payments: { select: { amount: true } },
        lineItems: { select: { jobId: true } },
      },
    });
    if (!invoice) return notFound("Invoice not found");

    if (invoice.status === "void") {
      return error("Cannot record a payment on a voided invoice", 409);
    }

    const payment = await prisma.payment.create({
      data: {
        invoiceId: id,
        amount: data.amount,
        date: data.date,
        method: data.method ?? null,
        notes: data.notes ?? null,
      },
    });

    const amountPaid = bankersRound(
      invoice.payments.reduce((sum, p) => sum + p.amount, 0) + data.amount
    );
    const balance = bankersRound(invoice.total - amountPaid);

    const warning =
      balance < 0
        ? `Payment exceeds invoice total by $${Math.abs(balance).toFixed(2)}`
        : undefined;

    let invoiceStatus = invoice.status;

    // Payment settles the invoice — apply the full mark-paid effects
    if (balance <= 0 && invoice.status !== "paid") {
      await prisma.invoice.update({
        where: { id },
        data: {
          status: "paid",
          paidDate: data.date,
          paidAt: new Date(),
        },
      });
      invoiceStatus = "paid";

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
            clientPaidDate: data.date,
            clientPaidMethod: data.method,
          },
        });
      }
    }

    await logAudit({
      userId: result.user.userId,
      action: "create",
      entityType: "invoice",
      entityId: id,
      summary: `Recorded payment of $${data.amount.toFixed(2)} on invoice ${invoice.invoiceNumber}`,
      details: {
        paymentId: payment.id,
        amount: data.amount,
        date: data.date,
        method: data.method,
        amountPaid,
        balance,
        invoiceStatus,
      },
    });

    return success({ payment, invoiceStatus, amountPaid, balance, warning });
  } catch (err) {
    console.error("[POST /api/invoices/[id]/payments]", err);
    return error("Failed to record payment", 500);
  }
}

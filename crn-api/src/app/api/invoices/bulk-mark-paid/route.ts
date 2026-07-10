import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, validationError } from "@/lib/responses";
import { bankersRound } from "crn-shared";
import { z } from "zod";

// ---------------------------------------------------------------------------
// POST /api/invoices/bulk-mark-paid — Mark many invoices as paid at once
// ---------------------------------------------------------------------------

const bulkMarkPaidSchema = z.object({
  invoiceIds: z.array(z.string().min(1)).min(1).max(100),
  paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  paymentMethod: z.string().optional(),
});

type BulkResult = {
  id: string;
  ok: boolean;
  invoiceNumber?: string;
  error?: string;
};

export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = bulkMarkPaidSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  const results: BulkResult[] = [];

  // Process sequentially so each invoice gets the exact same treatment as
  // PATCH /api/invoices/[id]/mark-paid, with per-item errors instead of
  // failing the whole batch
  for (const id of data.invoiceIds) {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
          lineItems: { select: { jobId: true } },
          payments: { select: { amount: true } },
        },
      });

      if (!invoice) {
        results.push({ id, ok: false, error: "Invoice not found" });
        continue;
      }
      if (invoice.status === "void") {
        results.push({
          id,
          ok: false,
          invoiceNumber: invoice.invoiceNumber,
          error: "Cannot mark a voided invoice as paid",
        });
        continue;
      }
      if (invoice.status === "paid") {
        results.push({
          id,
          ok: false,
          invoiceNumber: invoice.invoiceNumber,
          error: "Invoice is already paid",
        });
        continue;
      }

      await prisma.invoice.update({
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

      results.push({ id, ok: true, invoiceNumber: invoice.invoiceNumber });
    } catch (err) {
      console.error("[POST /api/invoices/bulk-mark-paid]", id, err);
      results.push({ id, ok: false, error: "Failed to mark invoice as paid" });
    }
  }

  const paidCount = results.filter((r) => r.ok).length;

  return success({ results, paidCount });
}

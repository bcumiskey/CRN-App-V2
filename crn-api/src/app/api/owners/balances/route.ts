import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { bankersRound } from "crn-shared";

// ---------------------------------------------------------------------------
// GET /api/owners/balances — Outstanding balance per owner
//
// For each owner:
//   - unpaidInvoiceTotal: Σ Invoice balance (total − payments) where status
//     in (sent, viewed, overdue). Drafts aren't owed yet; paid/void don't
//     count. Partial payments reduce what's owed.
//   - unbilledJobTotal: Σ (job.totalFee + Σ charges.amount) over COMPLETED
//     jobs on the owner's properties that aren't on any non-void invoice.
//   - draftInvoiceTotal: Σ Invoice.total where status = draft, so the UI can
//     hint "you have unsent drafts".
// ---------------------------------------------------------------------------

const UNPAID_STATUSES = ["sent", "viewed", "overdue"];

type OwnerBalance = {
  ownerId: string;
  ownerName: string;
  unpaidInvoiceTotal: number;
  unpaidInvoiceCount: number;
  unbilledJobTotal: number;
  unbilledJobCount: number;
  draftInvoiceTotal: number;
  totalOutstanding: number;
  oldestUnpaidInvoiceDate: string | null;
  oldestUnbilledJobDate: string | null;
};

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    const [owners, invoices, jobs] = await Promise.all([
      prisma.propertyOwner.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.invoice.findMany({
        where: { status: { in: [...UNPAID_STATUSES, "draft"] } },
        select: {
          ownerId: true,
          total: true,
          status: true,
          invoiceDate: true,
          payments: { select: { amount: true } },
        },
      }),
      prisma.job.findMany({
        where: {
          status: "COMPLETED",
          // Jobs whose only line items sit on voided invoices are billable again
          invoiceLineItems: { none: { invoice: { status: { not: "void" } } } },
          property: { ownerId: { not: null } },
        },
        select: {
          scheduledDate: true,
          totalFee: true,
          charges: { select: { amount: true } },
          property: { select: { ownerId: true } },
        },
      }),
    ]);

    // Accumulate per owner (raw sums; bankersRound once at the end)
    const acc = new Map<
      string,
      {
        unpaidInvoiceTotal: number;
        unpaidInvoiceCount: number;
        unbilledJobTotal: number;
        unbilledJobCount: number;
        draftInvoiceTotal: number;
        oldestUnpaidInvoiceDate: string | null;
        oldestUnbilledJobDate: string | null;
      }
    >();

    for (const owner of owners) {
      acc.set(owner.id, {
        unpaidInvoiceTotal: 0,
        unpaidInvoiceCount: 0,
        unbilledJobTotal: 0,
        unbilledJobCount: 0,
        draftInvoiceTotal: 0,
        oldestUnpaidInvoiceDate: null,
        oldestUnbilledJobDate: null,
      });
    }

    for (const inv of invoices) {
      const entry = acc.get(inv.ownerId);
      if (!entry) continue;

      if (inv.status === "draft") {
        entry.draftInvoiceTotal += inv.total;
        continue;
      }

      // What's still owed on this invoice: total minus partial payments
      // (clamped at 0 so an overpayment can't offset other invoices)
      const balance = Math.max(
        0,
        inv.total - inv.payments.reduce((sum, p) => sum + p.amount, 0)
      );
      entry.unpaidInvoiceTotal += balance;
      entry.unpaidInvoiceCount += 1;
      // String YYYY-MM-DD dates compare lexicographically
      if (
        entry.oldestUnpaidInvoiceDate === null ||
        inv.invoiceDate < entry.oldestUnpaidInvoiceDate
      ) {
        entry.oldestUnpaidInvoiceDate = inv.invoiceDate;
      }
    }

    for (const job of jobs) {
      const ownerId = job.property.ownerId;
      if (!ownerId) continue;
      const entry = acc.get(ownerId);
      if (!entry) continue;

      const jobTotal =
        job.totalFee + job.charges.reduce((sum, c) => sum + c.amount, 0);
      entry.unbilledJobTotal += jobTotal;
      entry.unbilledJobCount += 1;
      if (
        entry.oldestUnbilledJobDate === null ||
        job.scheduledDate < entry.oldestUnbilledJobDate
      ) {
        entry.oldestUnbilledJobDate = job.scheduledDate;
      }
    }

    const balances: OwnerBalance[] = owners.map((owner) => {
      const entry = acc.get(owner.id)!;
      const unpaidInvoiceTotal = bankersRound(entry.unpaidInvoiceTotal);
      const unbilledJobTotal = bankersRound(entry.unbilledJobTotal);
      return {
        ownerId: owner.id,
        ownerName: owner.name,
        unpaidInvoiceTotal,
        unpaidInvoiceCount: entry.unpaidInvoiceCount,
        unbilledJobTotal,
        unbilledJobCount: entry.unbilledJobCount,
        draftInvoiceTotal: bankersRound(entry.draftInvoiceTotal),
        totalOutstanding: bankersRound(unpaidInvoiceTotal + unbilledJobTotal),
        oldestUnpaidInvoiceDate: entry.oldestUnpaidInvoiceDate,
        oldestUnbilledJobDate: entry.oldestUnbilledJobDate,
      };
    });

    // Highest balances first; owners.findMany was name-sorted so ties stay
    // alphabetical
    balances.sort((a, b) => b.totalOutstanding - a.totalOutstanding);

    const grandTotal = bankersRound(
      balances.reduce((sum, b) => sum + b.totalOutstanding, 0)
    );

    return success({ owners: balances, grandTotal });
  } catch (err) {
    console.error("[GET /api/owners/balances]", err);
    return error("Failed to compute owner balances", 500);
  }
}

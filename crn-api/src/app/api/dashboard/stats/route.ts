import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { todayParts } from "@/lib/business-time";
import { loadFinancialModel, r2 } from "@/lib/report-utils";
import { calculateJob } from "crn-shared";

// ---------------------------------------------------------------------------
// GET /api/dashboard/stats — Dashboard summary stats
// Returns the same fields V1's dashboard expects
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { year, month: monthNum } = todayParts();
  const month = String(monthNum).padStart(2, "0");
  const monthStart = `${year}-${month}-01`;
  const nextMonth = monthNum === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(monthNum + 1).padStart(2, "0")}-01`;

  try {
    const financialModel = await loadFinancialModel(prisma);

    const [
      jobsThisMonth,
      jobsCompleted,
      revenueResult,
      uninvoicedJobs,
      unpaidTeamJobs,
      draftInvoices,
      outstandingInvoices,
      unpaidInvoices,
    ] = await Promise.all([
      // Jobs this month
      prisma.job.count({
        where: { scheduledDate: { gte: monthStart, lt: nextMonth } },
      }),

      // Jobs completed this month
      prisma.job.count({
        where: {
          scheduledDate: { gte: monthStart, lt: nextMonth },
          status: { in: ["COMPLETED", "INVOICED"] },
        },
      }),

      // Revenue this month (completed jobs)
      prisma.job.aggregate({
        where: {
          scheduledDate: { gte: monthStart, lt: nextMonth },
          status: { in: ["COMPLETED", "INVOICED"] },
        },
        _sum: { totalFee: true },
      }),

      // Completed jobs not yet invoiced or client-paid (all time) — the
      // uninvoiced half of "pending from clients"
      prisma.job.findMany({
        where: { status: "COMPLETED", clientPaid: false },
        select: {
          totalFee: true,
          charges: { select: { amount: true } },
        },
      }),

      // Completed/invoiced jobs the team hasn't been paid for (all time)
      prisma.job.findMany({
        where: {
          status: { in: ["COMPLETED", "INVOICED"] },
          teamPaid: false,
        },
        include: {
          assignments: {
            include: {
              user: { select: { id: true, name: true, isOwner: true } },
            },
          },
          charges: { select: { amount: true } },
        },
      }),

      // Draft invoices count
      prisma.invoice.count({
        where: { status: "draft" },
      }),

      // Outstanding invoices (sent, viewed, or overdue)
      prisma.invoice.count({
        where: { status: { in: ["sent", "viewed", "overdue"] } },
      }),

      // Outstanding amounts (total + partial payments, to compute balances)
      prisma.invoice.findMany({
        where: { status: { in: ["sent", "viewed", "overdue"] } },
        select: {
          total: true,
          payments: { select: { amount: true } },
        },
      }),
    ]);

    // Outstanding amount: what's still OWED on open invoices — each
    // invoice's total minus its partial payments (clamped at 0 so an
    // overpayment can't offset other invoices)
    const outstandingBalance = unpaidInvoices.reduce(
      (sum, inv) =>
        sum +
        Math.max(
          0,
          inv.total - inv.payments.reduce((s, p) => s + p.amount, 0)
        ),
      0
    );

    // Pending from clients: uninvoiced completed job value (fee + extra
    // charges) PLUS open invoice totals — sending an invoice moves the job
    // from the first sum to the second instead of vanishing.
    const uninvoicedValue = uninvoicedJobs.reduce(
      (sum, j) =>
        sum + j.totalFee + j.charges.reduce((s, c) => s + c.amount, 0),
      0
    );
    const pendingFromClients = r2(uninvoicedValue + outstandingBalance);

    // Owed to team: the workers' share of each unpaid job (worker pool +
    // owner payouts — exactly what pay statements freeze at period close),
    // not the full job fee.
    let owedToTeam = 0;
    for (const job of unpaidTeamJobs) {
      if (job.assignments.length === 0) continue;

      const jobResult = calculateJob(financialModel, {
        totalFee: job.totalFee,
        houseCutPercent: job.houseCutPercent,
        charges: job.charges.map((c) => ({ amount: c.amount })),
        assignments: job.assignments.map((a) => ({
          userId: a.userId,
          userName: a.user.name,
          share: a.share,
          isOwner: a.user.isOwner,
        })),
      });

      for (const wp of jobResult.workerPayments) {
        owedToTeam += wp.totalPay;
      }
    }
    owedToTeam = r2(owedToTeam);

    return success({
      // V1-compatible fields
      monthlyRevenue: revenueResult._sum.totalFee ?? 0,
      pendingFromClients,
      owedToTeam,
      draftInvoices,
      lowStockItems: 0, // TODO: compute from linens when inventory is tracked

      // V2 fields (for V2 pages that use these)
      jobsThisMonth,
      jobsCompleted,
      revenueThisMonth: revenueResult._sum.totalFee ?? 0,
      outstandingInvoices,
      outstandingAmount: r2(outstandingBalance),
    });
  } catch (err) {
    console.error("[GET /api/dashboard/stats]", err);
    return error("Failed to fetch dashboard stats", 500);
  }
}

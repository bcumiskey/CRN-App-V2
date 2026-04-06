import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";

// ---------------------------------------------------------------------------
// GET /api/dashboard/stats — Dashboard summary stats
// Returns the same fields V1's dashboard expects
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const monthStart = `${year}-${month}-01`;
  const nextMonth = now.getMonth() === 11
    ? `${year + 1}-01-01`
    : `${year}-${String(now.getMonth() + 2).padStart(2, "0")}-01`;

  try {
    const [
      jobsThisMonth,
      jobsCompleted,
      revenueResult,
      pendingFromClientsResult,
      owedToTeamResult,
      draftInvoices,
      outstandingInvoices,
      outstandingResult,
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

      // Pending from clients: completed jobs NOT client-paid (all time)
      prisma.job.aggregate({
        where: { status: "COMPLETED", clientPaid: false },
        _sum: { totalFee: true },
      }),

      // Owed to team: completed jobs NOT team-paid (all time)
      prisma.job.aggregate({
        where: { status: "COMPLETED", teamPaid: false },
        _sum: { totalFee: true },
      }),

      // Draft invoices count
      prisma.invoice.count({
        where: { status: "draft" },
      }),

      // Outstanding invoices (sent or overdue)
      prisma.invoice.count({
        where: { status: { in: ["sent", "overdue"] } },
      }),

      // Outstanding amount
      prisma.invoice.aggregate({
        where: { status: { in: ["sent", "overdue"] } },
        _sum: { total: true },
      }),
    ]);

    return success({
      // V1-compatible fields
      monthlyRevenue: revenueResult._sum.totalFee ?? 0,
      pendingFromClients: pendingFromClientsResult._sum.totalFee ?? 0,
      owedToTeam: owedToTeamResult._sum.totalFee ?? 0,
      draftInvoices,
      lowStockItems: 0, // TODO: compute from linens when inventory is tracked

      // V2 fields (for V2 pages that use these)
      jobsThisMonth,
      jobsCompleted,
      revenueThisMonth: revenueResult._sum.totalFee ?? 0,
      outstandingInvoices,
      outstandingAmount: outstandingResult._sum.total ?? 0,
    });
  } catch (err) {
    console.error("[GET /api/dashboard/stats]", err);
    return error("Failed to fetch dashboard stats", 500);
  }
}

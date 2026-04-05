import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";

// ---------------------------------------------------------------------------
// GET /api/dashboard/stats — This month's summary stats
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const monthStart = `${year}-${month}-01`;
  const monthEnd = `${year}-${month}-31`; // Safe upper bound for string comparison

  try {
    // Jobs this month
    const jobsThisMonth = await prisma.job.count({
      where: {
        scheduledDate: { gte: monthStart, lte: monthEnd },
      },
    });

    // Jobs completed this month
    const jobsCompleted = await prisma.job.count({
      where: {
        scheduledDate: { gte: monthStart, lte: monthEnd },
        status: { in: ["COMPLETED", "INVOICED"] },
      },
    });

    // Revenue this month (sum of totalFee for completed jobs)
    const revenueResult = await prisma.job.aggregate({
      where: {
        scheduledDate: { gte: monthStart, lte: monthEnd },
        status: { in: ["COMPLETED", "INVOICED"] },
      },
      _sum: { totalFee: true },
    });
    const revenueThisMonth = revenueResult._sum.totalFee ?? 0;

    // Outstanding invoices
    const outstandingInvoices = await prisma.invoice.count({
      where: {
        status: { in: ["sent", "overdue"] },
      },
    });

    const outstandingResult = await prisma.invoice.aggregate({
      where: {
        status: { in: ["sent", "overdue"] },
      },
      _sum: { total: true },
    });
    const outstandingAmount = outstandingResult._sum.total ?? 0;

    return success({
      jobsThisMonth,
      jobsCompleted,
      revenueThisMonth,
      outstandingInvoices,
      outstandingAmount,
    });
  } catch (err) {
    console.error("[GET /api/dashboard/stats]", err);
    return error("Failed to fetch dashboard stats", 500);
  }
}

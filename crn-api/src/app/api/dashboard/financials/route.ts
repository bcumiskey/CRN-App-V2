import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { calculateJob } from "crn-shared";
import type { FinancialModel } from "crn-shared";

// ---------------------------------------------------------------------------
// GET /api/dashboard/financials — Financial dashboard data
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    // Current month boundaries
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Load financial model
    const settings = await prisma.companySettings.findUnique({
      where: { id: "singleton" },
      select: { financialModel: true },
    });
    const financialModel = settings?.financialModel as unknown as FinancialModel;

    // Total revenue: sum of totalFee for completed/invoiced jobs this month
    const completedJobs = await prisma.job.findMany({
      where: {
        status: { in: ["COMPLETED", "INVOICED"] },
        scheduledDate: { gte: startDate, lte: endDate },
      },
      include: {
        assignments: {
          include: {
            user: { select: { id: true, name: true, isOwner: true } },
          },
        },
        charges: { select: { amount: true } },
      },
    });

    const totalRevenue = completedJobs.reduce((sum, j) => sum + j.totalFee, 0);

    // Total expenses this month
    const expenses = await prisma.expense.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      select: { amount: true },
    });
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Outstanding invoices (sent but not paid)
    const outstandingInvoices = await prisma.invoice.findMany({
      where: { status: { in: ["sent", "overdue"] } },
      select: { total: true },
    });
    const outstandingAmount = outstandingInvoices.reduce(
      (sum, i) => sum + i.total,
      0
    );

    // Team payroll: sum of worker pool amounts from calculateJob for each completed job
    let teamPayroll = 0;
    for (const job of completedJobs) {
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

      teamPayroll += jobResult.workerPoolAmount;
    }

    return success({
      month: startDate.substring(0, 7),
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      outstandingAmount: Math.round(outstandingAmount * 100) / 100,
      teamPayroll: Math.round(teamPayroll * 100) / 100,
    });
  } catch (err) {
    console.error("[GET /api/dashboard/financials]", err);
    return error("Failed to compute financial dashboard", 500);
  }
}

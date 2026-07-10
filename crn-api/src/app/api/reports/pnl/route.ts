import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { resolveDateRange } from "@/lib/date-ranges";
import {
  computeJobFinancials,
  jobIncludeForReports,
  loadFinancialModel,
  r2,
} from "@/lib/report-utils";

// ---------------------------------------------------------------------------
// GET /api/reports/pnl — Profit & Loss Summary
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    const params = request.nextUrl.searchParams;
    const range = resolveDateRange(
      params.get("startDate"),
      params.get("endDate"),
      params.get("preset")
    );

    const financialModel = await loadFinancialModel(prisma);

    // Completed jobs in range
    const jobs = await prisma.job.findMany({
      where: {
        status: { in: ["COMPLETED", "INVOICED"] },
        scheduledDate: { gte: range.startDate, lte: range.endDate },
      },
      include: jobIncludeForReports,
    });

    const fin = computeJobFinancials(jobs, financialModel);

    // Operating expenses grouped by top-level category
    const expenses = await prisma.expense.findMany({
      where: { date: { gte: range.startDate, lte: range.endDate } },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            parentId: true,
            parent: { select: { id: true, name: true } },
          },
        },
      },
    });

    const totalExpenses = r2(expenses.reduce((sum, e) => sum + e.amount, 0));

    const categoryMap = new Map<
      string,
      { categoryId: string; categoryName: string; total: number }
    >();
    for (const exp of expenses) {
      const topId = exp.category.parentId ?? exp.category.id;
      const topName = exp.category.parent?.name ?? exp.category.name;
      const existing = categoryMap.get(topId);
      if (existing) {
        existing.total += exp.amount;
      } else {
        categoryMap.set(topId, {
          categoryId: topId,
          categoryName: topName,
          total: exp.amount,
        });
      }
    }

    const expensesByCategory = Array.from(categoryMap.values())
      .map((c) => ({ ...c, total: r2(c.total) }))
      .sort((a, b) => b.total - a.total);

    // Labor cost: what the team earns on the jobs in range (worker pool +
    // owner payouts — the same amounts pay statements freeze at close), so
    // netProfit matches the tax package's view instead of ignoring payroll.
    let laborCost = 0;
    for (const worker of fin.perWorkerTotals.values()) {
      laborCost += worker.totalPay;
    }
    laborCost = r2(laborCost);

    // Mileage deduction in range
    const mileageLogs = await prisma.mileageLog.findMany({
      where: { date: { gte: range.startDate, lte: range.endDate } },
      select: { deductionAmount: true },
    });
    const mileageDeduction = r2(
      mileageLogs.reduce((sum, m) => sum + m.deductionAmount, 0)
    );

    const netProfit = r2(
      fin.totalNetRevenue - totalExpenses - laborCost - mileageDeduction
    );

    return success({
      ...range,
      jobCount: jobs.length,
      grossRevenue: fin.totalGrossRevenue,
      houseCut: fin.totalHouseCut,
      netRevenue: fin.totalNetRevenue,
      buckets: {
        businessExpense: fin.totalBusinessExpense,
        ownerProfit: fin.totalOwnerProfit,
        workerPool: fin.totalWorkerPool,
      },
      operatingExpenses: {
        total: totalExpenses,
        byCategory: expensesByCategory,
      },
      laborCost,
      mileageDeduction,
      netProfit,
    });
  } catch (err) {
    console.error("[GET /api/reports/pnl]", err);
    return error("Failed to compute P&L report", 500);
  }
}

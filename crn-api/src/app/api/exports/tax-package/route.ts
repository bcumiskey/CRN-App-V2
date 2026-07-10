import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import {
  computeJobFinancials,
  jobIncludeForReports,
  loadFinancialModel,
  r2,
} from "@/lib/report-utils";
import { todayParts } from "@/lib/business-time";

// ---------------------------------------------------------------------------
// POST /api/exports/tax-package — Annual Tax Package
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    const body = (await request.json()) as {
      taxYear?: number;
    };
    const taxYear = body.taxYear ?? todayParts().year;
    const startDate = `${taxYear}-01-01`;
    const endDate = `${taxYear}-12-31`;

    const financialModel = await loadFinancialModel(prisma);

    const settings = await prisma.companySettings.findUnique({
      where: { id: "singleton" },
      select: {
        businessName: true,
        ownerName: true,
        contractor1099Threshold: true,
        mileageRate: true,
      },
    });
    const threshold = settings?.contractor1099Threshold ?? 600;

    // --- P&L Summary ---
    const jobs = await prisma.job.findMany({
      where: {
        status: { in: ["COMPLETED", "INVOICED"] },
        scheduledDate: { gte: startDate, lte: endDate },
      },
      include: {
        ...jobIncludeForReports,
        property: { select: { id: true, name: true } },
      },
    });

    const fin = computeJobFinancials(jobs, financialModel);

    const expenses = await prisma.expense.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        isDeductible: true,
      },
      include: {
        category: {
          select: {
            name: true,
            scheduleCLine: true,
            parent: { select: { name: true, scheduleCLine: true } },
          },
        },
      },
    });

    const totalExpenses = r2(expenses.reduce((sum, e) => sum + e.amount, 0));

    // --- Schedule C Mapping ---
    const lineMap = new Map<
      string,
      { categories: Set<string>; total: number }
    >();

    for (const exp of expenses) {
      const line =
        exp.category.scheduleCLine ??
        exp.category.parent?.scheduleCLine ??
        "Other expenses";
      const existing = lineMap.get(line);
      if (existing) {
        existing.total += exp.amount;
        existing.categories.add(exp.category.name);
      } else {
        lineMap.set(line, {
          categories: new Set([exp.category.name]),
          total: exp.amount,
        });
      }
    }

    const scheduleCLines = Array.from(lineMap.entries())
      .map(([line, data]) => ({
        scheduleCLine: line,
        categories: Array.from(data.categories),
        total: r2(data.total),
      }))
      .sort((a, b) => a.scheduleCLine.localeCompare(b.scheduleCLine));

    // --- Mileage Summary ---
    const mileageLogs = await prisma.mileageLog.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      select: { miles: true, deductionAmount: true },
    });

    const totalMiles = r2(mileageLogs.reduce((sum, m) => sum + m.miles, 0));
    const totalMileageDeduction = r2(
      mileageLogs.reduce((sum, m) => sum + m.deductionAmount, 0)
    );

    // --- Revenue by Property ---
    const propertyMap = new Map<
      string,
      { propertyName: string; revenue: number; jobCount: number }
    >();
    for (const job of jobs) {
      const pid = job.propertyId;
      const existing = propertyMap.get(pid);
      if (existing) {
        existing.revenue += job.totalFee;
        existing.jobCount += 1;
      } else {
        propertyMap.set(pid, {
          propertyName: (job as any).property.name,
          revenue: job.totalFee,
          jobCount: 1,
        });
      }
    }

    const revenueByProperty = Array.from(propertyMap.entries())
      .map(([propertyId, data]) => ({
        propertyId,
        ...data,
        revenue: r2(data.revenue),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // --- Team Payouts ---
    const payPeriods = await prisma.payPeriod.findMany({
      where: {
        status: { in: ["closed", "paid"] },
        endDate: { gte: startDate, lte: endDate },
      },
      include: {
        payStatements: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                taxIdOnFile: true,
                mailingAddress: true,
              },
            },
          },
        },
      },
    });

    const totalLabor = r2(
      payPeriods.reduce(
        (sum, pp) =>
          sum + pp.payStatements.reduce((s, ps) => s + ps.grossPay, 0),
        0
      )
    );

    // Accrual labor cost for the P&L summary: what the team earns on the
    // year's jobs (worker pool + owner payouts), matching /reports/pnl.
    let laborCost = 0;
    for (const worker of fin.perWorkerTotals.values()) {
      laborCost += worker.totalPay;
    }
    laborCost = r2(laborCost);

    // --- 1099 Summary ---
    // 1099-NEC reports amounts ACTUALLY PAID: frozen pay statements from the
    // year's pay periods that were marked paid — matching /reports/1099-summary.
    const workerMap = new Map<
      string,
      {
        name: string;
        totalPaid: number;
        w9OnFile: boolean;
        hasMailingAddress: boolean;
      }
    >();
    for (const pp of payPeriods) {
      if (pp.status !== "paid") continue;
      for (const ps of pp.payStatements) {
        const existing = workerMap.get(ps.userId);
        if (existing) {
          existing.totalPaid += ps.grossPay;
        } else {
          workerMap.set(ps.userId, {
            name: ps.user.name,
            totalPaid: ps.grossPay,
            w9OnFile: ps.user.taxIdOnFile ?? false,
            hasMailingAddress: !!ps.user.mailingAddress,
          });
        }
      }
    }

    const workers1099 = Array.from(workerMap.entries()).map(
      ([userId, data]) => ({
        userId,
        name: data.name,
        totalPaid: r2(data.totalPaid),
        requires1099: data.totalPaid >= threshold,
        w9OnFile: data.w9OnFile,
        hasMailingAddress: data.hasMailingAddress,
      })
    );
    workers1099.sort((a, b) => b.totalPaid - a.totalPaid);

    return success({
      taxYear,
      businessName: settings?.businessName ?? "",
      ownerName: settings?.ownerName ?? "",
      generatedAt: new Date().toISOString(),

      pnlSummary: {
        grossRevenue: fin.totalGrossRevenue,
        houseCut: fin.totalHouseCut,
        netRevenue: fin.totalNetRevenue,
        totalExpenses,
        // Accrual labor for the year's jobs — matches /reports/pnl laborCost
        totalLabor: laborCost,
        totalMileageDeduction,
        netProfit: r2(
          fin.totalNetRevenue - totalExpenses - laborCost - totalMileageDeduction
        ),
      },

      scheduleCMapping: {
        expenseLines: scheduleCLines,
        labor: { scheduleCLine: "Contract labor", total: totalLabor },
        mileage: {
          scheduleCLine: "Car and truck expenses",
          total: totalMileageDeduction,
        },
      },

      expenseSummary: {
        total: totalExpenses,
        expenseCount: expenses.length,
      },

      mileageSummary: {
        totalTrips: mileageLogs.length,
        totalMiles,
        totalDeduction: totalMileageDeduction,
        rate: settings?.mileageRate ?? 0.7,
      },

      summary1099: {
        threshold,
        workers: workers1099,
      },

      revenueByProperty,
    });
  } catch (err) {
    console.error("[POST /api/exports/tax-package]", err);
    return error("Failed to generate tax package", 500);
  }
}

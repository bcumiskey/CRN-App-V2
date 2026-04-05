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
    const now = new Date();
    const taxYear = body.taxYear ?? now.getFullYear();
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

    // --- 1099 Summary ---
    const allWorkerIds = Array.from(fin.perWorkerTotals.keys());
    const users = await prisma.user.findMany({
      where: { id: { in: allWorkerIds } },
      select: { id: true, taxIdOnFile: true, mailingAddress: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const workers1099 = Array.from(fin.perWorkerTotals.entries()).map(
      ([userId, data]) => {
        const user = userMap.get(userId);
        return {
          userId,
          name: data.name,
          totalPaid: r2(data.totalPay),
          requires1099: data.totalPay >= threshold,
          w9OnFile: user?.taxIdOnFile ?? false,
        };
      }
    );
    workers1099.sort((a, b) => b.totalPaid - a.totalPaid);

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
        payStatements: { select: { grossPay: true } },
      },
    });

    const totalLabor = r2(
      payPeriods.reduce(
        (sum, pp) =>
          sum + pp.payStatements.reduce((s, ps) => s + ps.grossPay, 0),
        0
      )
    );

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
        totalLabor,
        totalMileageDeduction,
        netProfit: r2(
          fin.totalNetRevenue - totalExpenses - totalLabor - totalMileageDeduction
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

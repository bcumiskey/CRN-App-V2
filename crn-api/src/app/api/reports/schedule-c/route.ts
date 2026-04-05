import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { resolveDateRange } from "@/lib/date-ranges";
import { r2 } from "@/lib/report-utils";

// ---------------------------------------------------------------------------
// GET /api/reports/schedule-c — Schedule C Mapping
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

    // Expenses in range with category → scheduleCLine
    const expenses = await prisma.expense.findMany({
      where: {
        date: { gte: range.startDate, lte: range.endDate },
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

    // Group by Schedule C line
    const lineMap = new Map<
      string,
      { lineName: string; categories: Set<string>; total: number }
    >();

    for (const exp of expenses) {
      // Use the most specific scheduleCLine (category > parent > "Other expenses")
      const line =
        exp.category.scheduleCLine ??
        exp.category.parent?.scheduleCLine ??
        "Other expenses";

      const existing = lineMap.get(line);
      const catName = exp.category.name;
      if (existing) {
        existing.total += exp.amount;
        existing.categories.add(catName);
      } else {
        lineMap.set(line, {
          lineName: line,
          categories: new Set([catName]),
          total: exp.amount,
        });
      }
    }

    const expenseLines = Array.from(lineMap.values())
      .map((entry) => ({
        scheduleCLine: entry.lineName,
        categories: Array.from(entry.categories),
        total: r2(entry.total),
      }))
      .sort((a, b) => a.scheduleCLine.localeCompare(b.scheduleCLine));

    // Labor (team payouts) — from closed pay periods in the range
    const payPeriods = await prisma.payPeriod.findMany({
      where: {
        status: { in: ["closed", "paid"] },
        endDate: { gte: range.startDate, lte: range.endDate },
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

    // Mileage deduction
    const mileageLogs = await prisma.mileageLog.findMany({
      where: {
        date: { gte: range.startDate, lte: range.endDate },
      },
      select: { deductionAmount: true },
    });

    const totalMileageDeduction = r2(
      mileageLogs.reduce((sum, m) => sum + m.deductionAmount, 0)
    );

    const totalExpenses = r2(
      expenses.reduce((sum, e) => sum + e.amount, 0)
    );

    return success({
      ...range,
      expenseLines,
      totalExpenses,
      labor: {
        scheduleCLine: "Contract labor",
        total: totalLabor,
      },
      mileage: {
        scheduleCLine: "Car and truck expenses",
        total: totalMileageDeduction,
      },
      grandTotal: r2(totalExpenses + totalLabor + totalMileageDeduction),
    });
  } catch (err) {
    console.error("[GET /api/reports/schedule-c]", err);
    return error("Failed to compute Schedule C mapping", 500);
  }
}

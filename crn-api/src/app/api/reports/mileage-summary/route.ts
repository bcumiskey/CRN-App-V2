import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { resolveDateRange } from "@/lib/date-ranges";
import { r2 } from "@/lib/report-utils";

// ---------------------------------------------------------------------------
// GET /api/reports/mileage-summary — Mileage Summary
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

    const logs = await prisma.mileageLog.findMany({
      where: {
        date: { gte: range.startDate, lte: range.endDate },
      },
      select: {
        date: true,
        miles: true,
        ratePerMile: true,
        deductionAmount: true,
      },
      orderBy: { date: "asc" },
    });

    // Monthly breakdown
    const monthMap = new Map<
      string,
      { trips: number; miles: number; deduction: number; rate: number }
    >();

    for (const log of logs) {
      const month = log.date.substring(0, 7);
      const existing = monthMap.get(month);
      if (existing) {
        existing.trips += 1;
        existing.miles += log.miles;
        existing.deduction += log.deductionAmount;
        // Keep the latest rate for the month
        existing.rate = log.ratePerMile;
      } else {
        monthMap.set(month, {
          trips: 1,
          miles: log.miles,
          deduction: log.deductionAmount,
          rate: log.ratePerMile,
        });
      }
    }

    const months = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        trips: data.trips,
        miles: r2(data.miles),
        rate: data.rate,
        deduction: r2(data.deduction),
      }));

    const totalTrips = logs.length;
    const totalMiles = r2(logs.reduce((sum, l) => sum + l.miles, 0));
    const totalDeduction = r2(
      logs.reduce((sum, l) => sum + l.deductionAmount, 0)
    );

    return success({
      ...range,
      totalTrips,
      totalMiles,
      totalDeduction,
      months,
    });
  } catch (err) {
    console.error("[GET /api/reports/mileage-summary]", err);
    return error("Failed to compute mileage summary report", 500);
  }
}

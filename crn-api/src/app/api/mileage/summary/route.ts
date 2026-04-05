import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";

// ---------------------------------------------------------------------------
// GET /api/mileage/summary — Period mileage summary
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const params = request.nextUrl.searchParams;
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");

  try {
    const where: Record<string, unknown> = {};
    if (startDate || endDate) {
      where.date = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      };
    }

    const entries = await prisma.mileageLog.findMany({
      where,
      select: { miles: true, deductionAmount: true },
    });

    const settings = await prisma.companySettings.findUnique({
      where: { id: "singleton" },
      select: { mileageRate: true },
    });

    const totalTrips = entries.length;
    const totalMiles = Math.round(
      entries.reduce((sum, e) => sum + e.miles, 0) * 100
    ) / 100;
    const totalDeduction = Math.round(
      entries.reduce((sum, e) => sum + e.deductionAmount, 0) * 100
    ) / 100;

    return success({
      totalTrips,
      totalMiles,
      totalDeduction,
      currentRate: settings?.mileageRate ?? 0.70,
    });
  } catch (err) {
    console.error("[GET /api/mileage/summary]", err);
    return error("Failed to compute mileage summary", 500);
  }
}

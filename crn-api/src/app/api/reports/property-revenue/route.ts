import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { resolveDateRange } from "@/lib/date-ranges";
import { loadFinancialModel, r2 } from "@/lib/report-utils";
import { calculateJob } from "crn-shared";
import type { FinancialModel } from "crn-shared";

// ---------------------------------------------------------------------------
// GET /api/reports/property-revenue — Revenue by Property
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

    const jobs = await prisma.job.findMany({
      where: {
        status: { in: ["COMPLETED", "INVOICED"] },
        scheduledDate: { gte: range.startDate, lte: range.endDate },
      },
      include: {
        property: { select: { id: true, name: true } },
        assignments: {
          include: {
            user: { select: { id: true, name: true, isOwner: true } },
          },
        },
        charges: { select: { amount: true } },
      },
    });

    const map = new Map<
      string,
      {
        propertyName: string;
        jobCount: number;
        totalRevenue: number;
        houseCutTotal: number;
        netToCRN: number;
      }
    >();

    for (const job of jobs) {
      const r = calcResult(job, financialModel);
      const pid = job.propertyId;
      const existing = map.get(pid);
      if (existing) {
        existing.jobCount += 1;
        existing.totalRevenue += r.grossRevenue;
        existing.houseCutTotal += r.houseCutAmount;
        existing.netToCRN += r.netRevenue;
      } else {
        map.set(pid, {
          propertyName: job.property.name,
          jobCount: 1,
          totalRevenue: r.grossRevenue,
          houseCutTotal: r.houseCutAmount,
          netToCRN: r.netRevenue,
        });
      }
    }

    const properties = Array.from(map.entries())
      .map(([propertyId, data]) => ({
        propertyId,
        propertyName: data.propertyName,
        jobCount: data.jobCount,
        totalRevenue: r2(data.totalRevenue),
        avgPerJob: r2(data.totalRevenue / data.jobCount),
        houseCutTotal: r2(data.houseCutTotal),
        netToCRN: r2(data.netToCRN),
      }))
      .sort((a, b) => b.netToCRN - a.netToCRN);

    return success({
      ...range,
      propertyCount: properties.length,
      properties,
    });
  } catch (err) {
    console.error("[GET /api/reports/property-revenue]", err);
    return error("Failed to compute property revenue report", 500);
  }
}

function calcResult(job: any, model: FinancialModel) {
  return calculateJob(model, {
    totalFee: job.totalFee,
    houseCutPercent: job.houseCutPercent,
    charges: job.charges.map((c: any) => ({ amount: c.amount })),
    assignments: job.assignments.map((a: any) => ({
      userId: a.userId,
      userName: a.user.name,
      share: a.share,
      isOwner: a.user.isOwner,
    })),
  });
}

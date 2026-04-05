import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { resolveDateRange } from "@/lib/date-ranges";
import { loadFinancialModel, r2 } from "@/lib/report-utils";
import { calculateJob } from "crn-shared";
import type { FinancialModel } from "crn-shared";

// ---------------------------------------------------------------------------
// GET /api/reports/property-profitability — Property Profitability
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
        revenue: number;
        laborCost: number;
      }
    >();

    for (const job of jobs) {
      const r = calcResult(job, financialModel);
      const pid = job.propertyId;
      const existing = map.get(pid);
      if (existing) {
        existing.jobCount += 1;
        existing.revenue += r.netRevenue;
        existing.laborCost += r.workerPoolAmount;
      } else {
        map.set(pid, {
          propertyName: job.property.name,
          jobCount: 1,
          revenue: r.netRevenue,
          laborCost: r.workerPoolAmount,
        });
      }
    }

    const properties = Array.from(map.entries())
      .map(([propertyId, data]) => {
        const profit = r2(data.revenue - data.laborCost);
        const margin =
          data.revenue > 0
            ? r2((profit / data.revenue) * 100)
            : 0;
        return {
          propertyId,
          propertyName: data.propertyName,
          jobCount: data.jobCount,
          revenue: r2(data.revenue),
          laborCost: r2(data.laborCost),
          profit,
          margin,
        };
      })
      .sort((a, b) => b.profit - a.profit);

    return success({
      ...range,
      propertyCount: properties.length,
      properties,
    });
  } catch (err) {
    console.error("[GET /api/reports/property-profitability]", err);
    return error("Failed to compute property profitability report", 500);
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

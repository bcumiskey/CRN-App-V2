import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { resolveDateRange } from "@/lib/date-ranges";
import { loadFinancialModel, r2 } from "@/lib/report-utils";
import { calculateJob } from "crn-shared";
import type { FinancialModel } from "crn-shared";

// ---------------------------------------------------------------------------
// GET /api/reports/labor-cost — Labor Cost Analysis
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

    let totalLaborCost = 0;
    let totalNetRevenue = 0;
    let totalCrewSize = 0;

    // By property
    const byProperty = new Map<
      string,
      { propertyName: string; laborCost: number; jobCount: number }
    >();
    // By job type
    const byJobType = new Map<
      string,
      { laborCost: number; jobCount: number }
    >();

    for (const job of jobs) {
      const r = calc(job, financialModel);
      totalLaborCost += r.workerPoolAmount;
      totalNetRevenue += r.netRevenue;
      totalCrewSize += job.assignments.length;

      // By property
      const pid = job.propertyId;
      const ep = byProperty.get(pid);
      if (ep) {
        ep.laborCost += r.workerPoolAmount;
        ep.jobCount += 1;
      } else {
        byProperty.set(pid, {
          propertyName: job.property.name,
          laborCost: r.workerPoolAmount,
          jobCount: 1,
        });
      }

      // By job type
      const jt = (job as any).jobType as string;
      const et = byJobType.get(jt);
      if (et) {
        et.laborCost += r.workerPoolAmount;
        et.jobCount += 1;
      } else {
        byJobType.set(jt, {
          laborCost: r.workerPoolAmount,
          jobCount: 1,
        });
      }
    }

    const jobCount = jobs.length;

    const propertyBreakdown = Array.from(byProperty.entries())
      .map(([propertyId, d]) => ({
        propertyId,
        propertyName: d.propertyName,
        laborCost: r2(d.laborCost),
        jobCount: d.jobCount,
        avgPerJob: r2(d.jobCount > 0 ? d.laborCost / d.jobCount : 0),
      }))
      .sort((a, b) => b.laborCost - a.laborCost);

    const jobTypeBreakdown = Array.from(byJobType.entries())
      .map(([jobType, d]) => ({
        jobType,
        laborCost: r2(d.laborCost),
        jobCount: d.jobCount,
        avgPerJob: r2(d.jobCount > 0 ? d.laborCost / d.jobCount : 0),
      }))
      .sort((a, b) => b.laborCost - a.laborCost);

    return success({
      ...range,
      totalLaborCost: r2(totalLaborCost),
      laborAsPercentOfRevenue:
        totalNetRevenue > 0
          ? r2((totalLaborCost / totalNetRevenue) * 100)
          : 0,
      avgCrewSize: jobCount > 0 ? r2(totalCrewSize / jobCount) : 0,
      avgLaborCostPerJob:
        jobCount > 0 ? r2(totalLaborCost / jobCount) : 0,
      jobCount,
      byProperty: propertyBreakdown,
      byJobType: jobTypeBreakdown,
    });
  } catch (err) {
    console.error("[GET /api/reports/labor-cost]", err);
    return error("Failed to compute labor cost report", 500);
  }
}

function calc(job: any, model: FinancialModel) {
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

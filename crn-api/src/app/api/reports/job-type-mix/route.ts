import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { resolveDateRange } from "@/lib/date-ranges";
import { loadFinancialModel, r2 } from "@/lib/report-utils";
import { calculateJob } from "crn-shared";
import type { FinancialModel } from "crn-shared";

// ---------------------------------------------------------------------------
// GET /api/reports/job-type-mix — Job Type Mix
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
        assignments: {
          include: {
            user: { select: { id: true, name: true, isOwner: true } },
          },
        },
        charges: { select: { amount: true } },
      },
    });

    const typeMap = new Map<
      string,
      { count: number; grossRevenue: number }
    >();

    for (const job of jobs) {
      const jt = (job as any).jobType as string;
      const r = calculateJob(financialModel, {
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

      const existing = typeMap.get(jt);
      if (existing) {
        existing.count += 1;
        existing.grossRevenue += r.grossRevenue;
      } else {
        typeMap.set(jt, { count: 1, grossRevenue: r.grossRevenue });
      }
    }

    const totalJobs = jobs.length;
    const totalRevenue = Array.from(typeMap.values()).reduce(
      (sum, d) => sum + d.grossRevenue,
      0
    );

    const types = Array.from(typeMap.entries())
      .map(([jobType, data]) => ({
        jobType,
        count: data.count,
        countPercentage: totalJobs > 0 ? r2((data.count / totalJobs) * 100) : 0,
        grossRevenue: r2(data.grossRevenue),
        revenuePercentage:
          totalRevenue > 0
            ? r2((data.grossRevenue / totalRevenue) * 100)
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return success({
      ...range,
      totalJobs,
      totalGrossRevenue: r2(totalRevenue),
      types,
    });
  } catch (err) {
    console.error("[GET /api/reports/job-type-mix]", err);
    return error("Failed to compute job type mix report", 500);
  }
}

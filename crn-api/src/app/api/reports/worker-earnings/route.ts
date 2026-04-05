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
// GET /api/reports/worker-earnings — Worker Earnings
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

    // Load 1099 threshold
    const settings = await prisma.companySettings.findUnique({
      where: { id: "singleton" },
      select: { contractor1099Threshold: true },
    });
    const threshold = settings?.contractor1099Threshold ?? 600;

    const jobs = await prisma.job.findMany({
      where: {
        status: { in: ["COMPLETED", "INVOICED"] },
        scheduledDate: { gte: range.startDate, lte: range.endDate },
      },
      include: jobIncludeForReports,
    });

    const fin = computeJobFinancials(jobs, financialModel);

    const workers = Array.from(fin.perWorkerTotals.entries()).map(
      ([userId, data]) => ({
        userId,
        name: data.name,
        jobsWorked: data.jobCount,
        totalShares: r2(data.totalShares),
        workerPoolPay: r2(data.workerPoolPay),
        ownerPay: r2(data.ownerPay),
        totalPay: r2(data.totalPay),
        avgPerJob: r2(
          data.jobCount > 0 ? data.totalPay / data.jobCount : 0
        ),
        above1099Threshold: data.totalPay >= threshold,
      })
    );

    workers.sort((a, b) => b.totalPay - a.totalPay);

    return success({
      ...range,
      threshold1099: threshold,
      workerCount: workers.length,
      totalLaborCost: fin.totalWorkerPool,
      workers,
    });
  } catch (err) {
    console.error("[GET /api/reports/worker-earnings]", err);
    return error("Failed to compute worker earnings report", 500);
  }
}

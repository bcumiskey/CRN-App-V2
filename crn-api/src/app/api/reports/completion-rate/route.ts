import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { resolveDateRange } from "@/lib/date-ranges";
import { r2 } from "@/lib/report-utils";

// ---------------------------------------------------------------------------
// GET /api/reports/completion-rate — Completion Rate
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

    const jobs = await prisma.job.findMany({
      where: {
        scheduledDate: { gte: range.startDate, lte: range.endDate },
      },
      select: {
        status: true,
        scheduledDate: true,
      },
    });

    let scheduled = 0;
    let completed = 0;
    let cancelled = 0;

    // Monthly trend
    const monthMap = new Map<
      string,
      { scheduled: number; completed: number; cancelled: number }
    >();

    for (const job of jobs) {
      const month = job.scheduledDate.substring(0, 7);

      if (!monthMap.has(month)) {
        monthMap.set(month, { scheduled: 0, completed: 0, cancelled: 0 });
      }
      const m = monthMap.get(month)!;

      scheduled += 1;
      m.scheduled += 1;

      if (
        job.status === "COMPLETED" ||
        job.status === "INVOICED"
      ) {
        completed += 1;
        m.completed += 1;
      } else if (job.status === "CANCELLED") {
        cancelled += 1;
        m.cancelled += 1;
      }
    }

    const denominator = completed + cancelled;
    const completionRate =
      denominator > 0 ? r2((completed / denominator) * 100) : 100;

    const monthlyTrend = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => {
        const denom = data.completed + data.cancelled;
        return {
          month,
          scheduled: data.scheduled,
          completed: data.completed,
          cancelled: data.cancelled,
          completionRate:
            denom > 0 ? r2((data.completed / denom) * 100) : 100,
        };
      });

    return success({
      ...range,
      totalScheduled: scheduled,
      totalCompleted: completed,
      totalCancelled: cancelled,
      completionRate,
      monthlyTrend,
    });
  } catch (err) {
    console.error("[GET /api/reports/completion-rate]", err);
    return error("Failed to compute completion rate report", 500);
  }
}

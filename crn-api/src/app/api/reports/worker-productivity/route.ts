import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { resolveDateRange } from "@/lib/date-ranges";
import { loadFinancialModel, r2 } from "@/lib/report-utils";
import { calculateJob } from "crn-shared";
import type { FinancialModel } from "crn-shared";

// ---------------------------------------------------------------------------
// GET /api/reports/worker-productivity — Worker Productivity
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

    // Get completed jobs
    const completedJobs = await prisma.job.findMany({
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

    // Get cancelled jobs that had assignments (for consistency metric)
    const cancelledJobs = await prisma.job.findMany({
      where: {
        status: "CANCELLED",
        scheduledDate: { gte: range.startDate, lte: range.endDate },
      },
      include: {
        assignments: {
          select: { userId: true },
        },
      },
    });

    // Calculate weeks in range
    const weeksInRange = calcWeeksInRange(range.startDate, range.endDate);

    // Per worker: completed jobs, total shares, cancelled after assignment
    const workerMap = new Map<
      string,
      {
        name: string;
        completedJobs: number;
        totalShares: number;
        cancelledAfterAssignment: number;
      }
    >();

    for (const job of completedJobs) {
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

      for (const wp of r.workerPayments) {
        const existing = workerMap.get(wp.userId);
        if (existing) {
          existing.completedJobs += 1;
          existing.totalShares += wp.share;
        } else {
          workerMap.set(wp.userId, {
            name: wp.userName,
            completedJobs: 1,
            totalShares: wp.share,
            cancelledAfterAssignment: 0,
          });
        }
      }
    }

    // Count cancellations per worker
    for (const job of cancelledJobs) {
      for (const assignment of job.assignments) {
        const existing = workerMap.get(assignment.userId);
        if (existing) {
          existing.cancelledAfterAssignment += 1;
        }
        // If worker only had cancellations but no completions, skip them
      }
    }

    const workers = Array.from(workerMap.entries())
      .map(([userId, data]) => {
        const total = data.completedJobs + data.cancelledAfterAssignment;
        const consistency =
          total > 0
            ? r2((data.completedJobs / total) * 100)
            : 100;
        return {
          userId,
          name: data.name,
          completedJobs: data.completedJobs,
          avgShare: r2(
            data.completedJobs > 0
              ? data.totalShares / data.completedJobs
              : 0
          ),
          jobsPerWeek: r2(
            weeksInRange > 0 ? data.completedJobs / weeksInRange : 0
          ),
          consistency,
        };
      })
      .sort((a, b) => b.completedJobs - a.completedJobs);

    return success({
      ...range,
      weeksInRange: r2(weeksInRange),
      workerCount: workers.length,
      workers,
    });
  } catch (err) {
    console.error("[GET /api/reports/worker-productivity]", err);
    return error("Failed to compute worker productivity report", 500);
  }
}

function calcWeeksInRange(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  const days = (endMs - startMs) / (1000 * 60 * 60 * 24) + 1;
  return days / 7;
}

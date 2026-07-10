import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { resolveDateRange } from "@/lib/date-ranges";
import { r2 } from "@/lib/report-utils";
import { computePerWorkerEarnings } from "../../pay-periods/earnings";

// ---------------------------------------------------------------------------
// GET /api/reports/worker-earnings — Worker Earnings
//
// Attributed by pay period, not by job scheduledDate, so the figures always
// agree with pay statements (and the 1099 summary, which reads the same
// rows). A period belongs to the range when its endDate falls inside it —
// the same convention the 1099 summary uses and the date close stamps on
// swept jobs as teamPaidDate:
// - closed/paid periods: sum the frozen PayStatement rows (ground truth of
//   what was/will be paid, catch-up jobs included where they were paid).
// - an open period ending in the range: preview the exact sweep its close
//   will run, so the report already matches the eventual statements.
// ---------------------------------------------------------------------------

interface WorkerTotals {
  name: string;
  jobsWorked: number;
  totalShares: number;
  workerPoolPay: number;
  ownerPay: number;
  totalPay: number;
}

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

    // Load 1099 threshold
    const settings = await prisma.companySettings.findUnique({
      where: { id: "singleton" },
      select: { contractor1099Threshold: true },
    });
    const threshold = settings?.contractor1099Threshold ?? 600;

    // Pay periods whose payout lands inside the range
    const periods = await prisma.payPeriod.findMany({
      where: { endDate: { gte: range.startDate, lte: range.endDate } },
      include: {
        payStatements: {
          include: { user: { select: { name: true } } },
        },
      },
      orderBy: { endDate: "asc" },
    });

    const workerMap = new Map<string, WorkerTotals>();
    const accumulate = (userId: string, row: WorkerTotals) => {
      const existing = workerMap.get(userId);
      if (existing) {
        existing.jobsWorked += row.jobsWorked;
        existing.totalShares += row.totalShares;
        existing.workerPoolPay += row.workerPoolPay;
        existing.ownerPay += row.ownerPay;
        existing.totalPay += row.totalPay;
      } else {
        workerMap.set(userId, { ...row });
      }
    };

    // Frozen statements from closed/paid periods (open periods have none)
    for (const period of periods) {
      for (const ps of period.payStatements) {
        accumulate(ps.userId, {
          name: ps.user.name,
          jobsWorked: ps.jobsWorked,
          totalShares: ps.totalShares,
          workerPoolPay: ps.workerPoolPay,
          ownerPay: ps.ownerPay,
          totalPay: ps.grossPay,
        });
      }
    }

    // Live preview for the open period ending in the range. Its close sweeps
    // ALL unpaid completed jobs up to its endDate (no start floor), so a
    // single preview at the latest open endDate covers everything the
    // remaining closes in this range would pay, with no double counting
    // against the frozen statements (the sweep only sees teamPaid=false).
    const openPeriod = [...periods]
      .reverse()
      .find((p) => p.status === "open");
    if (openPeriod) {
      const { workers: liveWorkers } = await computePerWorkerEarnings(
        openPeriod.endDate
      );
      for (const w of liveWorkers) {
        accumulate(w.userId, {
          name: w.userName,
          jobsWorked: w.jobsWorked,
          totalShares: w.totalShares,
          workerPoolPay: w.workerPoolPay,
          ownerPay: w.ownerPay,
          totalPay: w.grossPay,
        });
      }
    }

    const workers = Array.from(workerMap.entries()).map(([userId, data]) => ({
      userId,
      name: data.name,
      jobsWorked: data.jobsWorked,
      totalShares: r2(data.totalShares),
      workerPoolPay: r2(data.workerPoolPay),
      ownerPay: r2(data.ownerPay),
      totalPay: r2(data.totalPay),
      avgPerJob: r2(
        data.jobsWorked > 0 ? data.totalPay / data.jobsWorked : 0
      ),
      above1099Threshold: data.totalPay >= threshold,
    }));

    workers.sort((a, b) => b.totalPay - a.totalPay);

    const totalLaborCost = r2(
      workers.reduce((sum, w) => sum + w.workerPoolPay, 0)
    );

    return success({
      ...range,
      threshold1099: threshold,
      workerCount: workers.length,
      totalLaborCost,
      workers,
    });
  } catch (err) {
    console.error("[GET /api/reports/worker-earnings]", err);
    return error("Failed to compute worker earnings report", 500);
  }
}

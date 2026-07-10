import { prisma } from "@/lib/prisma";
import { calculateJob } from "crn-shared";
import type { FinancialModel } from "crn-shared";

// ---------------------------------------------------------------------------
// Helper: Compute per-worker earnings for a pay period
//
// Lives outside the route.ts files because Next.js route modules may only
// export HTTP method handlers (the build-time route type check rejects any
// other export).
// ---------------------------------------------------------------------------

export interface WorkerEarnings {
  userId: string;
  userName: string;
  jobsWorked: number;
  totalShares: number;
  workerPoolPay: number;
  ownerPay: number;
  grossPay: number;
}

export async function computePerWorkerEarnings(
  endDate: string
): Promise<{ workers: WorkerEarnings[]; jobIds: string[] }> {
  // Load financial model
  const settings = await prisma.companySettings.findUnique({
    where: { id: "singleton" },
    select: { financialModel: true },
  });
  const financialModel = settings?.financialModel as unknown as FinancialModel;

  // Find all completed jobs the team has not yet been paid for, up to the end
  // of the period. There is deliberately no start-date floor: a job completed
  // (or synced/edited) after its own period was closed is swept into the next
  // period that closes, so it can never fall into a permanent gap. Double
  // counting is prevented by the teamPaid flag, which close/ sets on exactly
  // these jobs in the same transaction that freezes the statements.
  const jobs = await prisma.job.findMany({
    where: {
      status: { in: ["COMPLETED", "INVOICED"] },
      teamPaid: false,
      OR: [
        { completedDate: { lte: endDate } },
        { completedDate: null, scheduledDate: { lte: endDate } },
      ],
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

  // Accumulate per-worker totals
  const workerMap = new Map<string, WorkerEarnings>();
  const jobIds: string[] = [];

  for (const job of jobs) {
    if (job.assignments.length === 0) continue;
    jobIds.push(job.id);

    const jobResult = calculateJob(financialModel, {
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

    for (const wp of jobResult.workerPayments) {
      const existing = workerMap.get(wp.userId);
      if (existing) {
        existing.jobsWorked += 1;
        existing.totalShares += wp.share;
        existing.workerPoolPay += wp.workerPoolPay;
        existing.ownerPay += wp.ownerPay;
        existing.grossPay += wp.totalPay;
      } else {
        workerMap.set(wp.userId, {
          userId: wp.userId,
          userName: wp.userName,
          jobsWorked: 1,
          totalShares: wp.share,
          workerPoolPay: wp.workerPoolPay,
          ownerPay: wp.ownerPay,
          grossPay: wp.totalPay,
        });
      }
    }
  }

  // Round accumulated values
  const workers = Array.from(workerMap.values()).map((w) => ({
    ...w,
    totalShares: Math.round(w.totalShares * 100) / 100,
    workerPoolPay: Math.round(w.workerPoolPay * 100) / 100,
    ownerPay: Math.round(w.ownerPay * 100) / 100,
    grossPay: Math.round(w.grossPay * 100) / 100,
  }));

  return {
    workers: workers.sort((a, b) => b.grossPay - a.grossPay),
    jobIds,
  };
}

import { prisma } from "@/lib/prisma";
import { calculateJob } from "crn-shared";
import type { FinancialModel } from "crn-shared";

// ---------------------------------------------------------------------------
// Helper: A single worker's pay for one pay period, using the SAME
// attribution rules as pay-period close (see ../../pay-periods/earnings.ts):
//
// - OPEN period: preview the exact sweep the next close will run — every
//   completed job the team has not yet been paid for (teamPaid=false), up to
//   the period end by completedDate (falling back to scheduledDate), with no
//   start-date floor so catch-up jobs show in the period that will actually
//   pay them.
// - CLOSED/PAID period: the frozen PayStatement row is the ground truth of
//   what was (or will be) paid; the job list is reconstructed from the
//   teamPaidDate stamp close wrote (endDates are unique across periods, so
//   teamPaidDate === period.endDate identifies exactly the swept jobs).
//
// Lives outside the route.ts files because Next.js route modules may only
// export HTTP method handlers.
// ---------------------------------------------------------------------------

export interface WorkerPayJobDetail {
  jobId: string;
  date: string;
  propertyName: string;
  jobType: string;
  yourPay: number;
}

export interface WorkerPeriodPay {
  jobsWorked: number;
  totalEarned: number;
  jobs: WorkerPayJobDetail[];
}

export async function computeWorkerPeriodPay(
  period: { id: string; endDate: string; status: string },
  userId: string,
  financialModel: FinancialModel
): Promise<WorkerPeriodPay> {
  const isOpen = period.status === "open";

  const jobs = await prisma.job.findMany({
    where: isOpen
      ? {
          status: { in: ["COMPLETED", "INVOICED"] },
          teamPaid: false,
          OR: [
            { completedDate: { lte: period.endDate } },
            { completedDate: null, scheduledDate: { lte: period.endDate } },
          ],
          assignments: { some: { userId } },
        }
      : {
          teamPaid: true,
          teamPaidDate: period.endDate,
          assignments: { some: { userId } },
        },
    include: {
      property: { select: { name: true } },
      assignments: {
        include: {
          user: { select: { id: true, name: true, isOwner: true } },
        },
      },
      charges: true,
    },
    orderBy: { scheduledDate: "asc" },
  });

  // Calculate each job and extract this worker's pay
  let totalEarned = 0;
  const jobDetails: WorkerPayJobDetail[] = jobs.map((job) => {
    const calcResult = calculateJob(financialModel, {
      totalFee: job.totalFee,
      houseCutPercent: job.houseCutPercent,
      charges: job.charges.map((c) => ({ amount: c.amount })),
      assignments: job.assignments.map((a) => ({
        userId: a.user.id,
        userName: a.user.name,
        share: a.share,
        isOwner: a.user.isOwner,
      })),
    });

    const workerPayment = calcResult.workerPayments.find(
      (wp) => wp.userId === userId
    );
    // Manual per-assignment adjustment adds on top of the share-based pay.
    const adjustment =
      job.assignments.find((a) => a.user.id === userId)?.payAdjustment ?? 0;
    const yourPay = (workerPayment?.totalPay ?? 0) + adjustment;
    totalEarned += yourPay;

    return {
      jobId: job.id,
      date: job.scheduledDate,
      propertyName: job.property?.name ?? "Unknown",
      jobType: job.jobType,
      yourPay,
    };
  });

  // Accumulate then round once, matching how close freezes statements
  totalEarned = Math.round(totalEarned * 100) / 100;
  let jobsWorked = jobDetails.length;

  // For closed/paid periods the frozen statement wins over the recomputation
  // (a job edited after close cannot change what was actually paid)
  if (!isOpen) {
    const statement = await prisma.payStatement.findUnique({
      where: { payPeriodId_userId: { payPeriodId: period.id, userId } },
    });
    totalEarned = statement?.grossPay ?? 0;
    jobsWorked = statement?.jobsWorked ?? 0;
  }

  return { jobsWorked, totalEarned, jobs: jobDetails };
}

/**
 * Shared report computation helpers.
 *
 * These functions run `calculateJob()` over arrays of jobs and aggregate
 * the results. Every report that needs financial math should use these
 * so the source-of-truth stays in one place.
 */

import { calculateJob } from "crn-shared";
import type { FinancialModel } from "crn-shared";

// ---------------------------------------------------------------------------
// Types matching what Prisma returns when we include assignments + charges
// ---------------------------------------------------------------------------

export interface JobWithRelations {
  id: string;
  totalFee: number;
  houseCutPercent: number;
  assignments: {
    userId: string;
    share: number;
    user: { id: string; name: string; isOwner: boolean };
  }[];
  charges: { amount: number }[];
  [key: string]: unknown; // allow extra fields from Prisma
}

export interface PerWorkerTotals {
  name: string;
  jobCount: number;
  totalShares: number;
  workerPoolPay: number;
  ownerPay: number;
  totalPay: number;
}

export interface AggregatedFinancials {
  totalGrossRevenue: number;
  totalHouseCut: number;
  totalNetRevenue: number;
  totalBusinessExpense: number;
  totalOwnerProfit: number;
  totalWorkerPool: number;
  perWorkerTotals: Map<string, PerWorkerTotals>;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Run `calculateJob()` on every job and return aggregated totals.
 */
export function computeJobFinancials(
  jobs: JobWithRelations[],
  financialModel: FinancialModel
): AggregatedFinancials {
  let totalGrossRevenue = 0;
  let totalHouseCut = 0;
  let totalNetRevenue = 0;
  let totalBusinessExpense = 0;
  let totalOwnerProfit = 0;
  let totalWorkerPool = 0;
  const perWorkerTotals = new Map<string, PerWorkerTotals>();

  for (const job of jobs) {
    if (job.assignments.length === 0) {
      // No assignments — still count revenue but skip worker math
      const result = calculateJob(financialModel, {
        totalFee: job.totalFee,
        houseCutPercent: job.houseCutPercent,
        charges: job.charges.map((c) => ({ amount: c.amount })),
        assignments: [],
      });
      totalGrossRevenue += result.grossRevenue;
      totalHouseCut += result.houseCutAmount;
      totalNetRevenue += result.netRevenue;
      totalBusinessExpense += result.businessExpenseAmount;
      totalOwnerProfit += result.ownerProfitAmount;
      totalWorkerPool += result.workerPoolAmount;
      continue;
    }

    const result = calculateJob(financialModel, {
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

    totalGrossRevenue += result.grossRevenue;
    totalHouseCut += result.houseCutAmount;
    totalNetRevenue += result.netRevenue;
    totalBusinessExpense += result.businessExpenseAmount;
    totalOwnerProfit += result.ownerProfitAmount;
    totalWorkerPool += result.workerPoolAmount;

    // Accumulate per-worker
    for (const wp of result.workerPayments) {
      const existing = perWorkerTotals.get(wp.userId);
      if (existing) {
        existing.jobCount += 1;
        existing.totalShares += wp.share;
        existing.workerPoolPay += wp.workerPoolPay;
        existing.ownerPay += wp.ownerPay;
        existing.totalPay += wp.totalPay;
      } else {
        perWorkerTotals.set(wp.userId, {
          name: wp.userName,
          jobCount: 1,
          totalShares: wp.share,
          workerPoolPay: wp.workerPoolPay,
          ownerPay: wp.ownerPay,
          totalPay: wp.totalPay,
        });
      }
    }
  }

  return {
    totalGrossRevenue: r2(totalGrossRevenue),
    totalHouseCut: r2(totalHouseCut),
    totalNetRevenue: r2(totalNetRevenue),
    totalBusinessExpense: r2(totalBusinessExpense),
    totalOwnerProfit: r2(totalOwnerProfit),
    totalWorkerPool: r2(totalWorkerPool),
    perWorkerTotals,
  };
}

/**
 * Standard Prisma include for jobs needed by report computations.
 */
export const jobIncludeForReports = {
  assignments: {
    include: {
      user: { select: { id: true, name: true, isOwner: true } },
    },
  },
  charges: { select: { amount: true } },
} as const;

/**
 * Load the financial model from company settings.
 */
export async function loadFinancialModel(
  prisma: { companySettings: { findUnique: Function } }
): Promise<FinancialModel> {
  const settings = await prisma.companySettings.findUnique({
    where: { id: "singleton" },
    select: { financialModel: true },
  });
  return settings?.financialModel as unknown as FinancialModel;
}

/**
 * Round a number to two decimal places.
 */
export { r2 };

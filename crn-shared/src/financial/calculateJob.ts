import type {
  FinancialModel,
  JobInput,
  JobResult,
  BucketResult,
  WorkerPayment,
} from "../types";
import { bankersRound } from "./rounding";

/**
 * calculateJob() — The single source of all financial math in CRN V2.
 *
 * This is a pure function. No database calls, no side effects, no state.
 * It takes data in and returns results out. Every view, report, invoice,
 * and paystub calls this function. When inputs change, outputs change.
 *
 * See spec Section 4 for the complete algorithm and rules.
 */
export function calculateJob(
  model: FinancialModel,
  input: JobInput
): JobResult {
  // ── Validate financial model ──────────────────────────────────────
  validateModel(model);

  // ── Step 1: Gross revenue ─────────────────────────────────────────
  const chargesTotal = input.charges.reduce((sum, c) => sum + c.amount, 0);
  const grossRevenue = bankersRound(input.totalFee + chargesTotal);

  // ── Step 2: House cut ─────────────────────────────────────────────
  const houseCutAmount = bankersRound(
    grossRevenue * (input.houseCutPercent / 100)
  );

  // ── Step 3: Net revenue ───────────────────────────────────────────
  const netRevenue = bankersRound(grossRevenue - houseCutAmount);

  // ── Step 4: Bucket allocation ─────────────────────────────────────
  const buckets = allocateBuckets(model, netRevenue);

  // Extract convenience amounts
  const businessExpenseAmount =
    buckets.find((b) => b.type === "business")?.amount ?? 0;
  const ownerProfitAmount =
    buckets.find((b) => b.type === "owner")?.amount ?? 0;
  const workerPoolAmount =
    buckets.find((b) => b.type === "worker_pool")?.amount ?? 0;

  // ── Step 5: Worker payments ───────────────────────────────────────
  const { workerPayments, totalShares, perShareRate } = allocateWorkerPayments(
    input.assignments,
    workerPoolAmount,
    ownerProfitAmount
  );

  return {
    grossRevenue,
    houseCutAmount,
    netRevenue,
    buckets,
    totalShares,
    perShareRate,
    workerPayments,
    chargesTotal: bankersRound(chargesTotal),
    businessExpenseAmount,
    ownerProfitAmount,
    workerPoolAmount,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────

function validateModel(model: FinancialModel): void {
  if (!model.buckets || model.buckets.length === 0) {
    throw new Error(
      "Invalid financial model: must have at least one bucket."
    );
  }

  const totalPercent = model.buckets.reduce((sum, b) => sum + b.percent, 0);

  // Use tolerance for floating point comparison
  if (Math.abs(totalPercent - 100) > 1e-9) {
    throw new Error(
      `Invalid financial model: bucket percentages sum to ${totalPercent}, must equal 100.`
    );
  }
}

/**
 * Allocate net revenue into buckets using banker's rounding,
 * then adjust the worker_pool bucket (or largest bucket) for the remainder
 * so buckets sum to exactly netRevenue.
 */
function allocateBuckets(
  model: FinancialModel,
  netRevenue: number
): BucketResult[] {
  if (netRevenue === 0) {
    return model.buckets.map((b) => ({
      name: b.name,
      type: b.type,
      percent: b.percent,
      amount: 0,
    }));
  }

  // Round each bucket individually
  const buckets: BucketResult[] = model.buckets.map((b) => ({
    name: b.name,
    type: b.type,
    percent: b.percent,
    amount: bankersRound(netRevenue * (b.percent / 100)),
  }));

  // Calculate remainder (netRevenue - sum of rounded buckets)
  const bucketSum = buckets.reduce((sum, b) => sum + b.amount, 0);
  const remainder = bankersRound(netRevenue - bucketSum);

  if (remainder !== 0) {
    // Apply remainder to the worker_pool bucket, or the largest bucket if no worker_pool
    const workerPoolBucket = buckets.find((b) => b.type === "worker_pool");
    const targetBucket =
      workerPoolBucket ??
      buckets.reduce((largest, b) =>
        b.amount > largest.amount ? b : largest
      );
    targetBucket.amount = bankersRound(targetBucket.amount + remainder);
  }

  return buckets;
}

/**
 * Allocate worker pool amount among assigned workers based on shares,
 * and distribute owner profit among owner-flagged workers.
 *
 * Penny remainder goes to the owner-flagged worker, or the first worker
 * if no owner is flagged.
 */
function allocateWorkerPayments(
  assignments: JobInput["assignments"],
  workerPoolAmount: number,
  ownerProfitAmount: number
): {
  workerPayments: WorkerPayment[];
  totalShares: number;
  perShareRate: number;
} {
  if (assignments.length === 0) {
    return {
      workerPayments: [],
      totalShares: 0,
      perShareRate: 0,
    };
  }

  // ── Calculate shares ──────────────────────────────────────────────
  const totalShares = assignments.reduce(
    (sum, a) => sum + (a.share > 0 ? a.share : 0),
    0
  );

  const perShareRate =
    totalShares > 0 ? bankersRound(workerPoolAmount / totalShares) : 0;

  // ── Calculate owner pay ───────────────────────────────────────────
  const ownerCount = assignments.filter((a) => a.isOwner).length;
  const ownerPayPerPerson =
    ownerCount > 0 ? bankersRound(ownerProfitAmount / ownerCount) : 0;

  // ── Calculate per-worker payments ─────────────────────────────────
  const workerPayments: WorkerPayment[] = assignments.map((a) => {
    const workerPoolPay =
      a.share > 0 && totalShares > 0
        ? bankersRound(a.share * perShareRate)
        : 0;
    const ownerPay = a.isOwner ? ownerPayPerPerson : 0;

    return {
      userId: a.userId,
      userName: a.userName,
      share: a.share,
      workerPoolPay,
      ownerPay,
      totalPay: bankersRound(workerPoolPay + ownerPay),
    };
  });

  // ── Handle worker pool remainder ──────────────────────────────────
  // Only apply remainder when shares were actually distributed (totalShares > 0).
  // When all shares are 0, the pool sits undistributed — no remainder adjustment.
  const workerPoolSum = workerPayments.reduce(
    (sum, w) => sum + w.workerPoolPay,
    0
  );
  const poolRemainder = bankersRound(workerPoolAmount - workerPoolSum);

  if (poolRemainder !== 0 && totalShares > 0) {
    // Find the remainder target: owner-flagged worker, or first worker
    const remainderTarget =
      workerPayments.find((w) =>
        assignments.find(
          (a) => a.userId === w.userId && a.isOwner
        )
      ) ?? workerPayments[0];

    if (remainderTarget) {
      remainderTarget.workerPoolPay = bankersRound(
        remainderTarget.workerPoolPay + poolRemainder
      );
      remainderTarget.totalPay = bankersRound(
        remainderTarget.workerPoolPay + remainderTarget.ownerPay
      );
    }
  }

  // ── Handle owner pay remainder ────────────────────────────────────
  if (ownerCount > 0) {
    const ownerPaySum = workerPayments
      .filter((w) => assignments.find((a) => a.userId === w.userId && a.isOwner))
      .reduce((sum, w) => sum + w.ownerPay, 0);
    const ownerRemainder = bankersRound(ownerProfitAmount - ownerPaySum);

    if (ownerRemainder !== 0) {
      const firstOwner = workerPayments.find((w) =>
        assignments.find((a) => a.userId === w.userId && a.isOwner)
      );
      if (firstOwner) {
        firstOwner.ownerPay = bankersRound(firstOwner.ownerPay + ownerRemainder);
        firstOwner.totalPay = bankersRound(
          firstOwner.workerPoolPay + firstOwner.ownerPay
        );
      }
    }
  }

  return {
    workerPayments,
    totalShares,
    perShareRate,
  };
}

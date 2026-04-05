// ============================================================
// Financial Engine Types
// ============================================================

/**
 * A single bucket in the financial model.
 * Buckets define how net revenue is split (e.g., 10% business, 10% owner, 80% worker pool).
 */
export interface FinancialBucket {
  name: string;
  percent: number;
  type: "business" | "owner" | "worker_pool";
}

/**
 * The financial model configuration.
 * Read from CompanySettings.financialModel at runtime.
 * Bucket percentages MUST sum to exactly 100.
 */
export interface FinancialModel {
  buckets: FinancialBucket[];
}

/**
 * Share level preset (for UI display — the engine works with raw decimals).
 */
export interface ShareLevel {
  label: string;
  value: number;
}

/**
 * Full financial model config as stored in CompanySettings.financialModel JSON.
 */
export interface FinancialModelConfig {
  buckets: FinancialBucket[];
  shareLevels: ShareLevel[];
}

/**
 * A single worker assignment as input to calculateJob().
 */
export interface AssignmentInput {
  userId: string;
  userName: string;
  share: number;
  isOwner: boolean;
}

/**
 * An extra charge on a job (pet damage, oven clean, etc.).
 */
export interface ChargeInput {
  amount: number;
}

/**
 * All inputs needed to calculate a job's financial breakdown.
 */
export interface JobInput {
  totalFee: number;
  houseCutPercent: number;
  charges: ChargeInput[];
  assignments: AssignmentInput[];
}

/**
 * A computed bucket in the result.
 */
export interface BucketResult {
  name: string;
  type: string;
  percent: number;
  amount: number;
}

/**
 * Per-worker payment breakdown in the result.
 */
export interface WorkerPayment {
  userId: string;
  userName: string;
  share: number;
  workerPoolPay: number;
  ownerPay: number;
  totalPay: number;
}

/**
 * The complete output of calculateJob().
 * Every dollar amount is rounded to 2 decimal places using banker's rounding.
 */
export interface JobResult {
  // Gross
  grossRevenue: number;
  houseCutAmount: number;
  netRevenue: number;

  // Buckets
  buckets: BucketResult[];

  // Worker pool breakdown
  totalShares: number;
  perShareRate: number;

  // Per-worker detail
  workerPayments: WorkerPayment[];

  // Convenience totals
  chargesTotal: number;
  businessExpenseAmount: number;
  ownerProfitAmount: number;
  workerPoolAmount: number;
}

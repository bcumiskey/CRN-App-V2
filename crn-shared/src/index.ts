// Types
export type {
  FinancialBucket,
  FinancialModel,
  FinancialModelConfig,
  ShareLevel,
  AssignmentInput,
  ChargeInput,
  JobInput,
  BucketResult,
  WorkerPayment,
  JobResult,
} from "./types";

// Financial engine
export { calculateJob, bankersRound } from "./financial";

// Constants
export { DEFAULT_FINANCIAL_MODEL } from "./constants";

// Validators
export {
  FinancialBucketSchema,
  FinancialModelSchema,
  FinancialModelConfigSchema,
  ShareLevelSchema,
  ChargeInputSchema,
  AssignmentInputSchema,
  JobInputSchema,
  DateStringSchema,
  TimeStringSchema,
} from "./validators";

// Business-local dates — the ONE definition of "today".
// Lived only inside crn-api until a UTC-derived date in crn-web put jobs on the
// wrong day after 8pm Eastern. Shared so both apps cannot disagree again.
export {
  businessTimezone,
  businessYMD,
  todayYMD,
  addDaysYMD,
  monthRangeYMD,
  currentMonthYM,
} from "./business-time";

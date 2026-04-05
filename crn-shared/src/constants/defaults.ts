import type { FinancialModelConfig } from "../types";

/**
 * Default Three Buckets financial model.
 * 10% Business Expenses, 10% Owner Profit, 80% Worker Pool.
 */
export const DEFAULT_FINANCIAL_MODEL: FinancialModelConfig = {
  buckets: [
    { name: "Business Expenses", percent: 10, type: "business" },
    { name: "Owner Profit", percent: 10, type: "owner" },
    { name: "Worker Pool", percent: 80, type: "worker_pool" },
  ],
  shareLevels: [
    { label: "Full", value: 1.0 },
    { label: "Three Quarter", value: 0.75 },
    { label: "Half", value: 0.5 },
    { label: "Off", value: 0 },
  ],
};

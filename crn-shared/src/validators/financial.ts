import { z } from "zod";

export const FinancialBucketSchema = z.object({
  name: z.string().min(1),
  percent: z.number().min(0).max(100),
  type: z.enum(["business", "owner", "worker_pool"]),
});

export const FinancialModelSchema = z.object({
  buckets: z.array(FinancialBucketSchema).min(1).refine(
    (buckets) => {
      const total = buckets.reduce((sum, b) => sum + b.percent, 0);
      return Math.abs(total - 100) < 1e-9;
    },
    { message: "Bucket percentages must sum to exactly 100" }
  ),
});

export const ShareLevelSchema = z.object({
  label: z.string().min(1),
  value: z.number().min(0).max(1),
});

export const FinancialModelConfigSchema = z.object({
  buckets: FinancialBucketSchema.array().min(1),
  shareLevels: ShareLevelSchema.array().min(1),
});

export const ChargeInputSchema = z.object({
  amount: z.number(),
});

export const AssignmentInputSchema = z.object({
  userId: z.string().min(1),
  userName: z.string().min(1),
  share: z.number().min(0),
  isOwner: z.boolean(),
});

export const JobInputSchema = z.object({
  totalFee: z.number().min(0),
  houseCutPercent: z.number().min(0).max(100),
  charges: z.array(ChargeInputSchema),
  assignments: z.array(AssignmentInputSchema),
});

/** Date string validator: YYYY-MM-DD format */
export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

/** Time string validator: HH:MM 24-hour format */
export const TimeStringSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format");

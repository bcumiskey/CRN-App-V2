import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/settings — Return the CompanySettings singleton
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    let settings = await prisma.companySettings.findUnique({
      where: { id: "singleton" },
    });

    // Auto-create singleton if it doesn't exist
    if (!settings) {
      settings = await prisma.companySettings.create({
        data: {
          id: "singleton",
          financialModel: {
            buckets: [
              { name: "House", percent: 30, type: "house" },
              { name: "Worker Pool", percent: 70, type: "worker_pool" },
            ],
            shareLevels: [
              { label: "Full", value: 1.0 },
              { label: "Half", value: 0.5 },
              { label: "Training", value: 0.25 },
            ],
          },
        },
      });
    }

    return success(settings);
  } catch (err) {
    console.error("[GET /api/settings]", err);
    return error("Failed to fetch settings", 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/settings — Update company settings
// ---------------------------------------------------------------------------

const bucketSchema = z.object({
  name: z.string().min(1),
  percent: z.number().min(0).max(100),
  type: z.string().min(1),
});

const shareLevelSchema = z.object({
  label: z.string().min(1),
  value: z.number().min(0),
});

const financialModelSchema = z.object({
  buckets: z.array(bucketSchema).min(1),
  shareLevels: z.array(shareLevelSchema).optional(),
});

const updateSettingsSchema = z.object({
  businessName: z.string().min(1).optional(),
  ownerName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  financialModel: financialModelSchema.optional(),
  mileageRate: z.number().min(0).optional(),
  taxYear: z.number().int().optional(),
  contractor1099Threshold: z.number().min(0).optional(),
  payPeriodType: z.enum(["monthly", "biweekly", "weekly"]).optional(),
  defaultPaymentTerms: z.string().optional(),
  invoicePrefix: z.string().optional(),
  invoiceNextNumber: z.number().int().min(1).optional(),
  jobPrefix: z.string().optional(),
  jobNextNumber: z.number().int().min(1).optional(),
  businessHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  businessHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  timezone: z.string().optional(),
});

export async function PATCH(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  // Validate financial model buckets sum to 100
  if (data.financialModel) {
    const bucketSum = data.financialModel.buckets.reduce(
      (sum, b) => sum + b.percent,
      0
    );
    if (Math.abs(bucketSum - 100) > 0.01) {
      return error(
        `Financial model buckets must sum to 100 (currently ${bucketSum})`,
        400
      );
    }
  }

  try {
    const settings = await prisma.companySettings.update({
      where: { id: "singleton" },
      data,
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "settings",
      entityId: "singleton",
      summary: `Updated settings: ${Object.keys(data).join(", ")}`,
      details: { fields: Object.keys(data) },
    });

    return success(settings);
  } catch (err) {
    console.error("[PATCH /api/settings]", err);
    return error("Failed to update settings", 500);
  }
}

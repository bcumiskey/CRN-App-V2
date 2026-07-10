import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, created, error, validationError } from "@/lib/responses";
import { addDaysYMD, todayParts } from "@/lib/business-time";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/pay-periods — List pay periods
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    const periods = await prisma.payPeriod.findMany({
      include: {
        _count: { select: { payStatements: true } },
      },
      orderBy: { startDate: "desc" },
    });

    return success({ periods });
  } catch (err) {
    console.error("[GET /api/pay-periods]", err);
    return error("Failed to fetch pay periods", 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/pay-periods — Create pay period
// ---------------------------------------------------------------------------

const createPayPeriodSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional(),
});

/**
 * Auto-detect next pay period dates based on company settings.
 */
async function autoDetectDates(): Promise<{ startDate: string; endDate: string }> {
  const settings = await prisma.companySettings.findUnique({
    where: { id: "singleton" },
    select: { payPeriodType: true },
  });

  // Find the most recent pay period to compute the next one
  const lastPeriod = await prisma.payPeriod.findFirst({
    orderBy: { endDate: "desc" },
    select: { endDate: true },
  });

  const type = settings?.payPeriodType ?? "monthly";

  if (lastPeriod) {
    // Start day after last period ended
    const startDate = addDaysYMD(lastPeriod.endDate, 1);

    let endDate: string;
    if (type === "weekly") {
      endDate = addDaysYMD(startDate, 6);
    } else if (type === "biweekly") {
      endDate = addDaysYMD(startDate, 13);
    } else {
      // monthly: go to end of start's month
      const [y, m] = startDate.split("-").map((p) => parseInt(p, 10));
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      endDate = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    }

    return { startDate, endDate };
  }

  // No previous period — default to current month (business timezone)
  const { year, month } = todayParts();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return { startDate, endDate };
}

export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = createPayPeriodSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    let startDate: string;
    let endDate: string;

    if (data.startDate && data.endDate) {
      startDate = data.startDate;
      endDate = data.endDate;
    } else {
      const auto = await autoDetectDates();
      startDate = auto.startDate;
      endDate = auto.endDate;
    }

    // Check for overlapping periods
    const overlap = await prisma.payPeriod.findFirst({
      where: {
        OR: [
          { startDate: { lte: endDate }, endDate: { gte: startDate } },
        ],
      },
    });
    if (overlap) {
      return error(
        `Pay period overlaps with existing period ${overlap.startDate} to ${overlap.endDate}`,
        409
      );
    }

    const period = await prisma.payPeriod.create({
      data: { startDate, endDate },
    });

    await logAudit({
      userId: result.user.userId,
      action: "create",
      entityType: "pay_period",
      entityId: period.id,
      summary: `Created pay period ${startDate} to ${endDate}`,
    });

    return created(period);
  } catch (err) {
    console.error("[POST /api/pay-periods]", err);
    return error("Failed to create pay period", 500);
  }
}

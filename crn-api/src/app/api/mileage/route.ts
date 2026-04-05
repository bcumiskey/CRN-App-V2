import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, created, error, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/mileage — List mileage entries
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const params = request.nextUrl.searchParams;
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");
  const limit = Math.min(Number(params.get("limit") || 50), 200);
  const offset = Number(params.get("offset") || 0);

  const where: Record<string, unknown> = {};
  if (startDate || endDate) {
    where.date = {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {}),
    };
  }

  try {
    const [entries, total] = await Promise.all([
      prisma.mileageLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true } },
        },
        orderBy: { date: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.mileageLog.count({ where }),
    ]);

    return success({ entries, total, limit, offset });
  } catch (err) {
    console.error("[GET /api/mileage]", err);
    return error("Failed to fetch mileage entries", 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/mileage — Create mileage entry
// ---------------------------------------------------------------------------

const createMileageSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  miles: z.number().min(0),
  startLocation: z.string().optional(),
  endLocation: z.string().optional(),
  purpose: z.string().optional(),
  userId: z.string().optional(),
  jobId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = createMileageSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    // Snapshot current mileage rate from settings
    const settings = await prisma.companySettings.findUnique({
      where: { id: "singleton" },
      select: { mileageRate: true },
    });
    const ratePerMile = settings?.mileageRate ?? 0.70;
    const deductionAmount = Math.round(data.miles * ratePerMile * 100) / 100;

    const entry = await prisma.mileageLog.create({
      data: {
        userId: data.userId ?? result.user.userId,
        date: data.date,
        miles: data.miles,
        startLocation: data.startLocation,
        endLocation: data.endLocation,
        purpose: data.purpose,
        jobId: data.jobId,
        ratePerMile,
        deductionAmount,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "create",
      entityType: "mileage",
      entityId: entry.id,
      summary: `Logged ${data.miles} miles on ${data.date}`,
    });

    return created(entry);
  } catch (err) {
    console.error("[POST /api/mileage]", err);
    return error("Failed to create mileage entry", 500);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, created, error, validationError } from "@/lib/responses";
import { generateJobNumber } from "@/lib/job-numbers";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/jobs — List jobs with filters
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const propertyId = params.get("propertyId");
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");
  const month = params.get("month");
  const year = params.get("year");
  const clientPaid = params.get("clientPaid");
  const teamPaid = params.get("teamPaid");
  const limit = Math.min(Number(params.get("limit") || 500), 500);
  const offset = Number(params.get("offset") || 0);

  const where: Record<string, unknown> = {};
  if (status) {
    // Support comma-separated status values
    const statuses = status.split(",").map(s => s.trim()).filter(Boolean);
    if (statuses.length === 1) where.status = statuses[0];
    else if (statuses.length > 1) where.status = { in: statuses };
  }
  if (propertyId) where.propertyId = propertyId;
  if (clientPaid !== null && clientPaid !== undefined && clientPaid !== "")
    where.clientPaid = clientPaid === "true";
  if (teamPaid !== null && teamPaid !== undefined && teamPaid !== "")
    where.teamPaid = teamPaid === "true";

  // Date filtering: support month/year (V1) or startDate/endDate (V2)
  if (month && year) {
    const m = parseInt(month);
    const y = parseInt(year);
    const startOfMonth = `${y}-${String(m).padStart(2, "0")}-01`;
    const endOfMonth = m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    where.scheduledDate = { gte: startOfMonth, lt: endOfMonth };
  } else if (startDate || endDate) {
    where.scheduledDate = {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {}),
    };
  }

  try {
    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          property: { select: { id: true, name: true, code: true } },
          assignments: {
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
        orderBy: { scheduledDate: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.job.count({ where }),
    ]);

    return success({ jobs, total, limit, offset });
  } catch (err) {
    console.error("[GET /api/jobs]", err);
    return error("Failed to fetch jobs", 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/jobs — Create a job
// ---------------------------------------------------------------------------

const assignmentSchema = z.object({
  userId: z.string().min(1),
  share: z.number().min(0).default(1.0),
});

const createJobSchema = z.object({
  propertyId: z.string().min(1),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  scheduledTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Must be HH:MM")
    .optional(),
  totalFee: z.number().min(0),
  houseCutPercent: z.number().min(0).max(100).optional(),
  jobType: z.string().optional(),
  jobTypeLabel: z.string().optional(),
  isBtoB: z.boolean().optional(),
  notes: z.string().optional(),
  assignments: z.array(assignmentSchema).optional(),
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

  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    // Validate property exists
    const property = await prisma.property.findUnique({
      where: { id: data.propertyId },
      select: { id: true, houseCutPercent: true },
    });
    if (!property) return error("Property not found", 404);

    // Snapshot houseCutPercent from property if not provided
    const houseCutPercent = data.houseCutPercent ?? property.houseCutPercent;

    const jobNumber = await generateJobNumber();

    const job = await prisma.job.create({
      data: {
        jobNumber,
        propertyId: data.propertyId,
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        totalFee: data.totalFee,
        houseCutPercent,
        jobType: data.jobType,
        jobTypeLabel: data.jobTypeLabel,
        isBtoB: data.isBtoB,
        notes: data.notes,
        assignments: data.assignments
          ? {
              create: data.assignments.map((a) => ({
                userId: a.userId,
                share: a.share,
              })),
            }
          : undefined,
      },
      include: {
        property: { select: { id: true, name: true, code: true } },
        assignments: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "create",
      entityType: "job",
      entityId: job.id,
      summary: `Created job ${jobNumber}`,
    });

    return created(job);
  } catch (err) {
    console.error("[POST /api/jobs]", err);
    return error("Failed to create job", 500);
  }
}

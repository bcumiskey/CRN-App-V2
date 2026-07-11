import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { resolveWorkerUserId } from "@/lib/worker-view";
import { success, error } from "@/lib/responses";
import { todayYMD, addDaysYMD } from "@/lib/business-time";

// ---------------------------------------------------------------------------
// GET /api/worker/schedule — Worker's jobs in a date range
// ---------------------------------------------------------------------------

function getWeekBounds(): { startDate: string; endDate: string } {
  // Default week window anchored to "today" in the business timezone
  // (server-local new Date() is UTC on Vercel and shifts a day evenings).
  const today = todayYMD();
  const [y, m, d] = today.split("-").map((p) => parseInt(p, 10));
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun
  const startDate = addDaysYMD(today, -dayOfWeek);
  const endDate = addDaysYMD(startDate, 6);
  return { startDate, endDate };
}

export async function GET(request: NextRequest) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  const scope = await resolveWorkerUserId(request, result.user);
  if (scope.error) return scope.error;
  const params = request.nextUrl.searchParams;

  const defaults = getWeekBounds();
  const startDate = params.get("startDate") || defaults.startDate;
  const endDate = params.get("endDate") || defaults.endDate;

  // Validate date format
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
    return error("startDate and endDate must be YYYY-MM-DD format");
  }

  try {
    const jobs = await prisma.job.findMany({
      where: {
        scheduledDate: { gte: startDate, lte: endDate },
        assignments: { some: { userId: scope.userId } },
      },
      include: {
        property: {
          select: { id: true, name: true, address: true },
        },
        assignments: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [
        { scheduledDate: "asc" },
        { isBtoB: "desc" },
        { scheduledTime: "asc" },
      ],
    });

    const sanitized = jobs.map((job) => ({
      id: job.id,
      jobNumber: job.jobNumber,
      scheduledDate: job.scheduledDate,
      scheduledTime: job.scheduledTime,
      jobType: job.jobType,
      jobTypeLabel: job.jobTypeLabel,
      status: job.status,
      isBtoB: job.isBtoB,
      notes: job.notes,
      propertyId: job.propertyId,
      property: job.property
        ? { id: job.property.id, name: job.property.name, address: job.property.address }
        : null,
      assignments: job.assignments.map((a) => ({
        id: a.id,
        userName: a.user.name,
      })),
    }));

    return success({ jobs: sanitized, startDate, endDate });
  } catch (err) {
    console.error("[GET /api/worker/schedule]", err);
    return error("Failed to fetch schedule", 500);
  }
}

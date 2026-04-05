import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error } from "@/lib/responses";

// ---------------------------------------------------------------------------
// GET /api/worker/schedule — Worker's jobs in a date range
// ---------------------------------------------------------------------------

function getWeekBounds(): { startDate: string; endDate: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return { startDate: fmt(start), endDate: fmt(end) };
}

export async function GET(request: NextRequest) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  const { user } = result;
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
        assignments: { some: { userId: user.userId } },
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

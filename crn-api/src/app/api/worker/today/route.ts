import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error } from "@/lib/responses";

// ---------------------------------------------------------------------------
// GET /api/worker/today — Today's jobs for the current worker
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  const { user } = result;

  try {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const jobs = await prisma.job.findMany({
      where: {
        scheduledDate: today,
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
        { isBtoB: "desc" },
        { scheduledTime: "asc" },
      ],
    });

    // Secondary sort by property name for jobs without scheduledTime
    jobs.sort((a, b) => {
      // B2B first
      if (a.isBtoB !== b.isBtoB) return a.isBtoB ? -1 : 1;
      // Then by scheduledTime
      if (a.scheduledTime && b.scheduledTime) {
        if (a.scheduledTime !== b.scheduledTime) {
          return a.scheduledTime.localeCompare(b.scheduledTime);
        }
      } else if (a.scheduledTime) {
        return -1;
      } else if (b.scheduledTime) {
        return 1;
      }
      // Then by property name
      return (a.property?.name ?? "").localeCompare(b.property?.name ?? "");
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

    return success({ jobs: sanitized, date: today });
  } catch (err) {
    console.error("[GET /api/worker/today]", err);
    return error("Failed to fetch today's jobs", 500);
  }
}

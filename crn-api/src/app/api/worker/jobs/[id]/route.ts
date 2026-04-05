import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error, notFound } from "@/lib/responses";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/worker/jobs/[id] — Worker job detail (scoped by assignment)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: RouteContext) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  const { user } = result;
  const { id: jobId } = await params;

  try {
    // Critical scoping: only return if worker is assigned
    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        assignments: { some: { userId: user.userId } },
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            accessInstructions: true,
            parkingNotes: true,
            wifiName: true,
            wifiPassword: true,
            specialInstructions: true,
            rooms: {
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                name: true,
                floor: true,
                type: true,
                bedType: true,
                bedCount: true,
                hasCrib: true,
                hasMurphy: true,
                hasTrundle: true,
                hasPullout: true,
                towelCount: true,
                hasRug: true,
                hasRobes: true,
                hasSlippers: true,
                stockingNotes: true,
                sortOrder: true,
              },
            },
          },
        },
        assignments: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!job) return notFound();

    // Sanitize: exclude financial data, include only operational info
    const sanitized = {
      id: job.id,
      jobNumber: job.jobNumber,
      scheduledDate: job.scheduledDate,
      scheduledTime: job.scheduledTime,
      jobType: job.jobType,
      jobTypeLabel: job.jobTypeLabel,
      status: job.status,
      isBtoB: job.isBtoB,
      notes: job.notes,
      completedDate: job.completedDate,
      property: job.property
        ? {
            id: job.property.id,
            name: job.property.name,
            address: job.property.address,
            accessInstructions: job.property.accessInstructions,
            parkingNotes: job.property.parkingNotes,
            wifiName: job.property.wifiName,
            wifiPassword: job.property.wifiPassword,
            specialInstructions: job.property.specialInstructions,
            rooms: job.property.rooms,
          }
        : null,
      assignments: job.assignments.map((a) => ({
        id: a.id,
        userName: a.user.name,
      })),
    };

    return success(sanitized);
  } catch (err) {
    console.error("[GET /api/worker/jobs/[id]]", err);
    return error("Failed to fetch job", 500);
  }
}

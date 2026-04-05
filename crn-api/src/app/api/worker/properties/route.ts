import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error } from "@/lib/responses";

// ---------------------------------------------------------------------------
// GET /api/worker/properties — Properties the worker has been assigned to
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  const { user } = result;

  try {
    // Find distinct propertyIds from this worker's assignments
    const assignments = await prisma.jobAssignment.findMany({
      where: { userId: user.userId },
      select: {
        job: { select: { propertyId: true } },
      },
    });

    const propertyIds = [...new Set(assignments.map((a) => a.job.propertyId))];

    if (propertyIds.length === 0) {
      return success({ properties: [] });
    }

    // Load properties (operational info only — no financial data, no owner)
    const properties = await prisma.property.findMany({
      where: { id: { in: propertyIds } },
      select: {
        id: true,
        name: true,
        address: true,
      },
      orderBy: { name: "asc" },
    });

    // Find last cleaned date for each property (most recent completed job)
    const lastCleanedMap = new Map<string, string>();
    for (const pid of propertyIds) {
      const lastJob = await prisma.job.findFirst({
        where: {
          propertyId: pid,
          status: { in: ["COMPLETED", "INVOICED"] },
          assignments: { some: { userId: user.userId } },
        },
        select: { completedDate: true, scheduledDate: true },
        orderBy: { scheduledDate: "desc" },
      });
      if (lastJob) {
        lastCleanedMap.set(pid, lastJob.completedDate ?? lastJob.scheduledDate);
      }
    }

    const propertiesWithDates = properties.map((p) => ({
      ...p,
      lastCleanedDate: lastCleanedMap.get(p.id) ?? null,
    }));

    return success({ properties: propertiesWithDates });
  } catch (err) {
    console.error("[GET /api/worker/properties]", err);
    return error("Failed to fetch properties", 500);
  }
}

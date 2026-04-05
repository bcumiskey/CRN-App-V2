import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound } from "@/lib/responses";
import { generateJobNumber } from "@/lib/job-numbers";
import { z } from "zod";

// ---------------------------------------------------------------------------
// POST /api/sync/unmatched/[id]/assign — Assign unmatched event to property
// ---------------------------------------------------------------------------

const assignSchema = z.object({
  propertyId: z.string().min(1, "Property ID is required"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const event = await prisma.unmatchedSyncEvent.findUnique({
      where: { id },
    });

    if (!event) return notFound("Unmatched event not found");
    if (event.status !== "pending") {
      return error(`Event already ${event.status}`, 409);
    }

    const body = await request.json();
    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) {
      return error(
        parsed.error.errors.map((e) => e.message).join(", "),
        400
      );
    }

    const { propertyId } = parsed.data;

    // Verify property exists
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property) return notFound("Property not found");

    // Extract event data
    const rawData = (event.rawData as Record<string, unknown>) ?? {};

    // Create job from event data
    const jobNumber = await generateJobNumber();
    const job = await prisma.job.create({
      data: {
        jobNumber,
        propertyId,
        scheduledDate: event.date,
        totalFee: property.defaultJobFee ?? 0,
        houseCutPercent: property.houseCutPercent,
        source: (rawData.source as string) ?? "google",
        externalId: event.uid,
        rawSummary: event.rawSummary,
        isBtoB: (rawData.isBtoB as boolean) ?? false,
        syncLocked: false,
        status: "SCHEDULED",
        notes: (rawData.notes as string) ?? null,
      },
    });

    // Update unmatched event
    await prisma.unmatchedSyncEvent.update({
      where: { id },
      data: {
        status: "assigned",
        assignedPropertyId: propertyId,
        assignedJobId: job.id,
      },
    });

    logAudit({
      userId: result.user.userId,
      action: "create",
      entityType: "job",
      entityId: job.id,
      summary: `Assigned unmatched event "${event.rawSummary}" to property "${property.name}" as ${jobNumber}`,
    });

    return success({ job, event: { id, status: "assigned" } });
  } catch (err) {
    console.error("[POST /api/sync/unmatched/[id]/assign]", err);
    return error("Failed to assign unmatched event", 500);
  }
}

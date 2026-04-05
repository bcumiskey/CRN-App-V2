import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// POST /api/worker/jobs/[id]/checklist — Save checklist progress
//
// NOTE: The JobChecklist model is not yet in the Prisma schema.
// This endpoint validates and returns the data structure so the mobile
// client can be built now. Actual persistence will be wired when the
// schema migration adds a JobChecklistProgress model.
//
// Pragmatic approach: store checklist state as JSON in Job.notes would
// clobber existing notes, so we return success with the payload and
// a flag indicating the persistence backend is pending.
// ---------------------------------------------------------------------------

const checklistSchema = z.object({
  checklistId: z.string().min(1, "checklistId is required"),
  completedItems: z.array(z.string()).default([]),
});

export async function POST(request: NextRequest, { params }: RouteContext) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  const { user } = result;
  const { id: jobId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = checklistSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { checklistId, completedItems } = parsed.data;

  try {
    // Critical scoping: worker must be assigned to this job
    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        assignments: { some: { userId: user.userId } },
      },
      select: { id: true, jobNumber: true, propertyId: true },
    });

    if (!job) return notFound();

    // Validate the checklist belongs to this job's property
    const checklist = await prisma.checklist.findFirst({
      where: {
        id: checklistId,
        propertyId: job.propertyId,
      },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!checklist) return notFound("Checklist not found for this property");

    // Validate completedItems are real checklist item IDs
    const validItemIds = new Set(checklist.items.map((i) => i.id));
    const invalidItems = completedItems.filter((id) => !validItemIds.has(id));
    if (invalidItems.length > 0) {
      return error(`Invalid checklist item IDs: ${invalidItems.join(", ")}`);
    }

    // TODO: Persist when JobChecklistProgress model is added to schema.
    // For now, return the validated state so the client can track locally.
    const totalItems = checklist.items.length;
    const completedCount = completedItems.length;

    return success({
      jobId,
      checklistId,
      checklistName: checklist.name,
      completedItems,
      totalItems,
      completedCount,
      percentComplete: totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0,
      _note: "Checklist progress accepted. Persistence pending schema migration.",
    });
  } catch (err) {
    console.error("[POST /api/worker/jobs/[id]/checklist]", err);
    return error("Failed to save checklist progress", 500);
  }
}

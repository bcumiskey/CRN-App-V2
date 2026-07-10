import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// POST /api/worker/jobs/[id]/checklist — Save checklist progress
//
// NOT IMPLEMENTED: there is no persistence target in the Prisma schema
// (only Checklist/ChecklistItem definition models exist — no
// JobChecklistProgress). This endpoint used to return HTTP 200 without
// writing anything, which would let any client believe progress was saved
// when it was silently discarded. It now validates the payload and returns
// 501 so no client can mistake it for a successful save. Wire real
// persistence when a JobChecklistProgress model is added to the schema.
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

    // TODO: Persist when a JobChecklistProgress model is added to the schema.
    // Until then, refuse loudly rather than pretend the save succeeded —
    // a 200 here would silently discard the worker's checklist progress.
    return error(
      "Checklist progress cannot be saved yet — persistence is not implemented. Nothing was stored.",
      501
    );
  } catch (err) {
    console.error("[POST /api/worker/jobs/[id]/checklist]", err);
    return error("Failed to save checklist progress", 500);
  }
}

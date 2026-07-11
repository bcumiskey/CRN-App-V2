import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { resolveWorkerUserId } from "@/lib/worker-view";
import { success, error, notFound, validationError } from "@/lib/responses";
import { todayYMD } from "@/lib/business-time";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// Worker-allowed status transitions (subset of admin transitions)
// ---------------------------------------------------------------------------

const WORKER_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
};

// ---------------------------------------------------------------------------
// PATCH /api/worker/jobs/[id]/status — Worker starts/completes a job
// ---------------------------------------------------------------------------

const statusSchema = z.object({
  status: z.enum(["IN_PROGRESS", "COMPLETED"]),
});

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  const scope = await resolveWorkerUserId(request, result.user, { mutating: true });
  if (scope.error) return scope.error;
  const { id: jobId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const newStatus = parsed.data.status;

  try {
    // Critical scoping: worker must be assigned to this job
    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        assignments: { some: { userId: scope.userId } },
      },
      select: { id: true, jobNumber: true, status: true },
    });

    if (!job) return notFound();

    const oldStatus = job.status;

    // Validate worker-allowed transition
    const allowed = WORKER_TRANSITIONS[oldStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      return error(
        `Invalid status transition: ${oldStatus} → ${newStatus}. Workers can: SCHEDULED → IN_PROGRESS, IN_PROGRESS → COMPLETED`,
        422
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = { status: newStatus };

    // Lock the job against calendar sync — the feed must never move
    // dates/fees of a job that has started or completed. Workers can only
    // transition to IN_PROGRESS or COMPLETED (never back to SCHEDULED), so
    // every worker transition locks. Mirrors the admin status route
    // (/api/jobs/[id]/status), which documents this contract.
    updateData.syncLocked = true;

    // Set completedDate when transitioning to COMPLETED.
    // Must be the business-timezone date (payroll sweeps by completedDate);
    // server-local new Date() is UTC on Vercel and flips a day early evenings.
    if (newStatus === "COMPLETED") {
      updateData.completedDate = todayYMD();
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: updateData,
      select: {
        id: true,
        jobNumber: true,
        status: true,
        completedDate: true,
      },
    });

    return success(updated);
  } catch (err) {
    console.error("[PATCH /api/worker/jobs/[id]/status]", err);
    return error("Failed to update job status", 500);
  }
}

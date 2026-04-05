import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// Status state machine
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["INVOICED", "CANCELLED"],
  INVOICED: ["CANCELLED"],
  CANCELLED: ["SCHEDULED"],
};

// ---------------------------------------------------------------------------
// PATCH /api/jobs/[id]/status — Transition job status
// ---------------------------------------------------------------------------

const statusSchema = z.object({
  status: z.enum([
    "SCHEDULED",
    "IN_PROGRESS",
    "COMPLETED",
    "INVOICED",
    "CANCELLED",
  ]),
});

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

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
    const job = await prisma.job.findUnique({
      where: { id },
      select: { id: true, jobNumber: true, status: true },
    });
    if (!job) return notFound("Job not found");

    const oldStatus = job.status;

    // Validate transition
    const allowed = VALID_TRANSITIONS[oldStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      return error(
        `Invalid status transition: ${oldStatus} → ${newStatus}. Allowed: ${(allowed || []).join(", ")}`,
        422
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = { status: newStatus };

    // Set completedDate when transitioning to COMPLETED
    if (newStatus === "COMPLETED") {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      updateData.completedDate = `${yyyy}-${mm}-${dd}`;
    }

    // Clear completedDate if reverting from COMPLETED back (e.g., CANCELLED→SCHEDULED)
    if (newStatus === "SCHEDULED" && oldStatus === "CANCELLED") {
      updateData.completedDate = null;
    }

    const updated = await prisma.job.update({
      where: { id },
      data: updateData,
      include: {
        property: { select: { id: true, name: true } },
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "job",
      entityId: id,
      summary: `Job ${job.jobNumber} status: ${oldStatus} → ${newStatus}`,
    });

    return success(updated);
  } catch (err) {
    console.error("[PATCH /api/jobs/[id]/status]", err);
    return error("Failed to update job status", 500);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

type RouteContext = {
  params: Promise<{ id: string; assignmentId: string }>;
};

// ---------------------------------------------------------------------------
// PATCH /api/jobs/[id]/assignments/[assignmentId] — Update share and/or the
// manual pay adjustment (+/- dollars on top of computed pay)
// ---------------------------------------------------------------------------

const updateAssignmentSchema = z
  .object({
    share: z.number().min(0).optional(),
    payAdjustment: z.number().optional(),
  })
  .refine((d) => d.share !== undefined || d.payAdjustment !== undefined, {
    message: "Provide share and/or payAdjustment",
  });

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id, assignmentId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = updateAssignmentSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const assignment = await prisma.jobAssignment.findFirst({
      where: { id: assignmentId, jobId: id },
      include: {
        user: { select: { name: true } },
        job: { select: { jobNumber: true } },
      },
    });
    if (!assignment) return notFound("Assignment not found");

    const updateData: { share?: number; payAdjustment?: number } = {};
    if (parsed.data.share !== undefined) updateData.share = parsed.data.share;
    if (parsed.data.payAdjustment !== undefined)
      updateData.payAdjustment = parsed.data.payAdjustment;

    const updated = await prisma.jobAssignment.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    const changes: string[] = [];
    if (parsed.data.share !== undefined)
      changes.push(`share ${assignment.share} → ${parsed.data.share}`);
    if (parsed.data.payAdjustment !== undefined)
      changes.push(
        `pay adjustment ${assignment.payAdjustment} → ${parsed.data.payAdjustment}`
      );

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "job",
      entityId: id,
      summary: `Updated ${assignment.user.name} on job ${assignment.job.jobNumber}: ${changes.join(", ")}`,
    });

    return success(updated);
  } catch (err) {
    console.error("[PATCH /api/jobs/[id]/assignments/[assignmentId]]", err);
    return error("Failed to update assignment", 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/jobs/[id]/assignments/[assignmentId] — Remove assignment
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id, assignmentId } = await params;

  try {
    const assignment = await prisma.jobAssignment.findFirst({
      where: { id: assignmentId, jobId: id },
      include: {
        user: { select: { name: true } },
        job: { select: { jobNumber: true } },
      },
    });
    if (!assignment) return notFound("Assignment not found");

    await prisma.jobAssignment.delete({ where: { id: assignmentId } });

    await logAudit({
      userId: result.user.userId,
      action: "delete",
      entityType: "job",
      entityId: id,
      summary: `Removed ${assignment.user.name} from job ${assignment.job.jobNumber}`,
    });

    return success({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/jobs/[id]/assignments/[assignmentId]]", err);
    return error("Failed to remove assignment", 500);
  }
}

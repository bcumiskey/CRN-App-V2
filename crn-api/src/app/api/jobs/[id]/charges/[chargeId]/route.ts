import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound } from "@/lib/responses";

type RouteContext = {
  params: Promise<{ id: string; chargeId: string }>;
};

// ---------------------------------------------------------------------------
// DELETE /api/jobs/[id]/charges/[chargeId] — Remove charge
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id, chargeId } = await params;

  try {
    const charge = await prisma.jobCharge.findFirst({
      where: { id: chargeId, jobId: id },
      include: {
        job: { select: { jobNumber: true } },
      },
    });
    if (!charge) return notFound("Charge not found");

    await prisma.jobCharge.delete({ where: { id: chargeId } });

    await logAudit({
      userId: result.user.userId,
      action: "delete",
      entityType: "job",
      entityId: id,
      summary: `Removed charge $${charge.amount} from job ${charge.job.jobNumber}: ${charge.reason}`,
    });

    return success({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/jobs/[id]/charges/[chargeId]]", err);
    return error("Failed to remove charge", 500);
  }
}

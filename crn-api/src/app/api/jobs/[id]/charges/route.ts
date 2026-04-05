import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { created, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// POST /api/jobs/[id]/charges — Add extra charge
// ---------------------------------------------------------------------------

const addChargeSchema = z.object({
  amount: z.number(),
  reason: z.string().min(1).max(120, "Reason must be 120 characters or fewer"),
});

export async function POST(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = addChargeSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { amount, reason } = parsed.data;

  try {
    const job = await prisma.job.findUnique({
      where: { id },
      select: { id: true, jobNumber: true },
    });
    if (!job) return notFound("Job not found");

    const charge = await prisma.jobCharge.create({
      data: { jobId: id, amount, reason },
    });

    await logAudit({
      userId: result.user.userId,
      action: "create",
      entityType: "job",
      entityId: id,
      summary: `Added charge $${amount} to job ${job.jobNumber}: ${reason}`,
    });

    return created(charge);
  } catch (err) {
    console.error("[POST /api/jobs/[id]/charges]", err);
    return error("Failed to add charge", 500);
  }
}

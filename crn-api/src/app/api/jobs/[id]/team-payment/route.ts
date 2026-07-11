import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { todayYMD } from "@/lib/business-time";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// POST /api/jobs/[id]/team-payment — Mark the crew paid for this job (or clear)
//
// paymentMethod set   → teamPaid=true, teamPaidDate=today (business tz), method
// paymentMethod null  → clear team payment (teamPaid=false, date/method null)
// ---------------------------------------------------------------------------

const teamPaymentSchema = z.object({
  paymentMethod: z
    .enum(["check", "venmo", "zelle", "ach", "cash", "other"])
    .nullable(),
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

  const parsed = teamPaymentSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { paymentMethod } = parsed.data;

  try {
    const job = await prisma.job.findUnique({
      where: { id },
      select: { id: true, jobNumber: true },
    });
    if (!job) return notFound("Job not found");

    const paying = paymentMethod !== null;

    const updated = await prisma.job.update({
      where: { id },
      data: {
        teamPaid: paying,
        teamPaidDate: paying ? todayYMD() : null,
        teamPaidMethod: paymentMethod,
      },
      include: {
        property: { select: { id: true, name: true, code: true, color: true } },
        assignments: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "job",
      entityId: id,
      summary: paying
        ? `Marked team paid on job ${job.jobNumber} via ${paymentMethod}`
        : `Cleared team payment on job ${job.jobNumber}`,
    });

    return success(updated);
  } catch (err) {
    console.error("[POST /api/jobs/[id]/team-payment]", err);
    return error("Failed to update team payment", 500);
  }
}

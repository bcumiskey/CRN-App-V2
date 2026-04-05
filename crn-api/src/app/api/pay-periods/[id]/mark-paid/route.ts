import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound } from "@/lib/responses";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/pay-periods/[id]/mark-paid — Mark period as paid
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const period = await prisma.payPeriod.findUnique({ where: { id } });
    if (!period) return notFound("Pay period not found");

    if (period.status === "paid") {
      return error("Pay period is already marked as paid", 409);
    }
    if (period.status === "open") {
      return error("Pay period must be closed before marking as paid", 409);
    }

    const updated = await prisma.payPeriod.update({
      where: { id },
      data: {
        status: "paid",
        paidAt: new Date(),
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "pay_period",
      entityId: id,
      summary: `Marked pay period ${period.startDate} to ${period.endDate} as paid`,
    });

    return success(updated);
  } catch (err) {
    console.error("[PATCH /api/pay-periods/[id]/mark-paid]", err);
    return error("Failed to mark pay period as paid", 500);
  }
}

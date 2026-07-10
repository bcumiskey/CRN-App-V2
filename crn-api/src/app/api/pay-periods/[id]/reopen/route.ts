import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound } from "@/lib/responses";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/pay-periods/[id]/reopen — Reopen a closed pay period
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const period = await prisma.payPeriod.findUnique({ where: { id } });
    if (!period) return notFound("Pay period not found");

    if (period.status === "paid") {
      return error("Cannot reopen a paid pay period", 409);
    }
    if (period.status === "open") {
      return error("Pay period is already open", 409);
    }

    // Delete pay statements, release the claimed jobs, and reopen in a
    // transaction. Close marks each counted job teamPaid=true with
    // teamPaidDate set to this period's endDate (endDates are unique across
    // periods), so that marker identifies exactly the jobs this close
    // claimed — releasing them lets a re-close (or a later period) count
    // them again without ever double-counting.
    await prisma.$transaction(async (tx) => {
      await tx.payStatement.deleteMany({ where: { payPeriodId: id } });
      await tx.job.updateMany({
        where: { teamPaid: true, teamPaidDate: period.endDate },
        data: { teamPaid: false, teamPaidDate: null },
      });
      await tx.payPeriod.update({
        where: { id },
        data: {
          status: "open",
          closedAt: null,
        },
      });
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "pay_period",
      entityId: id,
      summary: `Reopened pay period ${period.startDate} to ${period.endDate}`,
    });

    const updated = await prisma.payPeriod.findUnique({ where: { id } });

    return success(updated);
  } catch (err) {
    console.error("[PATCH /api/pay-periods/[id]/reopen]", err);
    return error("Failed to reopen pay period", 500);
  }
}

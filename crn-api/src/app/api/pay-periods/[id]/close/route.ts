import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound } from "@/lib/responses";
import { computePerWorkerEarnings } from "../route";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/pay-periods/[id]/close — Close the pay period
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const period = await prisma.payPeriod.findUnique({ where: { id } });
    if (!period) return notFound("Pay period not found");

    if (period.status !== "open") {
      return error(`Cannot close a period that is ${period.status}`, 409);
    }

    // Compute per-worker earnings
    const perWorker = await computePerWorkerEarnings(
      period.startDate,
      period.endDate
    );

    // Create pay statements and close period in a transaction
    await prisma.$transaction(async (tx) => {
      // Create PayStatement records
      for (const worker of perWorker) {
        await tx.payStatement.create({
          data: {
            payPeriodId: id,
            userId: worker.userId,
            jobsWorked: worker.jobsWorked,
            totalShares: worker.totalShares,
            workerPoolPay: worker.workerPoolPay,
            ownerPay: worker.ownerPay,
            grossPay: worker.grossPay,
          },
        });
      }

      // Close the period
      await tx.payPeriod.update({
        where: { id },
        data: {
          status: "closed",
          closedAt: new Date(),
        },
      });
    });

    await logAudit({
      userId: result.user.userId,
      action: "close",
      entityType: "pay_period",
      entityId: id,
      summary: `Closed pay period ${period.startDate} to ${period.endDate} (${perWorker.length} workers)`,
      details: { workerCount: perWorker.length },
    });

    // Return updated period
    const updated = await prisma.payPeriod.findUnique({
      where: { id },
      include: {
        payStatements: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    return success(updated);
  } catch (err) {
    console.error("[PATCH /api/pay-periods/[id]/close]", err);
    return error("Failed to close pay period", 500);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound } from "@/lib/responses";
import { computePerWorkerEarnings } from "../../earnings";

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

    // Compute per-worker earnings (all unpaid completed jobs up to the
    // period end, including catch-up jobs completed after an earlier
    // period was closed)
    const { workers: perWorker, jobIds } = await computePerWorkerEarnings(
      period.endDate
    );

    // Create pay statements, claim the swept jobs, and close the period in
    // a single transaction
    await prisma.$transaction(async (tx) => {
      // Re-check the period is still open inside the transaction so a
      // concurrent close cannot freeze the same snapshot twice
      const claimed = await tx.payPeriod.updateMany({
        where: { id, status: "open" },
        data: {
          status: "closed",
          closedAt: new Date(),
        },
      });
      if (claimed.count !== 1) {
        throw new Error("PERIOD_NOT_OPEN");
      }

      // Mark the counted jobs as team-paid so no other period can count
      // them again. teamPaidDate records the endDate of the period that
      // paid the job — reopen uses this marker to release exactly these
      // jobs. The teamPaid:false guard + count check aborts the close if
      // another period claimed any of these jobs since we computed.
      if (jobIds.length > 0) {
        const marked = await tx.job.updateMany({
          where: { id: { in: jobIds }, teamPaid: false },
          data: { teamPaid: true, teamPaidDate: period.endDate },
        });
        if (marked.count !== jobIds.length) {
          throw new Error("JOBS_ALREADY_CLAIMED");
        }
      }

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
    });

    await logAudit({
      userId: result.user.userId,
      action: "close",
      entityType: "pay_period",
      entityId: id,
      summary: `Closed pay period ${period.startDate} to ${period.endDate} (${perWorker.length} workers, ${jobIds.length} jobs)`,
      details: { workerCount: perWorker.length, jobCount: jobIds.length },
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
    if (err instanceof Error && err.message === "PERIOD_NOT_OPEN") {
      return error("Pay period is no longer open", 409);
    }
    if (err instanceof Error && err.message === "JOBS_ALREADY_CLAIMED") {
      return error(
        "Some jobs were claimed by another pay period while closing — please retry",
        409
      );
    }
    console.error("[PATCH /api/pay-periods/[id]/close]", err);
    return error("Failed to close pay period", 500);
  }
}

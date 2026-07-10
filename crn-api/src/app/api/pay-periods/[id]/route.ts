import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error, notFound } from "@/lib/responses";
import { computePerWorkerEarnings } from "../earnings";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/pay-periods/[id] — Period detail with per-worker breakdown
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const period = await prisma.payPeriod.findUnique({
      where: { id },
      include: {
        payStatements: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!period) return notFound("Pay period not found");

    // If the period is closed/paid, return the stored statements
    if (period.status !== "open") {
      return success({
        ...period,
        perWorker: period.payStatements.map((ps) => ({
          userId: ps.userId,
          userName: ps.user.name,
          jobsWorked: ps.jobsWorked,
          totalShares: ps.totalShares,
          workerPoolPay: ps.workerPoolPay,
          ownerPay: ps.ownerPay,
          grossPay: ps.grossPay,
        })),
      });
    }

    // For open periods, compute live
    const { workers: perWorker } = await computePerWorkerEarnings(
      period.endDate
    );

    return success({ ...period, perWorker });
  } catch (err) {
    console.error("[GET /api/pay-periods/[id]]", err);
    return error("Failed to fetch pay period detail", 500);
  }
}

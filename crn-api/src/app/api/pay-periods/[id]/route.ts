import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error, notFound } from "@/lib/responses";
import { calculateJob } from "crn-shared";
import type { FinancialModel } from "crn-shared";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// Helper: Compute per-worker earnings for a pay period
// ---------------------------------------------------------------------------

interface WorkerEarnings {
  userId: string;
  userName: string;
  jobsWorked: number;
  totalShares: number;
  workerPoolPay: number;
  ownerPay: number;
  grossPay: number;
}

export async function computePerWorkerEarnings(
  startDate: string,
  endDate: string
): Promise<WorkerEarnings[]> {
  // Load financial model
  const settings = await prisma.companySettings.findUnique({
    where: { id: "singleton" },
    select: { financialModel: true },
  });
  const financialModel = settings?.financialModel as FinancialModel;

  // Find all completed jobs in the period with assignments and charges
  const jobs = await prisma.job.findMany({
    where: {
      status: { in: ["COMPLETED", "INVOICED"] },
      scheduledDate: { gte: startDate, lte: endDate },
    },
    include: {
      assignments: {
        include: {
          user: { select: { id: true, name: true, isOwner: true } },
        },
      },
      charges: { select: { amount: true } },
    },
  });

  // Accumulate per-worker totals
  const workerMap = new Map<string, WorkerEarnings>();

  for (const job of jobs) {
    if (job.assignments.length === 0) continue;

    const jobResult = calculateJob(financialModel, {
      totalFee: job.totalFee,
      houseCutPercent: job.houseCutPercent,
      charges: job.charges.map((c) => ({ amount: c.amount })),
      assignments: job.assignments.map((a) => ({
        userId: a.userId,
        userName: a.user.name,
        share: a.share,
        isOwner: a.user.isOwner,
      })),
    });

    for (const wp of jobResult.workerPayments) {
      const existing = workerMap.get(wp.userId);
      if (existing) {
        existing.jobsWorked += 1;
        existing.totalShares += wp.share;
        existing.workerPoolPay += wp.workerPoolPay;
        existing.ownerPay += wp.ownerPay;
        existing.grossPay += wp.totalPay;
      } else {
        workerMap.set(wp.userId, {
          userId: wp.userId,
          userName: wp.userName,
          jobsWorked: 1,
          totalShares: wp.share,
          workerPoolPay: wp.workerPoolPay,
          ownerPay: wp.ownerPay,
          grossPay: wp.totalPay,
        });
      }
    }
  }

  // Round accumulated values
  const workers = Array.from(workerMap.values()).map((w) => ({
    ...w,
    totalShares: Math.round(w.totalShares * 100) / 100,
    workerPoolPay: Math.round(w.workerPoolPay * 100) / 100,
    ownerPay: Math.round(w.ownerPay * 100) / 100,
    grossPay: Math.round(w.grossPay * 100) / 100,
  }));

  return workers.sort((a, b) => b.grossPay - a.grossPay);
}

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
    const perWorker = await computePerWorkerEarnings(
      period.startDate,
      period.endDate
    );

    return success({ ...period, perWorker });
  } catch (err) {
    console.error("[GET /api/pay-periods/[id]]", err);
    return error("Failed to fetch pay period detail", 500);
  }
}

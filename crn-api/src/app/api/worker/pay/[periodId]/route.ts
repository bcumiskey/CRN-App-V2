import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { resolveWorkerUserId } from "@/lib/worker-view";
import { success, error, notFound } from "@/lib/responses";
import { calculateJob } from "crn-shared";
import type { FinancialModel } from "crn-shared";
import { todayParts } from "@/lib/business-time";
import { computeWorkerPeriodPay } from "../earnings";

type RouteContext = { params: Promise<{ periodId: string }> };

// ---------------------------------------------------------------------------
// GET /api/worker/pay/[periodId] — Worker's earnings for a specific period
//
// Attribution matches pay-period close: open periods preview the sweep the
// next close will run (all unpaid completed jobs up to the period end,
// including catch-up jobs), closed/paid periods read the frozen PayStatement.
// See ../earnings.ts.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: RouteContext) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  const scope = await resolveWorkerUserId(request, result.user);
  if (scope.error) return scope.error;
  const workerUserId = scope.userId;
  const { periodId } = await params;

  try {
    // Load financial model
    const settings = await prisma.companySettings.findUnique({
      where: { id: "singleton" },
      select: { financialModel: true },
    });
    if (!settings) return error("Company settings not configured", 500);

    const financialModel = settings.financialModel as unknown as FinancialModel;

    // Find the specified pay period
    const period = await prisma.payPeriod.findUnique({
      where: { id: periodId },
    });
    if (!period) return notFound("Pay period not found");

    const { jobsWorked, totalEarned, jobs } = await computeWorkerPeriodPay(
      period,
      workerUserId,
      financialModel
    );

    // YTD summary, attributed the same way payroll is:
    // - frozen PayStatement rows from every period ending this calendar year
    //   (the ground truth of what was/will be paid), plus
    // - the live value of unpaid completed work the next close will sweep
    //   (teamPaid=false, no start floor — matches close's catch-up semantics)
    // Current year in the business timezone (server runs UTC), matching how
    // resolveDateRange and the 1099 summary resolve "this year"
    const { year } = todayParts();
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const statements = await prisma.payStatement.findMany({
      where: {
        userId: workerUserId,
        payPeriod: { endDate: { gte: yearStart, lte: yearEnd } },
      },
      select: { grossPay: true, jobsWorked: true },
    });

    const unpaidJobs = await prisma.job.findMany({
      where: {
        status: { in: ["COMPLETED", "INVOICED"] },
        teamPaid: false,
        OR: [
          { completedDate: { lte: yearEnd } },
          { completedDate: null, scheduledDate: { lte: yearEnd } },
        ],
        assignments: { some: { userId: workerUserId } },
      },
      include: {
        assignments: {
          include: {
            user: { select: { id: true, name: true, isOwner: true } },
          },
        },
        charges: true,
      },
    });

    let ytdEarned = 0;
    let ytdJobs = 0;
    for (const s of statements) {
      ytdEarned += s.grossPay;
      ytdJobs += s.jobsWorked;
    }
    for (const job of unpaidJobs) {
      const calcResult = calculateJob(financialModel, {
        totalFee: job.totalFee,
        houseCutPercent: job.houseCutPercent,
        charges: job.charges.map((c) => ({ amount: c.amount })),
        assignments: job.assignments.map((a) => ({
          userId: a.user.id,
          userName: a.user.name,
          share: a.share,
          isOwner: a.user.isOwner,
        })),
      });

      const wp = calcResult.workerPayments.find(
        (w) => w.userId === workerUserId
      );
      ytdEarned += wp?.totalPay ?? 0;
      ytdJobs += 1;
    }

    return success({
      periodId: period.id,
      periodLabel: `${period.startDate} to ${period.endDate}`,
      periodStatus: period.status,
      startDate: period.startDate,
      endDate: period.endDate,
      jobsWorked,
      totalEarned,
      jobs,
      ytd: {
        year,
        totalEarned: Math.round(ytdEarned * 100) / 100,
        totalJobs: ytdJobs,
      },
    });
  } catch (err) {
    console.error("[GET /api/worker/pay/[periodId]]", err);
    return error("Failed to fetch pay data", 500);
  }
}

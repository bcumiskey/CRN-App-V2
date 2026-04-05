import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error, notFound } from "@/lib/responses";
import { calculateJob } from "crn-shared";
import type { FinancialModel, AssignmentInput, ChargeInput } from "crn-shared";

type RouteContext = { params: Promise<{ periodId: string }> };

// ---------------------------------------------------------------------------
// GET /api/worker/pay/[periodId] — Worker's earnings for a specific period
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: RouteContext) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  const { user } = result;
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

    // Find all completed jobs in this period where worker has an assignment
    const jobs = await prisma.job.findMany({
      where: {
        status: { in: ["COMPLETED", "INVOICED"] },
        scheduledDate: { gte: period.startDate, lte: period.endDate },
        assignments: { some: { userId: user.userId } },
      },
      include: {
        property: { select: { name: true } },
        assignments: {
          include: {
            user: { select: { id: true, name: true, isOwner: true } },
          },
        },
        charges: true,
      },
      orderBy: { scheduledDate: "asc" },
    });

    // Calculate each job and extract this worker's pay
    let totalEarned = 0;
    const jobDetails = jobs.map((job) => {
      const assignments: AssignmentInput[] = job.assignments.map((a) => ({
        userId: a.user.id,
        userName: a.user.name,
        share: a.share,
        isOwner: a.user.isOwner,
      }));

      const charges: ChargeInput[] = job.charges.map((c) => ({
        amount: c.amount,
      }));

      const calcResult = calculateJob(financialModel, {
        totalFee: job.totalFee,
        houseCutPercent: job.houseCutPercent,
        charges,
        assignments,
      });

      const workerPayment = calcResult.workerPayments.find(
        (wp) => wp.userId === user.userId
      );
      const yourPay = workerPayment?.totalPay ?? 0;
      totalEarned += yourPay;

      return {
        jobId: job.id,
        date: job.scheduledDate,
        propertyName: job.property?.name ?? "Unknown",
        jobType: job.jobType,
        yourPay,
      };
    });

    // YTD summary: all completed jobs this calendar year
    const now = new Date();
    const yearStart = `${now.getFullYear()}-01-01`;
    const yearEnd = `${now.getFullYear()}-12-31`;

    const ytdJobs = await prisma.job.findMany({
      where: {
        status: { in: ["COMPLETED", "INVOICED"] },
        scheduledDate: { gte: yearStart, lte: yearEnd },
        assignments: { some: { userId: user.userId } },
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
    for (const job of ytdJobs) {
      const assignments: AssignmentInput[] = job.assignments.map((a) => ({
        userId: a.user.id,
        userName: a.user.name,
        share: a.share,
        isOwner: a.user.isOwner,
      }));

      const charges: ChargeInput[] = job.charges.map((c) => ({
        amount: c.amount,
      }));

      const calcResult = calculateJob(financialModel, {
        totalFee: job.totalFee,
        houseCutPercent: job.houseCutPercent,
        charges,
        assignments,
      });

      const wp = calcResult.workerPayments.find(
        (w) => w.userId === user.userId
      );
      ytdEarned += wp?.totalPay ?? 0;
    }

    return success({
      periodId: period.id,
      periodLabel: `${period.startDate} to ${period.endDate}`,
      periodStatus: period.status,
      jobsWorked: jobDetails.length,
      totalEarned,
      jobs: jobDetails,
      ytd: {
        year: now.getFullYear(),
        totalEarned: ytdEarned,
        totalJobs: ytdJobs.length,
      },
    });
  } catch (err) {
    console.error("[GET /api/worker/pay/[periodId]]", err);
    return error("Failed to fetch pay data", 500);
  }
}

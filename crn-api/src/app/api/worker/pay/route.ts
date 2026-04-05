import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error, notFound } from "@/lib/responses";
import { calculateJob } from "crn-shared";
import type { FinancialModel, AssignmentInput, ChargeInput } from "crn-shared";

// ---------------------------------------------------------------------------
// GET /api/worker/pay — Current worker's earnings for the current open period
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  const { user } = result;
  const params = request.nextUrl.searchParams;
  const payPeriodId = params.get("payPeriodId");

  try {
    // Load financial model
    const settings = await prisma.companySettings.findUnique({
      where: { id: "singleton" },
      select: { financialModel: true },
    });
    if (!settings) return error("Company settings not configured", 500);

    const financialModel = settings.financialModel as unknown as FinancialModel;

    // Find the pay period
    let period;
    if (payPeriodId) {
      period = await prisma.payPeriod.findUnique({
        where: { id: payPeriodId },
      });
    } else {
      // Find current open period
      period = await prisma.payPeriod.findFirst({
        where: { status: "open" },
        orderBy: { startDate: "desc" },
      });
    }

    if (!period) return notFound("No pay period found");

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

      // Find this worker's payment
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

    return success({
      periodId: period.id,
      periodLabel: `${period.startDate} to ${period.endDate}`,
      periodStatus: period.status,
      jobsWorked: jobDetails.length,
      totalEarned,
      jobs: jobDetails,
    });
  } catch (err) {
    console.error("[GET /api/worker/pay]", err);
    return error("Failed to fetch pay data", 500);
  }
}

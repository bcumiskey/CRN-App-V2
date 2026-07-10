import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error, notFound } from "@/lib/responses";
import type { FinancialModel } from "crn-shared";
import { computeWorkerPeriodPay } from "./earnings";

// ---------------------------------------------------------------------------
// GET /api/worker/pay — Current worker's earnings for the current open period
//
// Attribution matches pay-period close: open periods preview the sweep the
// next close will run (all unpaid completed jobs up to the period end,
// including catch-up jobs), closed/paid periods read the frozen PayStatement.
// See ./earnings.ts.
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

    const { jobsWorked, totalEarned, jobs } = await computeWorkerPeriodPay(
      period,
      user.userId,
      financialModel
    );

    return success({
      periodId: period.id,
      periodLabel: `${period.startDate} to ${period.endDate}`,
      periodStatus: period.status,
      startDate: period.startDate,
      endDate: period.endDate,
      jobsWorked,
      totalEarned,
      jobs,
    });
  } catch (err) {
    console.error("[GET /api/worker/pay]", err);
    return error("Failed to fetch pay data", 500);
  }
}

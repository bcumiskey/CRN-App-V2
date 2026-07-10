import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { resolveDateRange } from "@/lib/date-ranges";
import { r2 } from "@/lib/report-utils";

// ---------------------------------------------------------------------------
// GET /api/reports/1099-summary — 1099 Summary
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    const params = request.nextUrl.searchParams;
    // Explicit taxYear wins; otherwise infer it from the selected date range
    // (the web sends only preset/startDate/endDate — e.g. "last_year" in
    // January must show the prior tax year, not the current empty one).
    // With no params at all this resolves to this_month → the current year.
    const explicitTaxYear = params.get("taxYear");
    const taxYear = explicitTaxYear
      ? parseInt(explicitTaxYear, 10)
      : parseInt(
          resolveDateRange(
            params.get("startDate"),
            params.get("endDate"),
            params.get("preset")
          ).endDate.slice(0, 4),
          10
        );

    const settings = await prisma.companySettings.findUnique({
      where: { id: "singleton" },
      select: { contractor1099Threshold: true },
    });
    const threshold = settings?.contractor1099Threshold ?? 600;

    const startDate = `${taxYear}-01-01`;
    const endDate = `${taxYear}-12-31`;

    // 1099-NEC reports amounts ACTUALLY PAID, not recomputed job earnings:
    // sum the frozen pay statements from pay periods of the tax year that
    // have been marked paid (mark-paid flips status to "paid").
    const payPeriods = await prisma.payPeriod.findMany({
      where: {
        status: "paid",
        endDate: { gte: startDate, lte: endDate },
      },
      include: {
        payStatements: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                taxIdOnFile: true,
                mailingAddress: true,
              },
            },
          },
        },
      },
    });

    const workerMap = new Map<
      string,
      {
        name: string;
        totalPaid: number;
        w9OnFile: boolean;
        hasMailingAddress: boolean;
      }
    >();

    for (const pp of payPeriods) {
      for (const ps of pp.payStatements) {
        const existing = workerMap.get(ps.userId);
        if (existing) {
          existing.totalPaid += ps.grossPay;
        } else {
          workerMap.set(ps.userId, {
            name: ps.user.name,
            totalPaid: ps.grossPay,
            w9OnFile: ps.user.taxIdOnFile ?? false,
            hasMailingAddress: !!ps.user.mailingAddress,
          });
        }
      }
    }

    const workers = Array.from(workerMap.entries()).map(([userId, data]) => ({
      userId,
      name: data.name,
      totalPaid: r2(data.totalPaid),
      requires1099: data.totalPaid >= threshold,
      w9OnFile: data.w9OnFile,
      hasMailingAddress: data.hasMailingAddress,
    }));

    workers.sort((a, b) => b.totalPaid - a.totalPaid);

    const requiring1099 = workers.filter((w) => w.requires1099);
    const missingW9 = requiring1099.filter((w) => !w.w9OnFile);

    return success({
      taxYear,
      threshold,
      totalWorkers: workers.length,
      workersRequiring1099: requiring1099.length,
      workersMissingW9: missingW9.length,
      workers,
    });
  } catch (err) {
    console.error("[GET /api/reports/1099-summary]", err);
    return error("Failed to compute 1099 summary", 500);
  }
}

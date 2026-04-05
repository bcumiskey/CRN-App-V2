import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import {
  computeJobFinancials,
  jobIncludeForReports,
  loadFinancialModel,
  r2,
} from "@/lib/report-utils";

// ---------------------------------------------------------------------------
// GET /api/reports/1099-summary — 1099 Summary
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    const params = request.nextUrl.searchParams;
    const now = new Date();
    const taxYear = parseInt(params.get("taxYear") ?? String(now.getFullYear()), 10);

    const settings = await prisma.companySettings.findUnique({
      where: { id: "singleton" },
      select: { contractor1099Threshold: true, financialModel: true },
    });
    const threshold = settings?.contractor1099Threshold ?? 600;
    const financialModel = await loadFinancialModel(prisma);

    const startDate = `${taxYear}-01-01`;
    const endDate = `${taxYear}-12-31`;

    // All completed jobs for the year
    const jobs = await prisma.job.findMany({
      where: {
        status: { in: ["COMPLETED", "INVOICED"] },
        scheduledDate: { gte: startDate, lte: endDate },
      },
      include: jobIncludeForReports,
    });

    const fin = computeJobFinancials(jobs, financialModel);

    // Get W-9 status from user records
    const allWorkerIds = Array.from(fin.perWorkerTotals.keys());
    const users = await prisma.user.findMany({
      where: { id: { in: allWorkerIds } },
      select: { id: true, taxIdOnFile: true, mailingAddress: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const workers = Array.from(fin.perWorkerTotals.entries()).map(
      ([userId, data]) => {
        const user = userMap.get(userId);
        return {
          userId,
          name: data.name,
          totalPaid: r2(data.totalPay),
          requires1099: data.totalPay >= threshold,
          w9OnFile: user?.taxIdOnFile ?? false,
          hasMailingAddress: !!user?.mailingAddress,
        };
      }
    );

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

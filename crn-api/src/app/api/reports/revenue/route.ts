import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { resolveDateRange } from "@/lib/date-ranges";
import {
  computeJobFinancials,
  jobIncludeForReports,
  loadFinancialModel,
  r2,
  type JobWithRelations,
} from "@/lib/report-utils";
import { calculateJob } from "crn-shared";
import type { FinancialModel } from "crn-shared";

// ---------------------------------------------------------------------------
// GET /api/reports/revenue — Revenue Dashboard
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    const params = request.nextUrl.searchParams;
    const range = resolveDateRange(
      params.get("startDate"),
      params.get("endDate"),
      params.get("preset")
    );
    const groupBy = params.get("groupBy") || "month";

    const financialModel = await loadFinancialModel(prisma);

    const jobs = await prisma.job.findMany({
      where: {
        status: { in: ["COMPLETED", "INVOICED"] },
        scheduledDate: { gte: range.startDate, lte: range.endDate },
      },
      include: {
        ...jobIncludeForReports,
        property: {
          select: {
            id: true,
            name: true,
            ownerId: true,
            owner: { select: { id: true, name: true } },
          },
        },
      },
    });

    let breakdown: Record<string, unknown>[] = [];

    switch (groupBy) {
      case "month":
        breakdown = aggregateByMonth(jobs, financialModel);
        break;
      case "property":
        breakdown = aggregateByProperty(jobs, financialModel);
        break;
      case "type":
        breakdown = aggregateByType(jobs, financialModel);
        break;
      case "owner":
        breakdown = aggregateByOwner(jobs, financialModel);
        break;
      default:
        breakdown = aggregateByMonth(jobs, financialModel);
    }

    const totals = computeJobFinancials(jobs, financialModel);

    return success({
      ...range,
      groupBy,
      totalJobs: jobs.length,
      totalGrossRevenue: totals.totalGrossRevenue,
      totalNetRevenue: totals.totalNetRevenue,
      breakdown,
    });
  } catch (err) {
    console.error("[GET /api/reports/revenue]", err);
    return error("Failed to compute revenue report", 500);
  }
}

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------

type JobRow = JobWithRelations & {
  scheduledDate: string;
  jobType: string;
  property: {
    id: string;
    name: string;
    ownerId: string | null;
    owner: { id: string; name: string } | null;
  };
};

function calcGross(job: JobWithRelations, model: FinancialModel): number {
  const r = calculateJob(model, {
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
  return r.grossRevenue;
}

function aggregateByMonth(
  jobs: JobRow[],
  model: FinancialModel
): Record<string, unknown>[] {
  const map = new Map<string, { jobs: number; grossRevenue: number }>();
  for (const job of jobs) {
    const month = job.scheduledDate.substring(0, 7); // YYYY-MM
    const existing = map.get(month);
    const gross = calcGross(job, model);
    if (existing) {
      existing.jobs += 1;
      existing.grossRevenue += gross;
    } else {
      map.set(month, { jobs: 1, grossRevenue: gross });
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      jobs: data.jobs,
      grossRevenue: r2(data.grossRevenue),
    }));
}

function aggregateByProperty(
  jobs: JobRow[],
  model: FinancialModel
): Record<string, unknown>[] {
  const map = new Map<
    string,
    { propertyName: string; jobs: number; grossRevenue: number }
  >();
  for (const job of jobs) {
    const pid = job.property.id;
    const existing = map.get(pid);
    const gross = calcGross(job, model);
    if (existing) {
      existing.jobs += 1;
      existing.grossRevenue += gross;
    } else {
      map.set(pid, {
        propertyName: job.property.name,
        jobs: 1,
        grossRevenue: gross,
      });
    }
  }
  return Array.from(map.entries())
    .map(([propertyId, data]) => ({
      propertyId,
      ...data,
      grossRevenue: r2(data.grossRevenue),
    }))
    .sort((a, b) => b.grossRevenue - a.grossRevenue);
}

function aggregateByType(
  jobs: JobRow[],
  model: FinancialModel
): Record<string, unknown>[] {
  const map = new Map<string, { jobs: number; grossRevenue: number }>();
  for (const job of jobs) {
    const jt = job.jobType;
    const existing = map.get(jt);
    const gross = calcGross(job, model);
    if (existing) {
      existing.jobs += 1;
      existing.grossRevenue += gross;
    } else {
      map.set(jt, { jobs: 1, grossRevenue: gross });
    }
  }
  return Array.from(map.entries())
    .map(([jobType, data]) => ({
      jobType,
      ...data,
      grossRevenue: r2(data.grossRevenue),
    }))
    .sort((a, b) => b.grossRevenue - a.grossRevenue);
}

function aggregateByOwner(
  jobs: JobRow[],
  model: FinancialModel
): Record<string, unknown>[] {
  const map = new Map<
    string,
    { ownerName: string; jobs: number; grossRevenue: number }
  >();
  for (const job of jobs) {
    const oid = job.property.ownerId ?? "unassigned";
    const existing = map.get(oid);
    const gross = calcGross(job, model);
    if (existing) {
      existing.jobs += 1;
      existing.grossRevenue += gross;
    } else {
      map.set(oid, {
        ownerName: job.property.owner?.name ?? "No Owner",
        jobs: 1,
        grossRevenue: gross,
      });
    }
  }
  return Array.from(map.entries())
    .map(([ownerId, data]) => ({
      ownerId,
      ...data,
      grossRevenue: r2(data.grossRevenue),
    }))
    .sort((a, b) => b.grossRevenue - a.grossRevenue);
}

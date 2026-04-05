import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { resolveDateRange } from "@/lib/date-ranges";
import { r2 } from "@/lib/report-utils";

// ---------------------------------------------------------------------------
// GET /api/reports/job-volume — Job Volume
// ---------------------------------------------------------------------------

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

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

    const jobs = await prisma.job.findMany({
      where: {
        scheduledDate: { gte: range.startDate, lte: range.endDate },
        status: { not: "CANCELLED" },
      },
      select: { scheduledDate: true },
    });

    const totalJobs = jobs.length;

    // Days in range
    const daysInRange = calcDaysInRange(range.startDate, range.endDate);
    const avgPerDay = daysInRange > 0 ? r2(totalJobs / daysInRange) : 0;

    // Count by date and day-of-week
    const dateCountMap = new Map<string, number>();
    const dowCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun..Sat

    for (const job of jobs) {
      dateCountMap.set(
        job.scheduledDate,
        (dateCountMap.get(job.scheduledDate) ?? 0) + 1
      );

      const [y, m, d] = job.scheduledDate.split("-").map(Number);
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      dowCounts[dow] += 1;
    }

    // Busiest day
    let busiestDate = "";
    let busiestCount = 0;
    for (const [date, count] of dateCountMap) {
      if (count > busiestCount) {
        busiestDate = date;
        busiestCount = count;
      }
    }

    // Day-of-week distribution
    const dayOfWeekDistribution = DAY_NAMES.map((name, idx) => ({
      day: name,
      count: dowCounts[idx],
    }));

    return success({
      ...range,
      totalJobs,
      avgPerDay,
      busiestDay: {
        date: busiestDate,
        count: busiestCount,
      },
      dayOfWeekDistribution,
    });
  } catch (err) {
    console.error("[GET /api/reports/job-volume]", err);
    return error("Failed to compute job volume report", 500);
  }
}

function calcDaysInRange(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  return Math.floor((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;
}

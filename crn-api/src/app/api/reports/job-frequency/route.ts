import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { resolveDateRange } from "@/lib/date-ranges";
import { r2 } from "@/lib/report-utils";

// ---------------------------------------------------------------------------
// GET /api/reports/job-frequency — Job Frequency per Property
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
        status: { in: ["COMPLETED", "INVOICED", "SCHEDULED", "IN_PROGRESS"] },
        scheduledDate: { gte: range.startDate, lte: range.endDate },
      },
      select: {
        propertyId: true,
        scheduledDate: true,
        isBtoB: true,
        property: { select: { id: true, name: true } },
      },
    });

    // Calculate months in range for avg-per-month
    const monthsInRange = calcMonthsInRange(range.startDate, range.endDate);

    const map = new Map<
      string,
      {
        propertyName: string;
        totalJobs: number;
        b2bCount: number;
        dayCounts: number[]; // [Sun..Sat]
      }
    >();

    for (const job of jobs) {
      const pid = job.propertyId;
      const existing = map.get(pid);

      // Parse day of week from YYYY-MM-DD using UTC to avoid timezone shift
      const [y, m, d] = job.scheduledDate.split("-").map(Number);
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

      if (existing) {
        existing.totalJobs += 1;
        existing.dayCounts[dow] += 1;
        if (job.isBtoB) existing.b2bCount += 1;
      } else {
        const dayCounts = [0, 0, 0, 0, 0, 0, 0];
        dayCounts[dow] = 1;
        map.set(pid, {
          propertyName: job.property.name,
          totalJobs: 1,
          b2bCount: job.isBtoB ? 1 : 0,
          dayCounts,
        });
      }
    }

    const properties = Array.from(map.entries())
      .map(([propertyId, data]) => {
        const maxDayIdx = data.dayCounts.indexOf(
          Math.max(...data.dayCounts)
        );
        return {
          propertyId,
          propertyName: data.propertyName,
          totalJobs: data.totalJobs,
          avgPerMonth: r2(data.totalJobs / Math.max(monthsInRange, 1)),
          mostCommonDay: DAY_NAMES[maxDayIdx],
          b2bPercentage: r2(
            data.totalJobs > 0
              ? (data.b2bCount / data.totalJobs) * 100
              : 0
          ),
        };
      })
      .sort((a, b) => b.totalJobs - a.totalJobs);

    return success({
      ...range,
      propertyCount: properties.length,
      properties,
    });
  } catch (err) {
    console.error("[GET /api/reports/job-frequency]", err);
    return error("Failed to compute job frequency report", 500);
  }
}

function calcMonthsInRange(startDate: string, endDate: string): number {
  const [sy, sm] = startDate.split("-").map(Number);
  const [ey, em] = endDate.split("-").map(Number);
  return (ey - sy) * 12 + (em - sm) + 1;
}

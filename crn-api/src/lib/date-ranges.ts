/**
 * Date range resolution for report endpoints.
 *
 * All dates are YYYY-MM-DD strings. The current year/month/day comes from
 * `todayParts()` (business timezone — the server runs UTC), then everything
 * is formatted manually.
 */

import { todayParts } from "@/lib/business-time";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(year: number, month: number): number {
  // month is 1-based; Date(year, month, 0) gives last day of that month
  return new Date(year, month, 0).getDate();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Quarter helper: returns 1-4 for months 1-12.
 */
function quarterOf(month: number): number {
  return Math.ceil(month / 3);
}

function quarterStartMonth(quarter: number): number {
  return (quarter - 1) * 3 + 1;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

/**
 * Resolve explicit dates, a preset name, or fall back to "this_month".
 */
export function resolveDateRange(
  startDate?: string | null,
  endDate?: string | null,
  preset?: string | null
): DateRange {
  // Explicit dates take priority
  if (startDate && endDate) {
    return { startDate, endDate };
  }

  const { year: curYear, month: curMonth, day: curDay } = todayParts();

  const key = preset || "this_month";

  switch (key) {
    case "this_month":
      return {
        startDate: formatDate(curYear, curMonth, 1),
        endDate: formatDate(curYear, curMonth, lastDayOfMonth(curYear, curMonth)),
      };

    case "last_month": {
      let year = curYear;
      let month = curMonth - 1;
      if (month === 0) {
        month = 12;
        year -= 1;
      }
      return {
        startDate: formatDate(year, month, 1),
        endDate: formatDate(year, month, lastDayOfMonth(year, month)),
      };
    }

    case "this_quarter": {
      const q = quarterOf(curMonth);
      const sm = quarterStartMonth(q);
      const em = sm + 2;
      return {
        startDate: formatDate(curYear, sm, 1),
        endDate: formatDate(curYear, em, lastDayOfMonth(curYear, em)),
      };
    }

    case "ytd":
      return {
        startDate: formatDate(curYear, 1, 1),
        endDate: formatDate(curYear, curMonth, curDay),
      };

    case "this_year":
      return {
        startDate: formatDate(curYear, 1, 1),
        endDate: formatDate(curYear, 12, 31),
      };

    case "last_year":
      return {
        startDate: formatDate(curYear - 1, 1, 1),
        endDate: formatDate(curYear - 1, 12, 31),
      };

    default:
      // Unknown preset — fall back to this_month
      return {
        startDate: formatDate(curYear, curMonth, 1),
        endDate: formatDate(curYear, curMonth, lastDayOfMonth(curYear, curMonth)),
      };
  }
}

/**
 * Business-local calendar dates — the ONE definition of "today", shared.
 *
 * This logic already existed and was already correct... inside crn-api
 * (src/lib/business-time.ts). It was never exported from crn-shared, so crn-web
 * could not import it and every page hand-rolled its own date instead. Two
 * different wrong answers grew:
 *
 *   toISOString().split("T")[0]        -> the UTC date. Wrong for ~4 hours every
 *                                        evening: after 8pm Eastern, UTC has
 *                                        already rolled over to tomorrow.
 *   d.getFullYear()/getMonth()/getDate() -> the BROWSER's date. Right only while
 *                                        the browser's zone happens to match the
 *                                        business's.
 *
 * The bug this fixes: the new-job form defaulted to the UTC date, so a job
 * entered in the local evening was written with tomorrow's date — while the
 * dashboard, correctly using business time, queried today. The row existed and
 * was invisible. It reads to the user as "items missing".
 *
 * Storage is YYYY-MM-DD strings everywhere, so these helpers only ever produce
 * and consume strings — never a Date that a timezone can shift underneath you.
 */

const DEFAULT_TIMEZONE = "America/New_York";

// crn-shared is consumed by both the server and the browser and deliberately
// carries no @types/node — declaring the one global we touch keeps it that way.
declare const process: { env?: Record<string, string | undefined> } | undefined;

export function businessTimezone(): string {
  // Works in both runtimes: the API reads the server env, the browser gets the
  // value inlined at build time via NEXT_PUBLIC_.
  const env =
    (typeof process !== "undefined" && process.env?.BUSINESS_TIMEZONE) ||
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_BUSINESS_TIMEZONE) ||
    "";
  return env || DEFAULT_TIMEZONE;
}

/** A calendar date in the business timezone, as YYYY-MM-DD. */
export function businessYMD(when: Date = new Date(), timeZone = businessTimezone()): string {
  // en-CA renders as YYYY-MM-DD, which is also the storage format.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(when);
}

/** Today, in the business timezone. Use this instead of toISOString().split("T")[0]. */
export function todayYMD(timeZone = businessTimezone()): string {
  return businessYMD(new Date(), timeZone);
}

/** Shift a YYYY-MM-DD string by whole days without ever leaving string-land. */
export function addDaysYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  // Noon UTC: far enough from either midnight that no zone can shift the day.
  const t = new Date(Date.UTC(y, m - 1, d, 12));
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

/** First and last day of a YYYY-MM month, inclusive. */
export function monthRangeYMD(year: number, month: number): { start: string; end: string } {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const p = (n: number) => String(n).padStart(2, "0");
  return { start: `${year}-${p(month)}-01`, end: `${year}-${p(month)}-${p(last)}` };
}

/** The current business month, 1-based. */
export function currentMonthYM(timeZone = businessTimezone()): { year: number; month: number } {
  const [y, m] = todayYMD(timeZone).split("-").map(Number);
  return { year: y, month: m };
}

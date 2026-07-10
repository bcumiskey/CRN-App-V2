/**
 * Business-local time helpers.
 *
 * The API runs on UTC servers (Vercel), but "today", "this month", invoice
 * dates, and report windows must follow the business's local calendar day.
 * The zone comes from BUSINESS_TIMEZONE (IANA name), defaulting to US Eastern.
 *
 * All helpers deal in YYYY-MM-DD strings (Rule #2 — string dates everywhere).
 */

const DEFAULT_TIMEZONE = "America/New_York";

export function businessTimezone(): string {
  return process.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE;
}

export interface DateParts {
  year: number;
  month: number; // 1-based
  day: number;
}

/**
 * Current date parts in the business timezone.
 */
export function todayParts(): DateParts {
  // en-CA formats as YYYY-MM-DD, which is also our storage format.
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: businessTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [year, month, day] = ymd.split("-").map((p) => parseInt(p, 10));
  return { year, month, day };
}

/**
 * Today as a YYYY-MM-DD string in the business timezone.
 */
export function todayYMD(): string {
  const { year, month, day } = todayParts();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Pure calendar arithmetic on YYYY-MM-DD strings (no timezone involved —
 * Date.UTC is used only as an integer calendar, never rendered locally).
 */
export function addDaysYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map((p) => parseInt(p, 10));
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(
    t.getUTCDate()
  ).padStart(2, "0")}`;
}

/**
 * Whole days from `fromYMD` to `toYMD` (positive when `toYMD` is later).
 */
export function diffDaysYMD(fromYMD: string, toYMD: string): number {
  const [fy, fm, fd] = fromYMD.split("-").map((p) => parseInt(p, 10));
  const [ty, tm, td] = toYMD.split("-").map((p) => parseInt(p, 10));
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/**
 * Days until due implied by payment terms text.
 * "Net 30" / "net30" → 30; "Due upon receipt" or anything unrecognized → 0.
 */
export function paymentTermsDays(terms: string | null | undefined): number {
  if (!terms) return 0;
  const match = terms.match(/net\s*(\d{1,3})/i);
  if (match) return parseInt(match[1], 10);
  return 0;
}

/**
 * Due date for an invoice: explicit terms applied to the invoice date.
 */
export function dueDateFromTerms(invoiceDate: string, terms: string | null | undefined): string {
  return addDaysYMD(invoiceDate, paymentTermsDays(terms));
}

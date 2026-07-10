// Shared types and date helpers for the Team Portal section.
// (Not a route file — Next.js only routes page/layout/route special names.)

/** Job shape returned by GET /api/worker/today and /api/worker/schedule */
export interface WorkerJob {
  id: string;
  jobNumber: number;
  scheduledDate: string;
  scheduledTime: string | null;
  jobType: string;
  jobTypeLabel: string | null;
  status: string;
  isBtoB: boolean;
  notes: string | null;
  propertyId: string | null;
  property: { id: string; name: string; address: string | null } | null;
  assignments: { id: string; userName: string }[];
}

// ── Local-date helpers (YYYY-MM-DD strings, no timezone shifting) ────────

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysYMD(ymd: string, days: number): string {
  const d = parseYMD(ymd);
  d.setDate(d.getDate() + days);
  return toYMD(d);
}

/** Sunday of the week containing the given date (matches the API default) */
export function startOfWeekYMD(ymd: string): string {
  return addDaysYMD(ymd, -parseYMD(ymd).getDay());
}

export function todayYMD(): string {
  return toYMD(new Date());
}

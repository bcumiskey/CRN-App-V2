import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { generateJobNumber } from "./job-numbers";
import { sendNotification, notifyJobCancelled } from "./notifications";
import { todayYMD, addDaysYMD } from "./business-time";

// ============================================================
// Types
// ============================================================

export interface NormalizedEvent {
  /** Raw iCal UID. */
  uid: string;
  /**
   * Stable job identity within (source, externalKey).
   * Equal to `uid` for plain events; `${uid}::${YYYY-MM-DD}` for expanded
   * recurrence instances and RECURRENCE-ID overrides.
   */
  externalKey: string;
  summary: string;
  propertyCode: string | null;
  /** Business-timezone calendar date (YYYY-MM-DD). */
  date: string;
  isBtoB: boolean;
  source: string;
  notes: string | null;
  /** True for STATUS:CANCELLED events or METHOD:CANCEL feeds. */
  cancelled: boolean;
  /** Set when the event can't be safely auto-processed (exotic RRULE, etc.). */
  reviewReason: string | null;
}

export interface SyncResult {
  status: "success" | "error" | "partial" | "skipped";
  eventsProcessed: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsSkipped: number;
  eventsCancelled: number;
  jobsFlaggedMissing: number;
  errors: Array<{ eventTitle: string; reason: string }>;
}

export class SyncError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "SyncError";
  }
}

interface PropertyMatch {
  code: string;
  name: string;
  aliases: string[];
}

// ============================================================
// Business-timezone helpers (local mirror)
// ============================================================
// NOTE: These mirror src/lib/business-time.ts (todayYMD / todayParts).
// business-time.ts has no "date of an arbitrary instant" helper, so the
// timed-event conversion lives here. Keep BUSINESS_TIMEZONE behavior in
// sync with that file.

const DEFAULT_TIMEZONE = "America/New_York";

function businessTimezone(): string {
  return process.env.BUSINESS_TIMEZONE || DEFAULT_TIMEZONE;
}

/** Calendar date (YYYY-MM-DD) of an instant in an IANA timezone. */
function dateOfInstantInZone(instant: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD, which is also our storage format.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

function businessDateOfInstant(instant: Date): string {
  return dateOfInstantInZone(instant, businessTimezone());
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedPartsAt(instant: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, number> = {};
  for (const p of fmt.formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = parseInt(p.value, 10);
  }
  // Some ICU versions render midnight as hour 24 with hour12:false.
  if (parts.hour === 24) parts.hour = 0;
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/**
 * Convert a wall-clock time in an IANA timezone to the UTC instant.
 * Two-pass offset probe via Intl (no external libraries).
 */
function wallTimeToUTC(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
  timeZone: string
): Date {
  const target = Date.UTC(y, mo - 1, d, h, mi, s);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const p = zonedPartsAt(new Date(guess), timeZone);
    const rendered = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess += target - rendered;
  }
  return new Date(guess);
}

// ============================================================
// Stage 1: Fetch Feed
// ============================================================

export async function fetchFeed(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "CRN-CalendarSync/2.0",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new SyncError(
        "FETCH_FAILED",
        `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const text = await response.text();

    if (!text.includes("BEGIN:VCALENDAR")) {
      throw new SyncError(
        "INVALID_FEED",
        "Response does not contain valid iCal data (missing BEGIN:VCALENDAR)"
      );
    }

    return text;
  } catch (err) {
    if (err instanceof SyncError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new SyncError("TIMEOUT", "Feed fetch timed out after 30 seconds");
    }
    throw new SyncError(
      "FETCH_FAILED",
      `Failed to fetch feed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ============================================================
// Stage 2: Normalize Events
// ============================================================

export interface ParsedICalDate {
  /** Business-timezone calendar date for timed events; literal date for all-day. */
  date: string;
  isAllDay: boolean;
}

/**
 * Parse an iCal date/date-time property to a YYYY-MM-DD business date.
 *
 * - All-day (VALUE=DATE or bare YYYYMMDD): literal calendar date, no
 *   timezone conversion. Per RFC 5545, an all-day DTEND is EXCLUSIVE.
 * - Timed with Z suffix: UTC instant -> business-timezone calendar date.
 * - Timed with TZID: wall time in that zone -> instant -> business date.
 *   Unknown TZIDs fall back to the business timezone.
 * - Floating (no Z, no TZID): interpreted in the business timezone.
 */
export function parseICalDate(params: string, value: string): ParsedICalDate {
  const v = value.trim();

  const isDateOnly = /VALUE=DATE(?!-TIME)/i.test(params) || /^\d{8}$/.test(v);
  if (isDateOnly) {
    const m = v.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!m) throw new SyncError("INVALID_DATE", `Cannot parse date: ${value}`);
    return { date: `${m[1]}-${m[2]}-${m[3]}`, isAllDay: true };
  }

  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)/);
  if (!m) throw new SyncError("INVALID_DATE", `Cannot parse datetime: ${value}`);
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  const h = parseInt(m[4], 10);
  const mi = parseInt(m[5], 10);
  const s = m[6] ? parseInt(m[6], 10) : 0;

  let instant: Date;
  if (m[7] === "Z") {
    instant = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  } else {
    let tz = businessTimezone();
    const tzidMatch = params.match(/TZID=([^;:]+)/i);
    if (tzidMatch) {
      try {
        // Validate the TZID; throws RangeError for unknown zones.
        new Intl.DateTimeFormat("en-CA", { timeZone: tzidMatch[1] });
        tz = tzidMatch[1];
      } catch {
        // Unknown TZID -> business timezone fallback.
      }
    }
    instant = wallTimeToUTC(y, mo, d, h, mi, s, tz);
  }

  return { date: businessDateOfInstant(instant), isAllDay: false };
}

/**
 * Parse a calendar event summary to extract property code and B2B flag.
 */
export function parseSummary(raw: string): {
  propertyCode: string | null;
  isBtoB: boolean;
} {
  let text = raw;
  // Step 1: Strip ALL emoji (broad Unicode ranges)
  text = text.replace(
    /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FA9F}\u{200D}]/gu,
    ""
  );
  // Step 2: Detect B2B
  const isBtoB = /b2b|back.to.back/i.test(text);
  // Step 3: Strip common prefixes/suffixes
  text = text
    .replace(/\bB2B\b/gi, "")
    .replace(/\bback.to.back\b/gi, "")
    .replace(/^clean(ing)?\s*/i, "")
    .replace(/\s*clean(ing)?$/i, "")
    .replace(/\s*turnover$/i, "")
    .replace(/\s*checkout$/i, "")
    .trim()
    .replace(/\s+/g, " ");
  // Step 4: Return parsed text as potential property code
  return { propertyCode: text || null, isBtoB };
}

/**
 * Match text against known properties by code, name, or alias.
 *
 * EXACT matches only (case- and whitespace-insensitive). Bidirectional
 * substring matching was removed: with properties like "Park" and
 * "Park West" it hijacked bookings across properties. Events that don't
 * match exactly land in unmatched review (or use the CalendarSource's
 * property binding).
 */
export function matchProperty(
  text: string,
  properties: PropertyMatch[]
): string | null {
  if (!text) return null;
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const target = norm(text);
  if (!target) return null;

  for (const p of properties) {
    if (norm(p.code) === target) return p.code;
  }
  for (const p of properties) {
    if (norm(p.name) === target) return p.code;
  }
  for (const p of properties) {
    for (const alias of p.aliases) {
      if (norm(alias) === target) return p.code;
    }
  }
  return null;
}

interface RawVEvent {
  uid: string;
  dtstartParams: string;
  dtstartValue: string;
  summary: string;
  description: string | null;
  status: string | null;
  rrule: string | null;
  recurrenceIdParams: string | null;
  recurrenceIdValue: string | null;
}

function matchProp(
  block: string,
  name: string
): { params: string; value: string } | null {
  const re = new RegExp(`^${name}((?:;[^:\\r\\n]*)?):(.*)$`, "m");
  const m = block.match(re);
  if (!m) return null;
  return { params: m[1] ?? "", value: m[2].trim() };
}

/**
 * Simple VEVENT parser. Extracts UID, DTSTART, SUMMARY, DESCRIPTION, STATUS,
 * RRULE, and RECURRENCE-ID from VEVENT blocks. Regex-based, no npm library.
 */
function parseVEvents(icalText: string): {
  events: RawVEvent[];
  methodCancel: boolean;
} {
  const events: RawVEvent[] = [];

  // Unfold continuation lines (RFC 5545: lines starting with space/tab are continuations)
  const unfolded = icalText.replace(/\r?\n[ \t]/g, "");

  // Calendar-level METHOD:CANCEL applies to every event in the feed.
  const methodCancel = /^METHOD[;:][^\r\n]*CANCEL/im.test(unfolded);

  // Extract VEVENT blocks
  const veventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let match: RegExpExecArray | null;

  while ((match = veventRegex.exec(unfolded)) !== null) {
    const block = match[1];

    const uid = matchProp(block, "UID");
    const dtstart = matchProp(block, "DTSTART");
    const summary = matchProp(block, "SUMMARY");
    const desc = matchProp(block, "DESCRIPTION");
    const status = matchProp(block, "STATUS");
    const rrule = matchProp(block, "RRULE");
    const recurrenceId = matchProp(block, "RECURRENCE-ID");

    if (!uid || !dtstart || !summary) continue;

    events.push({
      uid: uid.value,
      dtstartParams: dtstart.params,
      dtstartValue: dtstart.value,
      summary: summary.value,
      description: desc ? desc.value : null,
      status: status ? status.value : null,
      rrule: rrule ? rrule.value : null,
      recurrenceIdParams: recurrenceId ? recurrenceId.params : null,
      recurrenceIdValue: recurrenceId ? recurrenceId.value : null,
    });
  }

  return { events, methodCancel };
}

// ============================================================
// Recurrence expansion
// ============================================================
// LIMITS (documented behavior):
// - Only FREQ=DAILY and FREQ=WEEKLY with COUNT or UNTIL are expanded
//   (optionally with INTERVAL). These feeds carry bookings, so recurrence
//   is rare and simple when present.
// - Expansion is capped at a 90-day horizon from "today" (business tz)
//   and 100 occurrences.
// - Anything else (BYDAY, MONTHLY, unbounded rules, ...) is routed to
//   unmatched review instead of guessing.
// - Occurrence dates use calendar arithmetic on the first occurrence's
//   business date; a timed recurring event that straddles a DST change
//   very close to midnight could drift a day (acceptable for cleaning
//   bookings).

const RECURRENCE_HORIZON_DAYS = 90;
const MAX_OCCURRENCES = 100;

function expandRRule(
  startDate: string,
  rrule: string
): { dates: string[] } | { exotic: string } {
  const parts: Record<string, string> = {};
  for (const kv of rrule.split(";")) {
    const [k, val] = kv.split("=");
    if (k) parts[k.trim().toUpperCase()] = (val ?? "").trim().toUpperCase();
  }

  const freq = parts["FREQ"];
  if (freq !== "DAILY" && freq !== "WEEKLY") {
    return { exotic: `unsupported FREQ=${freq ?? "(none)"}` };
  }
  const allowed = new Set(["FREQ", "COUNT", "UNTIL", "INTERVAL", "WKST"]);
  for (const k of Object.keys(parts)) {
    if (!allowed.has(k)) return { exotic: `unsupported RRULE part ${k}` };
  }

  const count = parts["COUNT"] ? parseInt(parts["COUNT"], 10) : null;
  let until: string | null = null;
  if (parts["UNTIL"]) {
    const m = parts["UNTIL"].match(/^(\d{4})(\d{2})(\d{2})/);
    if (!m) return { exotic: `unparseable UNTIL=${parts["UNTIL"]}` };
    until = `${m[1]}-${m[2]}-${m[3]}`;
  }
  if (count === null && until === null) {
    return { exotic: "unbounded RRULE (no COUNT/UNTIL)" };
  }

  const interval = parts["INTERVAL"] ? parseInt(parts["INTERVAL"], 10) : 1;
  if (!Number.isFinite(interval) || interval < 1) {
    return { exotic: `invalid INTERVAL=${parts["INTERVAL"]}` };
  }

  const stepDays = (freq === "DAILY" ? 1 : 7) * interval;
  const horizon = addDaysYMD(todayYMD(), RECURRENCE_HORIZON_DAYS);
  const dates: string[] = [];
  let d = startDate;
  for (let i = 0; i < MAX_OCCURRENCES; i++) {
    if (count !== null && i >= count) break;
    if (until !== null && d > until) break;
    if (d > horizon) break;
    dates.push(d);
    d = addDaysYMD(d, stepDays);
  }
  return { dates };
}

export function normalizeEvents(
  icalText: string,
  sourceType: string
): NormalizedEvent[] {
  const { events: rawEvents, methodCancel } = parseVEvents(icalText);
  const src = sourceType === "turno_ical" ? "turno" : "google";

  const masters: RawVEvent[] = [];
  // Keyed `${uid}::${recurrence business date}`
  const overrides = new Map<string, RawVEvent>();

  for (const raw of rawEvents) {
    if (raw.recurrenceIdValue) {
      try {
        const rid = parseICalDate(
          raw.recurrenceIdParams ?? "",
          raw.recurrenceIdValue
        );
        overrides.set(`${raw.uid}::${rid.date}`, raw);
      } catch {
        // Unparseable RECURRENCE-ID: treat as a standalone event.
        masters.push(raw);
      }
    } else {
      masters.push(raw);
    }
  }

  const normalized: NormalizedEvent[] = [];
  const consumedOverrides = new Set<string>();

  const toEvent = (
    raw: RawVEvent,
    externalKey: string,
    dateOverride?: string,
    reviewReason?: string | null
  ): NormalizedEvent | null => {
    try {
      const date =
        dateOverride ?? parseICalDate(raw.dtstartParams, raw.dtstartValue).date;
      const { propertyCode, isBtoB } = parseSummary(raw.summary);
      return {
        uid: raw.uid,
        externalKey,
        summary: raw.summary,
        propertyCode,
        date,
        isBtoB,
        source: src,
        notes: raw.description,
        cancelled:
          methodCancel || (raw.status ?? "").toUpperCase().startsWith("CANCEL"),
        reviewReason: reviewReason ?? null,
      };
    } catch {
      // Skip events that can't be parsed (e.g., invalid dates)
      return null;
    }
  };

  for (const raw of masters) {
    let startDate: string;
    try {
      startDate = parseICalDate(raw.dtstartParams, raw.dtstartValue).date;
    } catch {
      continue;
    }

    if (raw.rrule) {
      const expanded = expandRRule(startDate, raw.rrule);
      if ("exotic" in expanded) {
        const ev = toEvent(
          raw,
          raw.uid,
          startDate,
          `Recurring event needs manual review: ${expanded.exotic}`
        );
        if (ev) normalized.push(ev);
        continue;
      }
      for (const occDate of expanded.dates) {
        const key = `${raw.uid}::${occDate}`;
        const override = overrides.get(key);
        if (override) {
          consumedOverrides.add(key);
          // Override supplies its own DTSTART (the instance may have moved).
          const ev = toEvent(override, key);
          if (ev) normalized.push(ev);
        } else {
          const ev = toEvent(raw, key, occDate);
          if (ev) normalized.push(ev);
        }
      }
    } else {
      const ev = toEvent(raw, raw.uid, startDate);
      if (ev) normalized.push(ev);
    }
  }

  // Orphan overrides (master missing, or the instance is outside the
  // expansion horizon): treat as standalone events with recurrence keys.
  for (const [key, override] of overrides) {
    if (consumedOverrides.has(key)) continue;
    const ev = toEvent(override, key);
    if (ev) normalized.push(ev);
  }

  return normalized;
}

// ============================================================
// Notifications (admin alerts — conservative, never destructive)
// ============================================================

async function activeAdmins(): Promise<Array<{ id: string }>> {
  return prisma.user.findMany({
    where: { role: "admin", status: "active" },
    select: { id: true },
  });
}

async function notifyAdmins(title: string, body: string, jobId?: string) {
  const admins = await activeAdmins();
  for (const admin of admins) {
    await sendNotification({
      userId: admin.id,
      title,
      body,
      entityType: jobId ? "job" : "sync",
      entityId: jobId,
    });
  }
}

/**
 * Notify admins once per (title, entity): syncs run hourly, so repeated
 * conditions (missing booking, un-cancellable upstream cancellation) must
 * not spam a fresh notification every run.
 */
async function notifyAdminsOnce(title: string, body: string, jobId: string) {
  const admins = await activeAdmins();
  for (const admin of admins) {
    const existing = await prisma.notification.findFirst({
      where: { userId: admin.id, title, entityType: "job", entityId: jobId },
    });
    if (existing) continue;
    await sendNotification({
      userId: admin.id,
      title,
      body,
      entityType: "job",
      entityId: jobId,
    });
  }
}

const TITLE_CANCELLED_UPSTREAM = "Booking cancelled upstream";
const TITLE_CANCEL_NEEDS_REVIEW = "Upstream cancellation needs review";
const TITLE_MISSING_FROM_FEED = "Booking missing from calendar feed";
const TITLE_BOOKING_REACTIVATED = "Cancelled job's booking reappeared";

// ============================================================
// Unmatched review entries (upsert-by-key, no per-run duplicates)
// ============================================================

async function upsertUnmatchedEvent(
  calendarSourceId: string,
  syncLogId: string,
  event: NormalizedEvent,
  reason: string
): Promise<void> {
  const existing = await prisma.unmatchedSyncEvent.findFirst({
    where: { calendarSourceId, uid: event.externalKey },
    orderBy: { createdAt: "desc" },
  });

  const rawData = {
    source: event.source,
    isBtoB: event.isBtoB,
    notes: event.notes,
    propertyCode: event.propertyCode,
    reason,
  };

  if (existing) {
    // Already assigned or dismissed: Alex made a call — don't resurface.
    if (existing.status !== "pending") return;
    await prisma.unmatchedSyncEvent.update({
      where: { id: existing.id },
      data: {
        syncLogId,
        rawSummary: event.summary,
        date: event.date,
        rawData,
      },
    });
    return;
  }

  await prisma.unmatchedSyncEvent.create({
    data: {
      calendarSourceId,
      syncLogId,
      uid: event.externalKey,
      rawSummary: event.summary,
      date: event.date,
      rawData,
      status: "pending",
    },
  });
}

// ============================================================
// Job storage helpers
// ============================================================

type JobRecord = Prisma.JobGetPayload<Record<string, never>>;

/**
 * Apply feed updates to an existing synced job.
 * ONLY touches scheduledDate, isBtoB, rawSummary. NEVER touches totalFee,
 * houseCutPercent, assignments, notes, status, propertyId, or syncLocked.
 * Locked jobs and jobs that progressed past SCHEDULED are never modified.
 */
async function applyFeedUpdate(
  job: JobRecord,
  event: NormalizedEvent,
  result: SyncResult,
  adoptExternalKey = false
): Promise<void> {
  if (job.syncLocked || job.status !== "SCHEDULED") {
    result.eventsSkipped++;
    return;
  }

  const unchanged =
    job.scheduledDate === event.date &&
    job.isBtoB === event.isBtoB &&
    job.rawSummary === event.summary &&
    (!adoptExternalKey || job.externalId === event.externalKey);
  if (unchanged) {
    result.eventsSkipped++;
    return;
  }

  await prisma.job.update({
    where: { id: job.id },
    data: {
      scheduledDate: event.date,
      isBtoB: event.isBtoB,
      rawSummary: event.summary,
      ...(adoptExternalKey ? { externalId: event.externalKey } : {}),
    },
  });
  result.eventsUpdated++;
}

async function createJobFromEvent(
  event: NormalizedEvent,
  propertyId: string,
  property: { defaultJobFee: number | null; houseCutPercent: number },
  result: SyncResult
): Promise<void> {
  try {
    const jobNumber = await generateJobNumber();
    await prisma.job.create({
      data: {
        jobNumber,
        propertyId,
        scheduledDate: event.date,
        totalFee: property.defaultJobFee ?? 0,
        houseCutPercent: property.houseCutPercent,
        source: event.source,
        externalId: event.externalKey,
        rawSummary: event.summary,
        isBtoB: event.isBtoB,
        syncLocked: false,
        status: "SCHEDULED",
        notes: event.notes,
      },
    });
    result.eventsCreated++;
  } catch (err) {
    // Unique-violation race on (source, externalId): another run created
    // the job between our lookup and this insert. Re-fetch and update.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const winner = await prisma.job.findFirst({
        where: {
          source: event.source,
          externalId: event.externalKey,
          status: { not: "CANCELLED" },
        },
        orderBy: { createdAt: "asc" },
      });
      if (winner) {
        await applyFeedUpdate(winner, event, result);
        return;
      }
      // P2002 but no (source, externalId) winner: the violation came from a
      // different unique constraint (e.g. a jobNumber collision when two
      // DIFFERENT sources sync concurrently — the in-flight guard is
      // per-source). Rethrow so the per-event catch records it in
      // result.errors instead of silently swallowing the event; the next
      // run will create the job with a fresh job number.
      throw err;
    }
    throw err;
  }
}

/**
 * Handle an explicit upstream cancellation (STATUS:CANCELLED / METHOD:CANCEL)
 * for a matched job.
 * - SCHEDULED, not locked, no charges: cancel the job + notify Alex and
 *   assigned workers.
 * - Anything else (IN_PROGRESS/COMPLETED/INVOICED, locked, or has charges):
 *   NEVER touch the job — notify Alex for manual review (deduped).
 */
async function handleUpstreamCancellation(
  job: JobRecord,
  sourceName: string,
  result: SyncResult
): Promise<void> {
  const chargesCount = await prisma.jobCharge.count({
    where: { jobId: job.id },
  });

  const property = await prisma.property.findUnique({
    where: { id: job.propertyId },
    select: { name: true },
  });
  const propertyName = property?.name ?? "unknown property";

  if (job.status === "SCHEDULED" && !job.syncLocked && chargesCount === 0) {
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "CANCELLED" },
    });
    await notifyAdmins(
      TITLE_CANCELLED_UPSTREAM,
      `Booking for ${job.jobNumber} at ${propertyName} on ${job.scheduledDate} was cancelled in "${sourceName}". The job was cancelled to match.`,
      job.id
    );
    const assignments = await prisma.jobAssignment.findMany({
      where: { jobId: job.id },
      select: { userId: true },
    });
    for (const a of assignments) {
      await notifyJobCancelled(
        a.userId,
        job.jobNumber,
        propertyName,
        job.scheduledDate
      );
    }
    result.eventsCancelled++;
    return;
  }

  const why =
    job.status !== "SCHEDULED"
      ? `the job is already ${job.status}`
      : chargesCount > 0
        ? "the job has charges"
        : "the job was manually edited (sync-locked)";
  await notifyAdminsOnce(
    TITLE_CANCEL_NEEDS_REVIEW,
    `Booking for ${job.jobNumber} at ${propertyName} on ${job.scheduledDate} was cancelled upstream in "${sourceName}", but ${why}. Review it manually — nothing was changed.`,
    job.id
  );
  result.eventsSkipped++;
}

// ============================================================
// Main Orchestrator: runSync
// ============================================================

const STALE_SYNC_MINUTES = 15;

export async function runSync(sourceId: string): Promise<SyncResult> {
  const startTime = Date.now();

  const result: SyncResult = {
    status: "success",
    eventsProcessed: 0,
    eventsCreated: 0,
    eventsUpdated: 0,
    eventsSkipped: 0,
    eventsCancelled: 0,
    jobsFlaggedMissing: 0,
    errors: [],
  };

  let source;
  let claimed = false;

  try {
    // Load calendar source
    source = await prisma.calendarSource.findUnique({
      where: { id: sourceId },
    });

    if (!source) {
      throw new SyncError("SOURCE_NOT_FOUND", `Calendar source ${sourceId} not found`);
    }

    if (!source.url) {
      throw new SyncError("NO_URL", "Calendar source has no URL configured");
    }

    // --------------------------------------------------------
    // Per-source in-flight guard: claim the row so cron and manual
    // syncs can't interleave. Race-safe (single conditional UPDATE)
    // and self-healing: a 'syncing' claim older than 15 minutes
    // (crashed run) is claimable.
    // --------------------------------------------------------
    const staleCutoff = new Date(Date.now() - STALE_SYNC_MINUTES * 60 * 1000);
    const claim = await prisma.calendarSource.updateMany({
      where: {
        id: sourceId,
        OR: [
          { lastSyncStatus: null },
          { lastSyncStatus: { not: "syncing" } },
          { lastSyncStartedAt: null },
          { lastSyncStartedAt: { lt: staleCutoff } },
        ],
      },
      data: { lastSyncStatus: "syncing", lastSyncStartedAt: new Date() },
    });
    if (claim.count === 0) {
      return {
        ...result,
        status: "skipped",
        errors: [
          {
            eventTitle: "SYNC_PIPELINE",
            reason: "Sync already in progress for this source",
          },
        ],
      };
    }
    claimed = true;

    // Stage 1: Fetch
    const icalText = await fetchFeed(source.url);

    // Stage 2: Normalize
    const events = normalizeEvents(icalText, source.type);
    result.eventsProcessed = events.length;

    // Load all active properties with aliases for matching
    const properties = await prisma.property.findMany({
      where: { status: "active" },
      select: {
        id: true,
        code: true,
        name: true,
        aliases: true,
        defaultJobFee: true,
        houseCutPercent: true,
      },
    });

    const propertyMatches: PropertyMatch[] = properties.map((p) => ({
      code: p.code,
      name: p.name,
      aliases: p.aliases,
    }));

    // Create sync log entry
    const syncLog = await prisma.syncLog.create({
      data: {
        calendarSourceId: sourceId,
        status: "success",
        startedAt: new Date(),
      },
    });

    const sourceTypeKey = source.type === "turno_ical" ? "turno" : "google";
    // Keys of ACTIVE (non-cancelled, non-review) events in this feed —
    // used to keep fallback matching from swallowing a second same-day
    // booking, and for disappearance detection.
    const activeKeys = new Set(
      events.filter((e) => !e.cancelled && !e.reviewReason).map((e) => e.externalKey)
    );
    const allKeys = events.map((e) => e.externalKey);

    // Process each event
    for (const event of events) {
      try {
        // Exotic recurrence (or similar): unmatched review, never guess.
        if (event.reviewReason) {
          await upsertUnmatchedEvent(sourceId, syncLog.id, event, event.reviewReason);
          result.eventsSkipped++;
          result.errors.push({
            eventTitle: event.summary,
            reason: event.reviewReason,
          });
          continue;
        }

        // ------------------------------------------------------
        // Job identity: (source, externalId) FIRST — regardless of
        // propertyId, so re-assigning a job's property or a partial
        // rename never causes re-creation.
        // ------------------------------------------------------
        const existing = await prisma.job.findFirst({
          where: {
            source: event.source,
            externalId: event.externalKey,
            status: { not: "CANCELLED" },
          },
          orderBy: { createdAt: "asc" },
        });
        const existingCancelled = existing
          ? null
          : await prisma.job.findFirst({
              where: {
                source: event.source,
                externalId: event.externalKey,
                status: "CANCELLED",
              },
              orderBy: { createdAt: "asc" },
            });

        // Explicit upstream cancellation
        if (event.cancelled) {
          if (existing) {
            await handleUpstreamCancellation(existing, source.name, result);
          } else {
            // No active job (never created, or already cancelled) — nothing to do.
            result.eventsSkipped++;
          }
          continue;
        }

        // Active event whose job was cancelled (by us or by Alex):
        // never auto-resurrect — notify once for manual review.
        if (existingCancelled) {
          await notifyAdminsOnce(
            TITLE_BOOKING_REACTIVATED,
            `The booking for cancelled job ${existingCancelled.jobNumber} (${existingCancelled.scheduledDate}) is active again in "${source.name}". Re-schedule it manually if the booking is back on.`,
            existingCancelled.id
          );
          result.eventsSkipped++;
          continue;
        }

        if (existing) {
          await applyFeedUpdate(existing, event, result);
          continue;
        }

        // ------------------------------------------------------
        // No identity match — resolve a property to fallback/create.
        // Binding first, then EXACT code/name/alias, else review.
        // ------------------------------------------------------
        let propertyId: string | null = null;
        let matchedProperty: (typeof properties)[number] | undefined;

        if (source.propertyId) {
          propertyId = source.propertyId;
          matchedProperty = properties.find((p) => p.id === source!.propertyId);
        } else if (event.propertyCode) {
          const matchedCode = matchProperty(event.propertyCode, propertyMatches);
          if (matchedCode) {
            matchedProperty = properties.find((p) => p.code === matchedCode);
            propertyId = matchedProperty?.id ?? null;
          }
        }

        if (!propertyId || !matchedProperty) {
          await upsertUnmatchedEvent(
            sourceId,
            syncLog.id,
            event,
            "No matching property found"
          );
          result.eventsSkipped++;
          result.errors.push({
            eventTitle: event.summary,
            reason: "No matching property found",
          });
          continue;
        }

        // ------------------------------------------------------
        // Fallback matching (UID churn): same property + date + source,
        // NEVER CANCELLED/COMPLETED/INVOICED, and NEVER a job whose
        // externalId corresponds to another active event in this feed
        // (that would swallow a genuine second same-day booking).
        // ------------------------------------------------------
        const candidates = await prisma.job.findMany({
          where: {
            propertyId,
            scheduledDate: event.date,
            source: event.source,
            status: { in: ["SCHEDULED", "IN_PROGRESS"] },
          },
          orderBy: { createdAt: "asc" },
        });
        const fallback = candidates.find(
          (j) => !j.externalId || !activeKeys.has(j.externalId)
        );

        if (fallback) {
          // Adopt the new externalId so future runs match by identity.
          await applyFeedUpdate(fallback, event, result, true);
          continue;
        }

        // Stage 4: Create (handles the P2002 unique-violation race)
        await createJobFromEvent(
          event,
          propertyId,
          {
            defaultJobFee: matchedProperty.defaultJobFee,
            houseCutPercent: matchedProperty.houseCutPercent,
          },
          result
        );
      } catch (eventErr) {
        result.errors.push({
          eventTitle: event.summary,
          reason:
            eventErr instanceof Error ? eventErr.message : String(eventErr),
        });
      }
    }

    // --------------------------------------------------------
    // Disappearance detection. Absence from the feed is NOT a
    // cancellation (feeds window out past events) — but a SCHEDULED
    // job whose event vanished while its date is today-or-later AND
    // inside the feed's covered window gets flagged (notification
    // only, NEVER auto-deleted or auto-cancelled).
    // Only runs when jobs can be attributed to this feed: the source
    // is property-bound, or it is the only active source of its type.
    // --------------------------------------------------------
    try {
      if (events.length > 0) {
        const sameTypeActive = await prisma.calendarSource.count({
          where: { type: source.type, isActive: true, url: { not: null } },
        });
        if (source.propertyId || sameTypeActive === 1) {
          const dates = events.map((e) => e.date).sort();
          const minDate = dates[0];
          const maxDate = dates[dates.length - 1];
          const today = todayYMD();
          const windowStart = today > minDate ? today : minDate;

          if (windowStart <= maxDate) {
            const missing = await prisma.job.findMany({
              where: {
                source: sourceTypeKey,
                status: "SCHEDULED",
                scheduledDate: { gte: windowStart, lte: maxDate },
                externalId: { not: null, notIn: allKeys },
                ...(source.propertyId ? { propertyId: source.propertyId } : {}),
              },
              include: { property: { select: { name: true } } },
            });
            for (const job of missing) {
              await notifyAdminsOnce(
                TITLE_MISSING_FROM_FEED,
                `${job.jobNumber} at ${job.property.name} on ${job.scheduledDate} is still SCHEDULED but its booking no longer appears in "${source.name}". Review it — cancel manually if the booking is gone.`,
                job.id
              );
              result.jobsFlaggedMissing++;
            }
          }
        }
      }
    } catch (flagErr) {
      result.errors.push({
        eventTitle: "MISSING_JOB_CHECK",
        reason: flagErr instanceof Error ? flagErr.message : String(flagErr),
      });
    }

    // Determine final status
    const progressed =
      result.eventsCreated + result.eventsUpdated + result.eventsCancelled;
    if (result.errors.length > 0 && progressed > 0) {
      result.status = "partial";
    } else if (result.errors.length > 0 && progressed === 0) {
      result.status = "error";
    }

    const durationMs = Date.now() - startTime;

    // Update sync log
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: result.status,
        eventsProcessed: result.eventsProcessed,
        eventsCreated: result.eventsCreated,
        eventsUpdated: result.eventsUpdated,
        eventsSkipped: result.eventsSkipped,
        errors: result.errors.length > 0 ? result.errors : undefined,
        completedAt: new Date(),
        durationMs,
      },
    });

    // Update source status (also releases the in-flight claim)
    await prisma.calendarSource.update({
      where: { id: sourceId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: result.status,
        lastSyncError:
          result.status === "error" && result.errors.length > 0
            ? result.errors[0].reason
            : null,
      },
    });

    return result;
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Create error sync log
    await prisma.syncLog.create({
      data: {
        calendarSourceId: sourceId,
        status: "error",
        errors: [{ eventTitle: "SYNC_PIPELINE", reason: errorMsg }],
        startedAt: new Date(startTime),
        completedAt: new Date(),
        durationMs,
      },
    });

    // Update source status (releases the in-flight claim if we held it)
    if (source && (claimed || !source.url)) {
      await prisma.calendarSource.update({
        where: { id: sourceId },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: "error",
          lastSyncError: errorMsg,
        },
      });
    }

    return {
      status: "error",
      eventsProcessed: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsSkipped: 0,
      eventsCancelled: 0,
      jobsFlaggedMissing: 0,
      errors: [{ eventTitle: "SYNC_PIPELINE", reason: errorMsg }],
    };
  }
}

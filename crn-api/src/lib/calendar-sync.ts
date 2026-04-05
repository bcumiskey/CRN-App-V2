import { prisma } from "./prisma";
import { generateJobNumber } from "./job-numbers";

// ============================================================
// Types
// ============================================================

export interface NormalizedEvent {
  uid: string;
  summary: string;
  propertyCode: string | null;
  date: string;
  isBtoB: boolean;
  source: string;
  notes: string | null;
}

export interface SyncResult {
  status: "success" | "error" | "partial";
  eventsProcessed: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsSkipped: number;
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

/**
 * Parse a DTSTART value to YYYY-MM-DD.
 * CRITICAL: NO `new Date()`. NO timezone conversion. Pure regex.
 * Handles: 20260415, 20260415T090000, 20260415T090000Z, TZID=...:20260415T090000
 */
export function parseDateString(dtstart: string): string {
  const match = dtstart.match(/(\d{4})(\d{2})(\d{2})/);
  if (!match) throw new SyncError("INVALID_DATE", `Cannot parse: ${dtstart}`);
  return `${match[1]}-${match[2]}-${match[3]}`;
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
 */
export function matchProperty(
  text: string,
  properties: PropertyMatch[]
): string | null {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  // Try exact code match (case-insensitive)
  for (const p of properties) {
    if (p.code.toLowerCase() === lower) return p.code;
  }

  // Try exact name match (case-insensitive)
  for (const p of properties) {
    if (p.name.toLowerCase() === lower) return p.code;
  }

  // Try alias match (case-insensitive)
  for (const p of properties) {
    for (const alias of p.aliases) {
      if (alias.toLowerCase() === lower) return p.code;
    }
  }

  // Try partial name match (text contains property name or vice versa)
  for (const p of properties) {
    const pName = p.name.toLowerCase();
    if (lower.includes(pName) || pName.includes(lower)) return p.code;
  }

  return null;
}

/**
 * Simple VEVENT parser. Extracts UID, DTSTART, SUMMARY, DESCRIPTION from VEVENT blocks.
 * Does NOT use an npm library -- focused regex-based parser.
 */
function parseVEvents(
  icalText: string
): Array<{
  uid: string;
  dtstart: string;
  summary: string;
  description: string | null;
}> {
  const events: Array<{
    uid: string;
    dtstart: string;
    summary: string;
    description: string | null;
  }> = [];

  // Unfold continuation lines (RFC 5545: lines starting with space/tab are continuations)
  const unfolded = icalText.replace(/\r?\n[ \t]/g, "");

  // Extract VEVENT blocks
  const veventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let match: RegExpExecArray | null;

  while ((match = veventRegex.exec(unfolded)) !== null) {
    const block = match[1];

    const uidMatch = block.match(/^UID[;:](.*)$/m);
    const dtstartMatch = block.match(/^DTSTART[;:](.*)$/m);
    const summaryMatch = block.match(/^SUMMARY[;:](.*)$/m);
    const descMatch = block.match(/^DESCRIPTION[;:](.*)$/m);

    if (!uidMatch || !dtstartMatch || !summaryMatch) continue;

    events.push({
      uid: uidMatch[1].trim(),
      dtstart: dtstartMatch[1].trim(),
      summary: summaryMatch[1].trim(),
      description: descMatch ? descMatch[1].trim() : null,
    });
  }

  return events;
}

export function normalizeEvents(
  icalText: string,
  sourceType: string
): NormalizedEvent[] {
  const rawEvents = parseVEvents(icalText);
  const normalized: NormalizedEvent[] = [];

  for (const raw of rawEvents) {
    try {
      const date = parseDateString(raw.dtstart);
      const { propertyCode, isBtoB } = parseSummary(raw.summary);

      normalized.push({
        uid: raw.uid,
        summary: raw.summary,
        propertyCode,
        date,
        isBtoB,
        source: sourceType === "turno_ical" ? "turno" : "google",
        notes: raw.description,
      });
    } catch {
      // Skip events that can't be parsed (e.g., invalid dates)
      continue;
    }
  }

  return normalized;
}

// ============================================================
// Stage 3: Dedup
// ============================================================

export async function dedupEvent(
  event: NormalizedEvent,
  propertyId: string,
  tx: typeof prisma
): Promise<{ action: "create" | "update" | "skip"; existingJobId?: string }> {
  // Check by externalId (iCal UID) + propertyId -- strongest match
  if (event.uid) {
    const existing = await tx.job.findFirst({
      where: {
        externalId: event.uid,
        propertyId,
      },
    });

    if (existing) {
      if (existing.syncLocked) return { action: "skip", existingJobId: existing.id };
      return { action: "update", existingJobId: existing.id };
    }
  }

  // Fallback: check by propertyId + date + source != "manual"
  const fallback = await tx.job.findFirst({
    where: {
      propertyId,
      scheduledDate: event.date,
      source: { not: "manual" },
    },
  });

  if (fallback) {
    if (fallback.syncLocked) return { action: "skip", existingJobId: fallback.id };
    return { action: "update", existingJobId: fallback.id };
  }

  return { action: "create" };
}

// ============================================================
// Stage 4: Store Event
// ============================================================

export async function storeEvent(
  event: NormalizedEvent,
  action: "create" | "update" | "skip",
  propertyId: string,
  property: { defaultJobFee: number | null; houseCutPercent: number },
  existingJobId: string | undefined,
  tx: typeof prisma
): Promise<void> {
  if (action === "skip") return;

  if (action === "create") {
    const jobNumber = await generateJobNumber();
    await tx.job.create({
      data: {
        jobNumber,
        propertyId,
        scheduledDate: event.date,
        totalFee: property.defaultJobFee ?? 0,
        houseCutPercent: property.houseCutPercent,
        source: event.source,
        externalId: event.uid,
        rawSummary: event.summary,
        isBtoB: event.isBtoB,
        syncLocked: false,
        status: "SCHEDULED",
        notes: event.notes,
      },
    });
  }

  if (action === "update" && existingJobId) {
    // ONLY update scheduledDate, isBtoB, rawSummary
    // NEVER touch totalFee, houseCutPercent, assignments, notes, status, or syncLocked
    await tx.job.update({
      where: { id: existingJobId },
      data: {
        scheduledDate: event.date,
        isBtoB: event.isBtoB,
        rawSummary: event.summary,
      },
    });
  }
}

// ============================================================
// Main Orchestrator: runSync
// ============================================================

export async function runSync(sourceId: string): Promise<SyncResult> {
  const startTime = Date.now();

  const result: SyncResult = {
    status: "success",
    eventsProcessed: 0,
    eventsCreated: 0,
    eventsUpdated: 0,
    eventsSkipped: 0,
    errors: [],
  };

  let source;

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

    // Process each event
    for (const event of events) {
      try {
        // Match property
        let propertyId: string | null = null;
        let matchedProperty: (typeof properties)[number] | undefined;

        // If source is tied to a single property, use that
        if (source.propertyId) {
          propertyId = source.propertyId;
          matchedProperty = properties.find((p) => p.id === source!.propertyId);
        } else if (event.propertyCode) {
          // Try matching from the summary
          const matchedCode = matchProperty(event.propertyCode, propertyMatches);
          if (matchedCode) {
            matchedProperty = properties.find((p) => p.code === matchedCode);
            propertyId = matchedProperty?.id ?? null;
          }
        }

        if (!propertyId || !matchedProperty) {
          // Store as unmatched
          await prisma.unmatchedSyncEvent.create({
            data: {
              calendarSourceId: sourceId,
              syncLogId: syncLog.id,
              uid: event.uid,
              rawSummary: event.summary,
              date: event.date,
              rawData: {
                source: event.source,
                isBtoB: event.isBtoB,
                notes: event.notes,
                propertyCode: event.propertyCode,
              },
              status: "pending",
            },
          });
          result.eventsSkipped++;
          result.errors.push({
            eventTitle: event.summary,
            reason: "No matching property found",
          });
          continue;
        }

        // Stage 3: Dedup
        const { action, existingJobId } = await dedupEvent(
          event,
          propertyId,
          prisma
        );

        // Stage 4: Store
        await storeEvent(
          event,
          action,
          propertyId,
          {
            defaultJobFee: matchedProperty.defaultJobFee,
            houseCutPercent: matchedProperty.houseCutPercent,
          },
          existingJobId,
          prisma
        );

        if (action === "create") result.eventsCreated++;
        if (action === "update") result.eventsUpdated++;
        if (action === "skip") result.eventsSkipped++;
      } catch (eventErr) {
        result.errors.push({
          eventTitle: event.summary,
          reason:
            eventErr instanceof Error ? eventErr.message : String(eventErr),
        });
      }
    }

    // Determine final status
    if (result.errors.length > 0 && result.eventsCreated + result.eventsUpdated > 0) {
      result.status = "partial";
    } else if (result.errors.length > 0 && result.eventsCreated + result.eventsUpdated === 0) {
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

    // Update source status
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

    // Update source status
    if (source) {
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
      errors: [{ eventTitle: "SYNC_PIPELINE", reason: errorMsg }],
    };
  }
}

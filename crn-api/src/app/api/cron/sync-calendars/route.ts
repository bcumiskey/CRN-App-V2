import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error } from "@/lib/responses";
import { runSync, SyncResult } from "@/lib/calendar-sync";

// ---------------------------------------------------------------------------
// GET|POST /api/cron/sync-calendars — Cron-triggered calendar sync
// ---------------------------------------------------------------------------
// Vercel Cron invokes this with GET and, when the CRON_SECRET env var is
// set, an "Authorization: Bearer <CRON_SECRET>" header. POST is kept for
// manual/legacy invocation (also accepts the legacy x-cron-secret header).
// If CRON_SECRET is not configured, ALL requests are rejected — this
// endpoint must never run unauthenticated.
// Finds all active sources where lastSyncAt + syncIntervalMinutes < now.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;
  // Legacy header (pre-v2.2.1 manual invocations)
  if (request.headers.get("x-cron-secret") === secret) return true;
  return false;
}

async function handleCronSync(request: NextRequest) {
  if (!isAuthorized(request)) {
    return error("Unauthorized", 401);
  }

  try {
    const now = new Date();

    // Find all active sources with a URL
    const sources = await prisma.calendarSource.findMany({
      where: {
        isActive: true,
        url: { not: null },
      },
    });

    // Filter to sources that are due for sync
    const dueSources = sources.filter((source) => {
      if (!source.lastSyncAt) return true; // Never synced — due now
      const intervalMs = source.syncIntervalMinutes * 60 * 1000;
      const nextSyncAt = new Date(source.lastSyncAt.getTime() + intervalMs);
      return now >= nextSyncAt;
    });

    const results: Array<{
      sourceId: string;
      sourceName: string;
      result: SyncResult;
    }> = [];

    for (const source of dueSources) {
      const syncResult = await runSync(source.id);
      results.push({
        sourceId: source.id,
        sourceName: source.name,
        result: syncResult,
      });
    }

    const summary = {
      checkedSources: sources.length,
      syncedSources: dueSources.length,
      successful: results.filter((r) => r.result.status === "success").length,
      partial: results.filter((r) => r.result.status === "partial").length,
      failed: results.filter((r) => r.result.status === "error").length,
      skipped: results.filter((r) => r.result.status === "skipped").length,
      totalEventsCreated: results.reduce(
        (sum, r) => sum + r.result.eventsCreated,
        0
      ),
      totalEventsUpdated: results.reduce(
        (sum, r) => sum + r.result.eventsUpdated,
        0
      ),
      totalEventsCancelled: results.reduce(
        (sum, r) => sum + r.result.eventsCancelled,
        0
      ),
      results,
    };

    return success(summary);
  } catch (err) {
    console.error("[/api/cron/sync-calendars]", err);
    return error("Cron sync failed", 500);
  }
}

export async function GET(request: NextRequest) {
  return handleCronSync(request);
}

export async function POST(request: NextRequest) {
  return handleCronSync(request);
}

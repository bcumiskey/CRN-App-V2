import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error } from "@/lib/responses";
import { runSync, SyncResult } from "@/lib/calendar-sync";

// ---------------------------------------------------------------------------
// POST /api/cron/sync-calendars — Cron-triggered calendar sync
// ---------------------------------------------------------------------------
// Auth: CRON_SECRET header, NOT Clerk.
// Finds all active sources where lastSyncAt + syncIntervalMinutes < now.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // Auth: check CRON_SECRET header
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
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
      totalEventsCreated: results.reduce(
        (sum, r) => sum + r.result.eventsCreated,
        0
      ),
      totalEventsUpdated: results.reduce(
        (sum, r) => sum + r.result.eventsUpdated,
        0
      ),
      results,
    };

    return success(summary);
  } catch (err) {
    console.error("[POST /api/cron/sync-calendars]", err);
    return error("Cron sync failed", 500);
  }
}

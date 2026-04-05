import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { runSync, SyncResult } from "@/lib/calendar-sync";

// ---------------------------------------------------------------------------
// POST /api/calendar-sources/sync-all — Sync all active sources
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    const sources = await prisma.calendarSource.findMany({
      where: { isActive: true, url: { not: null } },
    });

    const results: Array<{
      sourceId: string;
      sourceName: string;
      result: SyncResult;
    }> = [];

    for (const source of sources) {
      const syncResult = await runSync(source.id);
      results.push({
        sourceId: source.id,
        sourceName: source.name,
        result: syncResult,
      });
    }

    const summary = {
      totalSources: results.length,
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
    console.error("[POST /api/calendar-sources/sync-all]", err);
    return error("Sync-all failed", 500);
  }
}

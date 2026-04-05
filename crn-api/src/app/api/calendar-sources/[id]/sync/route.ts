import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error, notFound } from "@/lib/responses";
import { runSync } from "@/lib/calendar-sync";

// ---------------------------------------------------------------------------
// POST /api/calendar-sources/[id]/sync — Trigger manual sync
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const source = await prisma.calendarSource.findUnique({ where: { id } });
    if (!source) return notFound("Calendar source not found");

    if (!source.url) {
      return error("Calendar source has no URL configured", 422);
    }

    const syncResult = await runSync(id);

    return success(syncResult);
  } catch (err) {
    console.error("[POST /api/calendar-sources/[id]/sync]", err);
    return error("Sync failed", 500);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";

// ---------------------------------------------------------------------------
// GET /api/sync/unmatched — Unmatched events with status "pending"
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    const events = await prisma.unmatchedSyncEvent.findMany({
      where: { status: "pending" },
      orderBy: { date: "desc" },
    });

    return success({ events });
  } catch (err) {
    console.error("[GET /api/sync/unmatched]", err);
    return error("Failed to fetch unmatched events", 500);
  }
}

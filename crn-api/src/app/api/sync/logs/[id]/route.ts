import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error, notFound } from "@/lib/responses";

// ---------------------------------------------------------------------------
// GET /api/sync/logs/[id] — Sync log detail with full error list
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const log = await prisma.syncLog.findUnique({
      where: { id },
    });

    if (!log) return notFound("Sync log not found");

    return success(log);
  } catch (err) {
    console.error("[GET /api/sync/logs/[id]]", err);
    return error("Failed to fetch sync log", 500);
  }
}

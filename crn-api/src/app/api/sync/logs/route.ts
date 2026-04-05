import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";

// ---------------------------------------------------------------------------
// GET /api/sync/logs — Recent sync logs across all sources
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const params = request.nextUrl.searchParams;
  const sourceId = params.get("sourceId");
  const status = params.get("status");
  const limit = Math.min(Number(params.get("limit") || 50), 200);

  const where: Record<string, unknown> = {};
  if (sourceId) where.calendarSourceId = sourceId;
  if (status) where.status = status;

  try {
    const logs = await prisma.syncLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return success({ logs });
  } catch (err) {
    console.error("[GET /api/sync/logs]", err);
    return error("Failed to fetch sync logs", 500);
  }
}

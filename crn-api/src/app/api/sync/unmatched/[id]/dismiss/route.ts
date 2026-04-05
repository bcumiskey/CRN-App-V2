import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error, notFound } from "@/lib/responses";

// ---------------------------------------------------------------------------
// POST /api/sync/unmatched/[id]/dismiss — Dismiss unmatched event
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const event = await prisma.unmatchedSyncEvent.findUnique({
      where: { id },
    });

    if (!event) return notFound("Unmatched event not found");
    if (event.status !== "pending") {
      return error(`Event already ${event.status}`, 409);
    }

    await prisma.unmatchedSyncEvent.update({
      where: { id },
      data: { status: "dismissed" },
    });

    return success({ id, status: "dismissed" });
  } catch (err) {
    console.error("[POST /api/sync/unmatched/[id]/dismiss]", err);
    return error("Failed to dismiss event", 500);
  }
}

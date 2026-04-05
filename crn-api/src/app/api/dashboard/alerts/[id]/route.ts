import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { success } from "@/lib/responses";

// ---------------------------------------------------------------------------
// PATCH /api/dashboard/alerts/[id] — Dismiss an alert (placeholder)
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  // Placeholder — alert dismissal logic comes in later phases
  return success({ id, dismissed: true });
}

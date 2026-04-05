import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { success } from "@/lib/responses";

// ---------------------------------------------------------------------------
// GET /api/dashboard/alerts — Active alerts (placeholder)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  // Alert generation logic comes in later phases
  return success({ alerts: [] });
}

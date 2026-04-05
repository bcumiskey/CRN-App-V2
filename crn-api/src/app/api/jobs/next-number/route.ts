import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { generateJobNumber } from "@/lib/job-numbers";

// ---------------------------------------------------------------------------
// POST /api/jobs/next-number — Preview next job number
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    const jobNumber = await generateJobNumber();
    return success({ jobNumber });
  } catch (err) {
    console.error("[POST /api/jobs/next-number]", err);
    return error("Failed to generate job number", 500);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error } from "@/lib/responses";

// ---------------------------------------------------------------------------
// GET /api/onboarding/status — Check if onboarding is completed
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  try {
    const settings = await prisma.companySettings.findFirst();

    return success({
      completed: settings?.onboardingCompleted ?? false,
    });
  } catch (err) {
    console.error("[Onboarding] status error:", err);
    return error("Failed to fetch onboarding status", 500);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error } from "@/lib/responses";

// ---------------------------------------------------------------------------
// PATCH /api/onboarding/complete — Mark onboarding as completed
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    const settings = await prisma.companySettings.updateMany({
      data: { onboardingCompleted: true },
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "settings",
      entityId: "onboarding",
      summary: "Onboarding marked as completed",
    });

    return success({ completed: true, updated: settings.count });
  } catch (err) {
    console.error("[Onboarding] complete error:", err);
    return error("Failed to complete onboarding", 500);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// PATCH /api/onboarding/dismiss-tip — Add a tip ID to dismissedTips array
// ---------------------------------------------------------------------------

const dismissSchema = z.object({
  tipId: z.string().min(1, "tipId is required"),
});

export async function PATCH(request: NextRequest) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = dismissSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { tipId } = parsed.data;

  try {
    // Upsert UserPreference if it doesn't exist, then add tip
    let pref = await prisma.userPreference.findUnique({
      where: { userId: result.user.userId },
    });

    if (!pref) {
      pref = await prisma.userPreference.create({
        data: {
          userId: result.user.userId,
          dismissedTips: [tipId],
        },
      });
      return success({ dismissedTips: pref.dismissedTips });
    }

    // Parse existing dismissed tips
    const currentTips = Array.isArray(pref.dismissedTips)
      ? (pref.dismissedTips as string[])
      : [];

    // Don't add duplicates
    if (currentTips.includes(tipId)) {
      return success({ dismissedTips: currentTips });
    }

    const updatedTips = [...currentTips, tipId];

    const updated = await prisma.userPreference.update({
      where: { userId: result.user.userId },
      data: { dismissedTips: updatedTips },
    });

    return success({ dismissedTips: updated.dismissedTips });
  } catch (err) {
    console.error("[Onboarding] dismiss-tip error:", err);
    return error("Failed to dismiss tip", 500);
  }
}

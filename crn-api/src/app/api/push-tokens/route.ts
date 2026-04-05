import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// POST /api/push-tokens — Register a device push token
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  token: z.string().min(1, "Token is required"),
  platform: z.enum(["ios", "android", "web"]),
});

export async function POST(request: NextRequest) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { token, platform } = parsed.data;

  try {
    const pushToken = await prisma.pushToken.upsert({
      where: { token },
      update: {
        userId: result.user.userId,
        platform,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId: result.user.userId,
        token,
        platform,
        isActive: true,
      },
    });

    return success(pushToken);
  } catch (err) {
    console.error("[PushTokens] POST error:", err);
    return error("Failed to register push token", 500);
  }
}

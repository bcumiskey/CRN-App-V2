import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error, notFound } from "@/lib/responses";

// ---------------------------------------------------------------------------
// DELETE /api/push-tokens/[id] — Unregister a push token
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const token = await prisma.pushToken.findUnique({ where: { id } });

    if (!token) return notFound("Push token not found");
    if (token.userId !== result.user.userId) {
      return error("Forbidden", 403);
    }

    await prisma.pushToken.delete({ where: { id } });

    return success({ deleted: true });
  } catch (err) {
    console.error("[PushTokens] DELETE error:", err);
    return error("Failed to delete push token", 500);
  }
}

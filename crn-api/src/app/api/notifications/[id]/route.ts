import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error, notFound } from "@/lib/responses";

// ---------------------------------------------------------------------------
// DELETE /api/notifications/[id] — Dismiss/delete a notification
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) return notFound("Notification not found");
    if (notification.userId !== result.user.userId) {
      return error("Forbidden", 403);
    }

    await prisma.notification.delete({ where: { id } });

    return success({ deleted: true });
  } catch (err) {
    console.error("[Notifications] DELETE error:", err);
    return error("Failed to delete notification", 500);
  }
}

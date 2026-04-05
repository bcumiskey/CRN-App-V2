import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error, notFound } from "@/lib/responses";

// ---------------------------------------------------------------------------
// PATCH /api/notifications/[id]/read — Mark a notification as read
// ---------------------------------------------------------------------------

export async function PATCH(
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

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });

    return success(updated);
  } catch (err) {
    console.error("[Notifications] mark-read error:", err);
    return error("Failed to mark notification as read", 500);
  }
}

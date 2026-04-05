import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error } from "@/lib/responses";

// ---------------------------------------------------------------------------
// POST /api/notifications/mark-all-read — Mark all unread as read
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  try {
    const { count } = await prisma.notification.updateMany({
      where: { userId: result.user.userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return success({ updated: count });
  } catch (err) {
    console.error("[Notifications] mark-all-read error:", err);
    return error("Failed to mark notifications as read", 500);
  }
}

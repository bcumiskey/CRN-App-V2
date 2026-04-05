import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error } from "@/lib/responses";

// ---------------------------------------------------------------------------
// GET /api/notifications/unread-count — Count of unread notifications
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  try {
    const count = await prisma.notification.count({
      where: { userId: result.user.userId, isRead: false },
    });

    return success({ count });
  } catch (err) {
    console.error("[Notifications] unread-count error:", err);
    return error("Failed to count unread notifications", 500);
  }
}

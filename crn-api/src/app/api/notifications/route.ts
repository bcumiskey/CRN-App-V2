import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error } from "@/lib/responses";

// ---------------------------------------------------------------------------
// GET /api/notifications — List notifications for current user (cursor-paginated)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  const params = request.nextUrl.searchParams;
  const limit = Math.min(Number(params.get("limit") || 25), 100);
  const cursor = params.get("cursor");

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: result.user.userId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
    });

    const hasMore = notifications.length > limit;
    const items = hasMore ? notifications.slice(0, limit) : notifications;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return success({
      notifications: items,
      nextCursor,
      hasMore,
    });
  } catch (err) {
    console.error("[Notifications] GET error:", err);
    return error("Failed to fetch notifications", 500);
  }
}

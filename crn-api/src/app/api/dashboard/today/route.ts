import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { todayYMD } from "@/lib/business-time";

// ---------------------------------------------------------------------------
// GET /api/dashboard/today — Today's jobs for admin view
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const today = todayYMD(); // YYYY-MM-DD in the business timezone

  try {
    const jobs = await prisma.job.findMany({
      where: { scheduledDate: today },
      include: {
        property: { select: { id: true, name: true, code: true, color: true } },
        assignments: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        charges: true,
      },
      orderBy: [
        { isBtoB: "desc" },
        { scheduledTime: "asc" },
        { property: { name: "asc" } },
      ],
    });

    return success({ date: today, jobs });
  } catch (err) {
    console.error("[GET /api/dashboard/today]", err);
    return error("Failed to fetch today's jobs", 500);
  }
}

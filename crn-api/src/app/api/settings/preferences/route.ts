import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/settings/preferences — Current user's preferences
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const userId = result.user.userId;

  try {
    let prefs = await prisma.userPreference.findUnique({
      where: { userId },
    });

    // Create with defaults if none exists
    if (!prefs) {
      prefs = await prisma.userPreference.create({
        data: { userId },
      });
    }

    return success(prefs);
  } catch (err) {
    console.error("[GET /api/settings/preferences]", err);
    return error("Failed to fetch preferences", 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/settings/preferences — Update current user's preferences
// ---------------------------------------------------------------------------

const tabBarSlotSchema = z.object({
  position: z.number().int().min(1),
  section: z.string().min(1),
});

const updatePreferencesSchema = z.object({
  tabBarSlots: z.array(tabBarSlotSchema).optional(),
  centerAction: z.string().optional(),
  defaultJobsView: z.enum(["list", "calendar", "board"]).optional(),
  defaultCalendarView: z.enum(["day", "week", "month"]).optional(),
  jobCompletionAction: z.enum(["stay", "next", "dashboard"]).optional(),
  dashboardCards: z.any().optional(),
  notifyUpcomingJobs: z.boolean().optional(),
  notifyScheduleChanges: z.boolean().optional(),
  notifyOverdueInvoices: z.boolean().optional(),
  upcomingJobLeadDays: z.number().int().min(1).max(30).optional(),
  startOfWeek: z.enum(["sunday", "monday"]).optional(),
  timeFormat: z.enum(["12h", "24h"]).optional(),
});

export async function PATCH(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const userId = result.user.userId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = updatePreferencesSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  // Build Prisma-compatible data, handling JSON fields explicitly
  const { tabBarSlots, dashboardCards, ...scalarData } = data;

  const jsonFields: Record<string, Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined> = {};
  if (tabBarSlots !== undefined) {
    jsonFields.tabBarSlots = tabBarSlots as unknown as Prisma.InputJsonValue;
  }
  if (dashboardCards !== undefined) {
    jsonFields.dashboardCards = dashboardCards === null
      ? Prisma.JsonNull
      : (dashboardCards as Prisma.InputJsonValue);
  }

  try {
    const prefs = await prisma.userPreference.upsert({
      where: { userId },
      update: { ...scalarData, ...jsonFields },
      create: { userId, ...scalarData, ...jsonFields },
    });

    return success(prefs);
  } catch (err) {
    console.error("[PATCH /api/settings/preferences]", err);
    return error("Failed to update preferences", 500);
  }
}

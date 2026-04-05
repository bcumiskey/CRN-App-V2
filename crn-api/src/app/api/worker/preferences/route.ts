import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Worker default tab bar (differs from admin defaults)
// ---------------------------------------------------------------------------

const WORKER_DEFAULT_TAB_BAR = [
  { position: 1, section: "today" },
  { position: 2, section: "schedule" },
  { position: 3, section: "properties" },
];

// ---------------------------------------------------------------------------
// GET /api/worker/preferences — Current worker's preferences
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  const userId = result.user.userId;

  try {
    let prefs = await prisma.userPreference.findUnique({
      where: { userId },
    });

    // Auto-create with worker-specific defaults if none exists
    if (!prefs) {
      prefs = await prisma.userPreference.create({
        data: {
          userId,
          tabBarSlots: WORKER_DEFAULT_TAB_BAR as unknown as Prisma.InputJsonValue,
          centerAction: "start_job",
          defaultJobsView: "list",
          defaultCalendarView: "week",
          jobCompletionAction: "next",
        },
      });
    }

    return success(prefs);
  } catch (err) {
    console.error("[GET /api/worker/preferences]", err);
    return error("Failed to fetch preferences", 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/worker/preferences — Update worker's own preferences
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
  const result = await requireAuth(request);
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
      create: {
        userId,
        tabBarSlots: (tabBarSlots ?? WORKER_DEFAULT_TAB_BAR) as unknown as Prisma.InputJsonValue,
        centerAction: scalarData.centerAction ?? "start_job",
        jobCompletionAction: scalarData.jobCompletionAction ?? "next",
        ...scalarData,
        ...jsonFields,
      },
    });

    return success(prefs);
  } catch (err) {
    console.error("[PATCH /api/worker/preferences]", err);
    return error("Failed to update preferences", 500);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, created, error, validationError } from "@/lib/responses";
import { fetchFeed } from "@/lib/calendar-sync";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/calendar-sources — List all calendar sources
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    const sources = await prisma.calendarSource.findMany({
      include: {
        property: { select: { id: true, name: true, code: true } },
      },
      orderBy: { name: "asc" },
    });

    return success({ sources });
  } catch (err) {
    console.error("[GET /api/calendar-sources]", err);
    return error("Failed to fetch calendar sources", 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/calendar-sources — Create a calendar source
// ---------------------------------------------------------------------------

const createSourceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["turno_ical", "google_ical", "manual"]),
  url: z.string().url("Must be a valid URL").optional(),
  propertyId: z.string().optional(),
  syncIntervalMinutes: z.number().min(5).max(1440).optional(),
  isActive: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = createSourceSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const data = parsed.data;

    // If a URL is provided, do a test fetch to validate it
    if (data.url) {
      try {
        await fetchFeed(data.url);
      } catch (fetchErr) {
        return error(
          `URL validation failed: ${fetchErr instanceof Error ? fetchErr.message : "Unknown error"}`,
          422
        );
      }
    }

    // If propertyId provided, verify it exists
    if (data.propertyId) {
      const property = await prisma.property.findUnique({
        where: { id: data.propertyId },
      });
      if (!property) return error("Property not found", 404);
    }

    const source = await prisma.calendarSource.create({
      data: {
        name: data.name,
        type: data.type,
        url: data.url ?? null,
        propertyId: data.propertyId ?? null,
        syncIntervalMinutes: data.syncIntervalMinutes ?? 30,
        isActive: data.isActive ?? true,
      },
      include: {
        property: { select: { id: true, name: true, code: true } },
      },
    });

    logAudit({
      userId: result.user.userId,
      action: "create",
      entityType: "calendar_source",
      entityId: source.id,
      summary: `Created calendar source "${source.name}" (${source.type})`,
    });

    return created(source);
  } catch (err) {
    console.error("[POST /api/calendar-sources]", err);
    return error("Failed to create calendar source", 500);
  }
}

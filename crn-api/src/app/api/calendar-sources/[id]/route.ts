import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { fetchFeed } from "@/lib/calendar-sync";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/calendar-sources/[id] — Source detail with recent sync logs
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const source = await prisma.calendarSource.findUnique({
      where: { id },
      include: {
        property: { select: { id: true, name: true, code: true } },
      },
    });

    if (!source) return notFound("Calendar source not found");

    const syncLogs = await prisma.syncLog.findMany({
      where: { calendarSourceId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return success({ source, syncLogs });
  } catch (err) {
    console.error("[GET /api/calendar-sources/[id]]", err);
    return error("Failed to fetch calendar source", 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/calendar-sources/[id] — Update source
// ---------------------------------------------------------------------------

const updateSourceSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["turno_ical", "google_ical", "manual"]).optional(),
  url: z.string().url("Must be a valid URL").optional().nullable(),
  propertyId: z.string().optional().nullable(),
  syncIntervalMinutes: z.number().min(5).max(1440).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const existing = await prisma.calendarSource.findUnique({ where: { id } });
    if (!existing) return notFound("Calendar source not found");

    const body = await request.json();
    const parsed = updateSourceSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const data = parsed.data;

    // If URL changed, do a test fetch
    if (data.url !== undefined && data.url !== null && data.url !== existing.url) {
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

    const source = await prisma.calendarSource.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.url !== undefined && { url: data.url }),
        ...(data.propertyId !== undefined && { propertyId: data.propertyId }),
        ...(data.syncIntervalMinutes !== undefined && {
          syncIntervalMinutes: data.syncIntervalMinutes,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        property: { select: { id: true, name: true, code: true } },
      },
    });

    logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "calendar_source",
      entityId: source.id,
      summary: `Updated calendar source "${source.name}"`,
      details: data as Record<string, unknown>,
    });

    return success(source);
  } catch (err) {
    console.error("[PATCH /api/calendar-sources/[id]]", err);
    return error("Failed to update calendar source", 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/calendar-sources/[id] — Delete source (does NOT delete jobs)
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const existing = await prisma.calendarSource.findUnique({ where: { id } });
    if (!existing) return notFound("Calendar source not found");

    await prisma.calendarSource.delete({ where: { id } });

    logAudit({
      userId: result.user.userId,
      action: "delete",
      entityType: "calendar_source",
      entityId: id,
      summary: `Deleted calendar source "${existing.name}" (imported jobs preserved)`,
    });

    return success({ message: "Calendar source deleted. Imported jobs were not affected." });
  } catch (err) {
    console.error("[DELETE /api/calendar-sources/[id]]", err);
    return error("Failed to delete calendar source", 500);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Owner preference fields extracted from the Property model
// ---------------------------------------------------------------------------

const OWNER_PREF_FIELDS = {
  laundryMethod: true,
  laundryLocation: true,
  laundryNotes: true,
  guestCommsMethod: true,
  checkInPhotos: true,
  checkOutPhotos: true,
  preferredTemp: true,
  petPolicy: true,
  earliestArrival: true,
  latestDeparture: true,
  keyReturnMethod: true,
} as const;

// ---------------------------------------------------------------------------
// GET /api/properties/[id]/owner-preferences — Get owner preferences
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const property = await prisma.property.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        ...OWNER_PREF_FIELDS,
      },
    });
    if (!property) return notFound("Property not found");

    return success({ preferences: property });
  } catch (err) {
    console.error("[GET /api/properties/[id]/owner-preferences]", err);
    return error("Failed to fetch owner preferences", 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/properties/[id]/owner-preferences — Update owner preferences
// ---------------------------------------------------------------------------

const updatePreferencesSchema = z.object({
  laundryMethod: z
    .enum(["onsite", "laundromat", "service", "owner_handles"])
    .nullable()
    .optional(),
  laundryLocation: z.string().nullable().optional(),
  laundryNotes: z.string().nullable().optional(),
  guestCommsMethod: z
    .enum(["owner_handles", "crn_handles", "none"])
    .nullable()
    .optional(),
  checkInPhotos: z.boolean().optional(),
  checkOutPhotos: z.boolean().optional(),
  preferredTemp: z.string().nullable().optional(),
  petPolicy: z.string().nullable().optional(),
  earliestArrival: z.string().nullable().optional(),
  latestDeparture: z.string().nullable().optional(),
  keyReturnMethod: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = updatePreferencesSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return notFound("Property not found");

    const updated = await prisma.property.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        name: true,
        ...OWNER_PREF_FIELDS,
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "property",
      entityId: id,
      summary: `Updated owner preferences for property ${property.name}`,
      details: { changes: parsed.data },
    });

    return success({ preferences: updated });
  } catch (err) {
    console.error("[PATCH /api/properties/[id]/owner-preferences]", err);
    return error("Failed to update owner preferences", 500);
  }
}

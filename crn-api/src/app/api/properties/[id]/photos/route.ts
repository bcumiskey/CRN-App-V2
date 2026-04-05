import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, created, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/properties/[id]/photos — List photos for a property
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return notFound("Property not found");

    const url = new URL(request.url);
    const roomId = url.searchParams.get("roomId");
    const photoType = url.searchParams.get("photoType");

    const where: Record<string, unknown> = { propertyId: id };
    if (roomId) where.roomId = roomId;
    if (photoType) where.photoType = photoType;

    const photos = await prisma.propertyPhoto.findMany({
      where,
      include: {
        room: { select: { id: true, name: true } },
      },
      orderBy: { sortOrder: "asc" },
    });

    return success({ photos });
  } catch (err) {
    console.error("[GET /api/properties/[id]/photos]", err);
    return error("Failed to fetch photos", 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/properties/[id]/photos — Create a photo
// ---------------------------------------------------------------------------

const createPhotoSchema = z.object({
  url: z.string().url("Valid URL is required"),
  thumbnailUrl: z.string().url().optional(),
  roomId: z.string().optional(),
  caption: z.string().optional(),
  photoType: z.enum(["reference", "before", "after", "damage", "setup"]).default("reference"),
  isPrimary: z.boolean().default(false),
  sortOrder: z.number().int().optional(),
  uploadedById: z.string().optional(),
});

export async function POST(
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

  const parsed = createPhotoSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return notFound("Property not found");

    if (data.roomId) {
      const room = await prisma.room.findFirst({
        where: { id: data.roomId, propertyId: id },
      });
      if (!room) return notFound("Room not found on this property");
    }

    // If setting as primary, unset existing primary photo
    if (data.isPrimary) {
      await prisma.propertyPhoto.updateMany({
        where: { propertyId: id, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    // Default sortOrder to end of list
    if (data.sortOrder === undefined) {
      const maxSort = await prisma.propertyPhoto.aggregate({
        where: { propertyId: id },
        _max: { sortOrder: true },
      });
      data.sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
    }

    const photo = await prisma.propertyPhoto.create({
      data: {
        propertyId: id,
        url: data.url,
        thumbnailUrl: data.thumbnailUrl,
        roomId: data.roomId,
        caption: data.caption,
        photoType: data.photoType,
        isPrimary: data.isPrimary,
        sortOrder: data.sortOrder,
        uploadedById: data.uploadedById,
      },
      include: {
        room: { select: { id: true, name: true } },
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "create",
      entityType: "property_photo",
      entityId: photo.id,
      summary: `Added photo to property ${property.name}`,
      details: { propertyId: id, photoType: data.photoType },
    });

    return created(photo);
  } catch (err) {
    console.error("[POST /api/properties/[id]/photos]", err);
    return error("Failed to create photo", 500);
  }
}

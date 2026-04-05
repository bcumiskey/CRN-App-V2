import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// PATCH /api/properties/[id]/photos/[pid] — Update a photo
// ---------------------------------------------------------------------------

const updatePhotoSchema = z.object({
  caption: z.string().optional(),
  photoType: z.enum(["reference", "before", "after", "damage", "setup"]).optional(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  roomId: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id, pid } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = updatePhotoSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    const photo = await prisma.propertyPhoto.findFirst({
      where: { id: pid, propertyId: id },
    });
    if (!photo) return notFound("Photo not found");

    // If setting as primary, unset existing primary
    if (data.isPrimary === true) {
      await prisma.propertyPhoto.updateMany({
        where: { propertyId: id, isPrimary: true, id: { not: pid } },
        data: { isPrimary: false },
      });
    }

    if (data.roomId !== undefined && data.roomId !== null) {
      const room = await prisma.room.findFirst({
        where: { id: data.roomId, propertyId: id },
      });
      if (!room) return notFound("Room not found on this property");
    }

    const updated = await prisma.propertyPhoto.update({
      where: { id: pid },
      data,
      include: {
        room: { select: { id: true, name: true } },
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "property_photo",
      entityId: pid,
      summary: `Updated photo on property`,
      details: { propertyId: id, changes: data },
    });

    return success(updated);
  } catch (err) {
    console.error("[PATCH /api/properties/[id]/photos/[pid]]", err);
    return error("Failed to update photo", 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/properties/[id]/photos/[pid] — Delete a photo
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id, pid } = await params;

  try {
    const photo = await prisma.propertyPhoto.findFirst({
      where: { id: pid, propertyId: id },
    });
    if (!photo) return notFound("Photo not found");

    await prisma.propertyPhoto.delete({ where: { id: pid } });

    await logAudit({
      userId: result.user.userId,
      action: "delete",
      entityType: "property_photo",
      entityId: pid,
      summary: `Deleted photo from property`,
      details: { propertyId: id, photoType: photo.photoType },
    });

    return success({ message: "Photo deleted" });
  } catch (err) {
    console.error("[DELETE /api/properties/[id]/photos/[pid]]", err);
    return error("Failed to delete photo", 500);
  }
}

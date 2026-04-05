import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// PATCH /api/properties/[id]/rooms/[roomId] — Update a room
// ---------------------------------------------------------------------------

const updateRoomSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  floor: z.string().nullable().optional(),
  bedType: z.string().nullable().optional(),
  bedCount: z.number().int().min(0).optional(),
  hasCrib: z.boolean().optional(),
  hasMurphy: z.boolean().optional(),
  hasTrundle: z.boolean().optional(),
  hasPullout: z.boolean().optional(),
  towelCount: z.number().int().min(0).nullable().optional(),
  hasRug: z.boolean().optional(),
  hasRobes: z.boolean().optional(),
  hasSlippers: z.boolean().optional(),
  stockingNotes: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id, roomId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = updateRoomSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const room = await prisma.room.findFirst({
      where: { id: roomId, propertyId: id },
    });
    if (!room) return notFound("Room not found");

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: parsed.data,
    });

    return success(updated);
  } catch (err) {
    console.error("[PATCH /api/properties/[id]/rooms/[roomId]]", err);
    return error("Failed to update room", 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/properties/[id]/rooms/[roomId] — Delete a room
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id, roomId } = await params;

  try {
    const room = await prisma.room.findFirst({
      where: { id: roomId, propertyId: id },
    });
    if (!room) return notFound("Room not found");

    await prisma.room.delete({ where: { id: roomId } });

    return success({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/properties/[id]/rooms/[roomId]]", err);
    return error("Failed to delete room", 500);
  }
}

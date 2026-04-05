import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// PATCH /api/properties/[id]/checklists/[cid]/items/[iid] — Update item
// ---------------------------------------------------------------------------

const updateItemSchema = z.object({
  text: z.string().min(1).optional(),
  room: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isRequired: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string; iid: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id, cid, iid } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = updateItemSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    // Verify the checklist belongs to the property
    const checklist = await prisma.checklist.findFirst({
      where: { id: cid, propertyId: id },
    });
    if (!checklist) return notFound("Checklist not found");

    const item = await prisma.checklistItem.findFirst({
      where: { id: iid, checklistId: cid },
    });
    if (!item) return notFound("Checklist item not found");

    const updated = await prisma.checklistItem.update({
      where: { id: iid },
      data: parsed.data,
    });

    return success(updated);
  } catch (err) {
    console.error("[PATCH /api/properties/[id]/checklists/[cid]/items/[iid]]", err);
    return error("Failed to update checklist item", 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/properties/[id]/checklists/[cid]/items/[iid] — Delete item
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string; iid: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id, cid, iid } = await params;

  try {
    const checklist = await prisma.checklist.findFirst({
      where: { id: cid, propertyId: id },
    });
    if (!checklist) return notFound("Checklist not found");

    const item = await prisma.checklistItem.findFirst({
      where: { id: iid, checklistId: cid },
    });
    if (!item) return notFound("Checklist item not found");

    await prisma.checklistItem.delete({ where: { id: iid } });

    return success({ message: "Checklist item deleted" });
  } catch (err) {
    console.error("[DELETE /api/properties/[id]/checklists/[cid]/items/[iid]]", err);
    return error("Failed to delete checklist item", 500);
  }
}

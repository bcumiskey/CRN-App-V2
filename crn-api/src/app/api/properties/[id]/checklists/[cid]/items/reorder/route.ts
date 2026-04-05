import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// POST /api/properties/[id]/checklists/[cid]/items/reorder — Batch reorder
// ---------------------------------------------------------------------------

const reorderSchema = z.object({
  itemIds: z.array(z.string()).min(1, "At least one item ID is required"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id, cid } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { itemIds } = parsed.data;

  try {
    const checklist = await prisma.checklist.findFirst({
      where: { id: cid, propertyId: id },
    });
    if (!checklist) return notFound("Checklist not found");

    // Verify all items belong to this checklist
    const items = await prisma.checklistItem.findMany({
      where: { checklistId: cid, id: { in: itemIds } },
      select: { id: true },
    });

    if (items.length !== itemIds.length) {
      return error("One or more item IDs do not belong to this checklist");
    }

    await prisma.$transaction(
      itemIds.map((itemId, index) =>
        prisma.checklistItem.update({
          where: { id: itemId },
          data: { sortOrder: index },
        })
      )
    );

    return success({ message: "Items reordered", count: itemIds.length });
  } catch (err) {
    console.error("[POST /api/properties/[id]/checklists/[cid]/items/reorder]", err);
    return error("Failed to reorder items", 500);
  }
}

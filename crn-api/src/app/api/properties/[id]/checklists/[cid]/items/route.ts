import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { created, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// POST /api/properties/[id]/checklists/[cid]/items — Add item to checklist
// ---------------------------------------------------------------------------

const createItemSchema = z.object({
  text: z.string().min(1, "Item text is required"),
  room: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isRequired: z.boolean().default(true),
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

  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    const checklist = await prisma.checklist.findFirst({
      where: { id: cid, propertyId: id },
    });
    if (!checklist) return notFound("Checklist not found");

    // Default sortOrder to end of list
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const maxSort = await prisma.checklistItem.aggregate({
        where: { checklistId: cid },
        _max: { sortOrder: true },
      });
      sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
    }

    const item = await prisma.checklistItem.create({
      data: {
        checklistId: cid,
        text: data.text,
        room: data.room,
        sortOrder,
        isRequired: data.isRequired,
      },
    });

    return created(item);
  } catch (err) {
    console.error("[POST /api/properties/[id]/checklists/[cid]/items]", err);
    return error("Failed to create checklist item", 500);
  }
}

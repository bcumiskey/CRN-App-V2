import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { created, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// POST /api/properties/[id]/checklists/[cid]/copy — Copy checklist to another property
// ---------------------------------------------------------------------------

const copySchema = z.object({
  targetPropertyId: z.string().min(1, "Target property ID is required"),
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

  const parsed = copySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { targetPropertyId } = parsed.data;

  try {
    // Verify source checklist exists on source property
    const sourceChecklist = await prisma.checklist.findFirst({
      where: { id: cid, propertyId: id },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!sourceChecklist) return notFound("Checklist not found");

    // Verify target property exists
    const targetProperty = await prisma.property.findUnique({
      where: { id: targetPropertyId },
    });
    if (!targetProperty) return notFound("Target property not found");

    // Get sortOrder for the new checklist on the target property
    const maxSort = await prisma.checklist.aggregate({
      where: { propertyId: targetPropertyId },
      _max: { sortOrder: true },
    });
    const newSortOrder = (maxSort._max.sortOrder ?? -1) + 1;

    // Create checklist + items in a transaction
    const newChecklist = await prisma.$transaction(async (tx) => {
      const cl = await tx.checklist.create({
        data: {
          propertyId: targetPropertyId,
          name: sourceChecklist.name,
          jobType: sourceChecklist.jobType,
          isActive: sourceChecklist.isActive,
          sortOrder: newSortOrder,
        },
      });

      if (sourceChecklist.items.length > 0) {
        await tx.checklistItem.createMany({
          data: sourceChecklist.items.map((item, index) => ({
            checklistId: cl.id,
            text: item.text,
            room: item.room,
            sortOrder: item.sortOrder ?? index,
            isRequired: item.isRequired,
          })),
        });
      }

      return tx.checklist.findUnique({
        where: { id: cl.id },
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          _count: { select: { items: true } },
        },
      });
    });

    await logAudit({
      userId: result.user.userId,
      action: "create",
      entityType: "checklist",
      entityId: newChecklist!.id,
      summary: `Copied checklist "${sourceChecklist.name}" to property ${targetProperty.name}`,
      details: {
        sourcePropertyId: id,
        sourceChecklistId: cid,
        targetPropertyId,
        itemCount: sourceChecklist.items.length,
      },
    });

    return created(newChecklist);
  } catch (err) {
    console.error("[POST /api/properties/[id]/checklists/[cid]/copy]", err);
    return error("Failed to copy checklist", 500);
  }
}

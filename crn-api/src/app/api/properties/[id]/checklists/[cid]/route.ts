import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// PATCH /api/properties/[id]/checklists/[cid] — Update a checklist
// ---------------------------------------------------------------------------

const updateChecklistSchema = z.object({
  name: z.string().min(1).optional(),
  jobType: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
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

  const parsed = updateChecklistSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const checklist = await prisma.checklist.findFirst({
      where: { id: cid, propertyId: id },
    });
    if (!checklist) return notFound("Checklist not found");

    const updated = await prisma.checklist.update({
      where: { id: cid },
      data: parsed.data,
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        _count: { select: { items: true } },
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "checklist",
      entityId: cid,
      summary: `Updated checklist "${updated.name}"`,
      details: { propertyId: id, changes: parsed.data },
    });

    return success(updated);
  } catch (err) {
    console.error("[PATCH /api/properties/[id]/checklists/[cid]]", err);
    return error("Failed to update checklist", 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/properties/[id]/checklists/[cid] — Delete a checklist
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id, cid } = await params;

  try {
    const checklist = await prisma.checklist.findFirst({
      where: { id: cid, propertyId: id },
    });
    if (!checklist) return notFound("Checklist not found");

    await prisma.checklist.delete({ where: { id: cid } });

    await logAudit({
      userId: result.user.userId,
      action: "delete",
      entityType: "checklist",
      entityId: cid,
      summary: `Deleted checklist "${checklist.name}"`,
      details: { propertyId: id },
    });

    return success({ message: "Checklist deleted" });
  } catch (err) {
    console.error("[DELETE /api/properties/[id]/checklists/[cid]]", err);
    return error("Failed to delete checklist", 500);
  }
}

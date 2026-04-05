import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string; rid: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/linens/[id]/requirements/[rid] — Update quantityPerFlip
// ---------------------------------------------------------------------------

const updateRequirementSchema = z.object({
  quantityPerFlip: z.number().int().min(0, "quantityPerFlip must be >= 0"),
});

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id: linenItemId, rid } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = updateRequirementSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { quantityPerFlip } = parsed.data;

  try {
    // Validate linen item exists
    const linenItem = await prisma.linenItem.findUnique({
      where: { id: linenItemId },
    });
    if (!linenItem) return notFound("Linen item not found");

    // Validate requirement exists and belongs to this linen item
    const existing = await prisma.propertyLinenRequirement.findUnique({
      where: { id: rid },
    });
    if (!existing || existing.linenItemId !== linenItemId) {
      return notFound("Requirement not found");
    }

    const requirement = await prisma.propertyLinenRequirement.update({
      where: { id: rid },
      data: { quantityPerFlip },
      include: {
        property: { select: { id: true, name: true } },
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "linen_requirement",
      entityId: rid,
      summary: `Updated requirement for "${linenItem.name}" at "${requirement.property.name}": ${quantityPerFlip}/flip`,
    });

    return success(requirement);
  } catch (err) {
    console.error("[PATCH /api/linens/[id]/requirements/[rid]]", err);
    return error("Failed to update requirement", 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/linens/[id]/requirements/[rid] — Remove requirement
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id: linenItemId, rid } = await params;

  try {
    // Validate linen item exists
    const linenItem = await prisma.linenItem.findUnique({
      where: { id: linenItemId },
    });
    if (!linenItem) return notFound("Linen item not found");

    // Validate requirement exists and belongs to this linen item
    const existing = await prisma.propertyLinenRequirement.findUnique({
      where: { id: rid },
      include: {
        property: { select: { id: true, name: true } },
      },
    });
    if (!existing || existing.linenItemId !== linenItemId) {
      return notFound("Requirement not found");
    }

    await prisma.propertyLinenRequirement.delete({ where: { id: rid } });

    await logAudit({
      userId: result.user.userId,
      action: "delete",
      entityType: "linen_requirement",
      entityId: rid,
      summary: `Removed requirement for "${linenItem.name}" at "${existing.property.name}"`,
    });

    return success({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/linens/[id]/requirements/[rid]]", err);
    return error("Failed to delete requirement", 500);
  }
}

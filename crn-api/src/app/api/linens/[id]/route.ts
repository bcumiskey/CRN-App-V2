import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/linens/[id] — Linen item detail with requirements
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const item = await prisma.linenItem.findUnique({
      where: { id },
      include: {
        propertyRequirements: {
          include: {
            property: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (!item) return notFound("Linen item not found");

    // Compute target
    const totalRequirement = item.propertyRequirements.reduce(
      (sum, r) => sum + r.quantityPerFlip,
      0
    );
    const target = totalRequirement * 2;

    return success({
      ...item,
      target,
      deficit: item.onHand < target,
      surplus: item.onHand - target,
    });
  } catch (err) {
    console.error("[GET /api/linens/[id]]", err);
    return error("Failed to fetch linen item", 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/linens/[id] — Update linen item
// ---------------------------------------------------------------------------

const updateLinenSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  unitCost: z.number().min(0).optional(),
  vendor: z.string().nullable().optional(),
  vendorSku: z.string().nullable().optional(),
  onHand: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = updateLinenSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    const existing = await prisma.linenItem.findUnique({ where: { id } });
    if (!existing) return notFound("Linen item not found");

    // If code is changing, check uniqueness
    if (data.code && data.code !== existing.code) {
      const codeConflict = await prisma.linenItem.findUnique({
        where: { code: data.code },
      });
      if (codeConflict) return error("A linen item with this code already exists", 409);
    }

    const item = await prisma.linenItem.update({
      where: { id },
      data,
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "linen_item",
      entityId: id,
      summary: `Updated linen item "${item.name}" (${item.code})`,
      details: data as Record<string, unknown>,
    });

    return success(item);
  } catch (err) {
    console.error("[PATCH /api/linens/[id]]", err);
    return error("Failed to update linen item", 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/linens/[id] — Delete linen item (only if no requirements)
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const existing = await prisma.linenItem.findUnique({
      where: { id },
      include: { _count: { select: { propertyRequirements: true } } },
    });
    if (!existing) return notFound("Linen item not found");

    if (existing._count.propertyRequirements > 0) {
      return error(
        `Cannot delete: ${existing._count.propertyRequirements} property requirement(s) reference this item. Remove them first.`,
        409
      );
    }

    await prisma.linenItem.delete({ where: { id } });

    await logAudit({
      userId: result.user.userId,
      action: "delete",
      entityType: "linen_item",
      entityId: id,
      summary: `Deleted linen item "${existing.name}" (${existing.code})`,
    });

    return success({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/linens/[id]]", err);
    return error("Failed to delete linen item", 500);
  }
}

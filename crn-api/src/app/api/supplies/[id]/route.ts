import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/supplies/[id] — Supply detail
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const supply = await prisma.supply.findUnique({ where: { id } });
    if (!supply) return notFound("Supply not found");

    return success(supply);
  } catch (err) {
    console.error("[GET /api/supplies/[id]]", err);
    return error("Failed to fetch supply", 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/supplies/[id] — Update supply
// ---------------------------------------------------------------------------

const updateSupplySchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  onHand: z.number().int().min(0).optional(),
  reorderLevel: z.number().int().min(0).optional(),
  reorderQuantity: z.number().int().min(0).nullable().optional(),
  unitCost: z.number().min(0).optional(),
  unit: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
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

  const parsed = updateSupplySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    const existing = await prisma.supply.findUnique({ where: { id } });
    if (!existing) return notFound("Supply not found");

    const supply = await prisma.supply.update({
      where: { id },
      data,
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "supply",
      entityId: id,
      summary: `Updated supply "${supply.name}"`,
      details: data as Record<string, unknown>,
    });

    return success(supply);
  } catch (err) {
    console.error("[PATCH /api/supplies/[id]]", err);
    return error("Failed to update supply", 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/supplies/[id] — Delete supply
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const existing = await prisma.supply.findUnique({ where: { id } });
    if (!existing) return notFound("Supply not found");

    await prisma.supply.delete({ where: { id } });

    await logAudit({
      userId: result.user.userId,
      action: "delete",
      entityType: "supply",
      entityId: id,
      summary: `Deleted supply "${existing.name}" (${existing.category})`,
    });

    return success({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/supplies/[id]]", err);
    return error("Failed to delete supply", 500);
  }
}

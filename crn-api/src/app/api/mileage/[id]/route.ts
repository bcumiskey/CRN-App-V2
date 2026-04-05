import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/mileage/[id] — Mileage entry detail
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const entry = await prisma.mileageLog.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    if (!entry) return notFound("Mileage entry not found");

    return success(entry);
  } catch (err) {
    console.error("[GET /api/mileage/[id]]", err);
    return error("Failed to fetch mileage entry", 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/mileage/[id] — Update mileage entry
// ---------------------------------------------------------------------------

const updateMileageSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  miles: z.number().min(0).optional(),
  startLocation: z.string().nullable().optional(),
  endLocation: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
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

  const parsed = updateMileageSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    const existing = await prisma.mileageLog.findUnique({ where: { id } });
    if (!existing) return notFound("Mileage entry not found");

    // Recompute deduction if miles changed
    const updateData: Record<string, unknown> = { ...data };
    if (data.miles !== undefined) {
      updateData.deductionAmount =
        Math.round(data.miles * existing.ratePerMile * 100) / 100;
    }

    const entry = await prisma.mileageLog.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "mileage",
      entityId: id,
      summary: `Updated mileage entry (${entry.date})`,
      details: data as Record<string, unknown>,
    });

    return success(entry);
  } catch (err) {
    console.error("[PATCH /api/mileage/[id]]", err);
    return error("Failed to update mileage entry", 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/mileage/[id] — Delete mileage entry
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const existing = await prisma.mileageLog.findUnique({ where: { id } });
    if (!existing) return notFound("Mileage entry not found");

    await prisma.mileageLog.delete({ where: { id } });

    await logAudit({
      userId: result.user.userId,
      action: "delete",
      entityType: "mileage",
      entityId: id,
      summary: `Deleted mileage entry ${existing.miles} miles (${existing.date})`,
    });

    return success({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/mileage/[id]]", err);
    return error("Failed to delete mileage entry", 500);
  }
}

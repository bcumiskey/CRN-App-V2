import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// POST /api/linens/[id]/requirements — Upsert per-property requirement
// ---------------------------------------------------------------------------

const upsertRequirementSchema = z.object({
  propertyId: z.string().min(1, "propertyId is required"),
  quantityPerFlip: z.number().int().min(0, "quantityPerFlip must be >= 0"),
});

export async function POST(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id: linenItemId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = upsertRequirementSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { propertyId, quantityPerFlip } = parsed.data;

  try {
    // Validate linen item exists
    const linenItem = await prisma.linenItem.findUnique({
      where: { id: linenItemId },
    });
    if (!linenItem) return notFound("Linen item not found");

    // Validate property exists
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });
    if (!property) return notFound("Property not found");

    // Upsert the requirement
    const requirement = await prisma.propertyLinenRequirement.upsert({
      where: {
        propertyId_linenItemId: { propertyId, linenItemId },
      },
      update: { quantityPerFlip },
      create: { propertyId, linenItemId, quantityPerFlip },
      include: {
        property: { select: { id: true, name: true } },
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "linen_requirement",
      entityId: requirement.id,
      summary: `Set requirement for "${linenItem.name}" at "${property.name}": ${quantityPerFlip}/flip`,
    });

    return success(requirement);
  } catch (err) {
    console.error("[POST /api/linens/[id]/requirements]", err);
    return error("Failed to set linen requirement", 500);
  }
}

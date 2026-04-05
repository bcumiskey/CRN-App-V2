import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// POST /api/properties/[id]/instructions/reorder — Batch reorder instructions
// ---------------------------------------------------------------------------

const reorderSchema = z.object({
  instructionIds: z.array(z.string()).min(1, "At least one instruction ID is required"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { instructionIds } = parsed.data;

  try {
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return notFound("Property not found");

    // Verify all instructions belong to this property
    const instructions = await prisma.standingInstruction.findMany({
      where: { propertyId: id, id: { in: instructionIds } },
      select: { id: true },
    });

    if (instructions.length !== instructionIds.length) {
      return error("One or more instruction IDs do not belong to this property");
    }

    await prisma.$transaction(
      instructionIds.map((instructionId, index) =>
        prisma.standingInstruction.update({
          where: { id: instructionId },
          data: { sortOrder: index },
        })
      )
    );

    return success({ message: "Instructions reordered", count: instructionIds.length });
  } catch (err) {
    console.error("[POST /api/properties/[id]/instructions/reorder]", err);
    return error("Failed to reorder instructions", 500);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// PATCH /api/properties/[id]/instructions/[sid] — Update instruction
// ---------------------------------------------------------------------------

const updateInstructionSchema = z.object({
  text: z.string().min(1).optional(),
  category: z
    .enum(["general", "laundry", "guest", "owner", "access", "seasonal"])
    .optional(),
  priority: z.enum(["normal", "important", "critical"]).optional(),
  activeFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
    .nullable()
    .optional(),
  activeUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id, sid } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = updateInstructionSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const instruction = await prisma.standingInstruction.findFirst({
      where: { id: sid, propertyId: id },
    });
    if (!instruction) return notFound("Instruction not found");

    // Validate date range if both will be set after update
    const newFrom = parsed.data.activeFrom !== undefined
      ? parsed.data.activeFrom
      : instruction.activeFrom;
    const newUntil = parsed.data.activeUntil !== undefined
      ? parsed.data.activeUntil
      : instruction.activeUntil;

    if (newFrom && newUntil && newFrom > newUntil) {
      return error("activeFrom must be before activeUntil");
    }

    const updated = await prisma.standingInstruction.update({
      where: { id: sid },
      data: parsed.data,
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "standing_instruction",
      entityId: sid,
      summary: `Updated standing instruction`,
      details: { propertyId: id, changes: parsed.data },
    });

    return success(updated);
  } catch (err) {
    console.error("[PATCH /api/properties/[id]/instructions/[sid]]", err);
    return error("Failed to update instruction", 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/properties/[id]/instructions/[sid] — Delete instruction
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id, sid } = await params;

  try {
    const instruction = await prisma.standingInstruction.findFirst({
      where: { id: sid, propertyId: id },
    });
    if (!instruction) return notFound("Instruction not found");

    await prisma.standingInstruction.delete({ where: { id: sid } });

    await logAudit({
      userId: result.user.userId,
      action: "delete",
      entityType: "standing_instruction",
      entityId: sid,
      summary: `Deleted standing instruction`,
      details: { propertyId: id, text: instruction.text },
    });

    return success({ message: "Instruction deleted" });
  } catch (err) {
    console.error("[DELETE /api/properties/[id]/instructions/[sid]]", err);
    return error("Failed to delete instruction", 500);
  }
}

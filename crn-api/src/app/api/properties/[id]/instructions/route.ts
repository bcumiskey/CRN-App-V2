import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, created, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/properties/[id]/instructions — List active standing instructions
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return notFound("Property not found");

    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("includeInactive") === "true";

    const where: Record<string, unknown> = { propertyId: id };
    if (!includeInactive) {
      where.isActive = true;
    }

    const instructions = await prisma.standingInstruction.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }],
    });

    // Filter by seasonal visibility — only return if today is within the active range
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const filtered = instructions.filter((inst) => {
      if (!inst.activeFrom && !inst.activeUntil) return true;
      if (inst.activeFrom && today < inst.activeFrom) return false;
      if (inst.activeUntil && today > inst.activeUntil) return false;
      return true;
    });

    // Group by priority: critical first, then important, then normal
    const priorityOrder: Record<string, number> = {
      critical: 0,
      important: 1,
      normal: 2,
    };

    const grouped = {
      critical: filtered
        .filter((i) => i.priority === "critical")
        .sort((a, b) => a.sortOrder - b.sortOrder),
      important: filtered
        .filter((i) => i.priority === "important")
        .sort((a, b) => a.sortOrder - b.sortOrder),
      normal: filtered
        .filter((i) => i.priority === "normal")
        .sort((a, b) => a.sortOrder - b.sortOrder),
    };

    // Also return flat sorted list for convenience
    const sorted = [...filtered].sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 2;
      const pb = priorityOrder[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      return a.sortOrder - b.sortOrder;
    });

    return success({ instructions: sorted, grouped });
  } catch (err) {
    console.error("[GET /api/properties/[id]/instructions]", err);
    return error("Failed to fetch instructions", 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/properties/[id]/instructions — Create a standing instruction
// ---------------------------------------------------------------------------

const createInstructionSchema = z.object({
  text: z.string().min(1, "Text is required"),
  category: z
    .enum(["general", "laundry", "guest", "owner", "access", "seasonal"])
    .default("general"),
  priority: z.enum(["normal", "important", "critical"]).default("normal"),
  activeFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
    .optional(),
  activeUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
    .optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().optional(),
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

  const parsed = createInstructionSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return notFound("Property not found");

    // Validate date range if both provided
    if (data.activeFrom && data.activeUntil && data.activeFrom > data.activeUntil) {
      return error("activeFrom must be before activeUntil");
    }

    // Default sortOrder to end of list
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const maxSort = await prisma.standingInstruction.aggregate({
        where: { propertyId: id },
        _max: { sortOrder: true },
      });
      sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
    }

    const instruction = await prisma.standingInstruction.create({
      data: {
        propertyId: id,
        text: data.text,
        category: data.category,
        priority: data.priority,
        activeFrom: data.activeFrom,
        activeUntil: data.activeUntil,
        isActive: data.isActive,
        sortOrder,
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "create",
      entityType: "standing_instruction",
      entityId: instruction.id,
      summary: `Created standing instruction for property ${property.name}`,
      details: { propertyId: id, priority: data.priority, category: data.category },
    });

    return created(instruction);
  } catch (err) {
    console.error("[POST /api/properties/[id]/instructions]", err);
    return error("Failed to create instruction", 500);
  }
}

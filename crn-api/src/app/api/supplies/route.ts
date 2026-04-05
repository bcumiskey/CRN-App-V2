import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, created, error, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/supplies — List supplies with filters
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const params = request.nextUrl.searchParams;
  const category = params.get("category");
  const status = params.get("status"); // all | reorder | ok

  try {
    const where: Record<string, unknown> = { isActive: true };
    if (category) where.category = category;

    const supplies = await prisma.supply.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    // Filter by status if requested
    let filtered = supplies;
    if (status === "reorder") {
      filtered = supplies.filter((s) => s.onHand <= s.reorderLevel);
    } else if (status === "ok") {
      filtered = supplies.filter((s) => s.onHand > s.reorderLevel);
    }

    return success({ supplies: filtered, total: filtered.length });
  } catch (err) {
    console.error("[GET /api/supplies]", err);
    return error("Failed to fetch supplies", 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/supplies — Create supply
// ---------------------------------------------------------------------------

const createSupplySchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  onHand: z.number().int().min(0).optional(),
  reorderLevel: z.number().int().min(0).optional(),
  reorderQuantity: z.number().int().min(0).optional(),
  unitCost: z.number().min(0).optional(),
  unit: z.string().optional(),
  vendor: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = createSupplySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    const supply = await prisma.supply.create({
      data: {
        name: data.name,
        category: data.category,
        onHand: data.onHand ?? 0,
        reorderLevel: data.reorderLevel ?? 0,
        reorderQuantity: data.reorderQuantity,
        unitCost: data.unitCost ?? 0,
        unit: data.unit,
        vendor: data.vendor,
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "create",
      entityType: "supply",
      entityId: supply.id,
      summary: `Created supply "${data.name}" (${data.category})`,
    });

    return created(supply);
  } catch (err) {
    console.error("[POST /api/supplies]", err);
    return error("Failed to create supply", 500);
  }
}

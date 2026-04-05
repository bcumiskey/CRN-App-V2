import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, created, error, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/linens — List linen items with on-hand counts
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const params = request.nextUrl.searchParams;
  const category = params.get("category");
  const status = params.get("status"); // all | deficit | ok

  try {
    const where: Record<string, unknown> = { isActive: true };
    if (category) where.category = category;

    const items = await prisma.linenItem.findMany({
      where,
      include: {
        propertyRequirements: {
          select: { id: true, propertyId: true, quantityPerFlip: true },
        },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    // Compute target & deficit for each item
    const enriched = items.map((item) => {
      const totalRequirement = item.propertyRequirements.reduce(
        (sum, r) => sum + r.quantityPerFlip,
        0
      );
      const target = totalRequirement * 2; // 2x rule
      const deficit = item.onHand < target;
      const surplus = item.onHand - target;

      return {
        ...item,
        _requirementCount: item.propertyRequirements.length,
        target,
        deficit,
        surplus,
      };
    });

    // Filter by status if requested
    let filtered = enriched;
    if (status === "deficit") {
      filtered = enriched.filter((i) => i.deficit);
    } else if (status === "ok") {
      filtered = enriched.filter((i) => !i.deficit);
    }

    return success({ items: filtered, total: filtered.length });
  } catch (err) {
    console.error("[GET /api/linens]", err);
    return error("Failed to fetch linen items", 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/linens — Create linen item
// ---------------------------------------------------------------------------

const createLinenSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required"),
  category: z.enum(["sheets", "towels", "bedding", "pillows", "bath", "kitchen"]),
  unitCost: z.number().min(0).optional(),
  vendor: z.string().optional(),
  vendorSku: z.string().optional(),
  onHand: z.number().int().min(0).optional(),
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

  const parsed = createLinenSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    // Check code uniqueness
    const existing = await prisma.linenItem.findUnique({
      where: { code: data.code },
    });
    if (existing) return error("A linen item with this code already exists", 409);

    const item = await prisma.linenItem.create({
      data: {
        name: data.name,
        code: data.code,
        category: data.category,
        unitCost: data.unitCost ?? 0,
        vendor: data.vendor,
        vendorSku: data.vendorSku,
        onHand: data.onHand ?? 0,
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "create",
      entityType: "linen_item",
      entityId: item.id,
      summary: `Created linen item "${data.name}" (${data.code})`,
    });

    return created(item);
  } catch (err) {
    console.error("[POST /api/linens]", err);
    return error("Failed to create linen item", 500);
  }
}

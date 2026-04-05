import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";

// ---------------------------------------------------------------------------
// GET /api/linens/matrix — Inventory matrix: items × properties
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    // Fetch all active properties for column headers
    const properties = await prisma.property.findMany({
      where: { status: "active" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    // Fetch all active linen items with their requirements
    const items = await prisma.linenItem.findMany({
      where: { isActive: true },
      include: {
        propertyRequirements: {
          select: { propertyId: true, quantityPerFlip: true },
        },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    // Build the matrix
    const matrixItems = items.map((item) => {
      const requirements: Record<string, number> = {};
      let totalRequirement = 0;

      for (const req of item.propertyRequirements) {
        requirements[req.propertyId] = req.quantityPerFlip;
        totalRequirement += req.quantityPerFlip;
      }

      const target = totalRequirement * 2; // 2x rule
      const surplus = item.onHand - target;
      const status = item.onHand >= target ? "ok" : "deficit";

      return {
        id: item.id,
        name: item.name,
        code: item.code,
        category: item.category,
        onHand: item.onHand,
        target,
        status,
        surplus,
        requirements,
      };
    });

    return success({ properties, items: matrixItems });
  } catch (err) {
    console.error("[GET /api/linens/matrix]", err);
    return error("Failed to build linen matrix", 500);
  }
}

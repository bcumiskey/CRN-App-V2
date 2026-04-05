import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";

// ---------------------------------------------------------------------------
// GET /api/linens/shopping-list — Auto-generated deficit list grouped by vendor
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    const items = await prisma.linenItem.findMany({
      where: { isActive: true },
      include: {
        propertyRequirements: {
          select: { quantityPerFlip: true },
        },
      },
    });

    // Find deficit items
    const deficitItems: Array<{
      id: string;
      name: string;
      code: string;
      category: string;
      vendor: string;
      vendorSku: string | null;
      onHand: number;
      target: number;
      quantityNeeded: number;
      unitCost: number;
      totalCost: number;
    }> = [];

    for (const item of items) {
      const totalRequirement = item.propertyRequirements.reduce(
        (sum, r) => sum + r.quantityPerFlip,
        0
      );
      const target = totalRequirement * 2;

      if (item.onHand < target) {
        const quantityNeeded = target - item.onHand;
        deficitItems.push({
          id: item.id,
          name: item.name,
          code: item.code,
          category: item.category,
          vendor: item.vendor || "Unassigned",
          vendorSku: item.vendorSku,
          onHand: item.onHand,
          target,
          quantityNeeded,
          unitCost: item.unitCost,
          totalCost: quantityNeeded * item.unitCost,
        });
      }
    }

    // Group by vendor
    const vendorGroups: Record<
      string,
      {
        vendor: string;
        items: typeof deficitItems;
        vendorTotal: number;
      }
    > = {};

    for (const item of deficitItems) {
      if (!vendorGroups[item.vendor]) {
        vendorGroups[item.vendor] = {
          vendor: item.vendor,
          items: [],
          vendorTotal: 0,
        };
      }
      vendorGroups[item.vendor].items.push(item);
      vendorGroups[item.vendor].vendorTotal += item.totalCost;
    }

    const vendors = Object.values(vendorGroups).sort((a, b) =>
      a.vendor.localeCompare(b.vendor)
    );

    const grandTotal = deficitItems.reduce((sum, i) => sum + i.totalCost, 0);

    return success({
      vendors,
      grandTotal,
      totalItems: deficitItems.length,
    });
  } catch (err) {
    console.error("[GET /api/linens/shopping-list]", err);
    return error("Failed to generate shopping list", 500);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";

// ---------------------------------------------------------------------------
// GET /api/supplies/reorder-list — Items at or below reorder level
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    const supplies = await prisma.supply.findMany({
      where: { isActive: true },
    });

    // Find items at or below reorder level
    const reorderItems: Array<{
      id: string;
      name: string;
      category: string;
      vendor: string;
      onHand: number;
      reorderLevel: number;
      reorderQuantity: number | null;
      unitCost: number;
      totalCost: number;
    }> = [];

    for (const supply of supplies) {
      if (supply.onHand <= supply.reorderLevel) {
        const qty = supply.reorderQuantity ?? (supply.reorderLevel - supply.onHand + 1);
        reorderItems.push({
          id: supply.id,
          name: supply.name,
          category: supply.category,
          vendor: supply.vendor || "Unassigned",
          onHand: supply.onHand,
          reorderLevel: supply.reorderLevel,
          reorderQuantity: qty,
          unitCost: supply.unitCost,
          totalCost: qty * supply.unitCost,
        });
      }
    }

    // Group by vendor
    const vendorGroups: Record<
      string,
      {
        vendor: string;
        items: typeof reorderItems;
        vendorTotal: number;
      }
    > = {};

    for (const item of reorderItems) {
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

    const grandTotal = reorderItems.reduce((sum, i) => sum + i.totalCost, 0);

    return success({
      vendors,
      grandTotal,
      totalItems: reorderItems.length,
    });
  } catch (err) {
    console.error("[GET /api/supplies/reorder-list]", err);
    return error("Failed to generate reorder list", 500);
  }
}

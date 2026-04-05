import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// PATCH /api/linens/bulk-adjust — Bulk on-hand update from shopping list
// ---------------------------------------------------------------------------

const bulkAdjustSchema = z.object({
  adjustments: z
    .array(
      z.object({
        itemId: z.string().min(1, "itemId is required"),
        addQuantity: z.number().int().min(1, "addQuantity must be >= 1"),
      })
    )
    .min(1, "At least one adjustment is required"),
});

export async function PATCH(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = bulkAdjustSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { adjustments } = parsed.data;

  try {
    // Validate all item IDs exist first
    const itemIds = adjustments.map((a) => a.itemId);
    const existingItems = await prisma.linenItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, code: true, onHand: true },
    });

    const existingMap = new Map(existingItems.map((i) => [i.id, i]));
    const missing = itemIds.filter((id) => !existingMap.has(id));
    if (missing.length > 0) {
      return error(`Linen items not found: ${missing.join(", ")}`, 404);
    }

    // Apply all adjustments in a transaction
    const results = await prisma.$transaction(
      adjustments.map((adj) =>
        prisma.linenItem.update({
          where: { id: adj.itemId },
          data: { onHand: { increment: adj.addQuantity } },
          select: { id: true, name: true, code: true, onHand: true },
        })
      )
    );

    // Build audit summary
    const summaryLines = adjustments.map((adj) => {
      const item = existingMap.get(adj.itemId)!;
      return `${item.code}: +${adj.addQuantity} (${item.onHand} → ${item.onHand + adj.addQuantity})`;
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "linen_item",
      entityId: "bulk",
      summary: `Bulk adjusted ${adjustments.length} linen item(s)`,
      details: { adjustments: summaryLines },
    });

    return success({ updated: results, count: results.length });
  } catch (err) {
    console.error("[PATCH /api/linens/bulk-adjust]", err);
    return error("Failed to bulk adjust linen items", 500);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";

// ---------------------------------------------------------------------------
// GET /api/expenses/summary — Period expense summary
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const params = request.nextUrl.searchParams;
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");

  if (!startDate || !endDate) {
    return error("startDate and endDate are required");
  }

  try {
    const dateFilter = { gte: startDate, lte: endDate };

    // Get all expenses in the period with their categories
    const expenses = await prisma.expense.findMany({
      where: { date: dateFilter },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            parentId: true,
            parent: { select: { id: true, name: true } },
          },
        },
      },
    });

    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalDeductible = expenses
      .filter((e) => e.isDeductible)
      .reduce((sum, e) => sum + e.amount, 0);

    // Breakdown by top-level category
    const categoryMap = new Map<string, { categoryName: string; total: number }>();
    for (const expense of expenses) {
      // Use parent category name if it exists, otherwise use the category itself
      const topLevelName = expense.category.parent?.name ?? expense.category.name;
      const topLevelId = expense.category.parentId ?? expense.category.id;

      const existing = categoryMap.get(topLevelId);
      if (existing) {
        existing.total += expense.amount;
      } else {
        categoryMap.set(topLevelId, { categoryName: topLevelName, total: expense.amount });
      }
    }

    const byCategory = Array.from(categoryMap.values()).sort(
      (a, b) => b.total - a.total
    );

    return success({
      startDate,
      endDate,
      total: Math.round(total * 100) / 100,
      totalDeductible: Math.round(totalDeductible * 100) / 100,
      byCategory,
    });
  } catch (err) {
    console.error("[GET /api/expenses/summary]", err);
    return error("Failed to compute expense summary", 500);
  }
}

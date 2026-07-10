import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";

// ---------------------------------------------------------------------------
// GET /api/expenses/categories — List active expense categories
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    const categories = await prisma.expenseCategory.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        parentId: true,
        scheduleCLine: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return success({ categories });
  } catch (err) {
    console.error("[GET /api/expenses/categories]", err);
    return error("Failed to fetch expense categories", 500);
  }
}

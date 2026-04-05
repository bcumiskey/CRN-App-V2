import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { resolveDateRange } from "@/lib/date-ranges";
import { r2 } from "@/lib/report-utils";

// ---------------------------------------------------------------------------
// GET /api/reports/expense-detail — Expense Detail
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    const params = request.nextUrl.searchParams;
    const range = resolveDateRange(
      params.get("startDate"),
      params.get("endDate"),
      params.get("preset")
    );

    const expenses = await prisma.expense.findMany({
      where: {
        date: { gte: range.startDate, lte: range.endDate },
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            parent: { select: { id: true, name: true } },
          },
        },
        loggedBy: { select: { id: true, name: true } },
      },
      orderBy: { date: "asc" },
    });

    const items = expenses.map((exp) => ({
      id: exp.id,
      date: exp.date,
      amount: r2(exp.amount),
      vendor: exp.vendor,
      description: exp.description,
      categoryId: exp.categoryId,
      categoryName: exp.category.name,
      parentCategoryName: exp.category.parent?.name ?? null,
      isDeductible: exp.isDeductible,
      isReconciled: exp.isReconciled,
      hasReceipt: !!exp.receiptUrl,
      loggedBy: exp.loggedBy
        ? { id: exp.loggedBy.id, name: exp.loggedBy.name }
        : null,
      taxYear: exp.taxYear,
    }));

    const total = r2(expenses.reduce((sum, e) => sum + e.amount, 0));
    const totalDeductible = r2(
      expenses.filter((e) => e.isDeductible).reduce((sum, e) => sum + e.amount, 0)
    );

    return success({
      ...range,
      expenseCount: items.length,
      total,
      totalDeductible,
      expenses: items,
    });
  } catch (err) {
    console.error("[GET /api/reports/expense-detail]", err);
    return error("Failed to compute expense detail report", 500);
  }
}

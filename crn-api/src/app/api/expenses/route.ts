import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, created, error, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/expenses — List expenses with filters
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const params = request.nextUrl.searchParams;
  const categoryId = params.get("categoryId");
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");
  const vendor = params.get("vendor");
  const isDeductible = params.get("isDeductible");
  const limit = Math.min(Number(params.get("limit") || 50), 200);
  const offset = Number(params.get("offset") || 0);

  const where: Record<string, unknown> = {};
  if (categoryId) where.categoryId = categoryId;
  if (vendor) where.vendor = { contains: vendor, mode: "insensitive" };
  if (isDeductible !== null && isDeductible !== undefined && isDeductible !== "") {
    where.isDeductible = isDeductible === "true";
  }
  if (startDate || endDate) {
    where.date = {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {}),
    };
  }

  try {
    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, code: true } },
          loggedBy: { select: { id: true, name: true } },
        },
        orderBy: { date: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.expense.count({ where }),
    ]);

    return success({ expenses, total, limit, offset });
  } catch (err) {
    console.error("[GET /api/expenses]", err);
    return error("Failed to fetch expenses", 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/expenses — Create expense
// ---------------------------------------------------------------------------

const createExpenseSchema = z.object({
  amount: z.number().min(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  categoryId: z.string().min(1),
  vendor: z.string().optional(),
  description: z.string().optional(),
  receiptUrl: z.string().optional(),
  isDeductible: z.boolean().default(true),
  loggedById: z.string().optional(),
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

  const parsed = createExpenseSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    // Validate category
    const category = await prisma.expenseCategory.findUnique({
      where: { id: data.categoryId },
    });
    if (!category) return error("Expense category not found", 404);

    const expense = await prisma.expense.create({
      data: {
        amount: data.amount,
        date: data.date,
        categoryId: data.categoryId,
        vendor: data.vendor,
        description: data.description,
        receiptUrl: data.receiptUrl,
        isDeductible: data.isDeductible,
        loggedById: data.loggedById ?? result.user.userId,
        taxYear: parseInt(data.date.substring(0, 4), 10),
      },
      include: {
        category: { select: { id: true, name: true, code: true } },
        loggedBy: { select: { id: true, name: true } },
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "create",
      entityType: "expense",
      entityId: expense.id,
      summary: `Created expense $${data.amount} - ${data.vendor ?? "no vendor"}`,
    });

    return created(expense);
  } catch (err) {
    console.error("[POST /api/expenses]", err);
    return error("Failed to create expense", 500);
  }
}

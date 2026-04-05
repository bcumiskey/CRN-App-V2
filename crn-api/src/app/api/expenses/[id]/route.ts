import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/expenses/[id] — Expense detail
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, code: true, scheduleCLine: true } },
        loggedBy: { select: { id: true, name: true } },
      },
    });

    if (!expense) return notFound("Expense not found");

    return success(expense);
  } catch (err) {
    console.error("[GET /api/expenses/[id]]", err);
    return error("Failed to fetch expense", 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/expenses/[id] — Update expense
// ---------------------------------------------------------------------------

const updateExpenseSchema = z.object({
  amount: z.number().min(0).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  categoryId: z.string().optional(),
  vendor: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  receiptUrl: z.string().nullable().optional(),
  isDeductible: z.boolean().optional(),
  isReconciled: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = updateExpenseSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) return notFound("Expense not found");

    const updateData: Record<string, unknown> = { ...data };
    if (data.date) {
      updateData.taxYear = parseInt(data.date.substring(0, 4), 10);
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, code: true } },
        loggedBy: { select: { id: true, name: true } },
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "expense",
      entityId: id,
      summary: `Updated expense $${expense.amount}`,
      details: data as Record<string, unknown>,
    });

    return success(expense);
  } catch (err) {
    console.error("[PATCH /api/expenses/[id]]", err);
    return error("Failed to update expense", 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/expenses/[id] — Delete expense
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) return notFound("Expense not found");

    await prisma.expense.delete({ where: { id } });

    await logAudit({
      userId: result.user.userId,
      action: "delete",
      entityType: "expense",
      entityId: id,
      summary: `Deleted expense $${existing.amount} (${existing.date})`,
    });

    return success({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/expenses/[id]]", err);
    return error("Failed to delete expense", 500);
  }
}

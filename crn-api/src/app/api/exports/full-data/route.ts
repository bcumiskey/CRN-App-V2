import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { resolveDateRange } from "@/lib/date-ranges";

// ---------------------------------------------------------------------------
// POST /api/exports/full-data — Full Data Export
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    const body = (await request.json()) as {
      startDate?: string;
      endDate?: string;
      preset?: string;
    };
    const range = resolveDateRange(body.startDate, body.endDate, body.preset);

    // Jobs with assignments and charges
    const jobs = await prisma.job.findMany({
      where: {
        scheduledDate: { gte: range.startDate, lte: range.endDate },
      },
      include: {
        assignments: {
          include: {
            user: { select: { id: true, name: true, isOwner: true } },
          },
        },
        charges: true,
        property: { select: { id: true, name: true, code: true } },
      },
      orderBy: { scheduledDate: "asc" },
    });

    // Invoices with line items
    const invoices = await prisma.invoice.findMany({
      where: {
        invoiceDate: { gte: range.startDate, lte: range.endDate },
      },
      include: {
        lineItems: true,
        owner: { select: { id: true, name: true } },
      },
      orderBy: { invoiceDate: "asc" },
    });

    // Expenses
    const expenses = await prisma.expense.findMany({
      where: { date: { gte: range.startDate, lte: range.endDate } },
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: { date: "asc" },
    });

    // Mileage
    const mileage = await prisma.mileageLog.findMany({
      where: { date: { gte: range.startDate, lte: range.endDate } },
      orderBy: { date: "asc" },
    });

    // Pay periods overlapping the range
    const payPeriods = await prisma.payPeriod.findMany({
      where: {
        OR: [
          {
            startDate: { gte: range.startDate, lte: range.endDate },
          },
          {
            endDate: { gte: range.startDate, lte: range.endDate },
          },
        ],
      },
      include: {
        payStatements: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { startDate: "asc" },
    });

    // Properties with rooms
    const properties = await prisma.property.findMany({
      include: {
        rooms: true,
        owner: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });

    // Team members (no tax IDs for security)
    const team = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isOwner: true,
        status: true,
        defaultShare: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });

    return success({
      exportDate: new Date().toISOString(),
      ...range,
      jobs,
      invoices,
      expenses,
      mileage,
      payPeriods,
      properties,
      team,
    });
  } catch (err) {
    console.error("[POST /api/exports/full-data]", err);
    return error("Failed to generate full data export", 500);
  }
}

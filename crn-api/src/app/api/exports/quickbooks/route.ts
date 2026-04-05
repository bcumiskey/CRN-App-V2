import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { resolveDateRange } from "@/lib/date-ranges";
import { r2 } from "@/lib/report-utils";

// ---------------------------------------------------------------------------
// POST /api/exports/quickbooks — QuickBooks CSV Export
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

    const rows: string[][] = [];

    // Header row
    rows.push([
      "Type",
      "Date",
      "Number",
      "Name",
      "Description",
      "Amount",
      "Account",
    ]);

    // --- Invoices → Invoice type ---
    const invoices = await prisma.invoice.findMany({
      where: {
        invoiceDate: { gte: range.startDate, lte: range.endDate },
        status: { not: "void" },
      },
      include: {
        owner: { select: { name: true } },
        lineItems: { select: { description: true, amount: true } },
      },
    });

    for (const inv of invoices) {
      for (const li of inv.lineItems) {
        rows.push([
          "Invoice",
          inv.invoiceDate,
          inv.invoiceNumber,
          inv.owner.name,
          csvEscape(li.description),
          String(r2(li.amount)),
          "Cleaning Revenue",
        ]);
      }
    }

    // --- Payments (paid invoices) → Payment type ---
    const paidInvoices = await prisma.invoice.findMany({
      where: {
        status: "paid",
        paidDate: { gte: range.startDate, lte: range.endDate },
      },
      include: { owner: { select: { name: true } } },
    });

    for (const inv of paidInvoices) {
      rows.push([
        "Payment",
        inv.paidDate!,
        inv.invoiceNumber,
        inv.owner.name,
        `Payment for ${inv.invoiceNumber}`,
        String(r2(inv.total)),
        "Undeposited Funds",
      ]);
    }

    // --- Expenses → Expense type ---
    const expenses = await prisma.expense.findMany({
      where: { date: { gte: range.startDate, lte: range.endDate } },
      include: {
        category: {
          select: {
            name: true,
            parent: { select: { name: true } },
          },
        },
      },
    });

    for (const exp of expenses) {
      const categoryName =
        exp.category.parent?.name ?? exp.category.name;
      rows.push([
        "Expense",
        exp.date,
        "",
        exp.vendor ?? "",
        csvEscape(exp.description ?? categoryName),
        String(r2(exp.amount)),
        categoryName,
      ]);
    }

    // --- Team payouts → Contractor Payment type ---
    const payPeriods = await prisma.payPeriod.findMany({
      where: {
        status: { in: ["closed", "paid"] },
        endDate: { gte: range.startDate, lte: range.endDate },
      },
      include: {
        payStatements: {
          include: { user: { select: { name: true } } },
        },
      },
    });

    for (const pp of payPeriods) {
      for (const ps of pp.payStatements) {
        rows.push([
          "Contractor Payment",
          pp.endDate,
          "",
          ps.user.name,
          `Pay period ${pp.startDate} – ${pp.endDate}`,
          String(r2(ps.grossPay)),
          "Contract Labor",
        ]);
      }
    }

    // Build CSV string
    const csv = rows.map((row) => row.join(",")).join("\n");

    return success({
      ...range,
      rowCount: rows.length - 1, // exclude header
      csv,
    });
  } catch (err) {
    console.error("[POST /api/exports/quickbooks]", err);
    return error("Failed to generate QuickBooks export", 500);
  }
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

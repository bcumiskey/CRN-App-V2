import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { resolveDateRange } from "@/lib/date-ranges";
import { r2 } from "@/lib/report-utils";

// ---------------------------------------------------------------------------
// GET /api/reports/cash-flow — Cash Flow (cash-basis)
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

    // Money IN: invoices with paidDate in range
    const paidInvoices = await prisma.invoice.findMany({
      where: {
        status: "paid",
        paidDate: { gte: range.startDate, lte: range.endDate },
      },
      select: { id: true, invoiceNumber: true, total: true, paidDate: true },
    });

    const moneyIn = r2(paidInvoices.reduce((sum, inv) => sum + inv.total, 0));

    // Money OUT — expenses in range
    const expenses = await prisma.expense.findMany({
      where: { date: { gte: range.startDate, lte: range.endDate } },
      select: {
        id: true,
        amount: true,
        date: true,
        vendor: true,
        description: true,
      },
    });

    const totalExpenses = r2(expenses.reduce((sum, e) => sum + e.amount, 0));

    // Money OUT — team payouts from closed/paid pay periods in range
    const payPeriods = await prisma.payPeriod.findMany({
      where: {
        status: { in: ["closed", "paid"] },
        endDate: { gte: range.startDate, lte: range.endDate },
      },
      include: {
        payStatements: {
          select: { grossPay: true, userId: true },
        },
      },
    });

    const totalTeamPayouts = r2(
      payPeriods.reduce(
        (sum, pp) =>
          sum +
          pp.payStatements.reduce((s, ps) => s + ps.grossPay, 0),
        0
      )
    );

    const moneyOut = r2(totalExpenses + totalTeamPayouts);
    const netCashFlow = r2(moneyIn - moneyOut);

    // Build chronological timeline
    type TimelineEvent = {
      date: string;
      type: "income" | "expense" | "team_payout";
      description: string;
      amount: number;
    };

    const timeline: TimelineEvent[] = [];

    for (const inv of paidInvoices) {
      timeline.push({
        date: inv.paidDate!,
        type: "income",
        description: `Invoice ${inv.invoiceNumber} paid`,
        amount: r2(inv.total),
      });
    }

    for (const exp of expenses) {
      timeline.push({
        date: exp.date,
        type: "expense",
        description: exp.vendor
          ? `${exp.vendor} — ${exp.description ?? ""}`
          : exp.description ?? "Expense",
        amount: r2(exp.amount),
      });
    }

    for (const pp of payPeriods) {
      const ppTotal = r2(
        pp.payStatements.reduce((s, ps) => s + ps.grossPay, 0)
      );
      timeline.push({
        date: pp.endDate,
        type: "team_payout",
        description: `Pay period ${pp.startDate} – ${pp.endDate}`,
        amount: ppTotal,
      });
    }

    timeline.sort((a, b) => a.date.localeCompare(b.date));

    return success({
      ...range,
      moneyIn,
      moneyOut,
      netCashFlow,
      breakdown: {
        invoicePayments: moneyIn,
        operatingExpenses: totalExpenses,
        teamPayouts: totalTeamPayouts,
      },
      timeline,
    });
  } catch (err) {
    console.error("[GET /api/reports/cash-flow]", err);
    return error("Failed to compute cash flow report", 500);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";
import { r2 } from "@/lib/report-utils";

// ---------------------------------------------------------------------------
// GET /api/reports/ar-aging — Accounts Receivable Aging
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    // Find all unpaid invoices
    const invoices = await prisma.invoice.findMany({
      where: { status: { in: ["sent", "overdue"] } },
      include: {
        owner: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
      },
    });

    // Today as YYYY-MM-DD for comparison
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    type Bucket = "current" | "1_30" | "31_60" | "60_plus";

    interface InvoiceDetail {
      invoiceId: string;
      invoiceNumber: string;
      ownerName: string;
      propertyName: string | null;
      total: number;
      dueDate: string | null;
      invoiceDate: string;
      daysOverdue: number;
    }

    const buckets: Record<Bucket, { total: number; invoices: InvoiceDetail[] }> =
      {
        current: { total: 0, invoices: [] },
        "1_30": { total: 0, invoices: [] },
        "31_60": { total: 0, invoices: [] },
        "60_plus": { total: 0, invoices: [] },
      };

    for (const inv of invoices) {
      const dueDate = inv.dueDate ?? inv.invoiceDate;
      const daysOverdue = daysBetween(dueDate, todayStr);

      const detail: InvoiceDetail = {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        ownerName: inv.owner.name,
        propertyName: inv.property?.name ?? null,
        total: r2(inv.total),
        dueDate: inv.dueDate,
        invoiceDate: inv.invoiceDate,
        daysOverdue: Math.max(0, daysOverdue),
      };

      let bucket: Bucket;
      if (daysOverdue <= 0) {
        bucket = "current";
      } else if (daysOverdue <= 30) {
        bucket = "1_30";
      } else if (daysOverdue <= 60) {
        bucket = "31_60";
      } else {
        bucket = "60_plus";
      }

      buckets[bucket].total += inv.total;
      buckets[bucket].invoices.push(detail);
    }

    // Round totals
    for (const key of Object.keys(buckets) as Bucket[]) {
      buckets[key].total = r2(buckets[key].total);
    }

    const grandTotal = r2(
      buckets.current.total +
        buckets["1_30"].total +
        buckets["31_60"].total +
        buckets["60_plus"].total
    );

    return success({
      asOf: todayStr,
      totalOutstanding: grandTotal,
      invoiceCount: invoices.length,
      buckets,
    });
  } catch (err) {
    console.error("[GET /api/reports/ar-aging]", err);
    return error("Failed to compute AR aging report", 500);
  }
}

/**
 * Compute the number of days between two YYYY-MM-DD strings.
 * Positive means `to` is after `from`.
 */
function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs = Date.UTC(ty, tm - 1, td);
  return Math.floor((toMs - fromMs) / (1000 * 60 * 60 * 24));
}

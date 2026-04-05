import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";

// ---------------------------------------------------------------------------
// GET /api/invoices/uninvoiced-jobs — Completed jobs not yet on an invoice
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const params = request.nextUrl.searchParams;
  const ownerId = params.get("ownerId");
  const propertyId = params.get("propertyId");

  try {
    const where: Record<string, unknown> = {
      status: "COMPLETED",
      invoiceLineItems: { none: {} },
    };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (ownerId) {
      where.property = { ownerId };
    }

    const jobs = await prisma.job.findMany({
      where,
      select: {
        id: true,
        jobNumber: true,
        scheduledDate: true,
        totalFee: true,
        property: { select: { id: true, name: true } },
      },
      orderBy: { scheduledDate: "desc" },
    });

    return success({ jobs });
  } catch (err) {
    console.error("[GET /api/invoices/uninvoiced-jobs]", err);
    return error("Failed to fetch uninvoiced jobs", 500);
  }
}

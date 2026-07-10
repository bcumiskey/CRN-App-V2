import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { success, error, notFound } from "@/lib/responses";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/owners/[id]/stats — Owner job/invoice/revenue summary
// ---------------------------------------------------------------------------

const COMPLETED_STATUSES = ["COMPLETED", "INVOICED"];

export async function GET(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const owner = await prisma.propertyOwner.findUnique({ where: { id } });
    if (!owner) return notFound("Owner not found");

    const [jobs, invoices] = await Promise.all([
      prisma.job.findMany({
        where: {
          property: { ownerId: id },
          status: { not: "CANCELLED" },
        },
        select: {
          id: true,
          scheduledDate: true,
          totalFee: true,
          status: true,
          clientPaid: true,
          property: { select: { name: true } },
        },
        orderBy: { scheduledDate: "desc" },
      }),
      prisma.invoice.findMany({
        where: { ownerId: id },
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          total: true,
          status: true,
          property: { select: { name: true } },
        },
        orderBy: { invoiceDate: "desc" },
      }),
    ]);

    const completedJobs = jobs.filter((j) => COMPLETED_STATUSES.includes(j.status));
    const totalRevenue = completedJobs.reduce((sum, j) => sum + j.totalFee, 0);
    const paidRevenue = completedJobs
      .filter((j) => j.clientPaid)
      .reduce((sum, j) => sum + j.totalFee, 0);

    const nonVoidInvoices = invoices.filter((inv) => inv.status !== "void");

    return success({
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      paidRevenue: Math.round(paidRevenue * 100) / 100,
      unpaidRevenue: Math.round((totalRevenue - paidRevenue) * 100) / 100,
      totalJobs: jobs.length,
      completedJobs: completedJobs.length,
      pendingJobs: jobs.length - completedJobs.length,
      totalInvoices: nonVoidInvoices.length,
      paidInvoices: nonVoidInvoices.filter((inv) => inv.status === "paid").length,
      unpaidInvoices: nonVoidInvoices.filter((inv) =>
        ["sent", "viewed", "overdue"].includes(inv.status)
      ).length,
      draftInvoices: nonVoidInvoices.filter((inv) => inv.status === "draft").length,
      recentJobs: jobs.slice(0, 5).map((j) => ({
        id: j.id,
        date: j.scheduledDate,
        propertyName: j.property?.name ?? "",
        rate: j.totalFee,
        completed: COMPLETED_STATUSES.includes(j.status),
        clientPaid: j.clientPaid,
      })),
      recentInvoices: invoices.slice(0, 5).map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        propertyName: inv.property?.name ?? "",
        total: inv.total,
        status: inv.status,
      })),
    });
  } catch (err) {
    console.error("[GET /api/owners/[id]/stats]", err);
    return error("Failed to compute owner stats", 500);
  }
}

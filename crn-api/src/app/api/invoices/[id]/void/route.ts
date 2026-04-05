import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound } from "@/lib/responses";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// PATCH /api/invoices/[id]/void — Void the invoice
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { lineItems: { select: { jobId: true } } },
    });
    if (!invoice) return notFound("Invoice not found");

    if (invoice.status === "void") {
      return error("Invoice is already voided", 409);
    }

    // Void the invoice
    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: "void" },
    });

    // Revert linked jobs to COMPLETED
    const jobIds = invoice.lineItems
      .map((li) => li.jobId)
      .filter((jobId): jobId is string => jobId !== null);

    if (jobIds.length > 0) {
      await prisma.job.updateMany({
        where: { id: { in: jobIds }, status: "INVOICED" },
        data: { status: "COMPLETED" },
      });
    }

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "invoice",
      entityId: id,
      summary: `Voided invoice ${invoice.invoiceNumber}`,
    });

    return success(updated);
  } catch (err) {
    console.error("[PATCH /api/invoices/[id]/void]", err);
    return error("Failed to void invoice", 500);
  }
}

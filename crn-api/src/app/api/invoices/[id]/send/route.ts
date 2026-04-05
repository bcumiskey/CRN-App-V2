import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound } from "@/lib/responses";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// POST /api/invoices/[id]/send — Mark invoice as sent
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        lineItems: { select: { jobId: true } },
      },
    });
    if (!invoice) return notFound("Invoice not found");

    if (invoice.status !== "draft") {
      return error("Only draft invoices can be sent", 409);
    }

    // Mark invoice as sent
    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: "sent",
        sentAt: new Date(),
      },
    });

    // Set linked jobs to INVOICED status
    const jobIds = invoice.lineItems
      .map((li) => li.jobId)
      .filter((jobId): jobId is string => jobId !== null);

    if (jobIds.length > 0) {
      await prisma.job.updateMany({
        where: { id: { in: jobIds }, status: "COMPLETED" },
        data: { status: "INVOICED" },
      });
    }

    // Create communication log entry (email sending stubbed)
    await prisma.communicationLog.create({
      data: {
        type: "invoice_email",
        recipientEmail: invoice.owner.email,
        subject: `Invoice ${invoice.invoiceNumber}`,
        entityType: "invoice",
        entityId: invoice.id,
        status: "sent",
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "send",
      entityType: "invoice",
      entityId: id,
      summary: `Sent invoice ${invoice.invoiceNumber} to ${invoice.owner.name}`,
    });

    return success(updated);
  } catch (err) {
    console.error("[POST /api/invoices/[id]/send]", err);
    return error("Failed to send invoice", 500);
  }
}

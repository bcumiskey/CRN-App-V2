import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound } from "@/lib/responses";
import { isEmailConfigured, invoiceEmailSubject, sendInvoiceEmail } from "@/lib/email";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// POST /api/invoices/[id]/send — Mark invoice as sent (+ email PDF if configured)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        owner: { select: { name: true, email: true } },
        property: { select: { name: true, address: true } },
        lineItems: {
          select: { date: true, description: true, amount: true, jobId: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!invoice) return notFound("Invoice not found");

    if (invoice.status !== "draft") {
      return error("Only draft invoices can be sent", 409);
    }

    // Mark invoice as sent (Alex's manual flow — happens regardless of email)
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

    // Attempt real email delivery (PDF attached) when configured
    let emailSent = false;
    let emailSkippedReason: string | undefined;
    let emailSubject: string | undefined;

    if (!isEmailConfigured()) {
      emailSkippedReason = "not_configured";
    } else if (!invoice.owner.email) {
      emailSkippedReason = "no_owner_email";
    } else {
      try {
        const settings = await prisma.companySettings.findUnique({
          where: { id: "singleton" },
          select: { businessName: true },
        });
        const businessName = settings?.businessName ?? "Clean Right Now";

        const pdfBytes = await generateInvoicePdf(invoice, businessName);
        const sendResult = await sendInvoiceEmail({
          to: invoice.owner.email,
          ownerName: invoice.owner.name,
          businessName,
          invoice,
          pdfBytes,
        });

        if (sendResult.sent) {
          emailSent = true;
          emailSubject = invoiceEmailSubject(invoice.invoiceNumber, businessName);
        } else {
          emailSkippedReason = `send_failed: ${sendResult.reason}`;
        }
      } catch (err) {
        console.error("[POST /api/invoices/[id]/send] email delivery failed", err);
        const detail = err instanceof Error ? err.message : String(err);
        emailSkippedReason = `send_failed: ${detail}`;
      }
    }

    if (emailSent && invoice.owner.email) {
      // The email was genuinely delivered to Resend — log the communication.
      await prisma.communicationLog.create({
        data: {
          type: "invoice_email",
          recipientEmail: invoice.owner.email,
          subject: emailSubject ?? `Invoice ${invoice.invoiceNumber}`,
          entityType: "invoice",
          entityId: id,
          status: "sent",
        },
      });

      await logAudit({
        userId: result.user.userId,
        action: "send",
        entityType: "invoice",
        entityId: id,
        summary: `Sent invoice ${invoice.invoiceNumber} to ${invoice.owner.email}`,
      });
    } else {
      await logAudit({
        userId: result.user.userId,
        action: "send",
        entityType: "invoice",
        entityId: id,
        summary: `Marked invoice ${invoice.invoiceNumber} as sent`,
      });
    }

    return success({
      invoice: updated,
      emailSent,
      ...(emailSkippedReason ? { emailSkippedReason } : {}),
    });
  } catch (err) {
    console.error("[POST /api/invoices/[id]/send]", err);
    return error("Failed to send invoice", 500);
  }
}

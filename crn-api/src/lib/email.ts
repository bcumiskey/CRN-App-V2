// ---------------------------------------------------------------------------
// Email delivery via the Resend REST API (no SDK — plain fetch).
// Configured with RESEND_API_KEY + EMAIL_FROM (optional EMAIL_REPLY_TO).
// ---------------------------------------------------------------------------

const RESEND_URL = "https://api.resend.com/emails";

export interface InvoiceEmailInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  billingPeriod: string | null;
  total: number;
}

export interface SendInvoiceEmailParams {
  to: string;
  ownerName: string;
  businessName: string;
  invoice: InvoiceEmailInvoice;
  pdfBytes: Uint8Array;
}

export type SendEmailResult = { sent: true } | { sent: false; reason: string };

/** True when the environment has everything needed to actually send email. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** Subject line for invoice emails (also recorded in CommunicationLog). */
export function invoiceEmailSubject(
  invoiceNumber: string,
  businessName: string
): string {
  return `Invoice ${invoiceNumber} from ${businessName}`;
}

function formatCurrency(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? "-" : ""}$${formatted}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Simple email-safe HTML body (inline styles, no images). */
function buildInvoiceEmailHtml(params: SendInvoiceEmailParams): string {
  const { ownerName, businessName, invoice } = params;
  const rows: Array<[string, string]> = [["Invoice #", invoice.invoiceNumber]];
  if (invoice.billingPeriod) rows.push(["Billing Period", invoice.billingPeriod]);
  rows.push(["Amount Due", formatCurrency(invoice.total)]);
  if (invoice.dueDate) rows.push(["Due Date", invoice.dueDate]);

  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr>` +
        `<td style="padding:6px 16px 6px 0;color:#666666;font-size:14px;">${escapeHtml(label)}</td>` +
        `<td style="padding:6px 0;color:#111111;font-size:14px;font-weight:bold;">${escapeHtml(value)}</td>` +
        `</tr>`
    )
    .join("");

  return (
    `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111111;">` +
    `<h2 style="margin:0 0 16px 0;font-size:20px;color:#111111;">${escapeHtml(businessName)}</h2>` +
    `<p style="margin:0 0 16px 0;font-size:14px;line-height:1.5;">Hi ${escapeHtml(ownerName)},</p>` +
    `<p style="margin:0 0 16px 0;font-size:14px;line-height:1.5;">` +
    `Please find your invoice from ${escapeHtml(businessName)} below. A PDF copy is attached to this email.` +
    `</p>` +
    `<table cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;border-collapse:collapse;">${rowsHtml}</table>` +
    `<p style="margin:0 0 16px 0;font-size:14px;line-height:1.5;">Thank you for your business!</p>` +
    `<p style="margin:0;font-size:12px;color:#666666;line-height:1.5;">` +
    `If you have any questions about this invoice, just reply to this email.` +
    `</p>` +
    `</div>`
  );
}

/**
 * Send an invoice email with the PDF attached via Resend.
 * Never throws — returns { sent: false, reason } on any failure.
 */
export async function sendInvoiceEmail(
  params: SendInvoiceEmailParams
): Promise<SendEmailResult> {
  if (!isEmailConfigured()) {
    return { sent: false, reason: "not_configured" };
  }

  try {
    const body: Record<string, unknown> = {
      from: process.env.EMAIL_FROM,
      to: [params.to],
      subject: invoiceEmailSubject(params.invoice.invoiceNumber, params.businessName),
      html: buildInvoiceEmailHtml(params),
      attachments: [
        {
          filename: `Invoice-${params.invoice.invoiceNumber}.pdf`,
          content: Buffer.from(params.pdfBytes).toString("base64"),
        },
      ],
    };
    if (process.env.EMAIL_REPLY_TO) {
      body.reply_to = process.env.EMAIL_REPLY_TO;
    }

    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const reason = `Resend API error ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`;
      console.error("[sendInvoiceEmail]", reason);
      return { sent: false, reason };
    }

    return { sent: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("[sendInvoiceEmail]", err);
    return { sent: false, reason };
  }
}

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

// ---------------------------------------------------------------------------
// Invoice PDF generation (pdf-lib — pure JS, serverless-safe)
// ---------------------------------------------------------------------------

export interface InvoicePdfLineItem {
  date: string | null;
  description: string;
  amount: number;
}

export interface InvoicePdfData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  billingPeriod: string | null;
  paymentTerms: string;
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  owner: { name: string; email: string | null };
  property?: { name: string; address: string | null } | null;
  lineItems: InvoicePdfLineItem[];
}

// US Letter
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const CONTENT_RIGHT = PAGE_WIDTH - MARGIN;

// Table columns
const COL_DATE_X = MARGIN;
const COL_DESC_X = MARGIN + 95;
const COL_DESC_WIDTH = CONTENT_RIGHT - 90 - COL_DESC_X;
const COL_AMOUNT_RIGHT = CONTENT_RIGHT;

const GRAY = rgb(0.45, 0.45, 0.45);
const BLACK = rgb(0.1, 0.1, 0.1);
const LINE_GRAY = rgb(0.8, 0.8, 0.8);

/** Format a number as $X,XXX.XX (negative values as -$X,XXX.XX). */
function formatCurrency(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? "-" : ""}$${formatted}`;
}

/** Replace characters outside WinAnsi so StandardFonts never throw on encode. */
function sanitize(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "?");
}

/** Word-wrap text to fit maxWidth at the given font/size. Handles newlines. */
function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  for (const rawLine of sanitize(text).split("\n")) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (!current || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

interface Cursor {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
}

/** Start a new page and reset the cursor below the top margin. */
function addPage(cursor: Cursor): void {
  cursor.page = cursor.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  cursor.y = PAGE_HEIGHT - MARGIN;
}

/** Ensure at least `height` points remain on the current page. */
function ensureSpace(cursor: Cursor, height: number): void {
  if (cursor.y - height < MARGIN) addPage(cursor);
}

function drawText(
  cursor: Cursor,
  text: string,
  x: number,
  font: PDFFont,
  size: number,
  color = BLACK
): void {
  cursor.page.drawText(sanitize(text), { x, y: cursor.y, size, font, color });
}

/** Draw text so its right edge lands at `rightX`. */
function drawTextRight(
  cursor: Cursor,
  text: string,
  rightX: number,
  font: PDFFont,
  size: number,
  color = BLACK
): void {
  const clean = sanitize(text);
  const width = font.widthOfTextAtSize(clean, size);
  cursor.page.drawText(clean, {
    x: rightX - width,
    y: cursor.y,
    size,
    font,
    color,
  });
}

function drawRule(cursor: Cursor, color = LINE_GRAY, thickness = 0.75): void {
  cursor.page.drawLine({
    start: { x: MARGIN, y: cursor.y },
    end: { x: CONTENT_RIGHT, y: cursor.y },
    thickness,
    color,
  });
}

/** Draw the line-item table header row (repeated after page breaks). */
function drawTableHeader(cursor: Cursor, boldFont: PDFFont): void {
  ensureSpace(cursor, 30);
  drawText(cursor, "Date", COL_DATE_X, boldFont, 9, GRAY);
  drawText(cursor, "Description", COL_DESC_X, boldFont, 9, GRAY);
  drawTextRight(cursor, "Amount", COL_AMOUNT_RIGHT, boldFont, 9, GRAY);
  cursor.y -= 8;
  drawRule(cursor);
  cursor.y -= 14;
}

/**
 * Generate a PDF for an invoice.
 * `businessName` comes from CompanySettings.businessName (caller passes it).
 */
export async function generateInvoicePdf(
  invoice: InvoicePdfData,
  businessName: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  doc.setTitle(`Invoice ${invoice.invoiceNumber}`);

  const cursor: Cursor = {
    doc,
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: PAGE_HEIGHT - MARGIN - 10,
  };

  // -------------------------------------------------------------------------
  // Header: business name (left), INVOICE (right)
  // -------------------------------------------------------------------------
  drawText(cursor, businessName, MARGIN, boldFont, 18);
  drawTextRight(cursor, "INVOICE", COL_AMOUNT_RIGHT, boldFont, 18, GRAY);
  cursor.y -= 12;
  drawRule(cursor, LINE_GRAY, 1);
  cursor.y -= 24;

  // -------------------------------------------------------------------------
  // Meta block (right): invoice number / dates / billing period
  // Bill To block (left): owner name / email / property
  // -------------------------------------------------------------------------
  const metaRows: Array<[string, string]> = [
    ["Invoice #", invoice.invoiceNumber],
    ["Invoice Date", invoice.invoiceDate],
  ];
  if (invoice.dueDate) metaRows.push(["Due Date", invoice.dueDate]);
  if (invoice.billingPeriod) metaRows.push(["Billing Period", invoice.billingPeriod]);

  const billToLines: string[] = [];
  billToLines.push(invoice.owner.name);
  if (invoice.owner.email) billToLines.push(invoice.owner.email);
  if (invoice.property) {
    billToLines.push(invoice.property.name);
    if (invoice.property.address) billToLines.push(invoice.property.address);
  }

  const blockTop = cursor.y;

  // Bill To (left)
  drawText(cursor, "BILL TO", MARGIN, boldFont, 9, GRAY);
  cursor.y -= 15;
  for (let i = 0; i < billToLines.length; i++) {
    drawText(cursor, billToLines[i], MARGIN, i === 0 ? boldFont : font, 10);
    cursor.y -= 14;
  }
  const billToBottom = cursor.y;

  // Meta (right)
  cursor.y = blockTop;
  const metaLabelRight = CONTENT_RIGHT - 130;
  for (const [label, value] of metaRows) {
    drawTextRight(cursor, label, metaLabelRight, boldFont, 9, GRAY);
    drawTextRight(cursor, value, COL_AMOUNT_RIGHT, font, 10);
    cursor.y -= 15;
  }

  cursor.y = Math.min(billToBottom, cursor.y) - 20;

  // -------------------------------------------------------------------------
  // Line-item table with page-break handling
  // -------------------------------------------------------------------------
  drawTableHeader(cursor, boldFont);

  for (const item of invoice.lineItems) {
    const descLines = wrapText(item.description, font, 10, COL_DESC_WIDTH);
    const rowHeight = descLines.length * 13 + 6;

    if (cursor.y - rowHeight < MARGIN) {
      addPage(cursor);
      drawTableHeader(cursor, boldFont);
    }

    drawText(cursor, item.date ?? "", COL_DATE_X, font, 10);
    drawTextRight(cursor, formatCurrency(item.amount), COL_AMOUNT_RIGHT, font, 10);
    for (const line of descLines) {
      drawText(cursor, line, COL_DESC_X, font, 10);
      cursor.y -= 13;
    }
    cursor.y -= 6;
  }

  cursor.y += 2;
  ensureSpace(cursor, 12);
  drawRule(cursor);
  cursor.y -= 20;

  // -------------------------------------------------------------------------
  // Totals: subtotal / discount / total (right-aligned)
  // -------------------------------------------------------------------------
  const totalsLabelRight = CONTENT_RIGHT - 130;
  const totalsRows: Array<[string, string, boolean]> = [
    ["Subtotal", formatCurrency(invoice.subtotal), false],
  ];
  if (invoice.discount > 0) {
    totalsRows.push(["Discount", `-${formatCurrency(invoice.discount)}`, false]);
  }
  totalsRows.push(["Total Due", formatCurrency(invoice.total), true]);

  ensureSpace(cursor, totalsRows.length * 18 + 10);
  for (const [label, value, isBold] of totalsRows) {
    const rowFont = isBold ? boldFont : font;
    const size = isBold ? 12 : 10;
    drawTextRight(cursor, label, totalsLabelRight, rowFont, size, isBold ? BLACK : GRAY);
    drawTextRight(cursor, value, COL_AMOUNT_RIGHT, rowFont, size);
    cursor.y -= isBold ? 20 : 16;
  }

  cursor.y -= 10;

  // -------------------------------------------------------------------------
  // Payment terms + notes
  // -------------------------------------------------------------------------
  if (invoice.paymentTerms) {
    ensureSpace(cursor, 32);
    drawText(cursor, "PAYMENT TERMS", MARGIN, boldFont, 9, GRAY);
    cursor.y -= 14;
    for (const line of wrapText(invoice.paymentTerms, font, 10, CONTENT_RIGHT - MARGIN)) {
      ensureSpace(cursor, 13);
      drawText(cursor, line, MARGIN, font, 10);
      cursor.y -= 13;
    }
    cursor.y -= 8;
  }

  if (invoice.notes) {
    ensureSpace(cursor, 32);
    drawText(cursor, "NOTES", MARGIN, boldFont, 9, GRAY);
    cursor.y -= 14;
    for (const line of wrapText(invoice.notes, font, 10, CONTENT_RIGHT - MARGIN)) {
      ensureSpace(cursor, 13);
      drawText(cursor, line, MARGIN, font, 10);
      cursor.y -= 13;
    }
  }

  return doc.save();
}

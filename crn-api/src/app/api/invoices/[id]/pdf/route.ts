import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { error, notFound } from "@/lib/responses";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/invoices/[id]/pdf — Render the invoice as a PDF (inline)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: RouteContext) {
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
          select: { date: true, description: true, amount: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!invoice) return notFound("Invoice not found");

    const settings = await prisma.companySettings.findUnique({
      where: { id: "singleton" },
      select: { businessName: true },
    });

    const pdfBytes = await generateInvoicePdf(
      invoice,
      settings?.businessName ?? "Clean Right Now"
    );

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Invoice-${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[GET /api/invoices/[id]/pdf]", err);
    return error("Failed to generate invoice PDF", 500);
  }
}

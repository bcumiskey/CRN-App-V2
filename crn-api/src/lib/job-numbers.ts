import { prisma } from "./prisma";

/**
 * Atomically generate the next job number.
 * Format: {prefix}-{YYYY}-{sequential padded to 4}
 * Example: JOB-2026-0042
 */
export async function generateJobNumber(): Promise<string> {
  const settings = await prisma.companySettings.update({
    where: { id: "singleton" },
    data: { jobNextNumber: { increment: 1 } },
  });

  const year = new Date().getFullYear();
  const seq = String(settings.jobNextNumber - 1).padStart(4, "0");
  return `${settings.jobPrefix}-${year}-${seq}`;
}

/**
 * Atomically generate the next invoice number.
 * Format: {prefix}-{YYYY}-{sequential padded to 4}
 * Example: INV-2026-0001
 */
export async function generateInvoiceNumber(): Promise<string> {
  const settings = await prisma.companySettings.update({
    where: { id: "singleton" },
    data: { invoiceNextNumber: { increment: 1 } },
  });

  const year = new Date().getFullYear();
  const seq = String(settings.invoiceNextNumber - 1).padStart(4, "0");
  return `${settings.invoicePrefix}-${year}-${seq}`;
}

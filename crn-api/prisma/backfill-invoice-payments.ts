import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * One-time backfill: create Payment rows for invoices paid before payment
 * tracking existed.
 *
 * The Payment ledger is new — every invoice marked paid before it shipped
 * has status "paid" but zero Payment rows. Consumers guard against that
 * (a paid invoice with no payments is treated as settled), but backfilling
 * one Payment per legacy paid invoice keeps the ledger complete so payment
 * history reads the same for old and new invoices.
 *
 * Each backfilled Payment covers the full invoice total, dated paidDate
 * (fallback invoiceDate when paidDate was never stamped), with no method
 * and a note marking it as backfilled.
 *
 * Usage (from crn-api/):
 *   npx tsx prisma/backfill-invoice-payments.ts           # dry run — prints what it would create
 *   npx tsx prisma/backfill-invoice-payments.ts --apply   # actually writes
 */
async function main() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "APPLY MODE — writing changes\n" : "DRY RUN — no changes will be written (pass --apply to write)\n");

  const invoices = await prisma.invoice.findMany({
    where: {
      status: "paid",
      payments: { none: {} },
    },
    orderBy: { invoiceDate: "asc" },
    select: {
      id: true,
      invoiceNumber: true,
      total: true,
      invoiceDate: true,
      paidDate: true,
    },
  });
  console.log(`${invoices.length} legacy paid invoice(s) with no payments found.\n`);

  let totalCreated = 0;

  for (const invoice of invoices) {
    const date = invoice.paidDate ?? invoice.invoiceDate;
    console.log(`  ${invoice.invoiceNumber}  ${date}  $${invoice.total}`);

    if (apply) {
      await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: invoice.total,
          date,
          method: null,
          notes: "Backfilled from paid status",
        },
      });
      totalCreated += 1;
    } else {
      totalCreated += 1;
    }
  }

  console.log(`\n${apply ? "Created" : "Would create"} ${totalCreated} payment(s) total.`);
  if (!apply && totalCreated > 0) {
    console.log("Re-run with --apply to write.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

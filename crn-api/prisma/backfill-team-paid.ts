import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * One-time backfill: stamp teamPaid on jobs already covered by closed/paid
 * pay periods.
 *
 * Pay-period close used to freeze PayStatements WITHOUT marking the counted
 * jobs teamPaid. The new close logic sweeps ALL unpaid jobs up to the period
 * end — so without this backfill, the first close after deploying the new
 * logic would count (and pay) every historically-settled job a second time.
 *
 * Old close semantics counted jobs whose completedDate (fallback
 * scheduledDate) fell inside the period's start..end window; this backfill
 * stamps exactly those jobs, using the same marker the new close writes
 * (teamPaidDate = the paying period's endDate, which reopen relies on).
 *
 * Usage (from crn-api/):
 *   npx tsx prisma/backfill-team-paid.ts           # dry run — prints what it would stamp
 *   npx tsx prisma/backfill-team-paid.ts --apply   # actually writes
 */
async function main() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "APPLY MODE — writing changes\n" : "DRY RUN — no changes will be written (pass --apply to write)\n");

  const periods = await prisma.payPeriod.findMany({
    where: { status: { in: ["closed", "paid"] } },
    orderBy: { endDate: "asc" },
    select: { id: true, startDate: true, endDate: true, status: true },
  });
  console.log(`${periods.length} closed/paid pay period(s) found.\n`);

  let totalStamped = 0;

  for (const period of periods) {
    const jobs = await prisma.job.findMany({
      where: {
        teamPaid: false,
        status: { in: ["COMPLETED", "INVOICED"] },
        OR: [
          { completedDate: { gte: period.startDate, lte: period.endDate } },
          {
            completedDate: null,
            scheduledDate: { gte: period.startDate, lte: period.endDate },
          },
        ],
      },
      select: { id: true, jobNumber: true, scheduledDate: true, totalFee: true },
      orderBy: { scheduledDate: "asc" },
    });

    if (jobs.length === 0) {
      console.log(`Period ${period.startDate}..${period.endDate} (${period.status}): nothing to stamp.`);
      continue;
    }

    console.log(`Period ${period.startDate}..${period.endDate} (${period.status}): ${jobs.length} job(s) to stamp:`);
    for (const job of jobs) {
      console.log(`  ${job.jobNumber}  ${job.scheduledDate}  $${job.totalFee}`);
    }

    if (apply) {
      const res = await prisma.job.updateMany({
        where: { id: { in: jobs.map((j) => j.id) }, teamPaid: false },
        data: { teamPaid: true, teamPaidDate: period.endDate },
      });
      console.log(`  → stamped ${res.count} job(s) with teamPaidDate=${period.endDate}\n`);
      totalStamped += res.count;
    } else {
      totalStamped += jobs.length;
    }
  }

  console.log(`\n${apply ? "Stamped" : "Would stamp"} ${totalStamped} job(s) total.`);
  if (!apply && totalStamped > 0) {
    console.log("Re-run with --apply to write. Run this BEFORE the next pay-period close.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

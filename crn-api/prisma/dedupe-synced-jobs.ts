/**
 * Dedupe synced jobs that share an externalId.
 *
 * 2026-07-15 — KEYED ON externalId ALONE, NOT (source, externalId).
 * V1 had this right: `externalId String? @unique` — one calendar event, one job,
 * full stop. The later composite (source, externalId) is strictly WEAKER: it
 * permits the same event to exist once per source, which both sync paths produce
 * in practice (an import writes under one source; a later sync re-creates the
 * same event under another). The composite key also made THIS SCRIPT blind to the
 * very duplicates it exists to find, because it grouped by the same broken key.
 *
 * These duplicates were created by pre-v2.2.1 calendar-sync bugs
 * (concurrent cron + manual sync runs, fallback dedup misses). This script
 * MUST be run — and its output reviewed — BEFORE applying migration
 * 20260711000001_add_job_source_external_id_unique, which adds a partial
 * unique index on Job(source, externalId) WHERE externalId IS NOT NULL
 * AND status <> 'CANCELLED'.
 *
 * Usage:
 *   npx tsx prisma/dedupe-synced-jobs.ts            # DRY RUN (default) — reports only
 *   npx tsx prisma/dedupe-synced-jobs.ts --apply    # cancels safe duplicates
 *
 * Behavior:
 *   - Groups non-CANCELLED jobs by externalId (!= null), ACROSS sources.
 *   - In each group, KEEPS one job: the oldest job that has activity
 *     (assignments / charges / invoice line items), else the oldest overall.
 *   - Duplicates with NO activity are CANCELLED (status -> 'CANCELLED',
 *     never deleted) and an AuditLog row is written.
 *   - Duplicates WITH activity are NEVER touched — they are reported for
 *     manual resolution in the admin UI. The unique index cannot be applied
 *     until those are resolved.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface JobWithCounts {
  id: string;
  jobNumber: string;
  propertyId: string;
  scheduledDate: string;
  status: string;
  source: string;
  externalId: string | null;
  createdAt: Date;
  _count: { assignments: number; charges: number; invoiceLineItems: number };
}

function hasActivity(job: JobWithCounts): boolean {
  return (
    job._count.assignments > 0 ||
    job._count.charges > 0 ||
    job._count.invoiceLineItems > 0
  );
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(
    apply
      ? "MODE: --apply (safe duplicates WILL be cancelled — never deleted)"
      : "MODE: dry run (default — nothing will be modified; pass --apply to act)"
  );

  const groups = await prisma.job.groupBy({
    by: ["externalId"],
    where: {
      externalId: { not: null },
      status: { not: "CANCELLED" },
    },
    having: { externalId: { _count: { gt: 1 } } },
    _count: { _all: true },
  });

  if (groups.length === 0) {
    console.log(
      "No duplicate externalId groups found. Safe to apply the unique index."
    );
    return;
  }

  console.log(`Found ${groups.length} duplicate group(s).\n`);

  let cancelled = 0;
  let manualReview = 0;

  for (const group of groups) {
    const jobs = (await prisma.job.findMany({
      where: {
        externalId: group.externalId,
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        jobNumber: true,
        propertyId: true,
        scheduledDate: true,
        status: true,
        source: true,
        externalId: true,
        createdAt: true,
        _count: {
          select: { assignments: true, charges: true, invoiceLineItems: true },
        },
      },
      orderBy: { createdAt: "asc" },
    })) as JobWithCounts[];

    if (jobs.length < 2) continue; // resolved between groupBy and fetch

    // Keeper: oldest job WITH activity, else oldest overall.
    const keeper = jobs.find(hasActivity) ?? jobs[0];

    console.log(
      `Group (externalId=${group.externalId}) — ${jobs.length} jobs across ${new Set(jobs.map((j) => j.source)).size} source(s):`
    );
    console.log(
      `  KEEP    ${keeper.jobNumber} [${keeper.status}] ${keeper.scheduledDate}` +
        ` (assignments=${keeper._count.assignments}, charges=${keeper._count.charges}, lineItems=${keeper._count.invoiceLineItems})`
    );

    for (const job of jobs) {
      if (job.id === keeper.id) continue;

      if (hasActivity(job)) {
        manualReview++;
        console.log(
          `  MANUAL  ${job.jobNumber} [${job.status}] ${job.scheduledDate}` +
            ` — has activity (assignments=${job._count.assignments}, charges=${job._count.charges}, lineItems=${job._count.invoiceLineItems}); NOT touched — resolve in admin UI`
        );
        continue;
      }

      if (apply) {
        await prisma.job.update({
          where: { id: job.id },
          data: { status: "CANCELLED" },
        });
        await prisma.auditLog.create({
          data: {
            userId: null,
            action: "update",
            entityType: "job",
            entityId: job.id,
            summary: `Cancelled duplicate synced job ${job.jobNumber} (duplicate of ${keeper.jobNumber} by source=${job.source}, externalId=${job.externalId})`,
            details: {
              script: "dedupe-synced-jobs",
              keeperJobId: keeper.id,
              keeperJobNumber: keeper.jobNumber,
            },
          },
        });
        cancelled++;
        console.log(
          `  CANCEL  ${job.jobNumber} [${job.status}] ${job.scheduledDate} — no activity; cancelled`
        );
      } else {
        cancelled++;
        console.log(
          `  CANCEL* ${job.jobNumber} [${job.status}] ${job.scheduledDate} — no activity; would be cancelled with --apply`
        );
      }
    }
    console.log("");
  }

  console.log("---");
  console.log(
    `${apply ? "Cancelled" : "Would cancel"}: ${cancelled} duplicate job(s).`
  );
  console.log(`Manual review required: ${manualReview} job(s).`);
  if (manualReview > 0) {
    console.log(
      "Migration 20260711000001 will FAIL until the manual-review duplicates are resolved."
    );
  } else if (apply) {
    console.log(
      "No manual-review duplicates remain. Safe to apply migration 20260711000001."
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

# 20260711000001_add_job_source_external_id_unique

Adds a **partial unique index** on `Job(source, externalId)` limited to rows
where `externalId IS NOT NULL AND status <> 'CANCELLED'`. This is what lets
the calendar-sync engine treat `(source, externalId)` as job identity and
handle the concurrent-create race by catching `P2002`.

## MUST run the dedupe script first

Production data may already contain duplicate `(source, externalId)` jobs
(created by the pre-v2.2.1 concurrent-sync / fallback-dedup bugs). **Never
assume clean data.** Applying this migration against duplicates will fail.

Order of operations:

1. `npx tsx prisma/dedupe-synced-jobs.ts` — dry run; prints every duplicate
   group and what would happen. Nothing is modified.
2. Review the output. Duplicates that have assignments, charges, or invoice
   line items are **never** auto-touched — resolve those manually in the
   admin UI first (the report lists them).
3. `npx tsx prisma/dedupe-synced-jobs.ts --apply` — cancels (never deletes)
   the safe duplicates, keeping the oldest/most-active job in each group.
4. Re-run the dry run to confirm zero remaining active duplicates.
5. `npx prisma migrate deploy` — applies this migration.

## Why exclude CANCELLED rows

The dedupe script cancels duplicates instead of deleting them (production
data accuracy is sacred). Cancelled rows therefore still share the
`(source, externalId)` pair; excluding them from the index keeps history
intact while still guaranteeing at most one *live* job per external event.

Note: Prisma cannot declare partial indexes, so `schema.prisma` only carries
a comment about this index; the SQL here is the source of truth.

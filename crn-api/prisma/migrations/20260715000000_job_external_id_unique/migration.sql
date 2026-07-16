-- Restore V1's dedupe key: ONE calendar event, ONE job — across all sources.
--
-- The earlier key was the composite (source, externalId), which is strictly
-- WEAKER than a key on externalId alone: it permits the SAME event to exist once
-- per source. Both sync paths produce that in practice — an import writes a job
-- under one source and a later sync re-creates it under another — so live data
-- accumulates paired rows and double-counted revenue. V1 keyed on externalId
-- alone and was right.
--
-- The composite key also blinded prisma/dedupe-synced-jobs.ts, which grouped by
-- the same broken key and therefore reported "no duplicates found" while 23 sat
-- in the table.
--
-- CANCELLED rows stay excluded: the dedupe script cancels rather than deletes,
-- so cancelled duplicates still share the externalId and must not violate this.
--
-- PREREQUISITE: prisma/dedupe-synced-jobs.ts --apply must run first, and any
-- duplicates it flags for MANUAL review must be resolved, or this will fail.
DROP INDEX IF EXISTS "Job_source_externalId_active_key";

CREATE UNIQUE INDEX "Job_externalId_active_key"
ON "Job"("externalId")
WHERE "externalId" IS NOT NULL AND "status" <> 'CANCELLED';

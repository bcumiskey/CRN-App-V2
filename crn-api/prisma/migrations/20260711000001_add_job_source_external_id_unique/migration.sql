-- Partial unique index enforcing calendar-sync job identity:
-- at most ONE non-cancelled job per (source, externalId).
--
-- PREREQUISITE — read README.md in this folder. Existing duplicate rows
-- MUST be resolved first by running prisma/dedupe-synced-jobs.ts
-- (dry-run by default; --apply to cancel safe duplicates), otherwise this
-- CREATE UNIQUE INDEX will fail on production data.
--
-- CANCELLED jobs are excluded so that duplicates neutralized by the dedupe
-- script (which cancels, never deletes) do not violate the index.
CREATE UNIQUE INDEX "Job_source_externalId_active_key"
ON "Job"("source", "externalId")
WHERE "externalId" IS NOT NULL AND "status" <> 'CANCELLED';

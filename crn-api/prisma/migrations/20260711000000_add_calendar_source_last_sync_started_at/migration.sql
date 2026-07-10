-- Additive: track when a sync run claimed this source (in-flight guard).
-- Nullable, no default needed; safe on existing production data.
ALTER TABLE "CalendarSource" ADD COLUMN "lastSyncStartedAt" TIMESTAMP(3);

-- Manual per-worker, per-job pay adjustment (+/- dollars). Additive, nullable-
-- free with a default so every existing assignment reads as 0. Safe on live data.
ALTER TABLE "JobAssignment" ADD COLUMN "payAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Per-job team payment method (the "Pay Team" flow records how the crew was
-- paid, mirroring clientPaidMethod). Additive, nullable — safe on live data.
ALTER TABLE "Job" ADD COLUMN "teamPaidMethod" TEXT;

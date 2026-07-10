-- Additive: per-cleaner worker-portal password, set by the admin.
-- Stored as "scrypt$<saltB64>$<hashB64>" (scrypt N=16384 r=8 p=1, 32-byte key,
-- 16-byte random salt). Nullable; null means no portal login is configured,
-- so existing production data and behavior are unchanged.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

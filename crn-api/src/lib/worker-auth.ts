import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

// ---------------------------------------------------------------------------
// Worker portal auth primitives — pure functions, no database access.
//
// Password hashes are stored as "scrypt$<saltB64>$<hashB64>" and session
// tokens are compact HMAC tokens "wk1.<payloadB64url>.<sigB64url>". Both
// formats are frozen contracts shared with the web portal and mobile app —
// do not change parameters without a migration story for existing hashes
// and tokens.
// ---------------------------------------------------------------------------

// scrypt parameters (frozen)
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32; // bytes
const SALT_LENGTH = 16; // bytes

// Token format (frozen)
const TOKEN_PREFIX = "wk1";
const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * The secret used to sign/verify worker session tokens.
 *
 * WORKER_SESSION_SECRET takes precedence; API_SHARED_SECRET is the fallback
 * so a deployment that already has the admin secret configured gets worker
 * sessions without a new env var. Returns null when neither is set (empty
 * strings count as unset) — in that state the login route responds 503 and
 * no worker token can ever verify.
 */
export function workerSessionSecret(): string | null {
  return (
    process.env.WORKER_SESSION_SECRET || process.env.API_SHARED_SECRET || null
  );
}

/**
 * Hash a portal password for storage.
 *
 * Format: "scrypt$<saltB64>$<hashB64>" — scrypt N=16384 r=8 p=1, 32-byte
 * derived key, 16-byte random salt.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const hash = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/**
 * Verify a password against a stored "scrypt$<saltB64>$<hashB64>" hash.
 * Malformed stored values verify as false rather than throwing.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const salt = Buffer.from(parts[1], "base64");
  const expected = Buffer.from(parts[2], "base64");
  if (salt.length !== SALT_LENGTH || expected.length !== KEY_LENGTH) {
    return false;
  }

  const actual = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return timingSafeEqual(actual, expected);
}

/** HMAC-SHA256 signature over the payload segment, base64url-encoded. */
function signPayload(payloadB64url: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64url).digest("base64url");
}

/**
 * Constant-time string comparison. Compares SHA-256 digests so the buffers
 * passed to timingSafeEqual are always the same length — an attacker-supplied
 * signature of any length can never throw or leak length information.
 */
function signaturesMatch(provided: string, expected: string): boolean {
  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

/**
 * Sign a 30-day worker session token: "wk1.<payloadB64url>.<sigB64url>"
 * where payload = JSON { uid, exp } (exp in epoch seconds).
 *
 * Returns null when no signing secret is configured.
 */
export function signWorkerToken(
  userId: string,
  nowMs: number = Date.now()
): string | null {
  const secret = workerSessionSecret();
  if (!secret) return null;

  const payload = {
    uid: userId,
    exp: Math.floor(nowMs / 1000) + TOKEN_TTL_SECONDS,
  };
  const payloadB64url = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  return `${TOKEN_PREFIX}.${payloadB64url}.${signPayload(payloadB64url, secret)}`;
}

/**
 * Verify a worker session token and return its user id, or null when the
 * token is malformed, tampered with, expired, or no secret is configured.
 * The signature check runs in constant time.
 */
export function verifyWorkerToken(
  token: string,
  nowMs: number = Date.now()
): string | null {
  const secret = workerSessionSecret();
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null;
  const [, payloadB64url, signature] = parts;

  if (!signaturesMatch(signature, signPayload(payloadB64url, secret))) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(
      Buffer.from(payloadB64url, "base64url").toString("utf8")
    );
  } catch {
    return null;
  }
  if (typeof payload !== "object" || payload === null) return null;

  const { uid, exp } = payload as { uid?: unknown; exp?: unknown };
  if (typeof uid !== "string" || uid.length === 0) return null;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return null;
  if (exp <= Math.floor(nowMs / 1000)) return null;

  return uid;
}

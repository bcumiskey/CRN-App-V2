/**
 * Runtime API shared-secret storage (client side).
 *
 * The API is env-gated: until API_SHARED_SECRET is set on crn-api, every
 * request succeeds without a bearer token and none of this activates — the
 * headers are simply absent and the unlock gate never fires. Once the API
 * enforces the secret, requests come back 401, the UnlockGate overlay asks
 * the user for the passphrase once per device, and it is stored here
 * (localStorage — entered at runtime, never baked into the bundle).
 */

const STORAGE_KEY = "crn.apiSecret";

/** Window event dispatched when the API rejects a request with 401. */
export const UNAUTHORIZED_EVENT = "crn:api-unauthorized";

export function getApiSecret(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage can throw (privacy mode, disabled storage) — treat as unset
    return null;
  }
}

export function setApiSecret(secret: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, secret);
  } catch {
    // Ignore — worst case the user is asked again next load
  }
}

export function clearApiSecret(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Authorization header carrying the stored secret; empty object when no
 * secret is stored (today's production — requests are unchanged).
 */
export function apiSecretHeaders(): Record<string, string> {
  const secret = getApiSecret();
  if (!secret) return {};
  return { Authorization: `Bearer ${secret}` };
}

/**
 * Broadcast that the API answered 401 so the UnlockGate can appear.
 * No-op during SSR and when nothing listens.
 */
export function notifyUnauthorized(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker portal session (per-cleaner identity)
//
// Cleaners log in at /team-portal/login with an email + password the admin
// set for them; the API answers with a signed session token that we store
// here. Worker requests send it as the same Authorization: Bearer header the
// admin shared secret uses — a device holds one or the other, and the API's
// resolution order (exact shared-secret match first, then worker token)
// disambiguates. Env-gated like everything else: until the API has a signing
// secret configured, no token can ever be minted and none of this activates.
// ─────────────────────────────────────────────────────────────────────────────

const WORKER_TOKEN_KEY = "crn.workerToken";
const WORKER_NAME_KEY = "crn.workerName";

export function getWorkerToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(WORKER_TOKEN_KEY);
  } catch {
    // localStorage can throw (privacy mode, disabled storage) — treat as unset
    return null;
  }
}

export function setWorkerToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WORKER_TOKEN_KEY, token);
  } catch {
    // Ignore — worst case the worker is asked to log in again next load
  }
}

export function clearWorkerToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(WORKER_TOKEN_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Display name captured at login so the portal header can greet the worker
 * without an extra API round-trip. Purely cosmetic — never used for auth.
 */
export function getWorkerName(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(WORKER_NAME_KEY);
  } catch {
    return null;
  }
}

export function setWorkerName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WORKER_NAME_KEY, name);
  } catch {
    // Ignore — the header simply omits the name
  }
}

export function clearWorkerName(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(WORKER_NAME_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Authorization header for Team Portal requests: the worker session token
 * when this device has one, otherwise the normal admin-secret layer (which
 * is itself empty until a secret is stored). Exactly one bearer value is
 * ever sent.
 */
export function portalAuthHeaders(): Record<string, string> {
  const token = getWorkerToken();
  if (token) return { Authorization: `Bearer ${token}` };
  return apiSecretHeaders();
}

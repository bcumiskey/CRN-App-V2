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

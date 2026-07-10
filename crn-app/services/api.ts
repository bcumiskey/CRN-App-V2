/**
 * Typed API client for crn-api.
 *
 * Auth — two kinds of credential, one Authorization header:
 *
 * - Admin shared secret ("passphrase") stored on-device via expo-secure-store
 *   under the key "crn.apiSecret" (localStorage on web). Existing v2.4 flow.
 * - Per-cleaner worker session token stored under "crn.workerToken", obtained
 *   from POST /worker-auth/login. When present it is PREFERRED over the admin
 *   secret (a device normally holds one or the other). The signed-in worker's
 *   display identity is cached under "crn.workerUser".
 *
 * Whichever credential is present is attached as `Authorization: Bearer <value>`
 * on every request. When the server has no secrets configured and nothing is
 * stored on-device, no header is sent and requests behave exactly as before
 * (dev bypass on the server) — zero behavior change.
 *
 * On a 401 response:
 * - if the request carried a worker token, the token is cleared (expired or
 *   revoked) and worker-login-needed subscribers are notified;
 * - if the device previously held a worker session (identity still cached)
 *   and no admin secret exists, worker-login-needed is also used — a cleaner
 *   should see the sign-in screen, not the admin passphrase prompt;
 * - otherwise unauthorized subscribers are notified (the passphrase unlock
 *   screen), exactly as v2.4.
 */

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const API_BASE = (process.env.EXPO_PUBLIC_API_URL || "https://crn-app-v2.vercel.app") + "/api";

// ---------------------------------------------------------------------------
// Storage helpers (expo-secure-store; localStorage on web)
// ---------------------------------------------------------------------------

async function storageGet(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      // SecureStore is unavailable on web; use the web contract keys instead.
      return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function storageSet(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, value);
      }
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch {
    // Persistence failed (e.g. storage unavailable) — the in-memory value
    // still works for this session.
  }
}

async function storageDelete(key: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
      }
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch {
    // Ignore — the in-memory cache is cleared by the caller.
  }
}

// ---------------------------------------------------------------------------
// Admin shared secret ("crn.apiSecret")
// ---------------------------------------------------------------------------

const SECRET_STORAGE_KEY = "crn.apiSecret";

// Module-memory cache: `undefined` = not read yet, `null` = read, none stored.
let cachedSecret: string | null | undefined;

async function getAdminSecret(): Promise<string | null> {
  if (cachedSecret === undefined) {
    cachedSecret = await storageGet(SECRET_STORAGE_KEY);
  }
  return cachedSecret;
}

/** Persist the shared secret and use it for all subsequent requests. */
export async function setApiSecret(secret: string): Promise<void> {
  cachedSecret = secret;
  await storageSet(SECRET_STORAGE_KEY, secret);
}

/** Remove the shared secret from this device ("Lock this device"). */
export async function clearApiSecret(): Promise<void> {
  cachedSecret = null;
  await storageDelete(SECRET_STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Worker session ("crn.workerToken" + display identity "crn.workerUser")
// ---------------------------------------------------------------------------

const WORKER_TOKEN_KEY = "crn.workerToken";
const WORKER_USER_KEY = "crn.workerUser";

export interface WorkerSessionUser {
  userId: string;
  name: string;
  role: string;
  isOwner: boolean;
  /** Email used to sign in — kept only so the login form can prefill it. */
  email?: string;
}

let cachedWorkerToken: string | null | undefined;
let cachedWorkerUser: WorkerSessionUser | null | undefined;

async function getWorkerToken(): Promise<string | null> {
  if (cachedWorkerToken === undefined) {
    cachedWorkerToken = await storageGet(WORKER_TOKEN_KEY);
  }
  return cachedWorkerToken;
}

/** The signed-in worker's display identity (null when none stored). */
export async function getWorkerUser(): Promise<WorkerSessionUser | null> {
  if (cachedWorkerUser === undefined) {
    const raw = await storageGet(WORKER_USER_KEY);
    if (raw) {
      try {
        cachedWorkerUser = JSON.parse(raw) as WorkerSessionUser;
      } catch {
        cachedWorkerUser = null;
      }
    } else {
      cachedWorkerUser = null;
    }
  }
  return cachedWorkerUser;
}

/** True when a worker session token is stored on this device. */
export async function isWorkerSignedIn(): Promise<boolean> {
  return (await getWorkerToken()) !== null;
}

/** Persist a worker session after a successful login. */
export async function setWorkerSession(
  token: string,
  user: WorkerSessionUser
): Promise<void> {
  cachedWorkerToken = token;
  cachedWorkerUser = user;
  await storageSet(WORKER_TOKEN_KEY, token);
  await storageSet(WORKER_USER_KEY, JSON.stringify(user));
  emitWorkerSessionChange();
}

/** Log out: remove the worker token and identity from this device. */
export async function clearWorkerSession(): Promise<void> {
  cachedWorkerToken = null;
  cachedWorkerUser = null;
  await storageDelete(WORKER_TOKEN_KEY);
  await storageDelete(WORKER_USER_KEY);
  emitWorkerSessionChange();
}

/**
 * Token rejected by the server (expired/revoked) — drop it but keep the
 * identity so the login form can prefill the worker's email.
 */
async function invalidateWorkerToken(): Promise<void> {
  cachedWorkerToken = null;
  await storageDelete(WORKER_TOKEN_KEY);
  emitWorkerSessionChange();
}

// ---------------------------------------------------------------------------
// Event subscriptions (drive the unlock and worker-login screens)
// ---------------------------------------------------------------------------

type Listener = () => void;

const unauthorizedListeners = new Set<Listener>();

/** Subscribe to 401 responses (admin passphrase flow). Returns unsubscribe. */
export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

function emitUnauthorized(): void {
  for (const listener of unauthorizedListeners) {
    listener();
  }
}

/** Open the admin passphrase unlock screen (e.g. from the login screen). */
export function requestUnlock(): void {
  emitUnauthorized();
}

/**
 * Why the worker login screen is being opened:
 * - "expired": the stored session was rejected — blocking re-login.
 * - "manual": the user chose to sign in (logout / unlock-modal link).
 */
export type WorkerLoginReason = "expired" | "manual";

type WorkerLoginListener = (reason: WorkerLoginReason) => void;

const workerLoginListeners = new Set<WorkerLoginListener>();

/** Subscribe to worker-login-needed events. Returns an unsubscribe function. */
export function onWorkerLoginNeeded(listener: WorkerLoginListener): () => void {
  workerLoginListeners.add(listener);
  return () => {
    workerLoginListeners.delete(listener);
  };
}

function emitWorkerLoginNeeded(reason: WorkerLoginReason): void {
  for (const listener of workerLoginListeners) {
    listener(reason);
  }
}

/** Open the worker login screen (logout, or "Sign in as a team member"). */
export function requestWorkerLogin(): void {
  emitWorkerLoginNeeded("manual");
}

const workerSessionListeners = new Set<Listener>();

/** Subscribe to worker session sign-in/sign-out changes. */
export function onWorkerSessionChange(listener: Listener): () => void {
  workerSessionListeners.add(listener);
  return () => {
    workerSessionListeners.delete(listener);
  };
}

function emitWorkerSessionChange(): void {
  for (const listener of workerSessionListeners) {
    listener();
  }
}

// ---------------------------------------------------------------------------
// Request plumbing
// ---------------------------------------------------------------------------

interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public data: unknown,
    message?: string
  ) {
    super(message ?? `API error: ${status}`);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { body, params, ...fetchOptions } = options;

  let url = `${API_BASE}${path}`;

  // Append query params
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((fetchOptions.headers as Record<string, string>) ?? {}),
  };

  // Worker session token is preferred; otherwise fall back to the admin
  // shared secret. A device normally holds one or the other.
  const workerToken = await getWorkerToken();
  const adminSecret = workerToken ? null : await getAdminSecret();
  const bearer = workerToken ?? adminSecret;
  if (bearer) {
    headers["Authorization"] = `Bearer ${bearer}`;
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // A 401 from the login endpoint means "wrong credentials", not "this
  // device's session/secret is invalid" — the login form shows its own error
  // and must not trigger the unlock or re-login overlays (otherwise a typo'd
  // password would stack the passphrase modal over the login modal).
  const isLoginRequest = path === "/worker-auth/login";

  if (!response.ok) {
    if (response.status === 401 && !isLoginRequest) {
      if (workerToken) {
        // The worker session was rejected (expired or revoked): clear it and
        // ask for a fresh login — distinct from the passphrase unlock flow.
        await invalidateWorkerToken();
        emitWorkerLoginNeeded("expired");
      } else if (!adminSecret && (await getWorkerUser()) !== null) {
        // No credential was sent, but this device belonged to a signed-in
        // worker — route them to the worker login, not the admin passphrase.
        emitWorkerLoginNeeded("expired");
      } else {
        emitUnauthorized();
      }
    }
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data, data?.error);
  }

  return response.json();
}

// Convenience methods
export const api = {
  get: <T>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
    request<T>(path, { method: "GET", params }),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body }),

  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),
};

export { ApiError };

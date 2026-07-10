/**
 * Typed API client for crn-api.
 *
 * Auth: a runtime shared secret ("passphrase") stored on-device via
 * expo-secure-store under the key "crn.apiSecret". When present it is
 * attached as `Authorization: Bearer <secret>` on every request. When the
 * server has no API_SHARED_SECRET configured, no secret is ever stored and
 * requests behave exactly as before (dev bypass on the server).
 *
 * On any 401 response the module notifies subscribers (see onUnauthorized)
 * so the app can present the unlock screen.
 */

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const API_BASE = (process.env.EXPO_PUBLIC_API_URL || "https://crn-app-v2.vercel.app") + "/api";

// ---------------------------------------------------------------------------
// Shared-secret storage (expo-secure-store; localStorage on web)
// ---------------------------------------------------------------------------

const SECRET_STORAGE_KEY = "crn.apiSecret";

// Module-memory cache: `undefined` = not read yet, `null` = read, none stored.
let cachedSecret: string | null | undefined;

async function readStoredSecret(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      // SecureStore is unavailable on web; use the web contract key instead.
      return typeof localStorage !== "undefined"
        ? localStorage.getItem(SECRET_STORAGE_KEY)
        : null;
    }
    return await SecureStore.getItemAsync(SECRET_STORAGE_KEY);
  } catch {
    return null;
  }
}

async function getAuthToken(): Promise<string | null> {
  if (cachedSecret === undefined) {
    cachedSecret = await readStoredSecret();
  }
  return cachedSecret;
}

/** Persist the shared secret and use it for all subsequent requests. */
export async function setApiSecret(secret: string): Promise<void> {
  cachedSecret = secret;
  try {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(SECRET_STORAGE_KEY, secret);
      }
    } else {
      await SecureStore.setItemAsync(SECRET_STORAGE_KEY, secret);
    }
  } catch {
    // Persistence failed (e.g. storage unavailable) — the in-memory secret
    // still works for this session.
  }
}

/** Remove the shared secret from this device ("Lock this device"). */
export async function clearApiSecret(): Promise<void> {
  cachedSecret = null;
  try {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(SECRET_STORAGE_KEY);
      }
    } else {
      await SecureStore.deleteItemAsync(SECRET_STORAGE_KEY);
    }
  } catch {
    // Ignore — memory cache is already cleared.
  }
}

// ---------------------------------------------------------------------------
// 401 notification (drives the unlock screen)
// ---------------------------------------------------------------------------

type UnauthorizedListener = () => void;

const unauthorizedListeners = new Set<UnauthorizedListener>();

/** Subscribe to 401 responses. Returns an unsubscribe function. */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
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

  const token = await getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    if (response.status === 401) {
      emitUnauthorized();
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

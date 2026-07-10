// Team Portal fetch layer — like @/lib/api but credential-aware for workers.
// (Not a route file — Next.js only routes page/layout/route special names.)
//
// Differences from the shared `api` client:
//   1. Sends portalAuthHeaders(): the worker session token when this device
//      has one, otherwise the stored admin secret (admin-preview mode).
//   2. On 401 *with* a worker token stored, the session is dead (expired,
//      revoked, or the worker was archived) — clear it and route back to the
//      login page with a "session expired" hint instead of raising the
//      admin UnlockGate.
//   3. On 401 *without* a worker token, behave exactly like the shared
//      client: notify the UnlockGate (admin-secret enforcement, unchanged).

import { API_BASE, apiAuthHeaders, ApiError } from "@/lib/api";
import {
  clearWorkerName,
  clearWorkerToken,
  getWorkerToken,
  notifyUnauthorized,
  portalAuthHeaders,
} from "@/lib/auth-secret";

export const PORTAL_LOGIN_PATH = "/team-portal/login";

/** Query flag the login page reads to show a "session expired" message. */
export const SESSION_EXPIRED_PARAM = "expired";

/** Clear the worker session and send the browser back to the login page. */
export function endWorkerSession(expired: boolean): void {
  clearWorkerToken();
  clearWorkerName();
  if (typeof window !== "undefined") {
    window.location.replace(
      expired ? `${PORTAL_LOGIN_PATH}?${SESSION_EXPIRED_PARAM}=1` : PORTAL_LOGIN_PATH
    );
  }
}

interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { body, params, ...fetchOptions } = options;

  let url = `${API_BASE}/api${path}`;
  if (params) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") sp.set(k, String(v));
    }
    const qs = sp.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...apiAuthHeaders(),
    ...portalAuthHeaders(),
    ...((fetchOptions.headers as Record<string, string>) ?? {}),
  };

  const res = await fetch(url, {
    ...fetchOptions,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    if (res.status === 401) {
      if (getWorkerToken()) {
        // Worker session no longer valid — back to the portal login.
        endWorkerSession(true);
      } else {
        // Admin-preview mode: same behavior as the shared client.
        notifyUnauthorized();
      }
    }
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data);
  }

  return res.json();
}

export const portalApi = {
  get: <T>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
    request<T>(path, { method: "GET", params }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body }),
};

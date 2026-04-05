/**
 * Typed API client for crn-api.
 * Attaches auth token (dev: hardcoded, later: Clerk).
 */

// TODO: Make this configurable via environment
const API_BASE = "http://localhost:3000/api";

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

async function getAuthToken(): Promise<string | null> {
  // TODO: Replace with Clerk getToken() when auth is wired up
  // For dev bypass, no token needed — the API checks DEV_BYPASS_AUTH
  return null;
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

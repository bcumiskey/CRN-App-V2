const VERCEL_TEAM_SLUG = "bcumiskeys-projects";

/**
 * Resolve the API base URL:
 * 1. Explicit NEXT_PUBLIC_API_URL always wins.
 * 2. On Vercel preview deployments, derive the crn-api preview alias for the
 *    same git branch, so review branches talk to their matching API preview
 *    instead of production (requires "expose system env vars" in Vercel).
 * 3. Production default.
 */
function resolveApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  const branch = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF;
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" && branch) {
    const slug = branch.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return `https://crn-api-git-${slug}-${VERCEL_TEAM_SLUG}.vercel.app`;
  }
  return "https://crn-api.vercel.app";
}

export const API_BASE = resolveApiBase();

/**
 * When the crn-api preview sits behind Vercel Deployment Protection, requests
 * carry the "Protection Bypass for Automation" secret. Preview-scoped env var
 * only — unset in production, so this is a no-op there.
 */
export function apiAuthHeaders(): Record<string, string> {
  const bypass = process.env.NEXT_PUBLIC_VERCEL_BYPASS;
  if (!bypass) return {};
  return {
    "x-vercel-protection-bypass": bypass,
    "x-vercel-set-bypass-cookie": "true",
  };
}

interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiError extends Error {
  constructor(public status: number, public data: unknown) {
    super(`API error: ${status}`);
  }
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
    ...((fetchOptions.headers as Record<string, string>) ?? {}),
  };

  const res = await fetch(url, {
    ...fetchOptions,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data);
  }

  return res.json();
}

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

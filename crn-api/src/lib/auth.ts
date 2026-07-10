import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { verifyWorkerToken } from "./worker-auth";

export interface AuthUser {
  userId: string;
  clerkId: string;
  email: string;
  name: string;
  role: "admin" | "worker";
  isOwner: boolean;
}

/**
 * Constant-time comparison of two secrets.
 *
 * Compares SHA-256 digests so the buffers passed to timingSafeEqual are
 * always the same length — a length mismatch between the provided and
 * expected secrets can never throw, and no length information leaks
 * through early returns.
 */
function secretsMatch(provided: string, expected: string): boolean {
  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

/** Extract the token from an "Authorization: Bearer <token>" header. */
function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : null;
}

/** Look up the seeded admin user (the same user the dev bypass returns). */
async function getSeededAdmin(): Promise<AuthUser | null> {
  const user = await prisma.user.findFirst({
    where: { role: "admin" },
  });
  if (!user) return null;
  return {
    userId: user.id,
    clerkId: user.clerkId,
    email: user.email,
    name: user.name,
    role: user.role as "admin" | "worker",
    isOwner: user.isOwner,
  };
}

/**
 * Resolve a worker session token ("wk1.<payload>.<sig>", signed by
 * WORKER_SESSION_SECRET with API_SHARED_SECRET as fallback) to its user.
 * The user is loaded fresh from the database on every request so the
 * identity carries their REAL current role, and only "active" users
 * resolve — archiving or lame-ducking a worker invalidates their sessions
 * immediately, without waiting for token expiry.
 */
async function getWorkerUser(token: string): Promise<AuthUser | null> {
  const uid = verifyWorkerToken(token);
  if (!uid) return null;

  const user = await prisma.user.findFirst({
    where: { id: uid, status: "active" },
  });
  if (!user) return null;

  return {
    userId: user.id,
    clerkId: user.clerkId,
    email: user.email,
    name: user.name,
    role: user.role as "admin" | "worker",
    isOwner: user.isOwner,
  };
}

/**
 * Authenticate and authorize a request.
 *
 * Bearer token resolution order:
 *   1. Exact API_SHARED_SECRET match (when that env var is set, non-empty)
 *      → the seeded admin user. Unchanged from v2.4.
 *   2. Valid worker session token (signed by WORKER_SESSION_SECRET, falling
 *      back to API_SHARED_SECRET; see lib/worker-auth.ts) → the actual user
 *      loaded from the database with their real role. Requires the user to
 *      still be status "active". Works whether or not API_SHARED_SECRET is
 *      set; when neither secret is set, tokens never verify.
 *   3. Otherwise null (requireAuth turns that into a 401).
 *
 * DEV_BYPASS_AUTH=true is honored ONLY when API_SHARED_SECRET is unset
 * (exactly as v2.4): requests that don't resolve to a worker identity
 * return the seeded admin user, enabling full API development without
 * Clerk keys. When API_SHARED_SECRET is set, DEV_BYPASS_AUTH is ignored.
 *
 * Eventually, this may also validate a Clerk session token and look up
 * the user from the database.
 */
export async function getAuthUser(
  request: NextRequest
): Promise<AuthUser | null> {
  const token = getBearerToken(request);
  const sharedSecret = process.env.API_SHARED_SECRET;

  // 1. Runtime shared-secret auth — active only when the env var is set
  if (sharedSecret && token !== null && secretsMatch(token, sharedSecret)) {
    return getSeededAdmin();
  }

  // 2. Worker session token → real per-cleaner identity
  if (token !== null) {
    const workerUser = await getWorkerUser(token);
    if (workerUser) return workerUser;
  }

  // With a shared secret configured, anything unresolved is unauthorized
  // (DEV_BYPASS_AUTH is ignored in this mode — unchanged from v2.4).
  if (sharedSecret) return null;

  // Dev bypass — return seeded admin user
  if (process.env.DEV_BYPASS_AUTH === "true") {
    return getSeededAdmin();
  }

  // TODO: Real Clerk auth — uncomment when Clerk keys are available
  // const { userId: clerkId } = auth();
  // if (!clerkId) return null;
  // const user = await prisma.user.findUnique({ where: { clerkId } });
  // if (!user) return null;
  // return { userId: user.id, clerkId: user.clerkId, ... };

  return null;
}

/**
 * Require authentication. Returns the user or a 401 response.
 */
export async function requireAuth(request: NextRequest): Promise<
  | { user: AuthUser; error?: never }
  | { user?: never; error: Response }
> {
  const user = await getAuthUser(request);
  if (!user) {
    return {
      error: Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }
  return { user };
}

/**
 * Require admin role. Returns the user or a 401/403 response.
 */
export async function requireAdmin(request: NextRequest): Promise<
  | { user: AuthUser; error?: never }
  | { user?: never; error: Response }
> {
  const result = await requireAuth(request);
  if (result.error) return result;

  if (result.user.role !== "admin") {
    return {
      error: Response.json(
        { error: "Forbidden: admin access required" },
        { status: 403 }
      ),
    };
  }
  return result;
}

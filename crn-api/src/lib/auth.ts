import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";

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
 * Authenticate and authorize a request.
 *
 * When API_SHARED_SECRET is set (non-empty), the request must carry
 * "Authorization: Bearer <API_SHARED_SECRET>". A matching secret resolves
 * to the seeded admin user; a missing or wrong secret resolves to null
 * (which requireAuth turns into a 401). DEV_BYPASS_AUTH is ignored in
 * this mode.
 *
 * When API_SHARED_SECRET is unset, behavior is unchanged from before:
 * DEV_BYPASS_AUTH=true returns the seeded admin user without checking
 * any tokens (full API development without Clerk keys); otherwise null.
 *
 * Eventually, this will validate a Clerk session token and look up the
 * user from the database.
 */
export async function getAuthUser(
  request: NextRequest
): Promise<AuthUser | null> {
  // Runtime shared-secret auth — active only when the env var is set
  const sharedSecret = process.env.API_SHARED_SECRET;
  if (sharedSecret) {
    const token = getBearerToken(request);
    if (token !== null && secretsMatch(token, sharedSecret)) {
      return getSeededAdmin();
    }
    return null;
  }

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

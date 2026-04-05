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
 * Authenticate and authorize a request.
 *
 * When DEV_BYPASS_AUTH=true, returns the seeded admin user without
 * checking any tokens. This allows full API development without Clerk keys.
 *
 * In production, this will validate the Clerk session token and look up
 * the user from the database.
 */
export async function getAuthUser(
  request: NextRequest
): Promise<AuthUser | null> {
  // Dev bypass — return seeded admin user
  if (process.env.DEV_BYPASS_AUTH === "true") {
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

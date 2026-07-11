import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import type { AuthUser } from "./auth";
import { forbidden, notFound } from "./responses";

/**
 * Resolve which worker's data a request is scoped to.
 *
 * Default: the caller's own userId. When the caller is an ADMIN and passes
 * ?asUserId=<id>, resolve to that worker instead — this powers the admin Team
 * Portal "viewing as" preview so an admin (who has no job assignments of their
 * own) can see a real cleaner's Today / Schedule / Pay.
 *
 * The param is SILENTLY IGNORED for any non-admin caller: a real cleaner's
 * token always scopes to themselves, so asUserId can never be used to read
 * another cleaner's data, and it never errors or reveals whether an id exists.
 *
 * View-as is READ-ONLY. Mutating routes pass { mutating: true }; an admin using
 * ?asUserId on such a route gets a 403 rather than editing another user's data.
 * Admins make changes through the admin routes, not by impersonation.
 *
 * Returns the { userId } to scope by (plus a viewingAs flag), or an { error }
 * Response to return as-is — mirrors the requireAuth/requireAdmin result shape.
 */
export async function resolveWorkerUserId(
  request: NextRequest,
  user: AuthUser,
  opts: { mutating?: boolean } = {}
): Promise<
  | { userId: string; viewingAs: boolean; error?: never }
  | { userId?: never; viewingAs?: never; error: Response }
> {
  const asUserId = request.nextUrl.searchParams.get("asUserId");

  // Not an admin view-as request → always the caller's own identity.
  if (user.role !== "admin" || !asUserId || asUserId === user.userId) {
    return { userId: user.userId, viewingAs: false };
  }

  // Admin is viewing as another worker.
  if (opts.mutating) {
    return {
      error: forbidden(
        "View-as is read-only. Make changes from the admin tools, not the Team Portal preview."
      ),
    };
  }

  const target = await prisma.user.findUnique({
    where: { id: asUserId },
    select: { id: true },
  });
  if (!target) {
    return { error: notFound("Worker not found") };
  }

  return { userId: target.id, viewingAs: true };
}

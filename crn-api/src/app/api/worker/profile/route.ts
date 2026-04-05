import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error, validationError } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/worker/profile — Worker's own profile
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  const { user } = result;

  try {
    const profile = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        emergencyContact: true,
        emergencyPhone: true,
        avatarUrl: true,
        role: true,
        status: true,
        // EXCLUDE: clerkId, taxIdOnFile, taxIdLastFour, mailingAddress
      },
    });

    if (!profile) return error("Profile not found", 500);

    return success(profile);
  } catch (err) {
    console.error("[GET /api/worker/profile]", err);
    return error("Failed to fetch profile", 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/worker/profile — Worker updates their own profile (limited fields)
// ---------------------------------------------------------------------------

const updateProfileSchema = z.object({
  phone: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export async function PATCH(request: NextRequest) {
  const result = await requireAuth(request);
  if (result.error) return result.error;

  const { user } = result;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  // Reject any attempts to change protected fields
  const rawBody = body as Record<string, unknown>;
  const protectedFields = [
    "name",
    "email",
    "role",
    "status",
    "isOwner",
    "defaultShare",
    "clerkId",
    "taxIdOnFile",
    "taxIdLastFour",
    "mailingAddress",
  ];
  const attempted = protectedFields.filter((f) => f in rawBody);
  if (attempted.length > 0) {
    return error(`Cannot update protected fields: ${attempted.join(", ")}`);
  }

  try {
    const updated = await prisma.user.update({
      where: { id: user.userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        emergencyContact: true,
        emergencyPhone: true,
        avatarUrl: true,
        role: true,
        status: true,
      },
    });

    return success(updated);
  } catch (err) {
    console.error("[PATCH /api/worker/profile]", err);
    return error("Failed to update profile", 500);
  }
}

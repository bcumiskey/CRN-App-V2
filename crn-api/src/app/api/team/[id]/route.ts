import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { hashPassword } from "@/lib/worker-auth";
import { z } from "zod";

/**
 * Never expose the password hash — replace it with a boolean flag so the
 * admin UI can show whether portal access is configured.
 */
function sanitizeMember<T extends { passwordHash: string | null }>(member: T) {
  const { passwordHash, ...safe } = member;
  return { ...safe, hasPortalPassword: passwordHash !== null };
}

// ---------------------------------------------------------------------------
// GET /api/team/[id] — Team member detail
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const member = await prisma.user.findUnique({
      where: { id },
    });
    if (!member) return notFound("Team member not found");

    // Recent assignments with job and property info
    const recentAssignments = await prisma.jobAssignment.findMany({
      where: { userId: id },
      take: 20,
      orderBy: { job: { scheduledDate: "desc" } },
      include: {
        job: {
          select: {
            id: true,
            jobNumber: true,
            scheduledDate: true,
            totalFee: true,
            status: true,
            property: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Total jobs count
    const totalJobs = await prisma.jobAssignment.count({
      where: { userId: id },
    });

    // Basic stats
    const completedAssignments = await prisma.jobAssignment.count({
      where: {
        userId: id,
        job: { status: { in: ["COMPLETED", "INVOICED"] } },
      },
    });

    return success({
      member: sanitizeMember(member),
      recentAssignments: recentAssignments.map((a) => ({
        id: a.id,
        share: a.share,
        jobId: a.job.id,
        jobNumber: a.job.jobNumber,
        scheduledDate: a.job.scheduledDate,
        totalFee: a.job.totalFee,
        status: a.job.status,
        propertyName: a.job.property.name,
      })),
      stats: {
        totalJobs,
        completedJobs: completedAssignments,
      },
    });
  } catch (err) {
    console.error("[GET /api/team/[id]]", err);
    return error("Failed to fetch team member", 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/team/[id] — Update team member
// ---------------------------------------------------------------------------

const updateMemberSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  role: z.enum(["admin", "worker"]).optional(),
  isOwner: z.boolean().optional(),
  status: z.enum(["active", "lame_duck", "archived"]).optional(),
  statusReason: z.string().nullable().optional(),
  defaultShare: z.number().min(0).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  emergencyContact: z.string().nullable().optional(),
  emergencyPhone: z.string().nullable().optional(),
  taxIdOnFile: z.boolean().optional(),
  taxIdLastFour: z.string().nullable().optional(),
  mailingAddress: z.string().nullable().optional(),
  // Worker portal password: min 8 chars to set, empty string to clear.
  // Hashed before storage; the plaintext is never persisted or logged.
  portalPassword: z
    .union([
      z.string().min(8, "Portal password must be at least 8 characters"),
      z.literal(""),
    ])
    .optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = updateMemberSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return notFound("Team member not found");

    // Check email uniqueness if changing
    if (data.email && data.email !== existing.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: data.email },
      });
      if (emailExists) return error("A team member with this email already exists", 409);
    }

    // portalPassword is not a column — map it to passwordHash (set or clear)
    const { portalPassword, ...fields } = data;

    // If status is changing, set statusChangedAt to today
    const updateData: Record<string, unknown> = { ...fields };
    if (data.status && data.status !== existing.status) {
      const today = new Date();
      updateData.statusChangedAt = today.toISOString().split("T")[0]; // YYYY-MM-DD
    }

    if (portalPassword !== undefined) {
      updateData.passwordHash =
        portalPassword === "" ? null : hashPassword(portalPassword);
    }

    const member = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    // Build change summary
    const changedFields = Object.keys(data).filter((key) => {
      const k = key as keyof typeof data;
      return data[k] !== undefined;
    });
    const summary = changedFields.length > 0
      ? `Updated ${member.name}: ${changedFields.join(", ")}`
      : `Updated ${member.name}`;

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "user",
      entityId: id,
      summary,
      details: { fields: changedFields },
    });

    // Dedicated audit entry for portal-access changes (field names only —
    // never the password, hash, or any derived value)
    if (portalPassword !== undefined) {
      await logAudit({
        userId: result.user.userId,
        action: "update",
        entityType: "user",
        entityId: id,
        summary:
          portalPassword === ""
            ? `Cleared portal password for ${member.name}`
            : `Set portal password for ${member.name}`,
      });
    }

    return success(sanitizeMember(member));
  } catch (err) {
    console.error("[PATCH /api/team/[id]]", err);
    return error("Failed to update team member", 500);
  }
}

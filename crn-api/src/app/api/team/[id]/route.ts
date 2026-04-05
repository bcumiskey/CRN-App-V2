import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

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
      member,
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

    // If status is changing, set statusChangedAt to today
    const updateData: Record<string, unknown> = { ...data };
    if (data.status && data.status !== existing.status) {
      const today = new Date();
      updateData.statusChangedAt = today.toISOString().split("T")[0]; // YYYY-MM-DD
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

    return success(member);
  } catch (err) {
    console.error("[PATCH /api/team/[id]]", err);
    return error("Failed to update team member", 500);
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { created, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// POST /api/jobs/[id]/assignments — Add a crew member
// ---------------------------------------------------------------------------

const addAssignmentSchema = z.object({
  userId: z.string().min(1),
  share: z.number().min(0).default(1.0),
});

export async function POST(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = addAssignmentSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { userId, share } = parsed.data;

  try {
    // Validate job exists
    const job = await prisma.job.findUnique({
      where: { id },
      select: { id: true, jobNumber: true },
    });
    if (!job) return notFound("Job not found");

    // Validate user exists and is active (not lame_duck for new assignments)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, status: true },
    });
    if (!user) return notFound("User not found");
    if (user.status !== "active") {
      return error(
        `User ${user.name} is ${user.status} and cannot be assigned to new jobs`,
        422
      );
    }

    // Check for duplicate assignment
    const existing = await prisma.jobAssignment.findUnique({
      where: { jobId_userId: { jobId: id, userId } },
    });
    if (existing) {
      return error("User is already assigned to this job", 409);
    }

    const assignment = await prisma.jobAssignment.create({
      data: { jobId: id, userId, share },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    await logAudit({
      userId: result.user.userId,
      action: "create",
      entityType: "job",
      entityId: id,
      summary: `Added ${user.name} to job ${job.jobNumber} (share: ${share})`,
    });

    return created(assignment);
  } catch (err) {
    console.error("[POST /api/jobs/[id]/assignments]", err);
    return error("Failed to add assignment", 500);
  }
}

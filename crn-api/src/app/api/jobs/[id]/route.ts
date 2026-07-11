import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error, notFound, validationError } from "@/lib/responses";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/jobs/[id] — Job detail
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        property: {
          select: { id: true, name: true, code: true, address: true },
        },
        assignments: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        charges: true,
        _count: { select: { invoiceLineItems: true } },
      },
    });

    if (!job) return notFound("Job not found");

    return success(job);
  } catch (err) {
    console.error("[GET /api/jobs/[id]]", err);
    return error("Failed to fetch job", 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/jobs/[id] — Update job fields
// ---------------------------------------------------------------------------

const updateJobSchema = z.object({
  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .optional(),
  scheduledTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Must be HH:MM")
    .nullable()
    .optional(),
  totalFee: z.number().min(0).optional(),
  houseCutPercent: z.number().min(0).max(100).optional(),
  jobType: z.string().optional(),
  jobTypeLabel: z.string().nullable().optional(),
  isBtoB: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  clientPaid: z.boolean().optional(),
  clientPaidDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  clientPaidMethod: z.string().nullable().optional(),
  teamPaid: z.boolean().optional(),
  teamPaidDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  propertyId: z.string().optional(),
  // Crew editing from the jobs page (v1-compat maps teamMemberIds → userIds).
  // When present, the job's assignments are synced to exactly this set.
  userIds: z.array(z.string()).optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = updateJobSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const data = parsed.data;

  // Crew list is not a Job column — pull it out before building the update.
  const { userIds, ...jobFields } = data;

  try {
    const existing = await prisma.job.findUnique({ where: { id } });
    if (!existing) return notFound("Job not found");

    // Manual edits to sync-managed fields lock the job so calendar sync
    // never overwrites Alex's changes (date/fee/property/B2B). Payment
    // bookkeeping (clientPaid, teamPaid, ...) does NOT lock.
    const SYNC_LOCK_FIELDS = [
      "scheduledDate",
      "scheduledTime",
      "totalFee",
      "houseCutPercent",
      "propertyId",
      "isBtoB",
    ] as const;
    const shouldLock = SYNC_LOCK_FIELDS.some(
      (field) =>
        jobFields[field] !== undefined && jobFields[field] !== existing[field]
    );

    // Sync crew to exactly `userIds` when provided (remove dropped members,
    // add new ones at their default share, leave unchanged members and their
    // shares/payment state alone), then update the job — all in one
    // transaction so the returned job reflects the final crew.
    const job = await prisma.$transaction(async (tx) => {
      if (userIds !== undefined) {
        const desired = new Set(userIds);
        const current = await tx.jobAssignment.findMany({
          where: { jobId: id },
          select: { id: true, userId: true },
        });
        const currentIds = new Set(current.map((a) => a.userId));
        const toRemove = current.filter((a) => !desired.has(a.userId)).map((a) => a.id);
        const toAdd = userIds.filter((uid) => !currentIds.has(uid));

        if (toRemove.length) {
          await tx.jobAssignment.deleteMany({ where: { id: { in: toRemove } } });
        }
        if (toAdd.length) {
          const newUsers = await tx.user.findMany({
            where: { id: { in: toAdd } },
            select: { id: true, defaultShare: true },
          });
          const shareOf = new Map(newUsers.map((u) => [u.id, u.defaultShare ?? 1.0]));
          for (const uid of toAdd) {
            if (!shareOf.has(uid)) continue; // skip unknown user ids
            await tx.jobAssignment.create({
              data: { jobId: id, userId: uid, share: shareOf.get(uid)! },
            });
          }
        }
      }

      return tx.job.update({
        where: { id },
        data: {
          ...jobFields,
          ...(shouldLock ? { syncLocked: true } : {}),
        },
        include: {
          property: { select: { id: true, name: true, code: true } },
          assignments: {
            include: {
              user: { select: { id: true, name: true } },
            },
          },
        },
      });
    });

    await logAudit({
      userId: result.user.userId,
      action: "update",
      entityType: "job",
      entityId: id,
      summary: `Updated job ${existing.jobNumber}`,
      details: data as Record<string, unknown>,
    });

    return success(job);
  } catch (err) {
    console.error("[PATCH /api/jobs/[id]]", err);
    return error("Failed to update job", 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/jobs/[id] — Delete job (cascades assignments & charges)
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  const { id } = await params;

  try {
    const existing = await prisma.job.findUnique({ where: { id } });
    if (!existing) return notFound("Job not found");

    // Cascade: assignments and charges are cascade-deleted by Prisma schema.
    // Check for invoice line items first.
    const linkedInvoices = await prisma.invoiceLineItem.count({
      where: { jobId: id },
    });
    if (linkedInvoices > 0) {
      return error(
        "Cannot delete job linked to invoice line items. Remove the line items first.",
        409
      );
    }

    await prisma.job.delete({ where: { id } });

    await logAudit({
      userId: result.user.userId,
      action: "delete",
      entityType: "job",
      entityId: id,
      summary: `Deleted job ${existing.jobNumber}`,
    });

    return success({ deleted: true, jobNumber: existing.jobNumber });
  } catch (err) {
    console.error("[DELETE /api/jobs/[id]]", err);
    return error("Failed to delete job", 500);
  }
}

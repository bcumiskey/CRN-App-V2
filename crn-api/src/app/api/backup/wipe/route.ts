import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// POST /api/backup/wipe — Delete all user-created data (keep seed data)
// ---------------------------------------------------------------------------

const wipeSchema = z.object({
  confirm: z.literal("DELETE"),
});

export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Invalid JSON body");
  }

  const parsed = wipeSchema.safeParse(body);
  if (!parsed.success) {
    return error('Body must include { confirm: "DELETE" }');
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Delete all user-created data in dependency order
      await tx.propertyNotePhoto.deleteMany();
      await tx.propertyNote.deleteMany();
      await tx.checklistItem.deleteMany();
      await tx.checklist.deleteMany();
      await tx.standingInstruction.deleteMany();
      await tx.propertyPhoto.deleteMany();
      await tx.unmatchedSyncEvent.deleteMany();
      await tx.syncLog.deleteMany();
      await tx.invoiceLineItem.deleteMany();
      await tx.invoice.deleteMany();
      await tx.jobCharge.deleteMany();
      await tx.jobAssignment.deleteMany();
      await tx.job.deleteMany();
      await tx.propertyLinenRequirement.deleteMany();
      await tx.room.deleteMany();
      await tx.calendarSource.deleteMany();
      await tx.property.deleteMany();
      await tx.propertyOwner.deleteMany();
      await tx.expense.deleteMany();
      // Keep system expense categories
      await tx.expenseCategory.deleteMany({ where: { isSystem: false } });
      await tx.mileageLog.deleteMany();
      await tx.payStatement.deleteMany();
      await tx.payPeriod.deleteMany();
      await tx.linenItem.deleteMany();
      await tx.supply.deleteMany();
      await tx.billingItemPreset.deleteMany();
      await tx.notification.deleteMany();
      await tx.pushToken.deleteMany();
      await tx.communicationLog.deleteMany();
      await tx.userPreference.deleteMany();
      await tx.user.deleteMany();
      // Keep CompanySettings (seed data) — do NOT delete
      // AuditLog is NOT wiped
    });

    await logAudit({
      userId: result.user.userId,
      action: "wipe",
      entityType: "backup",
      entityId: new Date().toISOString(),
      summary: "Full data wipe executed (seed data preserved, audit log retained)",
    });

    return success({ wiped: true });
  } catch (err) {
    console.error("[Backup] wipe error:", err);
    return error("Failed to wipe data", 500);
  }
}

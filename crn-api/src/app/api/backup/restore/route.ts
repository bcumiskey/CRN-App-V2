import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error } from "@/lib/responses";
import { z } from "zod";

// ---------------------------------------------------------------------------
// POST /api/backup/restore — Restore from a backup JSON payload
// ---------------------------------------------------------------------------

const restoreSchema = z.object({
  confirm: z.literal("RESTORE"),
  data: z.object({
    companySettings: z.any().optional(),
    users: z.array(z.any()).optional(),
    userPreferences: z.array(z.any()).optional(),
    propertyOwners: z.array(z.any()).optional(),
    properties: z.array(z.any()).optional(),
    rooms: z.array(z.any()).optional(),
    propertyPhotos: z.array(z.any()).optional(),
    standingInstructions: z.array(z.any()).optional(),
    jobs: z.array(z.any()).optional(),
    jobAssignments: z.array(z.any()).optional(),
    jobCharges: z.array(z.any()).optional(),
    calendarSources: z.array(z.any()).optional(),
    invoices: z.array(z.any()).optional(),
    invoiceLineItems: z.array(z.any()).optional(),
    expenseCategories: z.array(z.any()).optional(),
    expenses: z.array(z.any()).optional(),
    mileageLogs: z.array(z.any()).optional(),
    payPeriods: z.array(z.any()).optional(),
    payStatements: z.array(z.any()).optional(),
    linenItems: z.array(z.any()).optional(),
    propertyLinenRequirements: z.array(z.any()).optional(),
    supplies: z.array(z.any()).optional(),
    propertyNotes: z.array(z.any()).optional(),
    propertyNotePhotos: z.array(z.any()).optional(),
    checklists: z.array(z.any()).optional(),
    checklistItems: z.array(z.any()).optional(),
    billingItemPresets: z.array(z.any()).optional(),
    unmatchedSyncEvents: z.array(z.any()).optional(),
  }),
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

  const parsed = restoreSchema.safeParse(body);
  if (!parsed.success) {
    return error(
      'Invalid backup format. Body must include { confirm: "RESTORE", data: {...} }'
    );
  }

  const { data } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      // Delete all existing data in dependency order (children first)
      await tx.propertyNotePhoto.deleteMany();
      await tx.propertyNote.deleteMany();
      await tx.checklistItem.deleteMany();
      await tx.checklist.deleteMany();
      await tx.standingInstruction.deleteMany();
      await tx.propertyPhoto.deleteMany();
      await tx.unmatchedSyncEvent.deleteMany();
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
      await tx.expenseCategory.deleteMany();
      await tx.mileageLog.deleteMany();
      await tx.payStatement.deleteMany();
      await tx.payPeriod.deleteMany();
      await tx.linenItem.deleteMany();
      await tx.supply.deleteMany();
      await tx.billingItemPreset.deleteMany();
      await tx.notification.deleteMany();
      await tx.pushToken.deleteMany();
      await tx.userPreference.deleteMany();
      await tx.user.deleteMany();
      await tx.companySettings.deleteMany();

      // Re-insert backup data in dependency order (parents first)
      if (data.companySettings) {
        await tx.companySettings.create({ data: data.companySettings });
      }

      if (data.users?.length) {
        await tx.user.createMany({ data: data.users });
      }

      if (data.userPreferences?.length) {
        await tx.userPreference.createMany({ data: data.userPreferences });
      }

      if (data.propertyOwners?.length) {
        await tx.propertyOwner.createMany({ data: data.propertyOwners });
      }

      if (data.properties?.length) {
        await tx.property.createMany({ data: data.properties });
      }

      if (data.rooms?.length) {
        await tx.room.createMany({ data: data.rooms });
      }

      if (data.propertyPhotos?.length) {
        await tx.propertyPhoto.createMany({ data: data.propertyPhotos });
      }

      if (data.standingInstructions?.length) {
        await tx.standingInstruction.createMany({ data: data.standingInstructions });
      }

      if (data.expenseCategories?.length) {
        await tx.expenseCategory.createMany({ data: data.expenseCategories });
      }

      if (data.calendarSources?.length) {
        await tx.calendarSource.createMany({ data: data.calendarSources });
      }

      if (data.jobs?.length) {
        await tx.job.createMany({ data: data.jobs });
      }

      if (data.jobAssignments?.length) {
        await tx.jobAssignment.createMany({ data: data.jobAssignments });
      }

      if (data.jobCharges?.length) {
        await tx.jobCharge.createMany({ data: data.jobCharges });
      }

      if (data.invoices?.length) {
        await tx.invoice.createMany({ data: data.invoices });
      }

      if (data.invoiceLineItems?.length) {
        await tx.invoiceLineItem.createMany({ data: data.invoiceLineItems });
      }

      if (data.expenses?.length) {
        await tx.expense.createMany({ data: data.expenses });
      }

      if (data.mileageLogs?.length) {
        await tx.mileageLog.createMany({ data: data.mileageLogs });
      }

      if (data.payPeriods?.length) {
        await tx.payPeriod.createMany({ data: data.payPeriods });
      }

      if (data.payStatements?.length) {
        await tx.payStatement.createMany({ data: data.payStatements });
      }

      if (data.linenItems?.length) {
        await tx.linenItem.createMany({ data: data.linenItems });
      }

      if (data.propertyLinenRequirements?.length) {
        await tx.propertyLinenRequirement.createMany({ data: data.propertyLinenRequirements });
      }

      if (data.supplies?.length) {
        await tx.supply.createMany({ data: data.supplies });
      }

      if (data.propertyNotes?.length) {
        await tx.propertyNote.createMany({ data: data.propertyNotes });
      }

      if (data.propertyNotePhotos?.length) {
        await tx.propertyNotePhoto.createMany({ data: data.propertyNotePhotos });
      }

      if (data.checklists?.length) {
        await tx.checklist.createMany({ data: data.checklists });
      }

      if (data.checklistItems?.length) {
        await tx.checklistItem.createMany({ data: data.checklistItems });
      }

      if (data.billingItemPresets?.length) {
        await tx.billingItemPreset.createMany({ data: data.billingItemPresets });
      }

      if (data.unmatchedSyncEvents?.length) {
        await tx.unmatchedSyncEvent.createMany({ data: data.unmatchedSyncEvents });
      }
    });

    await logAudit({
      userId: result.user.userId,
      action: "restore",
      entityType: "backup",
      entityId: new Date().toISOString(),
      summary: "Full database restore from backup",
    });

    return success({ restored: true });
  } catch (err) {
    console.error("[Backup] restore error:", err);
    return error("Failed to restore backup", 500);
  }
}

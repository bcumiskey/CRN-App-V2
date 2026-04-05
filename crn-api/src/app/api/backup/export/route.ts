import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { success, error } from "@/lib/responses";

// ---------------------------------------------------------------------------
// POST /api/backup/export — Generate a full JSON backup
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    // Fetch all exportable tables in parallel
    const [
      companySettings,
      users,
      userPreferences,
      propertyOwners,
      properties,
      rooms,
      propertyPhotos,
      standingInstructions,
      jobs,
      jobAssignments,
      jobCharges,
      calendarSources,
      invoices,
      invoiceLineItems,
      expenseCategories,
      expenses,
      mileageLogs,
      payPeriods,
      payStatements,
      linenItems,
      propertyLinenRequirements,
      supplies,
      propertyNotes,
      propertyNotePhotos,
      checklists,
      checklistItems,
      billingItemPresets,
      unmatchedSyncEvents,
    ] = await Promise.all([
      prisma.companySettings.findFirst(),
      prisma.user.findMany({
        select: {
          id: true,
          clerkId: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          isOwner: true,
          status: true,
          statusChangedAt: true,
          statusReason: true,
          defaultShare: true,
          avatarUrl: true,
          emergencyContact: true,
          emergencyPhone: true,
          taxIdOnFile: true,
          // Exclude taxIdLastFour for security
          mailingAddress: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.userPreference.findMany(),
      prisma.propertyOwner.findMany(),
      prisma.property.findMany(),
      prisma.room.findMany(),
      prisma.propertyPhoto.findMany(),
      prisma.standingInstruction.findMany(),
      prisma.job.findMany(),
      prisma.jobAssignment.findMany(),
      prisma.jobCharge.findMany(),
      prisma.calendarSource.findMany(),
      prisma.invoice.findMany(),
      prisma.invoiceLineItem.findMany(),
      prisma.expenseCategory.findMany(),
      prisma.expense.findMany(),
      prisma.mileageLog.findMany(),
      prisma.payPeriod.findMany(),
      prisma.payStatement.findMany(),
      prisma.linenItem.findMany(),
      prisma.propertyLinenRequirement.findMany(),
      prisma.supply.findMany(),
      prisma.propertyNote.findMany(),
      prisma.propertyNotePhoto.findMany(),
      prisma.checklist.findMany(),
      prisma.checklistItem.findMany(),
      prisma.billingItemPreset.findMany(),
      prisma.unmatchedSyncEvent.findMany(),
    ]);

    const backup = {
      exportDate: new Date().toISOString().split("T")[0],
      appVersion: "2.0.0",
      counts: {
        users: users.length,
        userPreferences: userPreferences.length,
        propertyOwners: propertyOwners.length,
        properties: properties.length,
        rooms: rooms.length,
        propertyPhotos: propertyPhotos.length,
        standingInstructions: standingInstructions.length,
        jobs: jobs.length,
        jobAssignments: jobAssignments.length,
        jobCharges: jobCharges.length,
        calendarSources: calendarSources.length,
        invoices: invoices.length,
        invoiceLineItems: invoiceLineItems.length,
        expenseCategories: expenseCategories.length,
        expenses: expenses.length,
        mileageLogs: mileageLogs.length,
        payPeriods: payPeriods.length,
        payStatements: payStatements.length,
        linenItems: linenItems.length,
        propertyLinenRequirements: propertyLinenRequirements.length,
        supplies: supplies.length,
        propertyNotes: propertyNotes.length,
        propertyNotePhotos: propertyNotePhotos.length,
        checklists: checklists.length,
        checklistItems: checklistItems.length,
        billingItemPresets: billingItemPresets.length,
        unmatchedSyncEvents: unmatchedSyncEvents.length,
      },
      data: {
        companySettings,
        users,
        userPreferences,
        propertyOwners,
        properties,
        rooms,
        propertyPhotos,
        standingInstructions,
        jobs,
        jobAssignments,
        jobCharges,
        calendarSources,
        invoices,
        invoiceLineItems,
        expenseCategories,
        expenses,
        mileageLogs,
        payPeriods,
        payStatements,
        linenItems,
        propertyLinenRequirements,
        supplies,
        propertyNotes,
        propertyNotePhotos,
        checklists,
        checklistItems,
        billingItemPresets,
        unmatchedSyncEvents,
      },
    };

    await logAudit({
      userId: result.user.userId,
      action: "export",
      entityType: "backup",
      entityId: backup.exportDate,
      summary: `Full backup exported — ${jobs.length} jobs, ${properties.length} properties, ${users.length} users`,
    });

    return success(backup);
  } catch (err) {
    console.error("[Backup] export error:", err);
    return error("Failed to generate backup", 500);
  }
}

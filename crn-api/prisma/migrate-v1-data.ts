/**
 * Migrate V1 data into V2 database.
 * Run: npx tsx prisma/migrate-v1-data.ts
 *
 * Maps V1 schema → V2 schema:
 * - Owner → PropertyOwner
 * - Property.baseRate → Property.defaultJobFee
 * - Property.expensePercent → Property.houseCutPercent
 * - TeamMember → User (role=worker)
 * - Job.date (DateTime) → Job.scheduledDate (string YYYY-MM-DD)
 * - Job.rate → Job.totalFee
 * - Job.expensePercent → Job.houseCutPercent
 * - Job.completed → Job.status (COMPLETED/SCHEDULED)
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// Load V1 export
const v1Data = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../../v1/CleaningRightNow/v1-export.json"),
    "utf-8"
  )
);

// ID mapping: V1 ID → V2 ID
const ownerMap = new Map<string, string>();
const propertyMap = new Map<string, string>();
const teamMap = new Map<string, string>();
const jobMap = new Map<string, string>();

function toDateString(dt: string | null): string {
  if (!dt) return new Date().toISOString().split("T")[0];
  // Extract YYYY-MM-DD from ISO datetime — NO timezone conversion
  const match = dt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return new Date().toISOString().split("T")[0];
}

async function main() {
  console.log("🔄 Migrating V1 data to V2...\n");

  // ── Clear existing sample data ──────────────────────────────
  console.log("  Clearing sample data...");
  await prisma.jobAssignment.deleteMany({});
  await prisma.jobCharge.deleteMany({});
  await prisma.invoiceLineItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.job.deleteMany({});
  await prisma.room.deleteMany({});
  await prisma.standingInstruction.deleteMany({});
  await prisma.checklistItem.deleteMany({});
  await prisma.checklist.deleteMany({});
  await prisma.propertyNote.deleteMany({});
  await prisma.property.deleteMany({});
  await prisma.propertyOwner.deleteMany({});
  // Keep users (Alex), keep expense categories, keep billing presets
  // Delete sample workers
  await prisma.user.deleteMany({ where: { role: "worker" } });
  console.log("  ✓ Cleared");

  // ── Migrate Owners ──────────────────────────────────────────
  console.log("  Migrating owners...");
  for (const owner of v1Data.owners) {
    const created = await prisma.propertyOwner.create({
      data: {
        name: owner.name,
        email: owner.email,
        phone: owner.phone,
        billingType: owner.defaultBillingType === "monthly" || owner.defaultBillingType === "monthly_end" ? "monthly" : "per_job",
        paymentTerms: "Due upon receipt",
        notes: owner.notes,
      },
    });
    ownerMap.set(owner.id, created.id);
  }
  console.log(`  ✓ ${v1Data.owners.length} owners`);

  // ── Migrate Properties ──────────────────────────────────────
  console.log("  Migrating properties...");
  for (const prop of v1Data.properties) {
    const code = prop.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) || "PROP";
    // Ensure unique code
    let finalCode = code;
    let suffix = 1;
    while (true) {
      const existing = await prisma.property.findUnique({ where: { code: finalCode } });
      if (!existing) break;
      finalCode = `${code}${suffix++}`;
    }

    const created = await prisma.property.create({
      data: {
        name: prop.name.trim(),
        code: finalCode,
        address: prop.address,
        ownerId: prop.ownerId ? ownerMap.get(prop.ownerId) : null,
        defaultJobFee: prop.baseRate,
        houseCutPercent: prop.expensePercent ?? 0,
        status: prop.isActive ? "active" : "inactive",
        accessInstructions: prop.accessCode ? `Code: ${prop.accessCode}${prop.accessNotes ? `\n${prop.accessNotes}` : ""}` : prop.accessNotes,
      },
    });
    propertyMap.set(prop.id, created.id);

    // Migrate rooms
    if (prop.rooms && prop.rooms.length > 0) {
      for (const room of prop.rooms) {
        await prisma.room.create({
          data: {
            propertyId: created.id,
            name: room.name,
            floor: room.floor,
            type: room.type,
            bedType: room.bedType,
            bedCount: room.bedCount ?? 1,
            hasCrib: room.hasCrib ?? false,
            hasMurphy: room.hasMurphy ?? false,
            hasTrundle: room.hasTrundle ?? false,
            hasPullout: room.hasPullout ?? false,
            towelCount: room.towelCount,
            hasRug: room.hasRug ?? false,
            hasRobes: room.hasRobes ?? false,
            hasSlippers: room.hasSlippers ?? false,
            stockingNotes: room.stockingNotes,
            sortOrder: room.sortOrder ?? 0,
          },
        });
      }
    }
  }
  console.log(`  ✓ ${v1Data.properties.length} properties with rooms`);

  // ── Migrate Team Members → Users ────────────────────────────
  console.log("  Migrating team members...");
  const adminUser = await prisma.user.findFirst({ where: { role: "admin" } });
  if (adminUser) {
    teamMap.set("admin", adminUser.id);
  }

  for (const tm of v1Data.teamMembers) {
    if (!tm.isActive && tm.name.startsWith("Test")) continue; // Skip test accounts

    const created = await prisma.user.create({
      data: {
        clerkId: `v1_migrated_${tm.id}`,
        email: tm.email || `${tm.name.toLowerCase().replace(/\s+/g, ".")}@migrated.local`,
        name: tm.name,
        phone: tm.phone,
        role: "worker",
        status: tm.isActive ? "active" : "archived",
        defaultShare: 1.0,
      },
    });
    teamMap.set(tm.id, created.id);
  }
  console.log(`  ✓ ${v1Data.teamMembers.length} team members`);

  // ── Migrate Jobs ────────────────────────────────────────────
  console.log("  Migrating jobs...");
  let jobCounter = 1;
  let skipped = 0;

  for (const job of v1Data.jobs) {
    const v2PropertyId = propertyMap.get(job.propertyId);
    if (!v2PropertyId) { skipped++; continue; }

    const scheduledDate = toDateString(job.date);
    const num = String(jobCounter++).padStart(4, "0");

    let status = "SCHEDULED";
    if (job.completed) status = "COMPLETED";

    const created = await prisma.job.create({
      data: {
        jobNumber: `JOB-2026-${num}`,
        propertyId: v2PropertyId,
        scheduledDate,
        scheduledTime: job.time || null,
        jobType: job.isBackToBack ? "TURNOVER" : "STANDARD",
        totalFee: job.rate,
        houseCutPercent: job.expensePercent ?? 0,
        status,
        completedDate: job.completed ? scheduledDate : null,
        clientPaid: job.clientPaid ?? false,
        clientPaidDate: job.clientPaidAt ? toDateString(job.clientPaidAt) : null,
        teamPaid: job.teamPaid ?? false,
        teamPaidDate: job.teamPaidAt ? toDateString(job.teamPaidAt) : null,
        source: job.source ?? "manual",
        externalId: job.externalId,
        rawSummary: job.renterName,
        syncLocked: false,
        isBtoB: job.isBackToBack ?? false,
      },
    });
    jobMap.set(job.id, created.id);

    // Migrate assignments
    if (job.assignments && Array.isArray(job.assignments)) {
      for (const assignment of job.assignments) {
        const v2UserId = teamMap.get(assignment.teamMemberId);
        if (!v2UserId) continue;

        try {
          await prisma.jobAssignment.create({
            data: {
              jobId: created.id,
              userId: v2UserId,
              share: 1.0,
            },
          });
        } catch (e) {
          // Skip duplicates
        }
      }
    }
  }
  console.log(`  ✓ ${jobCounter - 1} jobs migrated (${skipped} skipped)`);

  // ── Migrate Invoices ────────────────────────────────────────
  console.log("  Migrating invoices...");
  let invoiceCount = 0;
  for (const inv of v1Data.invoices) {
    const v2PropertyId = inv.propertyId ? propertyMap.get(inv.propertyId) : null;

    // Find the owner for this invoice's property
    const v1Property = v1Data.properties.find((p: any) => p.id === inv.propertyId);
    const v2OwnerId = v1Property?.ownerId ? ownerMap.get(v1Property.ownerId) : null;

    if (!v2OwnerId) continue; // Skip invoices without an owner

    const created = await prisma.invoice.create({
      data: {
        invoiceNumber: inv.invoiceNumber,
        ownerId: v2OwnerId,
        propertyId: v2PropertyId,
        type: inv.type ?? "per_job",
        billingPeriod: inv.billingPeriod,
        invoiceDate: toDateString(inv.invoiceDate || inv.createdAt),
        paymentTerms: inv.paymentTerms ?? "Due upon receipt",
        subtotal: inv.subtotal,
        discount: inv.discount ?? 0,
        total: inv.total,
        status: inv.status ?? "draft",
        notes: inv.notes,
      },
    });

    // Migrate line items
    if (inv.lineItems && Array.isArray(inv.lineItems)) {
      for (const li of inv.lineItems) {
        await prisma.invoiceLineItem.create({
          data: {
            invoiceId: created.id,
            jobId: li.jobId ? jobMap.get(li.jobId) : null,
            date: li.date ? toDateString(li.date) : null,
            description: li.description,
            amount: li.amount,
            category: li.itemType,
            sortOrder: li.sortOrder ?? 0,
          },
        });
      }
    }
    invoiceCount++;
  }
  console.log(`  ✓ ${invoiceCount} invoices`);

  // Update job counter
  await prisma.companySettings.update({
    where: { id: "singleton" },
    data: { jobNextNumber: jobCounter },
  });

  console.log("\n✅ V1 data migration complete!");
  console.log(`   Owners: ${ownerMap.size}`);
  console.log(`   Properties: ${propertyMap.size}`);
  console.log(`   Team: ${teamMap.size}`);
  console.log(`   Jobs: ${jobCounter - 1}`);
  console.log(`   Invoices: ${invoiceCount}`);
}

main()
  .catch((e) => { console.error("❌ Migration failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

/**
 * Migrate V1 data into V2 database.
 *
 * Usage (from crn-api/):
 *   npx tsx prisma/migrate-v1-data.ts --dry-run   # parse + map + print all counts; NO deletes, NO writes
 *   npx tsx prisma/migrate-v1-data.ts             # WIPES managed tables, then imports
 *
 * Maps V1 schema → V2 schema:
 * - Owner → PropertyOwner
 * - Property.baseRate → Property.defaultJobFee
 * - Property.expensePercent → Property.houseCutPercent
 * - Property.keywords (comma/pipe-separated) → Property.aliases (String[])
 * - TeamMember → User (role=worker; V1 bcrypt passwords are NOT migrated — reported only)
 * - Job.date (DateTime) → Job.scheduledDate (string YYYY-MM-DD)
 * - Job.rate → Job.totalFee
 * - Job.expensePercent → Job.houseCutPercent
 * - Job.completed → Job.status (COMPLETED/SCHEDULED)
 * - Invoice.sentAt/paidAt/paymentMethod carried; paid invoices get a Payment row;
 *   dueDate derived from paymentTerms via the same helper the API uses
 * - CalendarSource (turno→turno_ical, google→google_ical, else manual)
 * - LinenItem (category inferred from name/code)
 * - PropertyNote (+ photos when present); author falls back to the admin user
 *
 * Preserved across the wipe: admin users, CompanySettings, ExpenseCategory,
 * BillingItemPreset. Everything else this script manages is deleted first
 * (destructive idempotency) — including CalendarSource, SyncLog,
 * UnmatchedSyncEvent, LinenItem (PropertyLinenRequirement dies via cascade),
 * Payment, and Notification.
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { dueDateFromTerms } from "../src/lib/business-time";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

// Load V1 export
const v1Data = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../../v1/CleaningRightNow/v1-export.json"),
    "utf-8"
  )
);

// ID mapping: V1 ID → V2 ID (dry-run uses placeholder IDs so mapping still runs)
const ownerMap = new Map<string, string>();
const propertyMap = new Map<string, string>();
// v1PropertyId → v2OwnerId (covers synthesized owners for owner-less properties)
const propertyOwnerV2Map = new Map<string, string>();
const teamMap = new Map<string, string>();
const jobMap = new Map<string, string>();

/**
 * DateTime → business-local (Eastern) calendar date. V1 job dates are
 * noon-UTC-normalized (unaffected by the conversion), but real event
 * timestamps (paidAt/clientPaidAt/teamPaidAt/invoiceDate) recorded in the
 * evening Eastern time land on the NEXT UTC day — naive ISO slicing would
 * shift them +1 day.
 */
const EASTERN_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function toDateString(dt: string | null): string {
  const d = dt ? new Date(dt) : new Date();
  if (isNaN(d.getTime())) return EASTERN_DATE.format(new Date());
  return EASTERN_DATE.format(d);
}

/** V1 Property.keywords is a free-text comma (occasionally pipe) separated list. */
function keywordsToAliases(keywords: string | null | undefined): string[] {
  if (!keywords) return [];
  const parts = String(keywords)
    .split(/[,|]/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  return Array.from(new Set(parts));
}

/**
 * V2 LinenItem.category is constrained by the API to:
 * sheets | towels | bedding | pillows | bath | kitchen.
 * The April export lacked the LinenCategory table entirely; the fresh cutover
 * export adds a `linenCategories` key, but V1's free-form category names do
 * not map onto V2's fixed enum, so category is still inferred from name/code.
 */
function inferLinenCategory(name: string, code: string): string {
  const s = `${name ?? ""} ${code ?? ""}`.toLowerCase();
  if (s.includes("kitchen")) return "kitchen";
  if (s.includes("pcase") || s.includes("pillowcase") || s.includes("pillow case")) return "sheets";
  if (s.includes("pillow")) return "pillows";
  if (s.includes("blanket") || s.includes("duvet") || s.includes("comforter") || s.includes("quilt")) return "bedding";
  if (s.includes("sheet") || /(^|[\s-])set([\s-]|$)/.test(s)) return "sheets";
  if (s.includes("mat") || s.includes("makeup") || s.includes("robe") || s.includes("slipper")) return "bath";
  if (s.includes("towel") || s.includes("wash") || s.includes("hand") || s.includes("beach") || s.includes("bath")) return "towels";
  return "bedding";
}

function mapCalendarSourceType(v1Type: string | null | undefined): string {
  if (v1Type === "turno") return "turno_ical";
  if (v1Type === "google") return "google_ical";
  return "manual";
}

function printHalfMigratedWarning() {
  const bar = "!".repeat(74);
  console.error(`\n${bar}`);
  console.error("!!                                                                      !!");
  console.error("!!   DB IS HALF-MIGRATED — restore from backup or rerun this script.   !!");
  console.error("!!   The wipe completed but the import threw before finishing.         !!");
  console.error("!!   DO NOT let the app run against this database as-is.               !!");
  console.error("!!                                                                      !!");
  console.error(bar);
}

// ── Wipe ─────────────────────────────────────────────────────────
async function wipe() {
  if (DRY_RUN) {
    console.log("  [dry-run] Counting rows that WOULD be deleted (nothing is deleted)...");
    try {
      const wouldDelete: Array<[string, number]> = [
        ["Payment", await prisma.payment.count()],
        ["JobAssignment", await prisma.jobAssignment.count()],
        ["JobCharge", await prisma.jobCharge.count()],
        ["InvoiceLineItem", await prisma.invoiceLineItem.count()],
        ["Invoice", await prisma.invoice.count()],
        ["Job", await prisma.job.count()],
        ["UnmatchedSyncEvent", await prisma.unmatchedSyncEvent.count()],
        ["SyncLog", await prisma.syncLog.count()],
        ["CalendarSource", await prisma.calendarSource.count()],
        ["LinenItem", await prisma.linenItem.count()],
        ["PropertyLinenRequirement (via cascade)", await prisma.propertyLinenRequirement.count()],
        ["Room", await prisma.room.count()],
        ["StandingInstruction", await prisma.standingInstruction.count()],
        ["ChecklistItem", await prisma.checklistItem.count()],
        ["Checklist", await prisma.checklist.count()],
        ["PropertyNote", await prisma.propertyNote.count()],
        ["PropertyNotePhoto (via cascade)", await prisma.propertyNotePhoto.count()],
        ["Property", await prisma.property.count()],
        ["PropertyPhoto (via cascade)", await prisma.propertyPhoto.count()],
        ["PropertyOwner", await prisma.propertyOwner.count()],
        ["Notification", await prisma.notification.count()],
        ["PayStatement (worker-owned)", await prisma.payStatement.count({ where: { user: { role: "worker" } } })],
        ["MileageLog (worker-owned)", await prisma.mileageLog.count({ where: { user: { role: "worker" } } })],
        ["User (role=worker)", await prisma.user.count({ where: { role: "worker" } })],
      ];
      for (const [model, n] of wouldDelete) {
        console.log(`    would delete ${String(n).padStart(5)}  ${model}`);
      }
    } catch {
      console.log("    ⚠ DB unreachable in dry-run — skipping would-delete counts (mapping-only dry run)");
    }
    console.log("  [dry-run] Preserved either way: admin users, CompanySettings, ExpenseCategory, BillingItemPreset");
    return;
  }

  console.log("  Clearing existing data...");
  const del = async (label: string, fn: () => Promise<{ count: number }>) => {
    const r = await fn();
    console.log(`    deleted ${String(r.count).padStart(5)}  ${label}`);
  };

  // Payments die via Invoice cascade anyway, but delete explicitly so the count is visible.
  await del("Payment", () => prisma.payment.deleteMany({}));
  await del("JobAssignment", () => prisma.jobAssignment.deleteMany({}));
  await del("JobCharge", () => prisma.jobCharge.deleteMany({}));
  await del("InvoiceLineItem", () => prisma.invoiceLineItem.deleteMany({}));
  await del("Invoice", () => prisma.invoice.deleteMany({}));
  await del("Job", () => prisma.job.deleteMany({}));
  await del("UnmatchedSyncEvent", () => prisma.unmatchedSyncEvent.deleteMany({}));
  await del("SyncLog", () => prisma.syncLog.deleteMany({}));
  await del("CalendarSource", () => prisma.calendarSource.deleteMany({}));
  // PropertyLinenRequirement has onDelete: Cascade from BOTH LinenItem and
  // Property, so deleting LinenItem removes every requirement row.
  const linenReqCount = await prisma.propertyLinenRequirement.count();
  await del(`LinenItem (cascades ${linenReqCount} PropertyLinenRequirement)`, () => prisma.linenItem.deleteMany({}));
  await del("Room", () => prisma.room.deleteMany({}));
  await del("StandingInstruction", () => prisma.standingInstruction.deleteMany({}));
  await del("ChecklistItem", () => prisma.checklistItem.deleteMany({}));
  await del("Checklist", () => prisma.checklist.deleteMany({}));
  await del("PropertyNote (cascades PropertyNotePhoto)", () => prisma.propertyNote.deleteMany({}));
  await del("Property (cascades PropertyPhoto)", () => prisma.property.deleteMany({}));
  await del("PropertyOwner", () => prisma.propertyOwner.deleteMany({}));
  await del("Notification", () => prisma.notification.deleteMany({}));

  // PayStatement/MileageLog have onDelete: Restrict on User — clear the
  // worker-owned rows first or the worker wipe below aborts.
  await del("PayStatement (worker-owned)", () => prisma.payStatement.deleteMany({ where: { user: { role: "worker" } } }));
  await del("MileageLog (worker-owned)", () => prisma.mileageLog.deleteMany({ where: { user: { role: "worker" } } }));

  // Keep users (Alex/admins), keep expense categories, keep billing presets
  await del("User (role=worker)", () => prisma.user.deleteMany({ where: { role: "worker" } }));

  console.log("    kept: admin users, CompanySettings, ExpenseCategory, BillingItemPreset");
  console.log("  ✓ Cleared");
}

// ── Import ───────────────────────────────────────────────────────
async function importAll() {
  // ── Migrate Owners ──────────────────────────────────────────
  console.log("  Migrating owners...");
  for (const owner of v1Data.owners) {
    let v2Id = `dry_owner_${owner.id}`;
    if (!DRY_RUN) {
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
      v2Id = created.id;
    }
    ownerMap.set(owner.id, v2Id);
  }
  console.log(`  ✓ ${ownerMap.size} owners`);

  // ── Migrate Properties ──────────────────────────────────────
  console.log("  Migrating properties...");
  const usedCodes = new Set<string>();
  let roomCount = 0;
  let propertiesWithAliases = 0;
  let aliasTotal = 0;
  let ownersSynthesized = 0;
  // Dedupe synthesized owners across properties sharing the same denormalized owner
  const synthesizedOwners = new Map<string, string>(); // key: name|email → v2OwnerId

  for (const prop of v1Data.properties) {
    const code = prop.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) || "PROP";
    // Ensure unique code (in-memory set covers dry-run; DB check covers apply mode)
    let finalCode = code;
    let suffix = 1;
    while (true) {
      const clash =
        usedCodes.has(finalCode) ||
        (!DRY_RUN && (await prisma.property.findUnique({ where: { code: finalCode } })) !== null);
      if (!clash) break;
      finalCode = `${code}${suffix++}`;
    }
    usedCodes.add(finalCode);

    const aliases = keywordsToAliases(prop.keywords);
    if (aliases.length > 0) {
      propertiesWithAliases++;
      aliasTotal += aliases.length;
    }

    // Resolve owner — synthesizing one from V1's denormalized ownerName/
    // ownerEmail when the property has no Owner row. Without this, every
    // invoice on a "direct" property is skipped at import (V2 requires
    // Invoice.ownerId), silently dropping paid history.
    let v2OwnerId = prop.ownerId ? ownerMap.get(prop.ownerId) ?? null : null;
    if (!v2OwnerId) {
      const synthName = (prop.ownerName && String(prop.ownerName).trim()) || `Direct — ${prop.name.trim()}`;
      const synthKey = `${synthName.toLowerCase()}|${(prop.ownerEmail ?? "").toLowerCase()}`;
      if (synthesizedOwners.has(synthKey)) {
        v2OwnerId = synthesizedOwners.get(synthKey)!;
      } else {
        ownersSynthesized++;
        let synthId = `dry_synth_owner_${prop.id}`;
        if (!DRY_RUN) {
          const created = await prisma.propertyOwner.create({
            data: {
              name: synthName,
              email: prop.ownerEmail ?? null,
              phone: prop.ownerPhone ?? null,
              billingType: "per_job",
              paymentTerms: "Due upon receipt",
              notes: `Synthesized at V1 cutover from property "${prop.name.trim()}" (no Owner record in V1)`,
            },
          });
          synthId = created.id;
        }
        synthesizedOwners.set(synthKey, synthId);
        v2OwnerId = synthId;
        console.log(`    ⚠ synthesized owner "${synthName}" for owner-less property "${prop.name.trim()}"`);
      }
    }

    let v2Id = `dry_property_${prop.id}`;
    if (!DRY_RUN) {
      const created = await prisma.property.create({
        data: {
          name: prop.name.trim(),
          code: finalCode,
          address: prop.address,
          ownerId: v2OwnerId,
          defaultJobFee: prop.baseRate,
          houseCutPercent: prop.expensePercent ?? 0,
          status: prop.isActive ? "active" : "inactive",
          accessInstructions: prop.accessCode ? `Code: ${prop.accessCode}${prop.accessNotes ? `\n${prop.accessNotes}` : ""}` : prop.accessNotes,
          aliases,
          imageUrl: prop.imageUrl ?? null,
          color: prop.color ?? null,
        },
      });
      v2Id = created.id;
    }
    propertyMap.set(prop.id, v2Id);
    if (v2OwnerId) propertyOwnerV2Map.set(prop.id, v2OwnerId);

    // Migrate rooms — V1 rooms carry bed config as a `beds` JSON array
    // ([{type, count}]), not the V2-shaped bedType/bedCount fields.
    if (prop.rooms && prop.rooms.length > 0) {
      for (const room of prop.rooms) {
        roomCount++;
        let bedType: string | null = room.bedType ?? null;
        let bedCount: number = room.bedCount ?? 1;
        let extraBedsNote: string | null = null;
        if (Array.isArray(room.beds) && room.beds.length > 0) {
          const beds = room.beds.filter((b: any) => b && b.type);
          if (beds.length > 0) {
            bedType = String(beds[0].type).toLowerCase();
            bedCount = beds.reduce((sum: number, b: any) => sum + (Number(b.count) || 1), 0);
            if (beds.length > 1) {
              extraBedsNote = `Beds: ${beds.map((b: any) => `${b.count ?? 1}x ${b.type}`).join(", ")}`;
            }
          }
        }
        if (DRY_RUN) continue;
        await prisma.room.create({
          data: {
            propertyId: v2Id,
            name: room.name,
            floor: room.floor,
            type: room.type,
            bedType,
            bedCount,
            hasCrib: room.hasCrib ?? false,
            hasMurphy: room.hasMurphy ?? false,
            hasTrundle: room.hasTrundle ?? false,
            hasPullout: room.hasPullout ?? false,
            towelCount: room.towelCount,
            hasRug: room.hasRug ?? false,
            hasRobes: room.hasRobes ?? false,
            hasSlippers: room.hasSlippers ?? false,
            stockingNotes: [room.stockingNotes, extraBedsNote].filter(Boolean).join("\n") || null,
            sortOrder: room.sortOrder ?? 0,
          },
        });
      }
    }
  }
  console.log(`  ✓ ${propertyMap.size} properties, ${roomCount} rooms`);
  console.log(`  ✓ ${propertiesWithAliases} properties got aliases from V1 keywords (${aliasTotal} aliases total)`);
  console.log(`  ✓ ${ownersSynthesized} owner(s) synthesized for owner-less properties (their invoices now import)`);

  // ── Migrate Team Members → Users ────────────────────────────
  console.log("  Migrating team members...");
  let adminUser: { id: string } | null = null;
  try {
    adminUser = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });
  } catch (e) {
    if (!DRY_RUN) throw e;
    console.log("  ⚠ [dry-run] DB unreachable — cannot resolve the admin user");
  }
  if (adminUser) {
    teamMap.set("admin", adminUser.id);
  } else if (DRY_RUN) {
    teamMap.set("admin", "dry_admin");
  } else {
    console.log("  ⚠ NO ADMIN USER FOUND — property notes will have no author fallback and admin-mapped rows will be skipped");
  }

  let teamImported = 0;
  let teamSkippedTest = 0;
  let teamWithV1Passwords = 0;
  for (const tm of v1Data.teamMembers) {
    if (!tm.isActive && tm.name.startsWith("Test")) {
      // Skip test accounts — counted, not silent
      teamSkippedTest++;
      console.log(`    skipped test account: ${tm.name}`);
      continue;
    }

    if (tm.password) teamWithV1Passwords++;

    let v2Id = `dry_user_${tm.id}`;
    if (!DRY_RUN) {
      const created = await prisma.user.create({
        data: {
          clerkId: `v1_migrated_${tm.id}`,
          email: tm.email || `${tm.name.toLowerCase().replace(/\s+/g, ".")}@migrated.local`,
          name: tm.name,
          phone: tm.phone,
          role: "worker",
          status: tm.isActive ? "active" : "archived",
          defaultShare: 1.0,
          // NOTE: V1 TeamMember.password (bcrypt) is deliberately NOT copied into
          // passwordHash — V2 uses scrypt and the formats are incompatible.
        },
      });
      v2Id = created.id;
    }
    teamMap.set(tm.id, v2Id);
    teamImported++;
  }
  console.log(`  ✓ ${teamImported} team members imported (${teamSkippedTest} test accounts skipped)`);
  console.log(`  ⚠ NOTE: ${teamWithV1Passwords} imported worker(s) had V1 passwords; portal passwords must be re-issued (V1 bcrypt hashes are NOT migrated)`);

  // ── Migrate Jobs ────────────────────────────────────────────
  console.log("  Migrating jobs...");
  let jobCounter = 1;
  let jobsSkippedNoProperty = 0;
  const skippedJobIds: string[] = [];
  let assignmentsImported = 0;
  let assignmentsSkippedNoUser = 0;
  let assignmentsSkippedDuplicate = 0;

  for (const job of v1Data.jobs) {
    const v2PropertyId = propertyMap.get(job.propertyId);
    if (!v2PropertyId) {
      jobsSkippedNoProperty++;
      skippedJobIds.push(job.id);
      continue;
    }

    const scheduledDate = toDateString(job.date);
    const num = String(jobCounter++).padStart(4, "0");

    let status = "SCHEDULED";
    if (job.completed) status = "COMPLETED";

    let v2JobId = `dry_job_${job.id}`;
    if (!DRY_RUN) {
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
      v2JobId = created.id;
    }
    jobMap.set(job.id, v2JobId);

    // Migrate assignments (duplicates detected in-memory — counted, not swallowed)
    if (job.assignments && Array.isArray(job.assignments)) {
      const seenUsers = new Set<string>();
      for (const assignment of job.assignments) {
        const v2UserId = teamMap.get(assignment.teamMemberId);
        if (!v2UserId) {
          assignmentsSkippedNoUser++;
          continue;
        }
        if (seenUsers.has(v2UserId)) {
          assignmentsSkippedDuplicate++;
          continue;
        }
        seenUsers.add(v2UserId);

        if (!DRY_RUN) {
          await prisma.jobAssignment.create({
            data: {
              jobId: v2JobId,
              userId: v2UserId,
              share: 1.0,
            },
          });
        }
        assignmentsImported++;
      }
    }
  }
  console.log(`  ✓ ${jobCounter - 1} jobs migrated (${jobsSkippedNoProperty} skipped for missing property)`);
  if (skippedJobIds.length > 0) {
    console.log(`  ⚠ SKIPPED JOBS (no mapped property) — V1 ids: ${skippedJobIds.join(", ")}`);
  }
  console.log(`  ✓ ${assignmentsImported} assignments (${assignmentsSkippedNoUser} skipped for unmapped member, ${assignmentsSkippedDuplicate} duplicates skipped)`);

  // ── Migrate Invoices ────────────────────────────────────────
  console.log("  Migrating invoices...");
  let invoiceCount = 0;
  let paymentsCreated = 0;
  let lineItemCount = 0;
  let lineItemsUnlinkedJob = 0;
  const skippedInvoiceNumbers: string[] = [];
  const importedInvoiceNumbers: string[] = [];

  // Jobs referenced by sent/paid invoices must land as INVOICED (and paid
  // ones as client-paid), or months of settled work inflates "Pending from
  // Clients" and breaks invoice-void semantics.
  const jobStatusFromInvoices = new Map<string, { invoiced: boolean; paid: { date: string; method: string | null } | null }>();

  for (const inv of v1Data.invoices) {
    const v2PropertyId = inv.propertyId ? propertyMap.get(inv.propertyId) : null;

    // Owner via the property-resolution map — includes owners synthesized
    // for owner-less "direct" properties, so their invoices import too.
    const v2OwnerId = inv.propertyId ? propertyOwnerV2Map.get(inv.propertyId) ?? null : null;

    if (!v2OwnerId) {
      // Skip invoices without an owner — counted and listed LOUDLY below
      skippedInvoiceNumbers.push(inv.invoiceNumber);
      continue;
    }

    const invoiceDate = toDateString(inv.invoiceDate || inv.createdAt);
    const paymentTerms = inv.paymentTerms ?? "Due upon receipt";
    // Same helper the API uses when it creates invoices
    const dueDate = dueDateFromTerms(invoiceDate, paymentTerms);
    const paidDate = inv.paidAt ? toDateString(inv.paidAt) : null;
    const status = inv.status ?? "draft";

    let v2InvoiceId = `dry_invoice_${inv.id}`;
    if (!DRY_RUN) {
      const created = await prisma.invoice.create({
        data: {
          invoiceNumber: inv.invoiceNumber,
          ownerId: v2OwnerId,
          propertyId: v2PropertyId,
          type: inv.type ?? "per_job",
          billingPeriod: inv.billingPeriod,
          invoiceDate,
          dueDate,
          paymentTerms,
          subtotal: inv.subtotal,
          discount: inv.discount ?? 0,
          total: inv.total,
          status,
          sentAt: inv.sentAt ? new Date(inv.sentAt) : null,
          paidAt: inv.paidAt ? new Date(inv.paidAt) : null,
          paidDate,
          notes: inv.notes,
        },
      });
      v2InvoiceId = created.id;
    }

    // Paid invoices get a Payment row so the ledger is complete
    if (status === "paid") {
      if (!DRY_RUN) {
        await prisma.payment.create({
          data: {
            invoiceId: v2InvoiceId,
            amount: inv.total,
            date: paidDate ?? invoiceDate,
            method: inv.paymentMethod ?? null,
            notes: "Imported from V1",
          },
        });
      }
      paymentsCreated++;
    }

    // Migrate line items
    if (inv.lineItems && Array.isArray(inv.lineItems)) {
      for (const li of inv.lineItems) {
        const v2JobId = li.jobId ? jobMap.get(li.jobId) ?? null : null;
        if (li.jobId && !v2JobId) lineItemsUnlinkedJob++;
        if (v2JobId && (status === "sent" || status === "paid")) {
          const prev = jobStatusFromInvoices.get(v2JobId);
          jobStatusFromInvoices.set(v2JobId, {
            invoiced: true,
            paid: status === "paid"
              ? { date: paidDate ?? invoiceDate, method: inv.paymentMethod ?? null }
              : prev?.paid ?? null,
          });
        }
        if (!DRY_RUN) {
          await prisma.invoiceLineItem.create({
            data: {
              invoiceId: v2InvoiceId,
              jobId: v2JobId,
              date: li.date ? toDateString(li.date) : null,
              description: li.description,
              amount: li.amount,
              category: li.itemType,
              sortOrder: li.sortOrder ?? 0,
            },
          });
        }
        lineItemCount++;
      }
    }
    importedInvoiceNumbers.push(inv.invoiceNumber);
    invoiceCount++;
  }
  console.log(`  ✓ ${invoiceCount} invoices, ${lineItemCount} line items (${lineItemsUnlinkedJob} line items lost their job link)`);
  console.log(`  ✓ ${paymentsCreated} Payment rows created for paid invoices`);
  if (skippedInvoiceNumbers.length > 0) {
    console.log(`  ⚠⚠⚠ ${skippedInvoiceNumbers.length} INVOICES SKIPPED — property has no owner. Invoice numbers: ${skippedInvoiceNumbers.join(", ")}`);
  } else {
    console.log("  ✓ 0 invoices skipped for missing owner");
  }

  // ── Derive job status from invoice status ───────────────────
  let jobsMarkedInvoiced = 0;
  let jobsMarkedClientPaid = 0;
  for (const [v2JobId, info] of jobStatusFromInvoices) {
    if (!DRY_RUN) {
      // Mirror the send route: only COMPLETED jobs transition to INVOICED.
      const r = await prisma.job.updateMany({
        where: { id: v2JobId, status: "COMPLETED" },
        data: { status: "INVOICED" },
      });
      jobsMarkedInvoiced += r.count;
      if (info.paid) {
        const p = await prisma.job.updateMany({
          where: { id: v2JobId, clientPaid: false },
          data: { clientPaid: true, clientPaidDate: info.paid.date, clientPaidMethod: info.paid.method },
        });
        jobsMarkedClientPaid += p.count;
      }
    } else {
      jobsMarkedInvoiced++;
      if (info.paid) jobsMarkedClientPaid++;
    }
  }
  console.log(`  ✓ ${jobsMarkedInvoiced} jobs marked INVOICED from sent/paid invoices${DRY_RUN ? " (dry-run upper bound)" : ""}`);
  console.log(`  ✓ ${jobsMarkedClientPaid} jobs marked client-paid from paid invoices${DRY_RUN ? " (dry-run upper bound)" : ""}`);

  // ── Migrate Calendar Sources ────────────────────────────────
  console.log("  Migrating calendar sources...");
  let calendarSourceCount = 0;
  let calendarSourcesLinked = 0;
  for (const cs of v1Data.calendarSources ?? []) {
    const type = mapCalendarSourceType(cs.type);

    // V1 sources are account-level (no propertyId); only resolvable via
    // propertyPattern matching a property name exactly.
    let propertyId: string | null = null;
    if (cs.propertyPattern) {
      const match = v1Data.properties.find(
        (p: any) => p.name?.trim().toLowerCase() === String(cs.propertyPattern).trim().toLowerCase()
      );
      if (match) propertyId = propertyMap.get(match.id) ?? null;
    }
    if (propertyId) calendarSourcesLinked++;

    if (!DRY_RUN) {
      await prisma.calendarSource.create({
        data: {
          name: cs.name,
          type,
          url: cs.icalUrl ?? null,
          isActive: cs.isActive ?? true,
          propertyId,
        },
      });
    }
    // Do not print the iCal URL — feed URLs embed private tokens.
    console.log(`    ${DRY_RUN ? "[dry-run] would import" : "imported"}: "${cs.name}" (${cs.type} → ${type}, ${cs.isActive ? "active" : "inactive"}${propertyId ? ", linked to property" : ""})`);
    calendarSourceCount++;
  }
  console.log(`  ✓ ${calendarSourceCount} calendar sources (${calendarSourcesLinked} resolvable to a property, rest unlinked)`);

  // ── Migrate Linen Items ─────────────────────────────────────
  console.log("  Migrating linen items...");
  let linenCount = 0;
  let linenOwnerScoped = 0;
  let linenSkippedDupCode = 0;
  const seenLinenCodes = new Set<string>();
  for (const li of v1Data.linenItems ?? []) {
    if (li.code && seenLinenCodes.has(li.code)) {
      linenSkippedDupCode++;
      console.log(`    ⚠ skipped duplicate linen code: ${li.code}`);
      continue;
    }
    if (li.code) seenLinenCodes.add(li.code);

    const category = inferLinenCategory(li.name, li.code);
    // V2 LinenItem is global-only (no scope/ownerId); owner-scoped V1 items
    // are imported as global and flagged in the output.
    if (li.scope !== "global" || li.ownerId) {
      linenOwnerScoped++;
      console.log(`    ⚠ V1 item "${li.name}" (${li.code}) was ${li.scope}-scoped — imported as global`);
    }

    if (!DRY_RUN) {
      await prisma.linenItem.create({
        data: {
          name: li.name,
          code: li.code,
          category,
          unitCost: li.unitCost ?? 0,
          isActive: true,
        },
      });
    }
    linenCount++;
  }
  console.log(`  ✓ ${linenCount} linen items (${linenOwnerScoped} owner-scoped → global, ${linenSkippedDupCode} duplicate codes skipped)`);

  // ── Migrate Property Notes ──────────────────────────────────
  console.log("  Migrating property notes...");
  let noteCount = 0;
  let notesSkippedNoProperty = 0;
  let notesSkippedNoAuthor = 0;
  let notePhotosImported = 0;
  let notePhotosSkipped = 0;
  const adminId = teamMap.get("admin") ?? null;

  for (const note of v1Data.propertyNotes ?? []) {
    const v2PropertyId = propertyMap.get(note.propertyId);
    if (!v2PropertyId) {
      notesSkippedNoProperty++;
      continue;
    }
    const authorId = (note.addedById ? teamMap.get(note.addedById) : null) ?? adminId;
    if (!authorId) {
      notesSkippedNoAuthor++;
      continue;
    }

    // V2 PropertyNote has no title/severity/status fields — fold them into content.
    const meta: string[] = [];
    if (note.severity) meta.push(`severity: ${note.severity}`);
    if (note.status && note.status !== "resolved") meta.push(`status: ${note.status}`);
    if (note.estimatedCost != null) meta.push(`estimated cost: $${note.estimatedCost}`);
    if (note.ownerNotified) meta.push(`owner notified${note.ownerNotifiedAt ? ` ${toDateString(note.ownerNotifiedAt)}` : ""}`);
    const content = [
      note.title ? String(note.title) : null,
      note.content,
      meta.length > 0 ? `[V1: ${meta.join("; ")}]` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const noteType =
      note.type === "damage" ? "damage" : note.type === "owner_request" ? "owner_request" : "general";

    let v2NoteId = `dry_note_${note.id}`;
    if (!DRY_RUN) {
      const created = await prisma.propertyNote.create({
        data: {
          propertyId: v2PropertyId,
          authorId,
          content,
          noteType,
          isResolved: note.status === "resolved",
          resolvedAt: note.resolvedAt ? new Date(note.resolvedAt) : null,
          resolvedById: note.resolvedById ? teamMap.get(note.resolvedById) ?? null : null,
          resolutionNote: note.resolution ?? null,
          createdAt: note.createdAt ? new Date(note.createdAt) : undefined,
        },
      });
      v2NoteId = created.id;
    }
    noteCount++;

    // V1 NotePhoto → V2 PropertyNotePhoto is a trivial fit (url/caption).
    // The April export carries no photos key; handle it in case a fresh export does.
    if (Array.isArray(note.photos)) {
      for (const photo of note.photos) {
        if (!photo?.url) {
          notePhotosSkipped++;
          continue;
        }
        if (!DRY_RUN) {
          await prisma.propertyNotePhoto.create({
            data: {
              noteId: v2NoteId,
              url: photo.url,
              caption: photo.caption ?? null,
            },
          });
        }
        notePhotosImported++;
      }
    }
  }
  console.log(`  ✓ ${noteCount} property notes (${notesSkippedNoProperty} skipped for missing property, ${notesSkippedNoAuthor} skipped for missing author)`);
  console.log(`  ✓ ${notePhotosImported} note photos imported (${notePhotosSkipped} skipped — no url)`);

  // ── Counters ────────────────────────────────────────────────
  // Job counter
  if (DRY_RUN) {
    console.log(`  [dry-run] would set CompanySettings.jobNextNumber = ${jobCounter}`);
  } else {
    await prisma.companySettings.update({
      where: { id: "singleton" },
      data: { jobNextNumber: jobCounter },
    });
    console.log(`  ✓ CompanySettings.jobNextNumber = ${jobCounter}`);
  }

  // Invoice counter: max numeric tail of imported invoice numbers + 1
  const tails = importedInvoiceNumbers
    .map((n) => {
      const m = String(n).match(/(\d+)\s*$/);
      return m ? parseInt(m[1], 10) : null;
    })
    .filter((t): t is number => t !== null && Number.isFinite(t));
  const unparseable = importedInvoiceNumbers.filter((n) => !/\d+\s*$/.test(String(n)));
  if (unparseable.length > 0) {
    console.log(`  ⚠ ${unparseable.length} invoice number(s) had no numeric tail: ${unparseable.join(", ")}`);
  }
  if (tails.length > 0) {
    const invoiceNextNumber = Math.max(...tails) + 1;
    if (DRY_RUN) {
      console.log(`  [dry-run] would set CompanySettings.invoiceNextNumber = ${invoiceNextNumber}`);
    } else {
      await prisma.companySettings.update({
        where: { id: "singleton" },
        data: { invoiceNextNumber },
      });
      console.log(`  ✓ CompanySettings.invoiceNextNumber = ${invoiceNextNumber}`);
    }
  } else {
    console.log("  ⚠ WARNING: no imported invoice number had a parseable numeric tail — invoiceNextNumber left unchanged; verify manually before creating new invoices");
  }

  return {
    owners: ownerMap.size,
    properties: propertyMap.size,
    teamImported,
    teamSkippedTest,
    teamWithV1Passwords,
    jobs: jobCounter - 1,
    jobsSkippedNoProperty,
    assignmentsImported,
    invoices: invoiceCount,
    invoicesSkippedNoOwner: skippedInvoiceNumbers.length,
    paymentsCreated,
    lineItems: lineItemCount,
    calendarSources: calendarSourceCount,
    linenItems: linenCount,
    propertyNotes: noteCount,
  };
}

async function main() {
  console.log(
    DRY_RUN
      ? "🔍 DRY RUN — parsing + mapping only; NO deletes, NO writes (drop --dry-run to apply)\n"
      : "🔄 Migrating V1 data to V2...\n"
  );

  await wipe();

  // From here on the DB (in apply mode) is wiped — a thrown error leaves it
  // half-migrated, so make that failure impossible to miss.
  let summary;
  try {
    summary = await importAll();
  } catch (e) {
    if (!DRY_RUN) printHalfMigratedWarning();
    throw e;
  }

  console.log(DRY_RUN ? "\n✅ Dry run complete — nothing was written." : "\n✅ V1 data migration complete!");
  console.log(`   Owners:           ${summary.owners}`);
  console.log(`   Properties:       ${summary.properties}`);
  console.log(`   Team:             ${summary.teamImported} imported, ${summary.teamSkippedTest} test accounts skipped`);
  console.log(`   Jobs:             ${summary.jobs} (${summary.jobsSkippedNoProperty} skipped — no property)`);
  console.log(`   Assignments:      ${summary.assignmentsImported}`);
  console.log(`   Invoices:         ${summary.invoices} (${summary.invoicesSkippedNoOwner} skipped — no owner)`);
  console.log(`   Line items:       ${summary.lineItems}`);
  console.log(`   Payments created: ${summary.paymentsCreated}`);
  console.log(`   Calendar sources: ${summary.calendarSources}`);
  console.log(`   Linen items:      ${summary.linenItems}`);
  console.log(`   Property notes:   ${summary.propertyNotes}`);
  console.log(`   ⚠ ${summary.teamWithV1Passwords} worker(s) had V1 passwords; portal passwords must be re-issued.`);
}

main()
  .catch((e) => { console.error("❌ Migration failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

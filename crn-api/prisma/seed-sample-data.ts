import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("📊 Seeding sample operational data...\n");

  // ── Find existing records ──────────────────────────────────────
  const alex = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!alex) { console.error("❌ No admin user. Run main seed first."); process.exit(1); }

  const properties = await prisma.property.findMany();
  const propByCode: Record<string, typeof properties[0]> = {};
  for (const p of properties) propByCode[p.code] = p;

  // ── SAMPLE WORKERS ─────────────────────────────────────────────
  console.log("  Creating sample workers...");
  const workerB = await prisma.user.upsert({
    where: { clerkId: "pending_sarah@cleanrightnow.com" },
    update: {},
    create: {
      clerkId: "pending_sarah@cleanrightnow.com",
      email: "sarah@cleanrightnow.com",
      name: "Sarah",
      role: "worker",
      status: "active",
      defaultShare: 1.0,
      phone: "555-234-5678",
    },
  });

  const workerC = await prisma.user.upsert({
    where: { clerkId: "pending_maria@cleanrightnow.com" },
    update: {},
    create: {
      clerkId: "pending_maria@cleanrightnow.com",
      email: "maria@cleanrightnow.com",
      name: "Maria",
      role: "worker",
      status: "active",
      defaultShare: 1.0,
      phone: "555-345-6789",
    },
  });
  console.log(`  ✓ 2 workers (Sarah, Maria)`);

  // ── SAMPLE JOBS ────────────────────────────────────────────────
  console.log("  Creating sample jobs...");

  // Helper to create a job
  let jobCounter = 2; // Start at 2 since JOB-2026-0001 already exists
  async function createJob(opts: {
    propertyCode: string;
    date: string;
    time?: string;
    jobType?: string;
    status?: string;
    completedDate?: string;
    workers: Array<{ userId: string; share: number }>;
    charges?: Array<{ amount: number; reason: string }>;
    isBtoB?: boolean;
    clientPaid?: boolean;
    teamPaid?: boolean;
  }) {
    const prop = propByCode[opts.propertyCode];
    if (!prop) return null;
    const num = String(jobCounter++).padStart(4, "0");
    const job = await prisma.job.create({
      data: {
        jobNumber: `JOB-2026-${num}`,
        propertyId: prop.id,
        scheduledDate: opts.date,
        scheduledTime: opts.time,
        jobType: opts.jobType ?? "STANDARD",
        totalFee: prop.defaultJobFee ?? 200,
        houseCutPercent: prop.houseCutPercent,
        status: opts.status ?? "SCHEDULED",
        completedDate: opts.completedDate,
        source: "manual",
        isBtoB: opts.isBtoB ?? false,
        clientPaid: opts.clientPaid ?? false,
        teamPaid: opts.teamPaid ?? false,
        assignments: {
          create: opts.workers.map((w) => ({
            userId: w.userId,
            share: w.share,
          })),
        },
        charges: opts.charges ? {
          create: opts.charges.map((c) => ({
            amount: c.amount,
            reason: c.reason,
          })),
        } : undefined,
      },
    });
    return job;
  }

  // Past completed jobs (March 2026)
  await createJob({ propertyCode: "STONES", date: "2026-03-01", time: "09:00", status: "COMPLETED", completedDate: "2026-03-01", workers: [{ userId: alex.id, share: 1 }, { userId: workerB.id, share: 1 }], clientPaid: true, teamPaid: true });
  await createJob({ propertyCode: "BBR", date: "2026-03-01", time: "13:00", status: "COMPLETED", completedDate: "2026-03-01", jobType: "TURNOVER", workers: [{ userId: alex.id, share: 1 }, { userId: workerB.id, share: 1 }], clientPaid: true, teamPaid: true });
  await createJob({ propertyCode: "DOGWOOD", date: "2026-03-05", time: "09:00", status: "COMPLETED", completedDate: "2026-03-05", workers: [{ userId: alex.id, share: 1 }], clientPaid: true, teamPaid: true });
  await createJob({ propertyCode: "GABLE", date: "2026-03-08", time: "09:00", status: "COMPLETED", completedDate: "2026-03-08", jobType: "TURNOVER", workers: [{ userId: alex.id, share: 1 }, { userId: workerC.id, share: 0.75 }], charges: [{ amount: 60, reason: "Oven clean" }], clientPaid: true, teamPaid: true });
  await createJob({ propertyCode: "DUTCH", date: "2026-03-08", time: "14:00", status: "COMPLETED", completedDate: "2026-03-08", jobType: "TURNOVER", isBtoB: true, workers: [{ userId: alex.id, share: 1 }, { userId: workerC.id, share: 0.75 }], clientPaid: true, teamPaid: true });
  await createJob({ propertyCode: "OWL", date: "2026-03-12", time: "10:00", status: "COMPLETED", completedDate: "2026-03-12", jobType: "DEEP", workers: [{ userId: alex.id, share: 1 }, { userId: workerB.id, share: 1 }, { userId: workerC.id, share: 1 }], charges: [{ amount: 25, reason: "Extra trash" }, { amount: 40, reason: "Pet damage" }], clientPaid: true, teamPaid: true });
  await createJob({ propertyCode: "COURTYARD", date: "2026-03-15", time: "09:00", status: "COMPLETED", completedDate: "2026-03-15", workers: [{ userId: alex.id, share: 1 }, { userId: workerB.id, share: 1 }], clientPaid: true, teamPaid: true });
  await createJob({ propertyCode: "SUNSET", date: "2026-03-15", time: "14:00", status: "COMPLETED", completedDate: "2026-03-15", workers: [{ userId: alex.id, share: 1 }, { userId: workerB.id, share: 1 }], clientPaid: false, teamPaid: true });
  await createJob({ propertyCode: "COTTAGE", date: "2026-03-18", time: "09:00", status: "COMPLETED", completedDate: "2026-03-18", workers: [{ userId: workerB.id, share: 1 }], clientPaid: true, teamPaid: true });
  await createJob({ propertyCode: "DEERCROSSING", date: "2026-03-20", time: "10:00", status: "COMPLETED", completedDate: "2026-03-20", workers: [{ userId: alex.id, share: 1 }, { userId: workerC.id, share: 0.5 }], clientPaid: true, teamPaid: true });
  await createJob({ propertyCode: "CB", date: "2026-03-22", time: "09:00", status: "COMPLETED", completedDate: "2026-03-22", workers: [{ userId: alex.id, share: 1 }, { userId: workerB.id, share: 1 }], clientPaid: true, teamPaid: true });
  await createJob({ propertyCode: "STONES", date: "2026-03-25", time: "09:00", status: "COMPLETED", completedDate: "2026-03-25", jobType: "TURNOVER", workers: [{ userId: alex.id, share: 1 }, { userId: workerB.id, share: 1 }], charges: [{ amount: 30, reason: "Deep stains" }], clientPaid: true, teamPaid: true });
  await createJob({ propertyCode: "GABLE", date: "2026-03-28", time: "09:00", status: "COMPLETED", completedDate: "2026-03-28", workers: [{ userId: alex.id, share: 1 }, { userId: workerC.id, share: 1 }], clientPaid: false, teamPaid: false });
  await createJob({ propertyCode: "BBR", date: "2026-03-29", time: "10:00", status: "COMPLETED", completedDate: "2026-03-29", jobType: "TURNOVER", workers: [{ userId: alex.id, share: 1 }, { userId: workerB.id, share: 1 }, { userId: workerC.id, share: 0.75 }], clientPaid: false, teamPaid: false });

  // April 2026 (current month) — mix of completed, in-progress, scheduled
  await createJob({ propertyCode: "DOGWOOD", date: "2026-04-02", time: "09:00", status: "COMPLETED", completedDate: "2026-04-02", workers: [{ userId: alex.id, share: 1 }], clientPaid: true, teamPaid: true });
  await createJob({ propertyCode: "STONES", date: "2026-04-05", time: "09:00", status: "COMPLETED", completedDate: "2026-04-05", jobType: "TURNOVER", workers: [{ userId: alex.id, share: 1 }, { userId: workerB.id, share: 1 }], clientPaid: false });
  await createJob({ propertyCode: "OWL", date: "2026-04-05", time: "13:00", status: "COMPLETED", completedDate: "2026-04-05", workers: [{ userId: alex.id, share: 1 }, { userId: workerB.id, share: 1 }, { userId: workerC.id, share: 1 }] });

  // Upcoming scheduled jobs
  await createJob({ propertyCode: "GABLE", date: "2026-04-08", time: "09:00", jobType: "TURNOVER", workers: [{ userId: alex.id, share: 1 }, { userId: workerB.id, share: 1 }] });
  await createJob({ propertyCode: "DUTCH", date: "2026-04-08", time: "14:00", jobType: "TURNOVER", isBtoB: true, workers: [{ userId: alex.id, share: 1 }, { userId: workerB.id, share: 1 }] });
  await createJob({ propertyCode: "COURTYARD", date: "2026-04-10", time: "10:00", workers: [{ userId: alex.id, share: 1 }, { userId: workerC.id, share: 1 }] });
  await createJob({ propertyCode: "SUNSET", date: "2026-04-12", time: "09:00", workers: [{ userId: alex.id, share: 1 }, { userId: workerB.id, share: 1 }] });
  await createJob({ propertyCode: "BBR", date: "2026-04-12", time: "13:00", jobType: "TURNOVER", workers: [{ userId: alex.id, share: 1 }, { userId: workerC.id, share: 0.75 }] });
  await createJob({ propertyCode: "STONES", date: "2026-04-15", time: "09:00", jobType: "TURNOVER", workers: [{ userId: alex.id, share: 1 }, { userId: workerB.id, share: 1 }] });
  await createJob({ propertyCode: "CB", date: "2026-04-18", time: "09:00", workers: [{ userId: alex.id, share: 1 }] });
  await createJob({ propertyCode: "DEERCROSSING", date: "2026-04-20", time: "10:00", workers: [{ userId: alex.id, share: 1 }, { userId: workerC.id, share: 1 }] });
  await createJob({ propertyCode: "COTTAGE", date: "2026-04-22", time: "09:00", workers: [{ userId: workerB.id, share: 1 }] });
  await createJob({ propertyCode: "OWL", date: "2026-04-25", time: "10:00", jobType: "DEEP", workers: [{ userId: alex.id, share: 1 }, { userId: workerB.id, share: 1 }, { userId: workerC.id, share: 1 }] });

  console.log(`  ✓ ${jobCounter - 2} sample jobs created`);

  // Update company settings job counter
  await prisma.companySettings.update({
    where: { id: "singleton" },
    data: { jobNextNumber: jobCounter },
  });

  // ── SAMPLE LINEN ITEMS ─────────────────────────────────────────
  console.log("  Creating linen inventory...");
  const linens = [
    { name: "King Fitted Sheet", code: "K-FITTED", category: "sheets", unitCost: 13.33, vendor: "Costco Kirkland", onHand: 28 },
    { name: "King Flat Sheet", code: "K-FLAT", category: "sheets", unitCost: 13.33, vendor: "Costco Kirkland", onHand: 28 },
    { name: "King Pillow Case", code: "K-PILLOW", category: "sheets", unitCost: 5.00, vendor: "Costco Kirkland", onHand: 60 },
    { name: "Queen Fitted Sheet", code: "Q-FITTED", category: "sheets", unitCost: 11.67, vendor: "Target", onHand: 12 },
    { name: "Queen Flat Sheet", code: "Q-FLAT", category: "sheets", unitCost: 11.67, vendor: "Target", onHand: 12 },
    { name: "Full Fitted Sheet", code: "F-FITTED", category: "sheets", unitCost: 10.00, vendor: "Target", onHand: 10 },
    { name: "Full Flat Sheet", code: "F-FLAT", category: "sheets", unitCost: 10.00, vendor: "Target", onHand: 10 },
    { name: "Twin Fitted Sheet", code: "TW-FITTED", category: "sheets", unitCost: 8.33, vendor: "Target", onHand: 12 },
    { name: "Twin Flat Sheet", code: "TW-FLAT", category: "sheets", unitCost: 8.33, vendor: "Target", onHand: 12 },
    { name: "King Duvet Cover", code: "K-DUVET", category: "bedding", unitCost: 35.00, vendor: "Amazon", onHand: 14 },
    { name: "FQ Duvet Cover", code: "FQ-DUVET", category: "bedding", unitCost: 30.00, vendor: "Amazon", onHand: 8 },
    { name: "King Comforter", code: "K-COMF", category: "bedding", unitCost: 45.00, vendor: "Costco Kirkland", onHand: 14 },
    { name: "FQ Comforter", code: "FQ-COMF", category: "bedding", unitCost: 35.00, vendor: "Amazon", onHand: 8 },
    { name: "Twin Comforter", code: "TW-COMF", category: "bedding", unitCost: 25.00, vendor: "Target", onHand: 8 },
    { name: "King Mattress Pad", code: "K-MPAD", category: "bedding", unitCost: 25.00, vendor: "Amazon", onHand: 10 },
    { name: "Queen Mattress Pad", code: "Q-MPAD", category: "bedding", unitCost: 20.00, vendor: "Amazon", onHand: 6 },
    { name: "King Blanket", code: "K-BLANKET", category: "bedding", unitCost: 20.00, vendor: "Costco Kirkland", onHand: 10 },
    { name: "Bath Towel", code: "BATH-TWL", category: "towels", unitCost: 8.00, vendor: "Palmetto Imperial", onHand: 140 },
    { name: "Hand Towel", code: "HAND-TWL", category: "towels", unitCost: 5.00, vendor: "Palmetto Imperial", onHand: 120 },
    { name: "White Washcloth", code: "WASH-WHT", category: "towels", unitCost: 2.50, vendor: "Palmetto Imperial", onHand: 100 },
    { name: "Black Makeup Washcloth", code: "WASH-BLK", category: "towels", unitCost: 3.00, vendor: "Amazon", onHand: 80 },
    { name: "Bath Mat", code: "BATH-MAT", category: "bath", unitCost: 12.00, vendor: "Target", onHand: 20 },
    { name: "Beach Towel", code: "BEACH-TWL", category: "towels", unitCost: 10.00, vendor: "Costco Kirkland", onHand: 36 },
    { name: "Kitchen Towel", code: "KITCHEN-TWL", category: "kitchen", unitCost: 3.00, vendor: "Target", onHand: 30 },
    { name: "Robe", code: "ROBE", category: "bath", unitCost: 25.00, vendor: "Amazon", onHand: 8 },
    { name: "Slippers (pair)", code: "SLIPPERS", category: "bath", unitCost: 8.00, vendor: "Amazon", onHand: 8 },
    { name: "Std Pillow Case", code: "STD-PILLOW", category: "sheets", unitCost: 4.00, vendor: "Target", onHand: 40 },
    { name: "Pillow Protector", code: "PILLOW-PROT", category: "pillows", unitCost: 6.00, vendor: "Amazon", onHand: 30 },
  ];

  for (const item of linens) {
    await prisma.linenItem.upsert({
      where: { code: item.code },
      update: { onHand: item.onHand },
      create: item,
    });
  }
  console.log(`  ✓ ${linens.length} linen items`);

  // ── SAMPLE SUPPLIES ────────────────────────────────────────────
  console.log("  Creating supplies...");
  const supplies = [
    { name: "Windex (32oz)", category: "cleaning", onHand: 8, reorderLevel: 3, reorderQuantity: 6, unitCost: 4.99, unit: "bottle", vendor: "Target" },
    { name: "All-Purpose Cleaner", category: "cleaning", onHand: 6, reorderLevel: 2, reorderQuantity: 4, unitCost: 5.49, unit: "bottle", vendor: "Target" },
    { name: "Toilet Bowl Cleaner", category: "cleaning", onHand: 5, reorderLevel: 2, reorderQuantity: 4, unitCost: 3.99, unit: "bottle", vendor: "Target" },
    { name: "Microfiber Cloths", category: "cleaning", onHand: 24, reorderLevel: 8, reorderQuantity: 12, unitCost: 1.50, unit: "each", vendor: "Amazon" },
    { name: "Glass Rags", category: "cleaning", onHand: 12, reorderLevel: 4, reorderQuantity: 8, unitCost: 2.00, unit: "each", vendor: "Amazon" },
    { name: "Spray & Wash", category: "laundry", onHand: 4, reorderLevel: 2, reorderQuantity: 3, unitCost: 4.49, unit: "bottle", vendor: "Target" },
    { name: "Laundry Detergent", category: "laundry", onHand: 3, reorderLevel: 1, reorderQuantity: 2, unitCost: 12.99, unit: "bottle", vendor: "Costco" },
    { name: "Trash Bags (13 gal)", category: "paper", onHand: 2, reorderLevel: 3, reorderQuantity: 5, unitCost: 12.99, unit: "box", vendor: "Costco" },
    { name: "Toilet Paper (12 pack)", category: "paper", onHand: 4, reorderLevel: 2, reorderQuantity: 4, unitCost: 9.99, unit: "pack", vendor: "Costco" },
    { name: "Paper Towels (8 pack)", category: "paper", onHand: 3, reorderLevel: 2, reorderQuantity: 3, unitCost: 14.99, unit: "pack", vendor: "Costco" },
    { name: "Kitchen Sponge (6 pack)", category: "cleaning", onHand: 5, reorderLevel: 2, reorderQuantity: 4, unitCost: 5.99, unit: "pack", vendor: "Target" },
    { name: "Dishwasher Pods (32 ct)", category: "cleaning", onHand: 3, reorderLevel: 1, reorderQuantity: 2, unitCost: 11.99, unit: "box", vendor: "Costco" },
    { name: "Hand Soap Refill", category: "cleaning", onHand: 4, reorderLevel: 2, reorderQuantity: 3, unitCost: 6.99, unit: "bottle", vendor: "Target" },
    { name: "Dish Soap", category: "cleaning", onHand: 6, reorderLevel: 2, reorderQuantity: 4, unitCost: 3.49, unit: "bottle", vendor: "Target" },
  ];

  for (const item of supplies) {
    await prisma.supply.upsert({
      where: { id: `supply-${item.name.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 20)}` },
      update: {},
      create: {
        id: `supply-${item.name.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 20)}`,
        ...item,
      },
    });
  }
  console.log(`  ✓ ${supplies.length} supply items`);

  console.log("\n✅ Sample data seeded.");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

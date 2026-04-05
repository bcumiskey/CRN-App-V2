import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding CRN V2 database...\n");

  // ── Company Settings ────────────────────────────────────────────
  await prisma.companySettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      businessName: "Clean Right Now",
      financialModel: {
        buckets: [
          { name: "Business Expenses", percent: 10, type: "business" },
          { name: "Owner Profit", percent: 10, type: "owner" },
          { name: "Worker Pool", percent: 80, type: "worker_pool" },
        ],
        shareLevels: [
          { label: "Full", value: 1.0 },
          { label: "Three Quarter", value: 0.75 },
          { label: "Half", value: 0.5 },
          { label: "Off", value: 0 },
        ],
      },
    },
  });
  console.log("  ✓ Company settings");

  // ── Admin User ──────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { clerkId: "clerk_admin_alex" },
    update: {},
    create: {
      clerkId: "clerk_admin_alex",
      email: "alex@cleanrightnow.com",
      name: "Alex",
      role: "admin",
      isOwner: true,
      defaultShare: 1.0,
      status: "active",
    },
  });
  console.log("  ✓ Admin user (Alex)");

  // ── Property Owner: Michelle ────────────────────────────────────
  const michelle = await prisma.propertyOwner.upsert({
    where: { id: "owner_michelle" },
    update: {},
    create: {
      id: "owner_michelle",
      name: "Michelle",
      billingType: "monthly",
      paymentTerms: "Net 15",
    },
  });
  console.log("  ✓ Property owner (Michelle)");

  // ── Properties ──────────────────────────────────────────────────
  const properties = [
    // Michelle's properties (20% house cut)
    { name: "Stones Thoreau", code: "STONES", houseCutPercent: 20, defaultJobFee: 250, ownerId: michelle.id },
    { name: "The Gambrel (BBR)", code: "BBR", houseCutPercent: 20, defaultJobFee: 320, ownerId: michelle.id },
    { name: "The Dutch", code: "DUTCH", houseCutPercent: 20, defaultJobFee: 300, ownerId: michelle.id },
    { name: "The Gable", code: "GABLE", houseCutPercent: 20, defaultJobFee: 300, ownerId: michelle.id },
    // Direct properties (0% house cut)
    { name: "Dogwood Creek", code: "DOGWOOD", houseCutPercent: 0, defaultJobFee: 200, ownerId: null },
    { name: "Deer Crossing", code: "DEERCROSSING", houseCutPercent: 0, defaultJobFee: 175, ownerId: null },
    { name: "The Cottage", code: "COTTAGE", houseCutPercent: 0, defaultJobFee: 150, ownerId: null },
    { name: "The Owl", code: "OWL", houseCutPercent: 0, defaultJobFee: 600, ownerId: null },
    { name: "CB", code: "CB", houseCutPercent: 0, defaultJobFee: 375, ownerId: null },
    { name: "Courtyard Country Club", code: "COURTYARD", houseCutPercent: 0, defaultJobFee: 525, ownerId: null },
    { name: "Sunset", code: "SUNSET", houseCutPercent: 0, defaultJobFee: 500, ownerId: null },
  ];

  for (const prop of properties) {
    await prisma.property.upsert({
      where: { code: prop.code },
      update: {},
      create: {
        name: prop.name,
        code: prop.code,
        houseCutPercent: prop.houseCutPercent,
        defaultJobFee: prop.defaultJobFee,
        ownerId: prop.ownerId,
      },
    });
  }
  console.log(`  ✓ ${properties.length} properties`);

  // ── Expense Categories (hierarchical) ───────────────────────────
  // Root categories
  const cogs = await upsertCategory("cogs", "Cost of Goods Sold", null, true, 1);
  const opex = await upsertCategory("opex", "Operating Expenses", null, true, 2);

  // COGS children
  await upsertCategory("cogs-labor", "Labor", cogs.id, true, 1);
  await upsertCategory("cogs-supplies", "Cleaning Supplies", cogs.id, true, 2);
  await upsertCategory("cogs-linens", "Linens", cogs.id, true, 3);
  await upsertCategory("cogs-paper", "Paper Goods", cogs.id, true, 4);
  await upsertCategory("cogs-laundry", "Laundry Costs", cogs.id, true, 5);

  // OPEX children
  const vehicle = await upsertCategory("opex-vehicle", "Vehicle", opex.id, true, 1);
  await upsertCategory("opex-vehicle-mileage", "Mileage", vehicle.id, true, 1, "Line 9 - Car and truck expenses");
  await upsertCategory("opex-vehicle-parking", "Parking & Tolls", vehicle.id, true, 2);

  const insurance = await upsertCategory("opex-insurance", "Insurance", opex.id, true, 2);
  await upsertCategory("opex-insurance-liability", "Business Liability", insurance.id, true, 1, "Line 15 - Insurance");
  await upsertCategory("opex-insurance-wc", "Workers Comp", insurance.id, true, 2, "Line 15 - Insurance");

  const comms = await upsertCategory("opex-comms", "Communications", opex.id, true, 3);
  await upsertCategory("opex-comms-phone", "Phone (business %)", comms.id, true, 1, "Line 25 - Utilities");
  await upsertCategory("opex-comms-internet", "Internet (business %)", comms.id, true, 2, "Line 25 - Utilities");

  const professional = await upsertCategory("opex-professional", "Professional Services", opex.id, true, 4);
  await upsertCategory("opex-professional-accounting", "Accounting", professional.id, true, 1, "Line 17 - Legal and professional services");
  await upsertCategory("opex-professional-legal", "Legal", professional.id, true, 2, "Line 17 - Legal and professional services");
  await upsertCategory("opex-professional-software", "Software & Subscriptions", professional.id, true, 3, "Line 27a - Other expenses");

  const marketing = await upsertCategory("opex-marketing", "Marketing", opex.id, true, 5);
  await upsertCategory("opex-marketing-website", "Website", marketing.id, true, 1, "Line 8 - Advertising");
  await upsertCategory("opex-marketing-advertising", "Advertising", marketing.id, true, 2, "Line 8 - Advertising");

  await upsertCategory("opex-home-office", "Home Office", opex.id, true, 6, "Line 30 - Business use of home");
  await upsertCategory("opex-misc", "Miscellaneous", opex.id, true, 99, "Line 27a - Other expenses");

  console.log("  ✓ Expense categories (hierarchical tree)");

  // ── Billing Item Presets ────────────────────────────────────────
  const presets = [
    { name: "Turnover Cleaning", category: "service", sortOrder: 1 },
    { name: "Deep Clean", category: "service", sortOrder: 2 },
    { name: "Laundry Service", category: "service", sortOrder: 3 },
    { name: "Emergency / After-Hours", category: "service", sortOrder: 4 },
    { name: "Inspection", category: "service", sortOrder: 5 },
    { name: "Cleaning Supplies", category: "supply", sortOrder: 10 },
    { name: "Linen Replacement", category: "supply", sortOrder: 11 },
    { name: "Pet Damage Fee", category: "expense", sortOrder: 20 },
    { name: "Oven Clean", category: "expense", sortOrder: 21 },
    { name: "Extra Trash", category: "expense", sortOrder: 22 },
    { name: "Extra Time", category: "expense", sortOrder: 23 },
    { name: "Deep Stains", category: "expense", sortOrder: 24 },
    { name: "Mileage", category: "expense", sortOrder: 30 },
    { name: "Miscellaneous", category: "custom", sortOrder: 99 },
  ];

  for (const preset of presets) {
    await prisma.billingItemPreset.upsert({
      where: { id: `preset_${preset.sortOrder}` },
      update: {},
      create: {
        id: `preset_${preset.sortOrder}`,
        name: preset.name,
        category: preset.category,
        sortOrder: preset.sortOrder,
      },
    });
  }
  console.log(`  ✓ ${presets.length} billing item presets`);

  console.log("\n✅ Seed complete.");
}

// ── Helpers ─────────────────────────────────────────────────────────

async function upsertCategory(
  code: string,
  name: string,
  parentId: string | null,
  isSystem: boolean,
  sortOrder: number,
  scheduleCLine?: string
) {
  return prisma.expenseCategory.upsert({
    where: { code },
    update: {},
    create: {
      code,
      name,
      parentId,
      isSystem,
      sortOrder,
      scheduleCLine: scheduleCLine ?? null,
    },
  });
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🏠 Seeding Michelle's property data...\n");

  // Find Michelle's properties by name (codes vary between seed and migration)
  const gable = await prisma.property.findFirst({ where: { name: { contains: "Gable" } } });
  const dutch = await prisma.property.findFirst({ where: { name: { contains: "Dutch" } } });
  const bbr = await prisma.property.findFirst({ where: { name: { contains: "Gambrel" } } });
  const stones = await prisma.property.findFirst({ where: { name: { contains: "Stone" } } });

  if (!gable || !dutch || !bbr || !stones) {
    console.error("❌ Missing properties. Found:", { gable: gable?.name, dutch: dutch?.name, bbr: bbr?.name, stones: stones?.name });
    process.exit(1);
  }
  console.log(`  Found: ${gable.name}, ${dutch.name}, ${bbr.name}, ${stones.name}`);

  // ── GABLE ROOMS ──────────────────────────────────────────────
  console.log("  Creating Gable rooms...");
  const gableRooms = [
    {
      name: "King Bedroom 1", floor: "Main Floor", type: "bedroom",
      bedType: "king", bedCount: 1, towelCount: 2, sortOrder: 1,
      stockingNotes: `King Sheet Set ×1, King Duvet Cover ×1, King Comforter ×1, King Mattress Pad ×1, King Blanket ×1, King Pillow Cases ×4
Bath Towels ×2 (1 hanging on bar, 1 under cabinet)
Hand Towels ×2 (1 hanging, 1 under cabinet)
Black/Makeup Washcloth ×1 (tri-folded ON TOP of hand towel, 1 extra under sink)
White Washcloths ×2 (under sink)
Bath Mat ×1 (hung over shower door)`,
    },
    {
      name: "King Bedroom 2", floor: "Main Floor", type: "bedroom",
      bedType: "king", bedCount: 1, towelCount: 2, sortOrder: 2,
      stockingNotes: "Same linen setup as King 1. Same display arrangement.",
    },
    {
      name: "Hall Closet", floor: "Main Floor", type: "other",
      sortOrder: 3,
      stockingNotes: "Overflow stock for both main floor kings.\nBath Towels ×4, Hand Towels ×4, White Washcloths ×4, Black Washcloths ×4\nCheck and restock after EVERY turn.",
    },
    {
      name: "Half Bath", floor: "Main Floor", type: "bathroom",
      towelCount: 0, sortOrder: 4,
      stockingNotes: "Hand Towels ×1 (no full towel set here)\nToilet Paper ×3 (triangle fold, ≥¾ full)\nTrash can double bagged",
    },
    {
      name: "King Bedroom En-Suite", floor: "Upstairs", type: "bedroom",
      bedType: "king", bedCount: 1, hasCrib: true, towelCount: 6, sortOrder: 5,
      stockingNotes: `King Sheet Set ×1, Crib Sheet ×1 (if crib up), King Duvet Cover ×1, King Comforter ×1, King Mattress Pad ×1, King Pillow Cases ×4
Bath Towels ×6 (1 hanging, 2 in one basket, 3 in other basket under sink)
Hand Towels ×6 (1 rolled on each sink counter, 2 in baskets under sink)
Black Cloths ×6 (1 rolled on each counter, 2 in each drawer)
White Washcloths ×6 (3 per sink area, under sink or in drawer)
Bath Mat ×1 (hung over shower door)
Two sinks — each side mirrored`,
    },
    {
      name: "King Bedroom", floor: "Basement", type: "bedroom",
      bedType: "king", bedCount: 1, towelCount: 2, sortOrder: 6,
      stockingNotes: `King Sheet Set ×1, King Duvet Cover ×1, King Comforter ×1, King Mattress Pad ×1, King Pillow Cases ×4
Bath Towels ×2, Hand Towels ×2, White Washcloths ×2, Black Washcloths ×2
ALL towels left in CLOSET, NOT in the bathroom`,
    },
    {
      name: "Bunk Room", floor: "Basement", type: "bedroom",
      bedType: "bunk", bedCount: 4, sortOrder: 7,
      stockingNotes: `Twin Sheet Set ×2, Twin Duvet Cover ×2, Twin Comforter ×2, Twin Mattress Pad ×2
Queen Sheet Set ×2, FQ Duvet Cover ×2, FQ Comforter ×2, Queen Mattress Pad ×2
Std Pillow Cases ×8
Bath Towels ×2, Hand Towels ×2, White Washcloths ×2, Black Washcloths ×2
Towels in closet, NOT bathroom
Twin mattresses: take DOWN off bunk to make, make on ground, replace on frame, tuck in`,
    },
    {
      name: "Shared Bathroom", floor: "Basement", type: "bathroom",
      towelCount: 4, sortOrder: 8,
      stockingNotes: `Bath Towels ×4 (4 on bottom shelf under sink)
Hand Towels ×4 (1 hanging, 3 under sink)
Black Cloths ×4 (1 hanging, rest under sink with 4 rolls TP)
White Washcloths ×4 (all under sink)
Bath Mat ×1 (hung over side of tub)
Toilet Paper ×4 (triangle fold, ≥¾ full)
Trash double bagged
Mirror: 2-pass method (damp then dry Z-pattern until squeak)`,
    },
  ];

  for (const room of gableRooms) {
    await prisma.room.upsert({
      where: { id: `gable-${room.name.toLowerCase().replace(/\s+/g, "-")}` },
      update: room,
      create: { id: `gable-${room.name.toLowerCase().replace(/\s+/g, "-")}`, propertyId: gable.id, ...room },
    });
  }

  // ── DUTCH ROOMS (same layout as Gable) ────────────────────────
  console.log("  Creating Dutch rooms (same layout as Gable)...");
  for (const room of gableRooms) {
    await prisma.room.upsert({
      where: { id: `dutch-${room.name.toLowerCase().replace(/\s+/g, "-")}` },
      update: room,
      create: { id: `dutch-${room.name.toLowerCase().replace(/\s+/g, "-")}`, propertyId: dutch.id, ...room },
    });
  }

  // ── BBR/GAMBREL ROOMS ──────────────────────────────────────────
  console.log("  Creating BBR/Gambrel rooms...");
  const bbrRooms = [
    {
      name: "King Bedroom 1", floor: "Main Floor", type: "bedroom",
      bedType: "king", bedCount: 1, towelCount: 2, sortOrder: 1,
      stockingNotes: `King Sheet Set ×1, King Duvet Cover ×1, King Comforter ×1, King Mattress Pad ×1, King Blanket ×1, King Pillow Cases ×4
Bath Towels ×2 (standard hang)
Hand Towel — 1 ROLLED on counter on display
Black Makeup Cloth — 1 ROLLED next to hand towel on counter
White Washcloths ×2 (folded square, counter or under sink)
Bath Mat ×1 (hung over shower door)`,
    },
    {
      name: "King Bedroom 2", floor: "Main Floor", type: "bedroom",
      bedType: "king", bedCount: 1, towelCount: 2, sortOrder: 2,
      stockingNotes: "Same linen setup as King 1. Hand towel ROLLED on counter, black cloth ROLLED next to it.",
    },
    {
      name: "Hall Closet", floor: "Main Floor", type: "other",
      sortOrder: 3,
      stockingNotes: "Overflow stock for both main floor kings.\nBath Towels ×4, Hand Towels ×4, White Washcloths ×4, Black Washcloths ×4\nCheck and restock after EVERY turn.",
    },
    {
      name: "Half Bath", floor: "Main Floor", type: "bathroom",
      towelCount: 0, sortOrder: 4,
      stockingNotes: "Hand Towels ×2 (no full towel set)\nToilet Paper ×3 (triangle fold, ≥¾ full)\nTrash double bagged",
    },
    {
      name: "Master Suite En-Suite", floor: "Upstairs", type: "bedroom",
      bedType: "king", bedCount: 1, towelCount: 4, sortOrder: 5,
      stockingNotes: `King Sheet Set ×1, King Duvet Cover ×1, King Comforter ×1, King Mattress Pad ×1, King Blanket ×1, King Pillow Cases ×4
Bath Towels ×4 (standard hang)
Hand Towels ×4 (2 ROLLED on counter on display)
Black Makeup Cloths ×4 (2 ROLLED on counter next to hand towels)
White Washcloths ×4 (folded square, counter or under sink)
Bath Mat ×1 (hung over shower door)`,
    },
    {
      name: "Bunk Room", floor: "Upstairs", type: "bedroom",
      bedType: "bunk", bedCount: 4, sortOrder: 6,
      stockingNotes: `Twin Sheet Set ×2, Twin Comforter ×2, Twin Mattress Pad ×2
Full Sheet Set ×2, FQ Comforter ×2, Full Mattress Pad ×2
Std Pillow Cases ×6, Std Pillow Protectors ×6
Twin mattresses: take DOWN, make on ground, replace on frame, tuck in`,
    },
    {
      name: "Shared Bathroom", floor: "Upstairs", type: "bathroom",
      towelCount: 6, sortOrder: 7,
      stockingNotes: `Bath Towels ×6 (2 hanging, tri-folded, fold faces out)
Hand Towels ×6 (1 ROLLED on counter on display)
Black Cloths ×6 (1 ROLLED on counter next to hand towel)
White Washcloths (folded square, under sink or counter)
Bath Mat ×1 (hung over tub edge)
Trash double bagged, mirror two-pass method`,
    },
    {
      name: "Kitchen", floor: "Common Areas", type: "kitchen",
      sortOrder: 8,
      stockingNotes: `Kitchen Towels ×10, Makeup Towels (Black) ×2, Beach Towels ×12
Beach towels dried, folded, restocked every turn
New kitchen sponge every turn (old one in trash)
Paper towels at least 1 full roll
Dishwasher pods stocked, hand soap ≥ half full, dish soap not empty
Cooler emptied of water/food, lid cracked to air dry`,
    },
  ];

  for (const room of bbrRooms) {
    await prisma.room.upsert({
      where: { id: `bbr-${room.name.toLowerCase().replace(/\s+/g, "-")}` },
      update: room,
      create: { id: `bbr-${room.name.toLowerCase().replace(/\s+/g, "-")}`, propertyId: bbr.id, ...room },
    });
  }

  // ── STONES THOREAU ROOMS ────────────────────────────────────────
  console.log("  Creating Stones Thoreau rooms...");
  const stonesRooms = [
    {
      name: "King Bedroom En-Suite", floor: "1st Floor", type: "bedroom",
      bedType: "king", bedCount: 1, towelCount: 8, hasRobes: true, hasSlippers: true, sortOrder: 1,
      stockingNotes: `King Sheet Set ×1, King Duvet Cover ×1, King Comforter ×1, King Mattress Pad ×1, King Blanket ×1
King Pillow Cases ×4, King Pillow Protectors ×4
Bath Towels ×8, Hand Towels ×8, White Washcloths ×8, Black Washcloths ×8
Bath Mat ×1 (hung over shower door)
Robes ×2 (both hung on hooks)
Slippers ×2 pairs (neatly placed below robes)`,
    },
    {
      name: "Den", floor: "1st Floor", type: "living",
      bedType: "full", bedCount: 1, sortOrder: 2,
      stockingNotes: "Full Sheet Set ×1, FQ Comforter ×1, Full Mattress Pad ×1\nStd Pillow Cases ×2, Std Pillow Protectors ×2",
    },
    {
      name: "Half Bath", floor: "1st Floor", type: "bathroom",
      towelCount: 0, sortOrder: 3,
      stockingNotes: "Hand Towels ×2 (no full set)\nToilet Paper ×3 (triangle fold, ≥¾ full)\nTrash double bagged",
    },
    {
      name: "Queen Room En-Suite", floor: "2nd Floor", type: "bedroom",
      bedType: "queen", bedCount: 1, towelCount: 4, hasRobes: true, hasSlippers: true, sortOrder: 4,
      stockingNotes: `Queen Sheet Set ×1, FQ Duvet Cover ×1, FQ Comforter ×1, Queen Mattress Pad ×1
Std Pillow Cases ×4, Std Pillow Protectors ×4
Bath Towels ×4, Hand Towels ×4, White Washcloths ×4, Black Washcloths ×4
Bath Mat ×1 (hung over shower door)
Robes ×2 (hung on hooks), Slippers ×2 pairs (below robes)
Toilet Paper ×3`,
    },
    {
      name: "King Room", floor: "2nd Floor", type: "bedroom",
      bedType: "king", bedCount: 1, sortOrder: 5,
      stockingNotes: `King Sheet Set ×1, King Duvet Cover ×1, King Comforter ×1, King Mattress Pad ×1, King Blanket ×1
King Pillow Cases ×4, King Pillow Protectors ×4
Towels for this room go in the hall bath that serves it (6 of each)
Robes ×2 + Slippers ×2 pairs`,
    },
    {
      name: "Murphy Bed", floor: "2nd Floor", type: "bedroom",
      bedType: "full", bedCount: 1, hasMurphy: true, sortOrder: 6,
      stockingNotes: "Full Sheet Set ×1, Std Pillow Cases ×2\nBed fully closed/stowed when made",
    },
    {
      name: "Half Bath", floor: "2nd Floor", type: "bathroom",
      towelCount: 0, sortOrder: 7,
      stockingNotes: "Hand Towels ×2\nToilet Paper ×3 (triangle fold)\nTrash double bagged",
    },
    {
      name: "Kitchen", floor: "Common Areas", type: "kitchen",
      sortOrder: 8,
      stockingNotes: `Kitchen Towels ×6, Makeup Towels (Black) ×2, Beach Towels ×12
Beach towels dried, folded, restocked every turn
New kitchen sponge every turn (old in trash)
Paper towels at least 1 full roll
Dishwasher pods stocked, hand soap ≥ half full, dish soap not empty
Cooler emptied, lid cracked to air dry`,
    },
  ];

  for (const room of stonesRooms) {
    await prisma.room.upsert({
      where: { id: `stones-${room.name.toLowerCase().replace(/\s+/g, "-")}` },
      update: room,
      create: { id: `stones-${room.name.toLowerCase().replace(/\s+/g, "-")}`, propertyId: stones.id, ...room },
    });
  }

  // ── STANDING INSTRUCTIONS ──────────────────────────────────────
  console.log("  Creating standing instructions...");
  const allMichelleProps = [gable.id, dutch.id, bbr.id, stones.id];

  const instructions = [
    { text: "DOUBLE FOLD METHOD: bottom sheet → top sheet → comforter → blanket on top. Roll back TWICE from top. Sides tucked all the way in, firm and tight. Foot: hospital fold, tight and square. Pillowcases: opening faces IN toward center.", priority: "critical", category: "general" },
    { text: "Ceiling fan wiped BEFORE any beds are made — every room, every turn.", priority: "important", category: "general" },
    { text: "BUNK BEDS: Always take twin mattresses DOWN off the bunk to make them. Make on the ground, put back up, then tuck in on the frame.", priority: "important", category: "general" },
    { text: "LAUNDRY PRIORITY: Beach towels ALWAYS first load. Kitchen towels + makeup washcloths in with or right after. Strip kings FIRST to check blankets for stains.", priority: "important", category: "laundry" },
    { text: "Spray & Wash on any stain the SECOND you see it — treat before washing. Colors separate — NEVER mix with whites.", priority: "important", category: "laundry" },
    { text: "Mirror protocol: Glass rags on glass ONLY. Two light sprays Windex max. Pass 1: barely damp microfiber. Pass 2: dry glass rag, Z-pattern top to bottom until it SQUEAKS.", priority: "normal", category: "general" },
    { text: "Toilet paper: triangle fold on holder, ≥¾ full, minimum 4 rolls stocked. Trash cans: double bagged — one flat on bottom, one tied on top.", priority: "normal", category: "general" },
    { text: "Bath mat: hung over shower door or tub edge — NOT on the floor.", priority: "normal", category: "general" },
  ];

  for (const propId of allMichelleProps) {
    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];
      await prisma.standingInstruction.upsert({
        where: { id: `instr-${propId.slice(-6)}-${i}` },
        update: instr,
        create: {
          id: `instr-${propId.slice(-6)}-${i}`,
          propertyId: propId,
          ...instr,
          sortOrder: i,
        },
      });
    }
  }

  // ── CHECKLISTS ────────────────────────────────────────────────
  console.log("  Creating checklists...");

  // Standards checklist for all Michelle properties
  for (const propId of allMichelleProps) {
    const checklist = await prisma.checklist.upsert({
      where: { id: `checklist-standards-${propId.slice(-6)}` },
      update: { name: "Standards — Every Turn" },
      create: {
        id: `checklist-standards-${propId.slice(-6)}`,
        propertyId: propId,
        name: "Standards — Every Turn",
        isActive: true,
        sortOrder: 0,
      },
    });

    const standardItems = [
      "Ceiling fan wiped BEFORE beds are made",
      "Mattress pad smooth — no bunching, corners fitted",
      "Double fold: sheet → flat → comforter → blanket, rolled back TWICE",
      "Sides tucked all the way in — firm and tight",
      "Foot: hospital fold, tight and square",
      "Pillowcase openings face IN toward center",
      "Lint roll if pet hair visible",
      "Match reference photo for each room",
      "Beach towels dried, folded, restocked",
      "New kitchen sponge (old in trash)",
      "Paper towels at least 1 full roll",
      "Dishwasher pods stocked",
      "Hand soap pump works, ≥ half full",
      "Dish soap present and not empty",
      "All mirrors: 2-pass method (damp then dry Z-pattern)",
      "All toilet paper: triangle fold, ≥¾ full, 4 rolls minimum",
      "All trash cans: double bagged",
      "All bath mats: hung over shower door or tub edge, NOT on floor",
    ];

    for (let i = 0; i < standardItems.length; i++) {
      await prisma.checklistItem.upsert({
        where: { id: `item-std-${propId.slice(-6)}-${i}` },
        update: { text: standardItems[i] },
        create: {
          id: `item-std-${propId.slice(-6)}-${i}`,
          checklistId: checklist.id,
          text: standardItems[i],
          sortOrder: i,
          isRequired: true,
        },
      });
    }
  }

  console.log("\n✅ Michelle's property data seeded successfully.");
  console.log(`   Gable: ${gableRooms.length} rooms`);
  console.log(`   Dutch: ${gableRooms.length} rooms (same as Gable)`);
  console.log(`   BBR:   ${bbrRooms.length} rooms`);
  console.log(`   Stones: ${stonesRooms.length} rooms`);
  console.log(`   Standing instructions: ${instructions.length} per property (${allMichelleProps.length} properties)`);
  console.log(`   Standards checklist: 1 per property with 18 items`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

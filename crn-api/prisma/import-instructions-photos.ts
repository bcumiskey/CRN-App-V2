/**
 * ADDITIVE follow-up import: V1 property instructions + reference photos that the
 * main cutover skipped. Alex is actively using V2, so this is strictly additive
 * and idempotent — it ONLY creates StandingInstruction and PropertyPhoto rows,
 * never deletes or edits anything else.
 *
 * Source: ../../../v1/CleaningRightNow/instructions-photos-export.json
 *   (produced by v1/CleaningRightNow/scripts/export-instructions-photos.ts)
 *
 * Matching: V1 property/room by NAME → V2 property/room (ids changed at cutover).
 * Idempotency: a property is skipped for instructions if it already has any
 * StandingInstruction, and skipped for photos if it already has any
 * PropertyPhoto — so re-running never duplicates.
 *
 * Usage (from crn-api/):
 *   npx tsx prisma/import-instructions-photos.ts           # DRY RUN (no writes)
 *   npx tsx prisma/import-instructions-photos.ts --apply   # write
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const SRC = path.resolve(
  __dirname,
  "../../../v1/CleaningRightNow/instructions-photos-export.json"
);

const norm = (s: string) => s.trim().toLowerCase();

async function main() {
  console.log(
    APPLY
      ? "APPLY — creating instructions + photos (additive only)\n"
      : "DRY RUN — no writes; pass --apply to write\n"
  );

  const data = JSON.parse(fs.readFileSync(SRC, "utf-8"));
  const admin = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });

  // V2 properties (+ rooms) by normalized name
  const v2props = await prisma.property.findMany({
    select: { id: true, name: true, rooms: { select: { id: true, name: true } } },
  });
  const propByName = new Map(v2props.map((p) => [norm(p.name), p]));

  let instrCreated = 0;
  let photosCreated = 0;
  let propsSkippedNoMatch = 0;
  let propsSkippedHasInstr = 0;
  let propsSkippedHasPhotos = 0;

  for (const src of data.properties as Array<{
    propertyName: string;
    instructions: Array<{ instruction: string; room: string | null; sortOrder: number }>;
    photos: Array<{ url: string; caption: string | null; notes: string | null; room: string | null; sortOrder: number }>;
  }>) {
    const v2 = propByName.get(norm(src.propertyName));
    if (!v2) {
      propsSkippedNoMatch++;
      console.log(`  ⚠ no V2 property named "${src.propertyName}" — skipped (${src.instructions.length} instr, ${src.photos.length} photos)`);
      continue;
    }
    const roomByName = new Map(v2.rooms.map((r) => [norm(r.name), r.id]));

    // ── Instructions ──────────────────────────────────────────────
    if (src.instructions.length > 0) {
      const existing = await prisma.standingInstruction.count({ where: { propertyId: v2.id } });
      if (existing > 0) {
        propsSkippedHasInstr++;
        console.log(`  · ${src.propertyName}: already has ${existing} instruction(s) — leaving as-is`);
      } else {
        for (const ins of src.instructions) {
          const text = ins.room && norm(ins.room) !== "general" ? `[${ins.room}] ${ins.instruction}` : ins.instruction;
          if (APPLY) {
            await prisma.standingInstruction.create({
              data: { propertyId: v2.id, text, category: "general", sortOrder: ins.sortOrder ?? 0 },
            });
          }
          instrCreated++;
        }
        console.log(`  ✓ ${src.propertyName}: ${APPLY ? "created" : "would create"} ${src.instructions.length} instruction(s)`);
      }
    }

    // ── Photos ────────────────────────────────────────────────────
    if (src.photos.length > 0) {
      const existing = await prisma.propertyPhoto.count({ where: { propertyId: v2.id } });
      if (existing > 0) {
        propsSkippedHasPhotos++;
        console.log(`  · ${src.propertyName}: already has ${existing} photo(s) — leaving as-is`);
      } else {
        for (const ph of src.photos) {
          if (!ph.url) continue;
          const caption = [ph.caption, ph.notes].filter(Boolean).join(" — ") || null;
          const roomId = ph.room ? roomByName.get(norm(ph.room)) ?? null : null;
          if (APPLY) {
            await prisma.propertyPhoto.create({
              data: {
                propertyId: v2.id,
                url: ph.url,
                caption,
                roomId,
                photoType: "reference",
                sortOrder: ph.sortOrder ?? 0,
                uploadedById: admin?.id ?? null,
              },
            });
          }
          photosCreated++;
        }
        console.log(`  ✓ ${src.propertyName}: ${APPLY ? "created" : "would create"} ${src.photos.length} photo(s)`);
      }
    }
  }

  console.log(
    `\n${APPLY ? "Created" : "Would create"}: ${instrCreated} instructions, ${photosCreated} photos.`
  );
  console.log(
    `Skipped: ${propsSkippedNoMatch} unmatched properties, ${propsSkippedHasInstr} already had instructions, ${propsSkippedHasPhotos} already had photos.`
  );
  if (!APPLY && instrCreated + photosCreated > 0) console.log("Re-run with --apply to write.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

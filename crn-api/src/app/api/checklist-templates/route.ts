import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { success, error } from "@/lib/responses";

// ---------------------------------------------------------------------------
// GET /api/checklist-templates — Return static checklist templates
// ---------------------------------------------------------------------------

const CHECKLIST_TEMPLATES = {
  kitchen: [
    "Clean all countertops",
    "Wipe down appliance exteriors",
    "Clean microwave interior",
    "Clean stovetop and drip pans",
    "Clean oven exterior",
    "Wipe cabinet fronts",
    "Clean sink and faucet",
    "Empty and wipe trash can",
    "Sweep and mop floor",
    "Clean dishwasher exterior",
    "Wipe down backsplash",
    "Clean refrigerator exterior and handles",
    "Replace dish towels",
    "Check and restock paper towels",
    "Run and empty dishwasher if needed",
  ],
  bathroom: [
    "Scrub toilet inside and out",
    "Clean and disinfect toilet base and behind",
    "Clean shower walls and door",
    "Scrub tub",
    "Clean sink and countertop",
    "Polish faucets and fixtures",
    "Clean mirror",
    "Wipe cabinet fronts",
    "Empty trash",
    "Sweep and mop floor",
    "Replace towels per property spec",
    "Restock toilet paper",
    "Check and restock toiletries",
    "Clean exhaust fan cover",
    "Wipe light switches and door handles",
  ],
  bedroom: [
    "Strip and remake bed per property spec",
    "Fluff and arrange pillows",
    "Dust all surfaces",
    "Dust nightstands and lamps",
    "Wipe down dresser and furniture",
    "Clean mirrors",
    "Vacuum floor and under bed",
    "Empty trash cans",
    "Check closet for guest items",
    "Organize hangers",
    "Wipe light switches and door handles",
    "Check all drawers are empty and clean",
    "Adjust thermostat per property spec",
    "Open/close blinds per property spec",
  ],
  general: [
    "Check all lights are working",
    "Lock all doors and windows",
    "Set thermostat to specified temperature",
    "Check for damage or maintenance issues",
    "Vacuum all carpeted areas",
    "Mop all hard floors",
    "Dust ceiling fans and light fixtures",
    "Wipe all door handles and light switches",
    "Clean interior windows and glass doors",
    "Empty all trash and replace liners",
    "Wipe baseboards",
    "Check smoke detectors",
    "Remove cobwebs",
    "Arrange furniture per property layout",
    "Final walkthrough — verify all areas",
  ],
} as const;

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result.error) return result.error;

  try {
    return success({ templates: CHECKLIST_TEMPLATES });
  } catch (err) {
    console.error("[GET /api/checklist-templates]", err);
    return error("Failed to fetch templates", 500);
  }
}

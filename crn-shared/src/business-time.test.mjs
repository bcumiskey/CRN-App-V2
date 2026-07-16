/**
 * The evening-rollover regression. This bug has now bitten twice: fixed once in
 * crn-api, then reappeared in crn-web because the helper was never shared.
 *
 * Run: node src/business-time.test.mjs   (after `npm run build`)
 */
import assert from "node:assert/strict";
import { businessYMD, addDaysYMD, monthRangeYMD } from "../dist/business-time.js";

const TZ = "America/New_York";
let failed = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.log(`  ✗ ${name}\n      ${e.message}`);
    failed++;
  }
};

console.log("BUSINESS TIME — evening rollover\n");

// EDT is UTC-4. 20:30 ET on Jul 15 is 00:30 UTC on Jul 16.
const evening = new Date(Date.UTC(2026, 6, 16, 0, 30));
check("8:30pm ET is still the same ET day", () =>
  assert.equal(businessYMD(evening, TZ), "2026-07-15"));
check("...and that is NOT what the UTC date says", () =>
  assert.equal(evening.toISOString().split("T")[0], "2026-07-16"));
check("the two disagree — which is the whole bug", () =>
  assert.notEqual(businessYMD(evening, TZ), evening.toISOString().split("T")[0]));

// EST is UTC-5 in winter: rollover moves to 7pm.
const winterEvening = new Date(Date.UTC(2026, 0, 16, 0, 30)); // 7:30pm ET Jan 15
check("winter (EST) rolls at 7pm, not 8pm", () =>
  assert.equal(businessYMD(winterEvening, TZ), "2026-01-15"));

// Daytime must be unaffected.
check("midday is unambiguous", () =>
  assert.equal(businessYMD(new Date(Date.UTC(2026, 6, 15, 16, 0)), TZ), "2026-07-15"));

// String maths must never round-trip through a shiftable Date.
check("addDaysYMD crosses a month boundary", () =>
  assert.equal(addDaysYMD("2026-07-31", 1), "2026-08-01"));
check("addDaysYMD goes backwards", () =>
  assert.equal(addDaysYMD("2026-01-01", -1), "2025-12-31"));
check("addDaysYMD survives a DST spring-forward", () =>
  assert.equal(addDaysYMD("2026-03-07", 1), "2026-03-08"));
check("addDaysYMD survives a leap day", () =>
  assert.equal(addDaysYMD("2028-02-28", 1), "2028-02-29"));

check("monthRangeYMD knows February", () =>
  assert.deepEqual(monthRangeYMD(2026, 2), { start: "2026-02-01", end: "2026-02-28" }));
check("monthRangeYMD knows a leap February", () =>
  assert.deepEqual(monthRangeYMD(2028, 2), { start: "2028-02-01", end: "2028-02-29" }));
check("monthRangeYMD knows a 31-day month", () =>
  assert.deepEqual(monthRangeYMD(2026, 7), { start: "2026-07-01", end: "2026-07-31" }));

console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILED`}`);
process.exit(failed === 0 ? 0 : 1);

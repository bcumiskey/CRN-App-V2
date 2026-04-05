import { describe, it, expect } from "vitest";
import { bankersRound } from "../src/financial/rounding";

describe("bankersRound", () => {
  it("rounds normally when not exactly 0.5", () => {
    expect(bankersRound(2.3)).toBe(2.3);
    expect(bankersRound(2.36)).toBe(2.36);
    expect(bankersRound(2.364)).toBe(2.36);
    expect(bankersRound(2.366)).toBe(2.37);
  });

  it("rounds 0.5 to nearest even (banker's rule)", () => {
    // x.x5 where truncated digit is even → round down (stay even)
    expect(bankersRound(2.025)).toBe(2.02);
    expect(bankersRound(2.045)).toBe(2.04);
    expect(bankersRound(2.065)).toBe(2.06);

    // x.x5 where truncated digit is odd → round up (to even)
    expect(bankersRound(2.015)).toBe(2.02);
    expect(bankersRound(2.035)).toBe(2.04);
    expect(bankersRound(2.055)).toBe(2.06);
  });

  it("handles zero", () => {
    expect(bankersRound(0)).toBe(0);
  });

  it("handles negative numbers", () => {
    expect(bankersRound(-2.3)).toBe(-2.3);
    expect(bankersRound(-2.366)).toBe(-2.37);
  });

  it("handles whole numbers", () => {
    expect(bankersRound(100)).toBe(100);
    expect(bankersRound(200.00)).toBe(200);
  });

  it("handles custom decimal places", () => {
    expect(bankersRound(2.5, 0)).toBe(2);
    expect(bankersRound(3.5, 0)).toBe(4);
    expect(bankersRound(2.345, 2)).toBe(2.34);
  });
});

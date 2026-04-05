/**
 * Banker's rounding (round half to even).
 *
 * Standard Math.round rounds 0.5 up, which introduces systematic bias.
 * Banker's rounding rounds 0.5 to the nearest even number, distributing
 * rounding errors more evenly over many calculations.
 *
 * Examples:
 *   bankersRound(2.5)   → 2  (rounds to even)
 *   bankersRound(3.5)   → 4  (rounds to even)
 *   bankersRound(2.15)  → 2.2
 *   bankersRound(2.25)  → 2.2 (rounds to even)
 *   bankersRound(2.35)  → 2.4
 */
export function bankersRound(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  const shifted = value * factor;
  const truncated = Math.trunc(shifted);
  const remainder = Math.abs(shifted - truncated);

  // If exactly 0.5 (within floating point tolerance), round to even
  if (Math.abs(remainder - 0.5) < 1e-9) {
    // If truncated is even, keep it; if odd, round away from zero
    if (truncated % 2 === 0) {
      return truncated / factor;
    }
    return (truncated + Math.sign(shifted)) / factor;
  }

  // Otherwise, standard rounding
  return Math.round(shifted) / factor;
}

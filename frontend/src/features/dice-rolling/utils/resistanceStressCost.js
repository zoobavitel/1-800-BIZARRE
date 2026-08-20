/**
 * Stress marked on a resistance roll (user attributes or Durability).
 * Highest 6 costs 0. Two 6s: pay 0 and clear 1 (return -1).
 * 0-dice (2d take lower) cannot crit.
 *
 * @param {number[]} dice
 * @param {{ zeroDice?: boolean }} [opts]
 * @returns {number}
 */
export function resistanceStressCost(dice, { zeroDice = false } = {}) {
  const cleaned = (Array.isArray(dice) ? dice : [])
    .map((d) => Number(d))
    .filter((d) => Number.isFinite(d));
  if (cleaned.length === 0) return 0;
  if (zeroDice) {
    return Math.max(0, 6 - Math.min(...cleaned));
  }
  const highest = Math.max(...cleaned);
  const sixes = cleaned.filter((d) => d === 6).length;
  if (sixes >= 2) return -1;
  return Math.max(0, 6 - highest);
}

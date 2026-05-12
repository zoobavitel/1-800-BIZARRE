/**
 * Mirrors `characters.roll_helpers.tier_die_from_action_pool` /
 * `outcome_from_action_roll` / `outcome_from_dice_results` (Python).
 */

/**
 * @param {number[]} results
 * @param {number} poolBeforeRoll
 * @param {number|null|undefined} poolActionRating
 * @returns {number}
 */
export function tierDieFromActionPool(
  results,
  poolBeforeRoll,
  poolActionRating = null,
) {
  if (!results || !results.length) return 0;
  let poolInt =
    poolBeforeRoll != null && poolBeforeRoll !== ""
      ? Number(poolBeforeRoll)
      : 0;
  if (!Number.isFinite(poolInt)) poolInt = 0;
  poolInt = Math.max(0, Math.trunc(poolInt));
  let par =
    poolActionRating != null && poolActionRating !== ""
      ? Number(poolActionRating)
      : null;
  if (par != null && !Number.isFinite(par)) par = null;
  if (par != null) par = Math.max(0, Math.trunc(par));

  const vals = results
    .map((r) => Number(r))
    .filter((n) => Number.isFinite(n));
  if (!vals.length) return 0;

  if (poolInt === 0 && vals.length >= 2) {
    if (par != null && par > 0) return Math.max(...vals);
    return Math.min(...vals);
  }
  return Math.max(...vals);
}

/**
 * @param {number[]} results
 * @param {number} poolBeforeRoll
 * @param {number|null|undefined} poolActionRating
 * @returns {"CRITICAL_SUCCESS"|"FULL_SUCCESS"|"PARTIAL_SUCCESS"|"FAILURE"}
 */
export function outcomeFromActionRoll(
  results,
  poolBeforeRoll,
  poolActionRating = null,
) {
  if (!results || !results.length) return "FAILURE";
  const sixes = results.filter((r) => Number(r) === 6).length;
  if (sixes >= 2) return "CRITICAL_SUCCESS";
  const tier = tierDieFromActionPool(
    results,
    poolBeforeRoll,
    poolActionRating,
  );
  if (tier >= 6) return "FULL_SUCCESS";
  if (tier >= 4) return "PARTIAL_SUCCESS";
  return "FAILURE";
}

/**
 * Fortune / manual dice list: always highest die for tiers (see `outcome_from_dice_results`).
 * @param {number[]} results
 * @returns {"CRITICAL_SUCCESS"|"FULL_SUCCESS"|"PARTIAL_SUCCESS"|"FAILURE"}
 */
export function outcomeFromFortuneDiceResults(results) {
  if (!results || !results.length) return "FAILURE";
  const sixes = results.filter((r) => Number(r) === 6).length;
  if (sixes >= 2) return "CRITICAL_SUCCESS";
  const tier = Math.max(
    ...results.map((r) => Number(r)).filter((n) => Number.isFinite(n)),
  );
  if (tier >= 6) return "FULL_SUCCESS";
  if (tier >= 4) return "PARTIAL_SUCCESS";
  return "FAILURE";
}

/** Short labels matching manual-history UI copy. */
export const OUTCOME_BAND_SHORT_LABEL = {
  CRITICAL_SUCCESS: "Critical",
  FULL_SUCCESS: "Full",
  PARTIAL_SUCCESS: "Partial",
  FAILURE: "Failure",
};

/** Character sheet / offline dice result strings (unchanged copy). */
export const OUTCOME_API_SHEET_DISPLAY = {
  CRITICAL_SUCCESS: "Critical Success",
  FULL_SUCCESS: "Success",
  PARTIAL_SUCCESS: "Partial Success",
  FAILURE: "Failure",
};

/**
 * @param {string} api
 * @returns {string}
 */
export function outcomeApiToSheetDisplay(api) {
  const k = String(api || "").toUpperCase();
  return OUTCOME_API_SHEET_DISPLAY[k] || "Failure";
}

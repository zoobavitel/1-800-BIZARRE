import { standGradeIndexToDicePool } from "../constants/srd";

/**
 * Mirrors backend `roll_action` base dice math (character_views.py):
 * base action pool = action rating only (dots in the rolled action). Attribute
 * group breadth does not add dice.
 * When the final pool is 0 (after rating + push/devil/bonus/assist), the server
 * rolls 2d6 and uses the lower die for the outcome (Blades-style).
 *
 * @param {string} actionName - e.g. "HUNT" or "hunt"
 * @param {Record<string, number>} actionRatings - sheet keys (HUNT, BIZARRE, …)
 */
export const INSIGHT_ACTIONS = ["HUNT", "STUDY", "SURVEY", "TINKER"];
export const PROWESS_ACTIONS = ["FINESSE", "PROWL", "SKIRMISH", "WRECK"];
export const RESOLVE_ACTIONS = ["BIZARRE", "COMMAND", "CONSORT", "SWAY"];

export function attributeGroupForAction(actionName) {
  const u = String(actionName || "").toUpperCase();
  if (INSIGHT_ACTIONS.includes(u)) return INSIGHT_ACTIONS;
  if (PROWESS_ACTIONS.includes(u)) return PROWESS_ACTIONS;
  if (RESOLVE_ACTIONS.includes(u)) return RESOLVE_ACTIONS;
  return RESOLVE_ACTIONS;
}

export function computeActionPoolBreakdown(actionName, actionRatings) {
  const ratings = actionRatings || {};
  const key = String(actionName || "").toUpperCase();
  const action_rating = Math.max(0, Number(ratings[key] ?? 0) || 0);
  return {
    action_rating,
    /** @deprecated always 0; kept for callers that destructure; not added to pool */
    attribute_dice: 0,
    basePool: action_rating,
  };
}

/**
 * Total dice before push / devil / assist / ability bonus_dice.
 */
export function computeBaseDicePool(actionName, actionRatings) {
  const { basePool } = computeActionPoolBreakdown(actionName, actionRatings);
  return basePool;
}

/**
 * Stand Coin roll dice from grade indices on the sheet (`standStats` keys).
 */
export function computeStandRollPool(standStatKey, standStats) {
  const k = String(standStatKey || "").toLowerCase();
  const raw = Math.max(0, Math.min(5, Number(standStats?.[k]) || 0));
  return standGradeIndexToDicePool(raw);
}

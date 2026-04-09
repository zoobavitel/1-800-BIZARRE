/**
 * Mirrors backend `roll_action` dice math (character_views.py):
 * action_rating + attribute_dice, where attribute_dice counts actions in the
 * same attribute with dots > 0.
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
  const attrGroup = attributeGroupForAction(key);
  const attribute_dice = attrGroup.filter(
    (a) => (Number(ratings[a] ?? 0) || 0) > 0,
  ).length;
  return {
    action_rating,
    attribute_dice,
    basePool: action_rating + attribute_dice,
  };
}

/**
 * Total dice before push / devil / assist / ability bonus_dice.
 */
export function computeBaseDicePool(actionName, actionRatings) {
  const { basePool } = computeActionPoolBreakdown(actionName, actionRatings);
  return basePool;
}

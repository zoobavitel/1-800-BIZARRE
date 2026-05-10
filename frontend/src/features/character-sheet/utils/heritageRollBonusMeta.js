/**
 * Heritage benefit / detriment roll-checkbox rules (CharacterSheet action roll modal).
 * Names mirror backend fixtures: `characters/fixtures/srd_benefits.json`,
 * `srd_detriments.json`, `heritages_updated.json`.
 */

/** @param {string | undefined} name */
export function heritageBenefitNormName(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

const REFLEX_OVERCLOCK_NAMES = new Set(
  ["Reflex Overclock"].map((n) => heritageBenefitNormName(n)),
);

const ALIEN_UNDERSTANDING_NAMES = new Set(
  ["Alien Understanding"].map((n) => heritageBenefitNormName(n)),
);

/** SRD detriment: −1d on social interactions unless disguised as a human. */
export function heritageEntryIsAlienUnderstanding(entry) {
  return ALIEN_UNDERSTANDING_NAMES.has(heritageBenefitNormName(entry?.name));
}

/**
 * Reflex Overclock (SRD): +1 HP benefit, "+1d to dodging attacks."
 * Frontend: checkbox +1d; stand-coin SPEED uses the Speed stat pool for that fiction.
 *
 * @param {{ name?: string } | null | undefined} hb
 */
export function heritageBenefitIsReflexOverclock(hb) {
  return REFLEX_OVERCLOCK_NAMES.has(heritageBenefitNormName(hb?.name));
}

/**
 * When false, heritage dice (+ optional effect checkbox) must not count for this benefit row.
 *
 * @param {{
 *   rollPending?: { standRoll?: boolean, standStat?: string } | null,
 *   healingTreatmentBonusContext?: boolean,
 * }} ctx
 * `healingTreatmentBonusContext` matches CharacterSheet: heal attempt payload on the roll
 * or heal-another recovery intent (Invigorated auto path uses the same flag).
 */
export function reflexOverclockHeritageBonusApplies(ctx) {
  if (ctx?.healingTreatmentBonusContext) return false;

  const rollPending = ctx?.rollPending;
  if (rollPending?.standRoll) {
    const ss = String(rollPending.standStat || "").trim().toLowerCase();
    return ss === "speed";
  }
  return true;
}

/** @param {string | undefined} actionUpper */
function alienUnderstandingSocialAction(actionUpper) {
  const a = String(actionUpper || "")
    .trim()
    .toUpperCase()
    .replace(/\s*\(STAND\)\s*$/i, "");
  return a === "CONSORT" || a === "SWAY";
}

/**
 * When true, the Alien Understanding −1d checkbox may count toward the pool (still requires
 * player tick + social action + not healing / not stand).
 *
 * @param {{
 *   disguisedAsHuman?: boolean | null,
 * }} ctx
 */
export function alienUnderstandingPenaltyGateOpen(ctx) {
  return ctx?.disguisedAsHuman !== true;
}

/**
 * @param {{
 *   rollPending?: {
 *     standRoll?: boolean,
 *     healAttempt?: unknown,
 *   } | null,
 *   healingTreatmentBonusContext?: boolean,
 *   rollActionName?: string,
 *   disguisedAsHuman?: boolean | null,
 * }} ctx
 */
export function alienUnderstandingHeritagePenaltyApplies(ctx) {
  if (!alienUnderstandingPenaltyGateOpen(ctx)) return false;
  if (ctx?.healingTreatmentBonusContext) return false;
  const rp = ctx?.rollPending;
  if (rp?.standRoll) return false;
  if (rp?.healAttempt != null && typeof rp.healAttempt === "object") return false;
  if (!alienUnderstandingSocialAction(ctx?.rollActionName)) return false;
  return true;
}

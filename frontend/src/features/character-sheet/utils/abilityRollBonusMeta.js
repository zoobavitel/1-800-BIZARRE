/**
 * Curated rules for ability/heritage roll bonus checkboxes (CharacterSheet).
 * Names match fixture copy in backend/src/characters/fixtures/standard_abilities.json.
 *
 * @see docs/codebase/standard-ability-roll-bonus-audit.md
 */

/** @param {string | undefined} name */
function normName(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

/** Effect bonus on the *action roll modal* does not apply to this ability's fiction. */
const ACTION_MODAL_SUPPRESS_EFFECT_NAMES = new Set(
  ["Stand Proud"].map(normName),
);

/** Dice bonus on the *action roll modal* is wrong surface (ally-only or resistance-only). */
const ACTION_MODAL_SUPPRESS_DICE_NAMES = new Set(
  ["Aura of Confidence", "Iron Will", "Ripple Breathing"].map(normName),
);

const IRON_WILL_NAMES = new Set(["Iron Will"].map(normName));

const LEGENDARY_GUARD_NAMES = new Set(["Legendary Guard"].map(normName));

const PHANTOM_PAIN_NAMES = new Set(["Phantom Pain"].map(normName));

const INVIGORATED_NAMES = new Set(["invigorated"]);

/** Hamon Ripple Breathing: +1d only on qualifying resistance rolls, not generic action pools. */
const RIPPLE_BREATHING_NAMES = new Set(["Ripple Breathing"].map(normName));

/**
 * Standard ability — once/score negate one harm (fiction; not tied to armor box clicks).
 * @param {Array<{ type?: string, name?: string }> | undefined} abilities
 */
export function characterHasLegendaryGuard(abilities) {
  if (!Array.isArray(abilities)) return false;
  return abilities.some(
    (a) =>
      a &&
      String(a.type || "").toLowerCase() === "standard" &&
      LEGENDARY_GUARD_NAMES.has(normName(a.name)),
  );
}

/**
 * Spend 1 stress to attack through cover (standard ability; roll modal checkbox).
 * @param {Array<{ type?: string, name?: string }> | undefined} abilities
 */
export function characterHasPhantomPain(abilities) {
  if (!Array.isArray(abilities)) return false;
  return abilities.some(
    (a) =>
      a &&
      String(a.type || "").toLowerCase() === "standard" &&
      PHANTOM_PAIN_NAMES.has(normName(a.name)),
  );
}

/**
 * Standard ability — +1d on healing treatment rolls (SRD); used for auto pool on heal flows.
 * @param {Array<{ type?: string, name?: string }> | undefined} abilities
 */
export function characterHasInvigorated(abilities) {
  if (!Array.isArray(abilities)) return false;
  return abilities.some(
    (a) =>
      a &&
      String(a.type || "").toLowerCase() === "standard" &&
      INVIGORATED_NAMES.has(normName(a.name)),
  );
}

/**
 * +1d to healing treatment (SRD Invigorated). Any sheet row matching the catalog name —
 * standard pick, heritage echo, or server-hydrated `character.abilities` — counts.
 */
export function invigoratedHealingBonusApplies(rows) {
  if (!Array.isArray(rows)) return false;
  return rows.some((a) => a && INVIGORATED_NAMES.has(normName(a.name)));
}

/**
 * @param {Array<{ type?: string, name?: string }> | undefined} abilities
 */
export function characterHasRippleBreathing(abilities) {
  if (!Array.isArray(abilities)) return false;
  return abilities.some(
    (a) =>
      a &&
      String(a.type || "").toLowerCase() === "hamon" &&
      RIPPLE_BREATHING_NAMES.has(normName(a.name)),
  );
}

/**
 * Never offer +1d/+1effect checkboxes on the action-roll modal (wrong surface).
 * @param {string | undefined} name Ability display name (case-insensitive)
 */
export function abilityExcludedFromActionRollDicePoolBonuses(name) {
  return RIPPLE_BREATHING_NAMES.has(normName(name));
}

/**
 * @param {{ name?: string } | null | undefined} ab
 * @returns {{ supportsDice: boolean, supportsEffect: boolean }}
 */
export function adjustActionRollBonusSupports(ab, baseSupports) {
  const n = normName(ab?.name);
  let supportsDice = baseSupports.supportsDice;
  let supportsEffect = baseSupports.supportsEffect;
  if (ACTION_MODAL_SUPPRESS_EFFECT_NAMES.has(n)) supportsEffect = false;
  if (ACTION_MODAL_SUPPRESS_DICE_NAMES.has(n)) supportsDice = false;
  return { supportsDice, supportsEffect };
}

/**
 * Standard ability "Iron Will" — +1d only on RESOLVE-attribute resistance (sheet).
 * @param {string} resistanceAttr "INSIGHT" | "PROWESS" | "RESOLVE"
 */
export function ironWillBonusAppliesToResistanceAttr(resistanceAttr) {
  return String(resistanceAttr || "").toUpperCase() === "RESOLVE";
}

/**
 * @param {Array<{ type?: string, name?: string }> | undefined} abilities
 */
export function characterHasIronWill(abilities) {
  if (!Array.isArray(abilities)) return false;
  return abilities.some(
    (a) =>
      a &&
      String(a.type || "").toLowerCase() === "standard" &&
      IRON_WILL_NAMES.has(normName(a.name)),
  );
}

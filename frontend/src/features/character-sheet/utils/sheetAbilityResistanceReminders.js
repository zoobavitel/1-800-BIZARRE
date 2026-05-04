/**
 * Post-roll hints for resistance outcomes (display only; GM / table confirms fiction).
 * Extend the registry in getResistanceResultSheetAbilityReminders as you add curated triggers.
 */

/** @param {string | undefined} name */
function normName(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

const CASCADE_EFFECT_NAMES = new Set(["cascade effect"].map(normName));

/**
 * @param {Array<{ type?: string, name?: string }> | undefined} abilities
 * @param {string} type
 * @param {Set<string>} nameSet normalized names
 */
function sheetHasAbilityType(abilities, type, nameSet) {
  if (!Array.isArray(abilities)) return false;
  const t = normName(type);
  return abilities.some(
    (a) => a && normName(a.type) === t && nameSet.has(normName(a.name)),
  );
}

/**
 * @param {Array<{ type?: string, name?: string }> | undefined} abilities
 */
export function characterHasCascadeEffectAbility(abilities) {
  return sheetHasAbilityType(abilities, "standard", CASCADE_EFFECT_NAMES);
}

/**
 * @param {number[] | undefined} dice
 */
export function resistanceRollDiceIncludeSix(dice) {
  if (!Array.isArray(dice)) return false;
  return dice.some((d) => Number(d) === 6);
}

/**
 * @typedef {{ key: string, abilityType: string, abilityName: string, headline: string, body: string, title?: string }} ResistanceSheetAbilityReminder
 */

/**
 * @param {Array<{ type?: string, name?: string, description?: string }> | undefined} abilities
 * @param {number[] | undefined} dice
 * @returns {ResistanceSheetAbilityReminder[]}
 */
export function getResistanceResultSheetAbilityReminders(abilities, dice) {
  /** @type {ResistanceSheetAbilityReminder[]} */
  const out = [];

  const descFor = (abilityName) => {
    const a = (abilities || []).find(
      (x) => normName(x?.name) === normName(abilityName),
    );
    const raw = String(a?.description || "").trim();
    return raw ? raw.slice(0, 900) : undefined;
  };

  if (
    characterHasCascadeEffectAbility(abilities) &&
    resistanceRollDiceIncludeSix(dice)
  ) {
    out.push({
      key: "standard:cascade-effect",
      abilityType: "standard",
      abilityName: "Cascade Effect",
      headline: "Optional — trigger Cascade Effect",
      body: "Mirrored backlash on the attacker only if this resist targeted a physical or bizarre consequence.",
      title: descFor("Cascade Effect"),
    });
  }

  return out;
}

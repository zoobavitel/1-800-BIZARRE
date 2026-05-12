import {
  heritageBenefitIsReflexOverclock,
  reflexOverclockHeritageBonusApplies,
} from "./heritageRollBonusMeta";

/**
 * Same rules as CharacterSheet roll modal: sheet abilities / heritage rows that
 * support +1d or +1 effect, Invigorated auto-dice when `healingTreatmentBonusContext`,
 * Reflex Overclock gated by stand SPEED or non-stand rolls.
 *
 * @param {{
 *   abilityRollBonusOptions?: Array<{
 *     id?: number|string,
 *     name?: string,
 *     supportsDice?: boolean,
 *     supportsEffect?: boolean,
 *   }>,
 *   heritageRollBonusOptions?: Array<{
 *     id?: number|string,
 *     name?: string,
 *     supportsDice?: boolean,
 *     supportsEffect?: boolean,
 *   }>,
 *   abilityBoostMap?: Record<string, { dice?: boolean, effect?: boolean }>,
 *   heritageBoostMap?: Record<string, { dice?: boolean, effect?: boolean }>,
 *   healingTreatmentBonusContext?: boolean,
 *   standRoll?: boolean,
 *   reflexCtx?: { rollPending?: unknown, healingTreatmentBonusContext?: boolean },
 * }} p
 */
export function computeAbilityHeritageRollBonuses({
  abilityRollBonusOptions = [],
  heritageRollBonusOptions = [],
  abilityBoostMap = {},
  heritageBoostMap = {},
  healingTreatmentBonusContext = false,
  standRoll = false,
  reflexCtx,
}) {
  let bonusDiceFromAbilities = 0;
  let abilityEffectSteps = 0;
  const abilityBonusAudit = [];
  abilityRollBonusOptions.forEach((ab) => {
    const id = ab.id ?? ab.name;
    const b = abilityBoostMap[id];
    const invigoratedHeal =
      healingTreatmentBonusContext &&
      String(ab?.name || "")
        .trim()
        .toLowerCase() === "invigorated" &&
      ab.supportsDice;
    if (ab.supportsDice && (invigoratedHeal || (b && b.dice))) {
      bonusDiceFromAbilities += 1;
      abilityBonusAudit.push(
        invigoratedHeal
          ? `${ab.name}: +1d (healing treatment — auto)`
          : `${ab.name}: +1d`,
      );
    }
    if (ab.supportsEffect && b && b.effect) {
      abilityEffectSteps += 1;
      abilityBonusAudit.push(`${ab.name}: +1 effect`);
    }
  });

  const reflexOverclockCtx =
    reflexCtx ?? { rollPending: null, healingTreatmentBonusContext };
  let bonusDiceFromHeritage = 0;
  let heritageEffectSteps = 0;
  const heritageBonusAudit = [];
  heritageRollBonusOptions.forEach((hb) => {
    if (standRoll && !heritageBenefitIsReflexOverclock(hb)) {
      return;
    }
    if (
      heritageBenefitIsReflexOverclock(hb) &&
      !reflexOverclockHeritageBonusApplies(reflexOverclockCtx)
    ) {
      return;
    }
    const id = hb.id ?? hb.name;
    const b = heritageBoostMap[id];
    if (!b) return;
    if (hb.supportsDice && b.dice) {
      bonusDiceFromHeritage += 1;
      heritageBonusAudit.push(
        standRoll
          ? `${hb.name}: +1d (heritage — stand speed)`
          : `${hb.name}: +1d (heritage)`,
      );
    }
    if (hb.supportsEffect && b.effect) {
      heritageEffectSteps += 1;
      heritageBonusAudit.push(`${hb.name}: +1 effect (heritage)`);
    }
  });

  return {
    bonusDiceFromAbilities,
    abilityEffectSteps,
    abilityBonusAudit,
    bonusDiceFromHeritage,
    heritageEffectSteps,
    heritageBonusAudit,
  };
}

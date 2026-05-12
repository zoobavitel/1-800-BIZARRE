import { computeAbilityHeritageRollBonuses } from "./rollAbilityHeritageModifiers";

describe("computeAbilityHeritageRollBonuses", () => {
  test("counts checked ability dice and effect", () => {
    const r = computeAbilityHeritageRollBonuses({
      abilityRollBonusOptions: [
        {
          id: 1,
          name: "Test Strike",
          supportsDice: true,
          supportsEffect: true,
        },
      ],
      heritageRollBonusOptions: [],
      abilityBoostMap: { 1: { dice: true, effect: true } },
      heritageBoostMap: {},
      healingTreatmentBonusContext: false,
      standRoll: false,
    });
    expect(r.bonusDiceFromAbilities).toBe(1);
    expect(r.abilityEffectSteps).toBe(1);
    expect(r.abilityBonusAudit.some((x) => x.includes("+1d"))).toBe(true);
    expect(r.abilityBonusAudit.some((x) => x.includes("+1 effect"))).toBe(true);
  });
});

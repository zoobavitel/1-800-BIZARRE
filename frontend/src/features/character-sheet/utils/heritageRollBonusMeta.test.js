import {
  alienUnderstandingHeritagePenaltyApplies,
  alienUnderstandingPenaltyGateOpen,
  heritageBenefitIsReflexOverclock,
  heritageEntryIsAlienUnderstanding,
  reflexOverclockHeritageBonusApplies,
} from "./heritageRollBonusMeta";

describe("heritageRollBonusMeta — Reflex Overclock", () => {
  test("detects benefit by name", () => {
    expect(heritageBenefitIsReflexOverclock({ name: "Reflex Overclock" })).toBe(
      true,
    );
    expect(
      heritageBenefitIsReflexOverclock({ name: "  reflex OVERCLOCK " }),
    ).toBe(true);
    expect(heritageBenefitIsReflexOverclock({ name: "Enhanced Reflexes" })).toBe(
      false,
    );
  });

  test("excluded in healing treatment / heal-other intent context", () => {
    expect(
      reflexOverclockHeritageBonusApplies({
        healingTreatmentBonusContext: true,
        rollPending: { standRoll: true, standStat: "speed" },
      }),
    ).toBe(false);
  });

  test("stand roll: only Speed stat", () => {
    expect(
      reflexOverclockHeritageBonusApplies({
        healingTreatmentBonusContext: false,
        rollPending: { standRoll: true, standStat: "speed" },
      }),
    ).toBe(true);
    expect(
      reflexOverclockHeritageBonusApplies({
        healingTreatmentBonusContext: false,
        rollPending: { standRoll: true, standStat: "power" },
      }),
    ).toBe(false);
  });

  test("playbook action rolls: not stand", () => {
    expect(
      reflexOverclockHeritageBonusApplies({
        healingTreatmentBonusContext: false,
        rollPending: null,
      }),
    ).toBe(true);
    expect(
      reflexOverclockHeritageBonusApplies({
        healingTreatmentBonusContext: false,
        rollPending: { actionName: "PROWL" },
      }),
    ).toBe(true);
  });
});

describe("heritageRollBonusMeta — Alien Understanding", () => {
  test("detects detriment by name", () => {
    expect(heritageEntryIsAlienUnderstanding({ name: "Alien Understanding" })).toBe(
      true,
    );
    expect(
      heritageEntryIsAlienUnderstanding({ name: "  ALIEN understanding " }),
    ).toBe(true);
    expect(heritageEntryIsAlienUnderstanding({ name: "Weak to Electricity" })).toBe(
      false,
    );
  });

  test("penalty gate closed when disguised", () => {
    expect(alienUnderstandingPenaltyGateOpen({ disguisedAsHuman: true })).toBe(
      false,
    );
    expect(alienUnderstandingPenaltyGateOpen({ disguisedAsHuman: false })).toBe(
      true,
    );
    expect(alienUnderstandingPenaltyGateOpen({ disguisedAsHuman: null })).toBe(
      true,
    );
  });

  test("penalty applies on social action when not disguised", () => {
    expect(
      alienUnderstandingHeritagePenaltyApplies({
        disguisedAsHuman: false,
        rollActionName: "CONSORT",
        rollPending: {},
        healingTreatmentBonusContext: false,
      }),
    ).toBe(true);
    expect(
      alienUnderstandingHeritagePenaltyApplies({
        disguisedAsHuman: false,
        rollActionName: "SWAY",
        rollPending: {},
        healingTreatmentBonusContext: false,
      }),
    ).toBe(true);
  });

  test("no penalty when disguised", () => {
    expect(
      alienUnderstandingHeritagePenaltyApplies({
        disguisedAsHuman: true,
        rollActionName: "CONSORT",
        rollPending: {},
        healingTreatmentBonusContext: false,
      }),
    ).toBe(false);
  });

  test("no penalty on non-social actions", () => {
    expect(
      alienUnderstandingHeritagePenaltyApplies({
        disguisedAsHuman: false,
        rollActionName: "SKIRMISH",
        rollPending: {},
        healingTreatmentBonusContext: false,
      }),
    ).toBe(false);
  });

  test("no penalty on stand rolls or healing context", () => {
    expect(
      alienUnderstandingHeritagePenaltyApplies({
        disguisedAsHuman: false,
        rollActionName: "CONSORT",
        rollPending: { standRoll: true, standStat: "power" },
        healingTreatmentBonusContext: false,
      }),
    ).toBe(false);
    expect(
      alienUnderstandingHeritagePenaltyApplies({
        disguisedAsHuman: false,
        rollActionName: "CONSORT",
        rollPending: {},
        healingTreatmentBonusContext: true,
      }),
    ).toBe(false);
    expect(
      alienUnderstandingHeritagePenaltyApplies({
        disguisedAsHuman: false,
        rollActionName: "CONSORT",
        rollPending: { healAttempt: {} },
        healingTreatmentBonusContext: false,
      }),
    ).toBe(false);
  });
});

import {
  actionNameToActionKey,
  buildXpRequirementSnapshot,
  sumTrackerXpByTriggers,
  tallyDesperateActionRolls,
  formatAttrTally,
} from "./xpRequirements";

describe("actionNameToActionKey", () => {
  test("normalizes case and first token", () => {
    expect(actionNameToActionKey("hunt")).toBe("HUNT");
    expect(actionNameToActionKey("HUNT")).toBe("HUNT");
  });
});

describe("sumTrackerXpByTriggers", () => {
  const rows = [
    { session: 1, trigger: "BELIEFS", xp_gained: 1 },
    { session: 1, trigger: "BELIEFS", xp_gained: 1 },
    { session: 1, trigger: "BELIEFS", xp_gained: 1 },
    { session: 2, trigger: "BELIEFS", xp_gained: 4 },
  ];
  test("sums and caps at 2 for session 1", () => {
    expect(sumTrackerXpByTriggers(rows, 1, ["BELIEFS"], 2)).toBe(2);
  });
  test("ignores other sessions", () => {
    expect(sumTrackerXpByTriggers(rows, 2, ["BELIEFS"], 2)).toBe(2);
  });
});

describe("tallyDesperateActionRolls", () => {
  const rolls = [
    {
      character: 9,
      session: 3,
      roll_type: "ACTION",
      position: "desperate",
      action_name: "hunt",
    },
    {
      character: 9,
      session: 3,
      roll_type: "ACTION",
      position: "risky",
      action_name: "hunt",
    },
    {
      character: 8,
      session: 3,
      roll_type: "ACTION",
      position: "desperate",
      action_name: "skirmish",
    },
  ];
  test("only this character, desperate ACTION", () => {
    const o = tallyDesperateActionRolls(rolls, 3, 9);
    expect(o.count).toBe(1);
    expect(o.byAttribute.insight).toBe(1);
  });
});

describe("buildXpRequirementSnapshot", () => {
  test("no session -> hasActiveSession false", () => {
    const s = buildXpRequirementSnapshot({
      sessionId: null,
      characterId: 1,
      trackerEntries: [],
      rolls: [],
    });
    expect(s.hasActiveSession).toBe(false);
  });

  test("maps triggers and caps", () => {
    const s = buildXpRequirementSnapshot({
      sessionId: 1,
      characterId: 1,
      trackerEntries: [
        { session: 1, trigger: "BELIEFS", xp_gained: 1 },
        { session: 1, trigger: "STRUGGLE", xp_gained: 2 },
        { session: 1, trigger: "STANDOUT", xp_gained: 1 },
        { session: 1, trigger: "DESPERATE_ROLL", xp_gained: 1 },
      ],
      rolls: [],
    });
    expect(s.beliefs).toBe(1);
    expect(s.struggle).toBe(2);
    expect(s.playbook).toBe(1);
    expect(s.desperateTrackerNote).toBe(1);
  });
});

describe("formatAttrTally", () => {
  test("omits empty tracks", () => {
    const t = formatAttrTally({ insight: 2, prowess: 0, resolve: 1 });
    expect(t).toContain("insight +2");
    expect(t).toContain("resolve +1");
  });
});

import {
  rollHasAbilitiesTagForEncodedXp,
  buildSessionEndLiveSummary,
} from "./sessionEndLiveXpPreview";

describe("sessionEndLiveXpPreview", () => {
  test("abilities-tagged rolls do not add playbook encoded XP (STRUGGLE only auto)", () => {
    const rolls = [
      {
        character: 1,
        roll_type: "ACTION",
        description: "[abilities: foo]",
      },
      {
        character: 1,
        roll_type: "CLEAR_STRESS",
        action_name: "vice gamble",
        description: "overindulgence",
      },
    ];
    const summary = buildSessionEndLiveSummary(rolls, [], []);
    const row = summary.encodedRows.find((r) => r.characterId === 1);
    expect(row).toBeDefined();
    expect(rollHasAbilitiesTagForEncodedXp(rolls[0])).toBe(true);
    expect(row.playbookWouldGrant).toBe(0);
    expect(row.playbookEvents).toBe(0);
    expect(row.struggleWouldGrant).toBe(1);
    expect(row.totalEncodedPlaybookXp).toBe(1);
  });
});

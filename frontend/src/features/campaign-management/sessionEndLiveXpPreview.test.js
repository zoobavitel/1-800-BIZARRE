import {
  rollHasAbilitiesTagForEncodedXp,
  buildSessionEndLiveSummary,
  scorecardStatsByCharFromXpEntries,
  mergeEndLiveRowsWithScorecard,
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

  test("scorecardStatsByCharFromXpEntries buckets toggles and sums xp", () => {
    const stats = scorecardStatsByCharFromXpEntries([
      { character: 10, trigger: "BELIEFS", xp_gained: 1 },
      { character: 10, trigger: "PLAYBOOK_SPECIFIC", xp_gained: 1 },
      { character: 10, trigger: "STANDOUT", xp_gained: 1 },
      { character: 10, trigger: "STRUGGLE", xp_gained: 1 },
      { character: 10, trigger: "MANUAL", xp_gained: 2, description: "[insight] GM" },
      { character: 11, trigger: "BELIEFS", xp_gained: 2 },
      { character: 11, trigger: "BELIEFS", xp_gained: 1 },
    ]);
    const a = stats.get(10);
    expect(a.triggerCount.BELIEFS).toBe(1);
    expect(a.triggerCount.PLAYBOOK).toBe(2);
    expect(a.triggerCount.STRUGGLE).toBe(1);
    expect(a.xpSum).toBe(6);
    const b = stats.get(11);
    expect(b.triggerCount.BELIEFS).toBe(2);
    expect(b.xpSum).toBe(3);
  });

  test("mergeEndLiveRowsWithScorecard includes toggles in Total and avoids double-count STRUGGLE", () => {
    const stats = scorecardStatsByCharFromXpEntries([
      { character: 1, trigger: "BELIEFS", xp_gained: 1 },
      { character: 1, trigger: "PLAYBOOK_SPECIFIC", xp_gained: 1 },
      { character: 1, trigger: "STRUGGLE", xp_gained: 1 },
    ]);
    const rows = [
      {
        characterId: 1,
        name: "PC",
        playbookWouldGrant: 0,
        struggleWouldGrant: 2,
        developmentPoolXp: 1,
        manualSessionXp: 0,
        totalSessionXpPreview: 3,
      },
    ];
    const merged = mergeEndLiveRowsWithScorecard(rows, stats, false);
    expect(merged[0].beliefsToggleCount).toBe(1);
    expect(merged[0].playbookToggleCount).toBe(1);
    expect(merged[0].struggleToggleCount).toBe(1);
    // xpSum 3 + unsettled STRUGGLE max(0, 2-1)=1 + Dev 1 = 5
    expect(merged[0].totalSessionXpPreview).toBe(5);
    expect(merged[0].unsettledPreviewAdd).toBe(2);
  });

  test("mergeEndLiveRowsWithScorecard settled flag zeros unsettled Dev/STRUGGLE adds", () => {
    const stats = scorecardStatsByCharFromXpEntries([
      { character: 1, trigger: "STRUGGLE", xp_gained: 1 },
    ]);
    const rows = [
      {
        characterId: 1,
        name: "PC",
        playbookWouldGrant: 0,
        struggleWouldGrant: 2,
        developmentPoolXp: 3,
        manualSessionXp: 0,
        totalSessionXpPreview: 5,
      },
    ];
    const merged = mergeEndLiveRowsWithScorecard(rows, stats, true);
    expect(merged[0].struggleToggleCount).toBe(1);
    expect(merged[0].totalSessionXpPreview).toBe(1);
    expect(merged[0].unsettledPreviewAdd).toBe(0);
  });
});

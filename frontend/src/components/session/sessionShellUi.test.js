import {
  groupSessionNpcsByFaction,
  npcIdsEqual,
  resolveNpcFactionId,
  sessionInvolvedNpcIds,
} from "./sessionShellUi";

describe("sessionShellUi npc roster helpers", () => {
  it("npcIdsEqual coerces string and number ids", () => {
    expect(npcIdsEqual("12", 12)).toBe(true);
    expect(npcIdsEqual(12, "12")).toBe(true);
    expect(npcIdsEqual(12, 13)).toBe(false);
  });

  it("resolveNpcFactionId accepts pk, string, and nested object", () => {
    expect(resolveNpcFactionId({ faction: 4 })).toBe(4);
    expect(resolveNpcFactionId({ faction: "4" })).toBe(4);
    expect(resolveNpcFactionId({ faction: { id: 7, name: "Triad" } })).toBe(7);
    expect(resolveNpcFactionId({ faction_id: 9 })).toBe(9);
    expect(resolveNpcFactionId({})).toBeNull();
  });

  it("sessionInvolvedNpcIds normalizes involvement rows", () => {
    expect(
      sessionInvolvedNpcIds([{ npc: "1" }, { npc: 2 }, { npc: null }]),
    ).toEqual(new Set([1, 2]));
  });

  it("groupSessionNpcsByFaction uses faction.npcs and keeps empty factions", () => {
    const campaign = {
      factions: [
        { id: 1, name: "Alpha", npcs: [{ id: 10, name: "A" }] },
        { id: 2, name: "Beta", npcs: [] },
      ],
    };
    const campaignNPCs = [
      { id: "10", name: "A", faction: 1 },
      { id: 11, name: "B", faction: 2 },
    ];
    const npcInvolvements = [{ npc: "10" }, { npc: 11 }];

    const { factionPairs, ungrouped } = groupSessionNpcsByFaction(
      campaign,
      campaignNPCs,
      npcInvolvements,
    );

    expect(factionPairs.map(([id, list]) => [id, list.map((n) => Number(n.id))])).toEqual([
      [1, [10]],
      [2, [11]],
    ]);
    expect(ungrouped).toEqual([]);
  });
});

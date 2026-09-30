import {
  filterFactionRosterForPlayerView,
  filterSessionFactionPairsForPlayer,
} from "./rosterShared.js";

describe("filterFactionRosterForPlayerView", () => {
  const seen = { id: 1, name: "Seen", visible_to_players: true };
  const hiddenMember = { id: 2, name: "Hidden", visible_to_players: false };
  const fromHiddenFac = { id: 3, name: "Lone", visible_to_players: true };
  const orphan = { id: 4, name: "Orphan", visible_to_players: true };
  const orphanHidden = { id: 5, name: "Ghost", visible_to_players: false };

  test("promotes See-on NPCs from hidden factions into unaffiliated", () => {
    const { factionGroups, unaffiliated } = filterFactionRosterForPlayerView(
      [
        {
          faction: {
            id: 10,
            name: "Shown",
            visible_to_players: true,
            players_see_npcs: true,
          },
          npcs: [seen, hiddenMember],
        },
        {
          faction: {
            id: 11,
            name: "Secret",
            visible_to_players: false,
            players_see_npcs: true,
          },
          npcs: [fromHiddenFac],
        },
      ],
      [orphan, orphanHidden],
    );
    expect(factionGroups).toHaveLength(1);
    expect(factionGroups[0].npcs.map((n) => n.id)).toEqual([1]);
    expect(unaffiliated.map((n) => n.id).sort()).toEqual([3, 4]);
  });

  test("promotes members when players_see_npcs is false but keeps faction card", () => {
    const { factionGroups, unaffiliated } = filterFactionRosterForPlayerView(
      [
        {
          faction: {
            id: 10,
            name: "Shown",
            visible_to_players: true,
            players_see_npcs: false,
          },
          npcs: [seen, hiddenMember],
        },
      ],
      [],
    );
    expect(factionGroups).toHaveLength(1);
    expect(factionGroups[0].npcs).toEqual([]);
    expect(unaffiliated.map((n) => n.id)).toEqual([1]);
  });
});

describe("filterSessionFactionPairsForPlayer", () => {
  test("moves See-on NPCs from hidden factions into ungrouped", () => {
    const { factionPairs, ungrouped } = filterSessionFactionPairsForPlayer(
      [
        [10, [{ id: 1, visible_to_players: true }]],
        [11, [{ id: 2, visible_to_players: true }]],
      ],
      {
        10: { visible_to_players: true, players_see_npcs: true },
        11: { visible_to_players: false, players_see_npcs: true },
      },
      [{ id: 3, visible_to_players: true }],
    );
    expect(factionPairs).toEqual([[10, [{ id: 1, visible_to_players: true }]]]);
    expect(ungrouped.map((n) => n.id).sort()).toEqual([2, 3]);
  });
});

import {
  clampHelpPopoverBox,
  groupCampaignNpcsByFaction,
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

  it("groupCampaignNpcsByFaction keeps nested faction.npcs even if missing from campaign_npcs", () => {
    const campaign = {
      factions: [
        {
          id: 1,
          name: "Alpha",
          npcs: [{ id: 10, name: "NestedOnly" }],
        },
        { id: 2, name: "Beta", npcs: [] },
      ],
      campaign_npcs: [{ id: 11, name: "Unaffiliated" }],
    };
    const { factionGroups, unaffiliated } = groupCampaignNpcsByFaction(campaign);
    expect(
      factionGroups.map(({ faction, npcs }) => [
        Number(faction.id),
        npcs.map((n) => Number(n.id)),
      ]),
    ).toEqual([
      [1, [10]],
      [2, []],
    ]);
    expect(unaffiliated.map((n) => Number(n.id))).toEqual([11]);
  });

  it("groupCampaignNpcsByFaction merges campaign_npcs by resolveNpcFactionId", () => {
    const campaign = {
      factions: [{ id: 1, name: "Alpha", npcs: [{ id: 10, name: "A" }] }],
      campaign_npcs: [
        { id: 10, name: "A", faction: 1 },
        { id: 12, name: "RosterOnly", faction: 1 },
        { id: 13, name: "Free" },
      ],
    };
    const { factionGroups, unaffiliated } = groupCampaignNpcsByFaction(campaign);
    expect(factionGroups[0].npcs.map((n) => Number(n.id)).sort()).toEqual([
      10, 12,
    ]);
    expect(unaffiliated.map((n) => Number(n.id))).toEqual([13]);
  });
});

describe("clampHelpPopoverBox", () => {
  const viewport = { width: 360, height: 700 };

  it("shifts a left-edge tip back inside the window", () => {
    const box = clampHelpPopoverBox(
      { left: 40, right: 62, top: 400, bottom: 422 },
      viewport,
      80,
    );
    const viewLeft = 40 + box.left;
    expect(viewLeft).toBeGreaterThanOrEqual(8);
    expect(viewLeft + box.width).toBeLessThanOrEqual(viewport.width - 8);
  });

  it("keeps a right-side tip aligned to the button when it fits", () => {
    const box = clampHelpPopoverBox(
      { left: 900, right: 922, top: 80, bottom: 102 },
      { width: 1200, height: 800 },
      80,
    );
    expect(900 + box.left + box.width).toBe(922);
    expect(box.flipUp).toBe(false);
  });

  it("shrinks to the window and flips above when the bottom is tight", () => {
    const narrow = { width: 220, height: 200 };
    const box = clampHelpPopoverBox(
      { left: 180, right: 202, top: 160, bottom: 182 },
      narrow,
      140,
    );
    const viewLeft = 180 + box.left;
    expect(box.width).toBe(220 - 16);
    expect(viewLeft).toBeGreaterThanOrEqual(8);
    expect(viewLeft + box.width).toBeLessThanOrEqual(narrow.width - 8);
    expect(box.flipUp).toBe(true);
  });
});

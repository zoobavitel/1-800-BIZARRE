import {
  campaignHomeSortTier,
  compareCampaignsForHome,
  sortCampaignsForHome,
  visibleCampaignsForHome,
  characterHomeSortTier,
  sortCharactersForHome,
  visibleCharactersForHome,
  npcHomeSortTier,
  sortNpcsForHome,
  visibleNpcsForHome,
  buildGmFactionGroupsForHome,
  isCampaignGmForUser,
  visibleFactionGroupsForHome,
} from "./homeCampaignSort";

describe("campaignHomeSortTier", () => {
  test("live session is tier 0", () => {
    expect(
      campaignHomeSortTier({
        is_active: true,
        active_session_detail: { id: 1, name: "Session 2" },
      }),
    ).toBe(0);
    expect(
      campaignHomeSortTier({
        is_active: true,
        active_session: 3,
      }),
    ).toBe(0);
  });

  test("active without session is tier 1", () => {
    expect(campaignHomeSortTier({ is_active: true })).toBe(1);
    expect(campaignHomeSortTier({ name: "idle" })).toBe(1);
  });

  test("deactivated is tier 2 even with stale active_session", () => {
    expect(
      campaignHomeSortTier({
        is_active: false,
        active_session: 9,
        active_session_detail: { id: 9 },
      }),
    ).toBe(2);
  });
});

describe("sortCampaignsForHome", () => {
  test("orders live, then idle active, then deactivated", () => {
    const input = [
      { id: 1, name: "Zebra Idle", is_active: true },
      { id: 2, name: "Alpha Done", is_active: false },
      {
        id: 3,
        name: "Mike Live",
        is_active: true,
        active_session_detail: { id: 10 },
      },
    ];
    const sorted = sortCampaignsForHome(input);
    expect(sorted.map((c) => c.id)).toEqual([3, 1, 2]);
  });

  test("same-tier alphabetical by name", () => {
    const sorted = sortCampaignsForHome([
      { id: 2, name: "bravo", is_active: true },
      { id: 1, name: "Alpha", is_active: true },
      { id: 3, name: "Charlie", is_active: true },
    ]);
    expect(sorted.map((c) => c.name)).toEqual(["Alpha", "bravo", "Charlie"]);
  });

  test("same name falls back to id", () => {
    const sorted = sortCampaignsForHome([
      { id: 5, name: "Same", is_active: true },
      { id: 2, name: "Same", is_active: true },
    ]);
    expect(sorted.map((c) => c.id)).toEqual([2, 5]);
  });

  test("does not mutate input array", () => {
    const input = [
      { id: 2, name: "B", is_active: true },
      { id: 1, name: "A", is_active: true },
    ];
    const copy = [...input];
    sortCampaignsForHome(input);
    expect(input).toEqual(copy);
  });

  test("handles null/undefined list", () => {
    expect(sortCampaignsForHome(null)).toEqual([]);
    expect(sortCampaignsForHome(undefined)).toEqual([]);
  });
});

describe("compareCampaignsForHome", () => {
  test("returns negative when a should come first", () => {
    expect(
      compareCampaignsForHome(
        { id: 1, name: "A", is_active: true, active_session: 1 },
        { id: 2, name: "B", is_active: true },
      ),
    ).toBeLessThan(0);
  });
});

describe("visibleCampaignsForHome", () => {
  const campaigns = [
    { id: 1, name: "Idle", is_active: true },
    { id: 2, name: "Done", is_active: false },
    {
      id: 3,
      name: "Live",
      is_active: true,
      active_session_detail: { id: 10 },
    },
  ];

  test("collapsed shows first three in priority order", () => {
    const more = [
      ...campaigns,
      { id: 4, name: "Zebra Idle", is_active: true },
      {
        id: 5,
        name: "Alpha Live",
        is_active: true,
        active_session: 2,
      },
    ];
    const { visible, hiddenCount } = visibleCampaignsForHome(more);
    expect(visible.map((c) => c.id)).toEqual([5, 3, 1]);
    expect(hiddenCount).toBe(2);
  });

  test("collapsed shows all when fewer than limit", () => {
    const { visible, hiddenCount } = visibleCampaignsForHome(campaigns);
    expect(visible.map((c) => c.id)).toEqual([3, 1, 2]);
    expect(hiddenCount).toBe(0);
  });

  test("expanded shows full sorted list", () => {
    const { visible, hiddenCount } = visibleCampaignsForHome(campaigns, {
      expanded: true,
    });
    expect(visible.map((c) => c.id)).toEqual([3, 1, 2]);
    expect(hiddenCount).toBe(0);
  });
});

describe("characterHomeSortTier", () => {
  const campaigns = [
    {
      id: 10,
      is_active: true,
      active_session: 1,
      campaign_characters: [{ id: 1 }],
    },
    {
      id: 11,
      is_active: true,
      campaign_characters: [{ id: 2 }],
    },
    {
      id: 12,
      is_active: false,
      campaign_characters: [{ id: 3 }],
    },
  ];

  test("live campaign roster is tier 0", () => {
    expect(characterHomeSortTier({ id: 1 }, campaigns)).toBe(0);
  });

  test("active idle campaign roster is tier 1", () => {
    expect(characterHomeSortTier({ id: 2 }, campaigns)).toBe(1);
  });

  test("inactive-only or unassigned is tier 2", () => {
    expect(characterHomeSortTier({ id: 3 }, campaigns)).toBe(2);
    expect(characterHomeSortTier({ id: 99 }, campaigns)).toBe(2);
  });
});

describe("visibleCharactersForHome", () => {
  const campaigns = [
    {
      id: 10,
      is_active: true,
      active_session_detail: { id: 1 },
      campaign_characters: [{ id: 1 }],
    },
    {
      id: 11,
      is_active: true,
      campaign_characters: [{ id: 2 }],
    },
  ];
  const characters = [
    { id: 3, name: "Old" },
    { id: 2, name: "ActiveIdle" },
    { id: 1, name: "LivePC" },
  ];

  test("sorts live then active then older", () => {
    expect(sortCharactersForHome(characters, campaigns).map((c) => c.id)).toEqual([
      1, 2, 3,
    ]);
  });

  test("collapsed shows first three in priority order including unassigned", () => {
    const more = [
      ...characters,
      { id: 4, name: "Zed" },
      { id: 5, name: "Amy" },
    ];
    const { visible, hiddenCount } = visibleCharactersForHome(more, campaigns);
    expect(visible.map((c) => c.id)).toEqual([1, 2, 5]);
    expect(hiddenCount).toBe(2);
  });

  test("collapsed shows all when fewer than limit", () => {
    const { visible, hiddenCount } = visibleCharactersForHome(
      characters,
      campaigns,
    );
    expect(visible.map((c) => c.id)).toEqual([1, 2, 3]);
    expect(hiddenCount).toBe(0);
  });

  test("collapsed still shows unassigned when no campaign roster hits", () => {
    const onlyUnassigned = [
      { id: 9, name: "Toto" },
      { id: 8, name: "Beta" },
      { id: 7, name: "Alpha" },
      { id: 6, name: "Gamma" },
    ];
    const { visible, hiddenCount } = visibleCharactersForHome(
      onlyUnassigned,
      [],
    );
    expect(visible.map((c) => c.id)).toEqual([7, 8, 6]);
    expect(hiddenCount).toBe(1);
  });

  test("expanded shows all sorted", () => {
    const { visible, hiddenCount } = visibleCharactersForHome(
      characters,
      campaigns,
      { expanded: true },
    );
    expect(visible.map((c) => c.id)).toEqual([1, 2, 3]);
    expect(hiddenCount).toBe(0);
  });
});

describe("npcHomeSortTier", () => {
  const campaigns = [
    {
      id: 10,
      is_active: true,
      active_session: 1,
      campaign_npcs: [{ id: 1 }],
    },
    {
      id: 11,
      is_active: true,
      campaign_npcs: [{ id: 2 }],
    },
    {
      id: 12,
      is_active: false,
      campaign_npcs: [{ id: 3 }],
    },
  ];

  test("live campaign npc is tier 0", () => {
    expect(npcHomeSortTier({ id: 1 }, campaigns)).toBe(0);
  });

  test("active idle campaign npc is tier 1", () => {
    expect(npcHomeSortTier({ id: 2 }, campaigns)).toBe(1);
  });

  test("inactive-only or unassigned is tier 2", () => {
    expect(npcHomeSortTier({ id: 3 }, campaigns)).toBe(2);
    expect(npcHomeSortTier({ id: 99 }, campaigns)).toBe(2);
  });

  test("npc.campaign id matches campaign without roster entry", () => {
    expect(
      npcHomeSortTier(
        { id: 50, campaign: 10 },
        [
          {
            id: 10,
            is_active: true,
            active_session_detail: { id: 1 },
            campaign_npcs: [],
          },
        ],
      ),
    ).toBe(0);
  });
});

describe("visibleNpcsForHome", () => {
  const campaigns = [
    {
      id: 10,
      is_active: true,
      active_session_detail: { id: 1 },
      campaign_npcs: [{ id: 1 }],
    },
    {
      id: 11,
      is_active: true,
      campaign_npcs: [{ id: 2 }],
    },
  ];
  const npcs = [
    { id: 3, name: "Old" },
    { id: 2, name: "ActiveIdle" },
    { id: 1, name: "LiveNPC" },
  ];

  test("sorts live then active then older", () => {
    expect(sortNpcsForHome(npcs, campaigns).map((n) => n.id)).toEqual([
      1, 2, 3,
    ]);
  });

  test("collapsed shows first three in priority order including unassigned", () => {
    const more = [
      ...npcs,
      { id: 4, name: "Zed" },
      { id: 5, name: "Amy" },
    ];
    const { visible, hiddenCount } = visibleNpcsForHome(more, campaigns);
    expect(visible.map((n) => n.id)).toEqual([1, 2, 5]);
    expect(hiddenCount).toBe(2);
  });

  test("collapsed shows all when fewer than limit", () => {
    const { visible, hiddenCount } = visibleNpcsForHome(npcs, campaigns);
    expect(visible.map((n) => n.id)).toEqual([1, 2, 3]);
    expect(hiddenCount).toBe(0);
  });

  test("expanded shows all sorted", () => {
    const { visible, hiddenCount } = visibleNpcsForHome(npcs, campaigns, {
      expanded: true,
    });
    expect(visible.map((n) => n.id)).toEqual([1, 2, 3]);
    expect(hiddenCount).toBe(0);
  });
});

describe("visibleFactionGroupsForHome", () => {
  const gm = { id: 1 };
  const campaigns = [
    {
      id: 11,
      name: "Idle Camp",
      is_active: true,
      gm,
      factions: [
        { id: 20, name: "Zebra" },
        { id: 21, name: "Alpha" },
      ],
    },
    {
      id: 10,
      name: "Live Camp",
      is_active: true,
      active_session_detail: { id: 1 },
      gm,
      factions: [
        { id: 10, name: "Beta" },
        { id: 11, name: "Gamma" },
        { id: 12, name: "Delta" },
      ],
    },
    {
      id: 12,
      name: "Other GM",
      is_active: true,
      gm: { id: 99 },
      factions: [{ id: 99, name: "Skip" }],
    },
  ];

  test("buildGmFactionGroupsForHome orders live campaigns first and sorts factions", () => {
    const groups = buildGmFactionGroupsForHome(campaigns, 1);
    expect(groups.map((g) => g.campaign.id)).toEqual([10, 11]);
    expect(groups[0].factions.map((f) => f.id)).toEqual([10, 12, 11]);
    expect(groups[1].factions.map((f) => f.id)).toEqual([21, 20]);
  });

  test("excludes player-only campaigns even when they nest factions", () => {
    const groups = buildGmFactionGroupsForHome(campaigns, 1);
    expect(groups.some((g) => g.campaign.id === 12)).toBe(false);
    expect(groups.flatMap((g) => g.factions.map((f) => f.id))).not.toContain(99);
  });

  test("matches gm id when user id is a string", () => {
    const groups = buildGmFactionGroupsForHome(campaigns, "1");
    expect(groups.map((g) => g.campaign.id)).toEqual([10, 11]);
  });

  test("isCampaignGmForUser accepts bare gm id", () => {
    expect(isCampaignGmForUser({ gm: 7 }, 7)).toBe(true);
    expect(isCampaignGmForUser({ gm: 7 }, "7")).toBe(true);
    expect(isCampaignGmForUser({ gm: 7 }, 8)).toBe(false);
  });

  test("collapsed shows first three factions across groups", () => {
    const groups = buildGmFactionGroupsForHome(campaigns, 1);
    const { visible, hiddenCount } = visibleFactionGroupsForHome(groups);
    expect(visible.map((g) => g.campaign.id)).toEqual([10]);
    expect(visible[0].factions.map((f) => f.id)).toEqual([10, 12, 11]);
    expect(hiddenCount).toBe(2);
  });

  test("expanded shows all groups", () => {
    const groups = buildGmFactionGroupsForHome(campaigns, 1);
    const { visible, hiddenCount } = visibleFactionGroupsForHome(groups, {
      expanded: true,
    });
    expect(visible.map((g) => g.campaign.id)).toEqual([10, 11]);
    expect(hiddenCount).toBe(0);
  });
});

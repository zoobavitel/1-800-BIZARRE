import {
  campaignHomeSortTier,
  compareCampaignsForHome,
  sortCampaignsForHome,
  visibleCampaignsForHome,
  characterHomeSortTier,
  sortCharactersForHome,
  visibleCharactersForHome,
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

  test("collapsed shows only live-session campaigns", () => {
    const { visible, hiddenCount } = visibleCampaignsForHome(campaigns);
    expect(visible.map((c) => c.id)).toEqual([3]);
    expect(hiddenCount).toBe(2);
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

  test("collapsed hides characters not on active campaigns", () => {
    const { visible, hiddenCount } = visibleCharactersForHome(
      characters,
      campaigns,
    );
    expect(visible.map((c) => c.id)).toEqual([1, 2]);
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

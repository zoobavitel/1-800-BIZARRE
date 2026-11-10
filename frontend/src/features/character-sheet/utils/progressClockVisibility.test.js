import {
  isGmManagedProgressClock,
  progressClockShowsPlayersBadge,
  normalizeCampaignGmId,
} from "./progressClockVisibility";

describe("progressClockVisibility", () => {
  test("normalizeCampaignGmId accepts object or number", () => {
    expect(normalizeCampaignGmId({ id: 7 })).toBe(7);
    expect(normalizeCampaignGmId(7)).toBe(7);
    expect(normalizeCampaignGmId(null)).toBe(null);
  });

  test("GM-created clock is GM-managed even when created_by is set", () => {
    expect(
      isGmManagedProgressClock({ created_by: 3, npc: null }, 3),
    ).toBe(true);
    expect(
      isGmManagedProgressClock({ created_by: 9, npc: null }, 3),
    ).toBe(false);
  });

  test("NPC-linked clock is always GM-managed", () => {
    expect(
      isGmManagedProgressClock({ created_by: 9, npc: 12 }, 3),
    ).toBe(true);
  });

  test("null created_by is GM-managed", () => {
    expect(isGmManagedProgressClock({ created_by: null }, 3)).toBe(true);
  });

  test("players badge uses visible_to_players", () => {
    expect(
      progressClockShowsPlayersBadge(
        { created_by: 3, visible_to_players: true, visible_to_party: false },
        3,
      ),
    ).toBe(true);
  });

  test("players badge includes legacy GM visible_to_party mistoggle", () => {
    expect(
      progressClockShowsPlayersBadge(
        { created_by: 3, visible_to_players: false, visible_to_party: true },
        3,
      ),
    ).toBe(true);
    expect(
      progressClockShowsPlayersBadge(
        { created_by: 9, visible_to_players: false, visible_to_party: true },
        3,
      ),
    ).toBe(false);
  });
});

describe("clock audience (PC private clocks)", () => {
  const {
    clockAudience,
    clockAudiencePatch,
    clockPlayerOptions,
  } = require("./progressClockVisibility");

  it("reads a GM clock for picked players", () => {
    expect(clockAudience({ created_by: 1, visible_to: [3] }, 1)).toEqual({ all: false, ids: [3] });
  });

  it("GM clocks use visible_to_players, player clocks visible_to_party", () => {
    expect(clockAudiencePatch({ created_by: 1 }, 1, { all: true, ids: [] })).toEqual({
      visible_to_players: true, visible_to_party: false, visible_to: [],
    });
    expect(clockAudiencePatch({ created_by: 2 }, 1, { all: false, ids: [3, 3] })).toEqual({
      visible_to_party: false, visible_to: [3],
    });
  });

  it("lists campaign players with their PC, not the GM", () => {
    const campaign = {
      gm: { id: 1 },
      players: [{ id: 1, username: "gm" }, { id: 2, username: "player1" }, { id: 3, username: "player2" }],
      characters: [{ user: 2, true_name: "Ace" }],
    };
    expect(clockPlayerOptions(campaign)).toEqual([
      { id: 2, label: "player1 (Ace)" },
      { id: 3, label: "player2" },
    ]);
    expect(clockPlayerOptions(campaign, 2)).toEqual([{ id: 3, label: "player2" }]);
  });
});

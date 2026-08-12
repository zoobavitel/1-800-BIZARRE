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

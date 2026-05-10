import { derivePartyFacingSessionNpc } from "./sessionNpcPartyFace";

describe("derivePartyFacingSessionNpc", () => {
  test("passes through rows without GM visibility flags (player payload)", () => {
    const npc = {
      id: 1,
      name: "Rival",
      stand_coin_stats: { POWER: "B" },
      abilities: [{ name: "X" }],
    };
    const { display, showCard } = derivePartyFacingSessionNpc(npc);
    expect(showCard).toBe(true);
    expect(display).toBe(npc);
  });

  test("hides everything for GM row when all session toggles off", () => {
    const npc = {
      id: 2,
      name: "Test NPC",
      stand_name: "Stand",
      stand_coin_stats: { POWER: "A", SPEED: "C" },
      abilities: [{ name: "A1" }],
      vulnerability_clock_current: 0,
      vulnerability_clock_max: 8,
      conflict_clocks: [],
      alt_clocks: [],
      progress_clocks: [],
      show_clocks_to_players: false,
      show_vulnerability_clock_to_players: false,
      show_stand_coin_to_players: false,
      show_all_abilities_to_players: false,
      revealed_conflict_clock_names: [],
      revealed_alt_clock_names: [],
      revealed_progress_clock_ids: [],
      revealed_stand_coin_stats: [],
      revealed_ability_names: [],
    };
    const { display, showCard } = derivePartyFacingSessionNpc(npc);
    expect(showCard).toBe(false);
    expect(Object.keys(display.stand_coin_stats)).toHaveLength(0);
    expect(display.abilities).toEqual([]);
    expect(display.vulnerability_clock_max).toBe(0);
  });

  test("shows vuln only when vulnerability flag set without master clocks", () => {
    const npc = {
      id: 3,
      name: "Boss",
      stand_coin_stats: {},
      abilities: [],
      vulnerability_clock_current: 3,
      vulnerability_clock_max: 8,
      conflict_clocks: [],
      alt_clocks: [],
      progress_clocks: [],
      show_clocks_to_players: false,
      show_vulnerability_clock_to_players: true,
      show_stand_coin_to_players: false,
      show_all_abilities_to_players: false,
      revealed_conflict_clock_names: [],
      revealed_alt_clock_names: [],
      revealed_progress_clock_ids: [],
      revealed_stand_coin_stats: [],
      revealed_ability_names: [],
    };
    const { display, showCard } = derivePartyFacingSessionNpc(npc);
    expect(showCard).toBe(true);
    expect(display.vulnerability_clock_max).toBe(8);
    expect(display.vulnerability_clock_current).toBe(3);
  });
});

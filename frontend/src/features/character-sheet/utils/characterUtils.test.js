import {
  computeActionDotBudget,
  createDefaultCharacter,
  getCharacterCrewId,
  resolveHeritagePkForSave,
  rosterHasLinkedCrewForCrewSheetFactionUi,
  resolveCharacterCampaignContext,
  isUserCampaignGmForCharacter,
  isGmViewingPlayerCharacterSheet,
  isStandCoinChargenEditable,
  resolveCrewFromCampaign,
  normalizeCrewFromCharacter,
} from "./characterUtils";

const list = [
  { id: 1, name: "Human" },
  { id: 2, name: "Rock Human" },
  { id: 3, name: "Vampire" },
];

describe("resolveHeritagePkForSave", () => {
  test("throws when heritageList is empty", () => {
    expect(() => resolveHeritagePkForSave(1, [])).toThrow(
      /Could not resolve heritage: heritages unavailable/,
    );
    expect(() => resolveHeritagePkForSave(1, null)).toThrow(
      /Could not resolve heritage: heritages unavailable/,
    );
  });

  test("throws when first row has invalid id", () => {
    expect(() =>
      resolveHeritagePkForSave(1, [{ id: "x", name: "Bad" }]),
    ).toThrow(/Could not resolve heritage: heritages unavailable/);
  });

  test("returns finite number as-is", () => {
    expect(resolveHeritagePkForSave(2, list)).toBe(2);
  });

  test("coerces digit string", () => {
    expect(resolveHeritagePkForSave("3", list)).toBe(3);
  });

  test("resolves name case-insensitively", () => {
    expect(resolveHeritagePkForSave("rock human", list)).toBe(2);
    expect(resolveHeritagePkForSave("VAMPIRE", list)).toBe(3);
  });

  test("null and empty string fall back to first PK", () => {
    expect(resolveHeritagePkForSave(null, list)).toBe(1);
    expect(resolveHeritagePkForSave("", list)).toBe(1);
  });

  test("non-matching string falls back to first PK", () => {
    expect(resolveHeritagePkForSave("Unknown Lineage", list)).toBe(1);
  });

  test("coerces string id on match", () => {
    expect(
      resolveHeritagePkForSave("Rock Human", [
        { id: "2", name: "Rock Human" },
        { id: 1, name: "Human" },
      ]),
    ).toBe(2);
  });
});

describe("createDefaultCharacter", () => {
  test("starts with no abilities, no name, and a valid six-D coin baseline", () => {
    const c = createDefaultCharacter();
    expect(c.abilities).toEqual([]);
    expect(c.standStats).toEqual({
      power: 1,
      speed: 1,
      range: 1,
      durability: 1,
      precision: 1,
      development: 1,
    });
    expect(c.stress).toHaveLength(9);
    expect(c.name).toBe("");
    expect(c.heritage).toBe(null);
    expect(c.campaign).toBe(null);
  });

  test("accepts campaign override for roster create", () => {
    expect(createDefaultCharacter({ campaign: 9 }).campaign).toBe(9);
  });
});

describe("getCharacterCrewId / rosterHasLinkedCrewForCrewSheetFactionUi", () => {
  test("reads crew_id or nested crew.id", () => {
    expect(getCharacterCrewId({ crew_id: 7 })).toBe(7);
    expect(getCharacterCrewId({ crew: { id: 9 } })).toBe(9);
    expect(getCharacterCrewId({ crew: 12 })).toBe(12);
    expect(getCharacterCrewId({})).toBeNull();
  });

  test("roster gate is true when any PC has a positive crew PK", () => {
    expect(rosterHasLinkedCrewForCrewSheetFactionUi([])).toBe(false);
    expect(rosterHasLinkedCrewForCrewSheetFactionUi([{ id: 1 }])).toBe(false);
    expect(
      rosterHasLinkedCrewForCrewSheetFactionUi([
        { id: 1 },
        { id: 2, crew_id: 5 },
      ]),
    ).toBe(true);
  });
});

describe("isStandCoinChargenEditable", () => {
  test("owner Stand sheet stays editable after action dots if no XP coin ranks", () => {
    expect(
      isStandCoinChargenEditable({
        canEditSheet: true,
        hasStandPlaybook: true,
        standCoinPointsGained: 0,
      }),
    ).toBe(true);
  });

  test("locks after XP-bought Stand Coin points", () => {
    expect(
      isStandCoinChargenEditable({
        canEditSheet: true,
        hasStandPlaybook: true,
        standCoinPointsGained: 2,
      }),
    ).toBe(false);
  });
});

describe("computeActionDotBudget", () => {
  test("uses the larger of server gained dots and actual saved dot total", () => {
    const budget = computeActionDotBudget({
      actionDiceGained: 0,
      actionRatings: {
        HUNT: 2,
        STUDY: 1,
        SURVEY: 1,
        TINKER: 1,
        FINESSE: 1,
        PROWL: 1,
        SKIRMISH: 1,
        WRECK: 1,
        BIZARRE: 1,
        COMMAND: 0,
        CONSORT: 0,
        SWAY: 0,
      },
    });

    expect(budget.totalActionDots).toBe(10);
    expect(budget.actionDotsFromXp).toBe(3);
    expect(budget.maxActionDotsBudget).toBe(10);
    expect(budget.dotsRemaining).toBe(0);
  });
});

describe("resolveCharacterCampaignContext / GM undo row visibility", () => {
  const campaigns = [
    {
      id: 10,
      gm: { id: 99 },
      active_session: null,
      campaign_characters: [{ id: 42, user_id: 7 }],
    },
  ];

  test("finds campaign via roster when character.campaign FK unset", () => {
    const ctx = resolveCharacterCampaignContext({ id: 42, campaign: null }, campaigns);
    expect(ctx.campaignId).toBe(10);
    expect(ctx.campaignRecord?.id).toBe(10);
  });

  test("GM on player PC with no active session", () => {
    const character = { id: 42, campaign: null, user_id: 7 };
    const ctx = resolveCharacterCampaignContext(character, campaigns);
    const isCampaignGm = isUserCampaignGmForCharacter(
      { id: 99 },
      { campaignRecord: ctx.campaignRecord, campaignId: ctx.campaignId },
    );
    expect(isCampaignGm).toBe(true);
    expect(
      isGmViewingPlayerCharacterSheet(
        { id: 99 },
        character,
        { isCampaignGm, campaignId: ctx.campaignId },
      ),
    ).toBe(true);
  });

  test("hidden on GM own PC", () => {
    const character = { id: 42, campaign: null, user_id: 99 };
    const ctx = resolveCharacterCampaignContext(character, campaigns);
    const isCampaignGm = isUserCampaignGmForCharacter(
      { id: 99 },
      { campaignRecord: ctx.campaignRecord, campaignId: ctx.campaignId },
    );
    expect(
      isGmViewingPlayerCharacterSheet(
        { id: 99 },
        character,
        { isCampaignGm, campaignId: ctx.campaignId },
      ),
    ).toBe(false);
  });
});

describe("mergeServerOwnedCharacterFields", () => {
  const {
    mergeServerOwnedCharacterFields,
  } = require("./characterUtils");

  const local = {
    name: "Draft",
    stressFilled: 4,
    trauma: { COLD: false },
    clocks: [{ id: 1, filled: 2 }],
  };
  const server = {
    name: "Server",
    stressFilled: 8,
    trauma: { COLD: true },
    clocks: [],
  };

  test("overlays server stress and trauma when those fields were not touched", () => {
    const next = mergeServerOwnedCharacterFields(local, server, {});
    expect(next.stressFilled).toBe(8);
    expect(next.trauma).toEqual({ COLD: true });
    expect(next.clocks).toEqual([{ id: 1, filled: 2 }]);
    expect(next.name).toBe("Draft");
  });

  test("keeps local stress when the player touched the stress track", () => {
    const next = mergeServerOwnedCharacterFields(local, server, {
      stress: true,
    });
    expect(next.stressFilled).toBe(4);
    expect(next.trauma).toEqual({ COLD: true });
  });

  test("keeps local trauma when the player touched trauma", () => {
    const next = mergeServerOwnedCharacterFields(local, server, {
      trauma: true,
    });
    expect(next.stressFilled).toBe(8);
    expect(next.trauma).toEqual({ COLD: false });
  });

  test("keeps local healing clock when recover roll marked healingClock touched", () => {
    const localWithHeal = {
      ...local,
      healingClock: 2,
      healingClockSegments: 5,
    };
    const serverStale = {
      ...server,
      healingClock: 0,
      healingClockSegments: 5,
    };
    const untouched = mergeServerOwnedCharacterFields(
      localWithHeal,
      serverStale,
      {},
    );
    expect(untouched.healingClock).toBe(0);
    const touched = mergeServerOwnedCharacterFields(localWithHeal, serverStale, {
      healingClock: true,
    });
    expect(touched.healingClock).toBe(2);
    expect(touched.healingClockSegments).toBe(5);
  });
});

describe("server-owned field hydration guards", () => {
  test("shouldSkipServerOwnedFieldHydration blocks poll overwrite when field touched", () => {
    const { shouldSkipServerOwnedFieldHydration, SERVER_OWNED_FIELD_TOUCH_KEYS } =
      require("./characterUtils");
    expect(SERVER_OWNED_FIELD_TOUCH_KEYS).toContain("healingClock");
    expect(
      shouldSkipServerOwnedFieldHydration("healingClock", {
        fieldTouches: { healingClock: true },
      }),
    ).toBe(true);
    expect(
      shouldSkipServerOwnedFieldHydration("healingClock", {
        fieldTouches: {},
        sheetDraftIsDirty: true,
      }),
    ).toBe(true);
    expect(
      shouldSkipServerOwnedFieldHydration("healingClock", {
        fieldTouches: {},
        sheetDraftIsDirty: false,
      }),
    ).toBe(false);
  });

  test("computeHealingClockAfterSegments matches recover roll +1 band", () => {
    const { computeHealingClockAfterSegments } = require("./characterUtils");
    expect(
      computeHealingClockAfterSegments({
        currentFilled: 0,
        segmentsToAdd: 1,
        segmentCap: 5,
      }),
    ).toEqual({ nextFilled: 1, completions: 0 });
  });

  test("computeHealingClockAfterSegments counts full-clock harm downgrade", () => {
    const { computeHealingClockAfterSegments } = require("./characterUtils");
    expect(
      computeHealingClockAfterSegments({
        currentFilled: 3,
        segmentsToAdd: 2,
        segmentCap: 4,
      }),
    ).toEqual({ nextFilled: 1, completions: 1 });
  });
});

describe("playbook ability gating helpers", () => {
  test("level 1 abilities met at pcLevel 1", () => {
    const {
      playbookAbilityLevelMet,
      playbookAbilityRequirementLabel,
    } = require("./characterUtils");
    const ability = { required_a_count: 1, spin_type: "CAVALIER" };
    expect(playbookAbilityLevelMet(ability, 1)).toBe(true);
    expect(playbookAbilityRequirementLabel(ability, 1)).toBe("Level 1");
  });

  test("level 3 ability blocked at pcLevel 1", () => {
    const {
      playbookAbilityLevelMet,
      playbookAbilityRequirementLabel,
    } = require("./characterUtils");
    const ability = { required_a_count: 3, spin_type: "EXECUTIONER" };
    expect(playbookAbilityLevelMet(ability, 1)).toBe(false);
    expect(playbookAbilityRequirementLabel(ability, 1)).toContain(
      "Requires level 3",
    );
  });

  test("quota allows one non-foundation then blocks second", () => {
    const {
      canAddNonFoundationPlaybookAbility,
      playbookAbilitySlotBudget,
    } = require("./characterUtils");
    const abilities = [
      { type: "spin", id: 1, spin_type: "CAVALIER", required_a_count: 1 },
    ];
    const next = {
      type: "spin",
      id: 2,
      spin_type: "EXECUTIONER",
      required_a_count: 1,
    };
    expect(playbookAbilitySlotBudget([])).toBe(1);
    expect(
      canAddNonFoundationPlaybookAbility({
        abilities,
        ability: next,
        kind: "spin",
        xpAllocationRows: [],
      }),
    ).toBe(false);
    expect(
      canAddNonFoundationPlaybookAbility({
        abilities,
        ability: next,
        kind: "spin",
        xpAllocationRows: [
          { allocation_type: "LEVEL_UP_PLAYBOOK_ABILITY", undone_at: null },
        ],
      }),
    ).toBe(true);
  });
});

describe("playbook foundation auto-grant helpers", () => {
  test("mergePlaybookFoundationAbilities adds missing foundation rows", () => {
    const {
      mergePlaybookFoundationAbilities,
      abilitiesMissingPlaybookFoundations,
    } = require("./characterUtils");
    const catalog = [
      { id: 1, name: "Spin Base", spin_type: "FOUNDATION" },
      { id: 2, name: "Cavalier", spin_type: "CAVALIER", required_a_count: 1 },
    ];
    const abilities = [{ type: "standard", id: 9, name: "Bodyguard" }];
    expect(abilitiesMissingPlaybookFoundations(abilities, catalog, "spin")).toBe(
      true,
    );
    const merged = mergePlaybookFoundationAbilities(abilities, catalog, "spin");
    expect(merged).toHaveLength(2);
    expect(merged[1]).toMatchObject({
      id: 1,
      type: "spin",
      _playbookFoundation: true,
    });
    expect(abilitiesMissingPlaybookFoundations(merged, catalog, "spin")).toBe(
      false,
    );
  });

  test("isPlaybookFoundationAbility detects spin and hamon foundations", () => {
    const { isPlaybookFoundationAbility } = require("./characterUtils");
    expect(
      isPlaybookFoundationAbility({
        type: "spin",
        spin_type: "FOUNDATION",
      }),
    ).toBe(true);
    expect(
      isPlaybookFoundationAbility({
        type: "hamon",
        hamon_type: "FOUNDATION",
      }),
    ).toBe(true);
    expect(
      isPlaybookFoundationAbility({
        type: "spin",
        spin_type: "CAVALIER",
      }),
    ).toBe(false);
  });
});

describe("resolveCrewFromCampaign", () => {
  test("uses sole campaign crew when character has no crew yet", () => {
    const campaign = {
      id: 5,
      crews: [{ id: 12, name: "Speedwagon Foundation" }],
      campaign_characters: [{ id: 99, crew_id: null }],
    };
    expect(resolveCrewFromCampaign(campaign, 99, { id: 99 })).toEqual({
      crew: "Speedwagon Foundation",
      crewId: 12,
    });
  });

  test("maps roster crew_id to campaign crews name", () => {
    const campaign = {
      id: 5,
      crews: [{ id: 12, name: "Passione" }],
      campaign_characters: [{ id: 99, crew_id: 12, crew_name: "Passione" }],
    };
    expect(resolveCrewFromCampaign(campaign, 99, { id: 99 })).toEqual({
      crew: "Passione",
      crewId: 12,
    });
  });

  test("prefers character-linked crew when already hydrated", () => {
    const character = {
      id: 99,
      crew: { id: 3, name: "Existing Crew" },
    };
    expect(normalizeCrewFromCharacter(character)).toEqual({
      crew: "Existing Crew",
      crewId: 3,
    });
    expect(resolveCrewFromCampaign({ crews: [] }, 99, character)).toEqual({
      crew: "Existing Crew",
      crewId: 3,
    });
  });
});

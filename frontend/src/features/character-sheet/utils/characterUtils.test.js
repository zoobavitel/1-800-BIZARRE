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

import {
  transformFrontendToBackend,
  transformBackendToFrontend,
  playbookToBackend,
  secondaryPlaybookToBackend,
  hasPlaybook,
  formatPlaybookPair,
  normalizeListResponse,
  normalizeCharacterInventory,
  normalizeCoinBoxes,
  normalizeStashSlots,
  buildMultipartOrJson,
  isImageUploadPayload,
  sheetPostChargen,
} from "./api";
import { mergeAbilitiesPreferRicherCustoms } from "../utils/characterUtils";

/** Minimal sheet-like object for transform coverage (spin_playbook_abilities_ui). */
function makeSheet(overrides = {}) {
  const base = {
    name: "Test",
    standName: "Stand",
    heritage: 1,
    playbook: "Spin",
    background: "",
    look: "",
    vice: null,
    viceDetails: "",
    actionRatings: {
      HUNT: 1,
      STUDY: 0,
      SURVEY: 0,
      TINKER: 0,
      FINESSE: 0,
      PROWL: 0,
      SKIRMISH: 0,
      WRECK: 0,
      BIZARRE: 0,
      COMMAND: 0,
      CONSORT: 0,
      SWAY: 0,
    },
    standStats: {
      power: 0,
      speed: 0,
      range: 0,
      durability: 0,
      precision: 0,
      development: 0,
    },
    stressFilled: 0,
    stress: [],
    trauma: [],
    armor: { armor: false, heavy: false },
    harmEntries: {
      level4: [""],
      level3: [""],
      level2: ["", ""],
      level1: ["", ""],
    },
    xp: {},
    clocks: [],
    campaign: null,
    inventory: [],
    reputation_status: {},
    abilities: [],
  };
  return { ...base, ...overrides };
}

describe("normalizeCharacterInventory", () => {
  test("passes arrays through by reference", () => {
    const a = ["rope", { name: "coin", quantity: 2 }];
    expect(normalizeCharacterInventory(a)).toBe(a);
  });

  test("wraps non-array object as one-element array", () => {
    expect(normalizeCharacterInventory({ legacy: true })).toEqual([
      { legacy: true },
    ]);
  });

  test("empty array for null or primitives", () => {
    expect(normalizeCharacterInventory(null)).toEqual([]);
    expect(normalizeCharacterInventory(undefined)).toEqual([]);
    expect(normalizeCharacterInventory(3)).toEqual([]);
  });
});

describe("transformBackendToFrontend inventory", () => {
  test("normalizes legacy object inventory to array", () => {
    const fe = transformBackendToFrontend({
      inventory: { imported: "blob" },
    });
    expect(fe.inventory).toEqual([{ imported: "blob" }]);
  });
});

describe("transformFrontendToBackend inventory", () => {
  test("sends array through; coerces non-array via normalizer", () => {
    expect(
      transformFrontendToBackend(makeSheet({ inventory: ["a"] })).inventory,
    ).toEqual(["a"]);
    expect(
      transformFrontendToBackend(
        makeSheet({ inventory: { only: "one" } }),
      ).inventory,
    ).toEqual([{ only: "one" }]);
  });
});

describe("normalizeListResponse", () => {
  test("returns empty array for null and undefined", () => {
    expect(normalizeListResponse(null)).toEqual([]);
    expect(normalizeListResponse(undefined)).toEqual([]);
  });

  test("passes through plain arrays", () => {
    const arr = [{ id: 1 }, { id: 2 }];
    expect(normalizeListResponse(arr)).toBe(arr);
    expect(normalizeListResponse([])).toEqual([]);
  });

  test("unwraps paginated { results: [...] }", () => {
    const inner = [{ id: 3 }];
    expect(normalizeListResponse({ results: inner })).toBe(inner);
    expect(normalizeListResponse({ count: 0, results: [] })).toEqual([]);
  });

  test("returns empty array for unexpected shapes", () => {
    expect(normalizeListResponse({})).toEqual([]);
    expect(normalizeListResponse({ results: {} })).toEqual([]);
    expect(normalizeListResponse("oops")).toEqual([]);
    expect(normalizeListResponse(42)).toEqual([]);
  });
});

describe("transformFrontendToBackend playbook and playbook abilities", () => {
  test("playbookToBackend maps display labels to STAND/HAMON/SPIN", () => {
    expect(playbookToBackend("Stand")).toBe("STAND");
    expect(playbookToBackend("Hamon")).toBe("HAMON");
    expect(playbookToBackend("Spin")).toBe("SPIN");
    expect(playbookToBackend("SPIN")).toBe("SPIN");
  });

  test("secondaryPlaybookToBackend maps optional second slot", () => {
    expect(secondaryPlaybookToBackend("")).toBe(null);
    expect(secondaryPlaybookToBackend("Stand")).toBe("STAND");
    expect(secondaryPlaybookToBackend(null)).toBe(null);
  });

  test("hasPlaybook checks primary or secondary slot", () => {
    expect(hasPlaybook("Hamon", "Stand", "Stand")).toBe(true);
    expect(hasPlaybook("Hamon", "", "Stand")).toBe(false);
    expect(hasPlaybook("Hamon", "Spin", "Spin")).toBe(true);
  });

  test("formatPlaybookPair renders dual labels", () => {
    expect(formatPlaybookPair("Hamon", "")).toBe("Hamon");
    expect(formatPlaybookPair("Hamon", "Stand")).toBe("Hamon + Stand");
  });

  test("transform round-trips secondary_playbook", () => {
    const fe = transformBackendToFrontend({
      playbook: "HAMON",
      secondary_playbook: "STAND",
    });
    expect(fe.playbook).toBe("Hamon");
    expect(fe.secondaryPlaybook).toBe("Stand");
    const be = transformFrontendToBackend(
      makeSheet({ playbook: "Hamon", secondaryPlaybook: "Stand" }),
    );
    expect(be.playbook).toBe("HAMON");
    expect(be.secondary_playbook).toBe("STAND");
  });

  test("transform clears empty secondary_playbook on save", () => {
    const be = transformFrontendToBackend(
      makeSheet({ playbook: "Spin", secondaryPlaybook: "" }),
    );
    expect(be.secondary_playbook).toBe(null);
  });

  test("coerces heritage to integer PK or null (never passes display name strings)", () => {
    expect(
      transformFrontendToBackend(makeSheet({ heritage: 2 })).heritage,
    ).toBe(2);
    expect(
      transformFrontendToBackend(makeSheet({ heritage: "7" })).heritage,
    ).toBe(7);
    expect(
      transformFrontendToBackend(makeSheet({ heritage: "Human" })).heritage,
    ).toBe(null);
  });

  test("emits spin_ability_ids and hamon_ability_ids from abilities array", () => {
    const out = transformFrontendToBackend(
      makeSheet({
        abilities: [
          { id: 10, type: "standard", name: "S" },
          { id: 20, type: "spin", name: "Spin move" },
          { id: 30, type: "hamon", name: "Hamon move" },
        ],
      }),
    );
    expect(out.standard_abilities).toEqual([10]);
    expect(out.spin_ability_ids).toEqual([20]);
    expect(out.hamon_ability_ids).toEqual([30]);
  });

  test("emits coin_boxes from coin array", () => {
    const out = transformFrontendToBackend(
      makeSheet({ coin: [true, false, true, false] }),
    );
    expect(out.coin_boxes).toEqual([true, false, true, false]);
  });

  test("maps all harm boxes including slot2 and level4 to backend fields", () => {
    const out = transformFrontendToBackend(
      makeSheet({
        harm: {
          level4: ["Fatal wound"],
          level3: [""],
          level2: ["mod-a", "mod-b"],
          level1: ["l1a", "l1b"],
        },
      }),
    );
    expect(out.harm_level4_used).toBe(true);
    expect(out.harm_level4_name).toBe("Fatal wound");
    expect(out.harm_level1_used).toBe(true);
    expect(out.harm_level1_name).toBe("l1a");
    expect(out.harm_level1_slot2_used).toBe(true);
    expect(out.harm_level1_slot2_name).toBe("l1b");
    expect(out.harm_level2_used).toBe(true);
    expect(out.harm_level2_name).toBe("mod-a");
    expect(out.harm_level2_slot2_used).toBe(true);
    expect(out.harm_level2_slot2_name).toBe("mod-b");
  });

  test("clears custom ability payload when sheet has no custom abilities (after user removed them)", () => {
    const out = transformFrontendToBackend(
      makeSheet({
        abilities: [{ id: 1, type: "standard", name: "Only standard" }],
        extra_custom_abilities: [{ description: "stale" }],
        custom_ability_description: "stale",
      }),
    );
    expect(out.extra_custom_abilities).toEqual([]);
    expect(out.custom_ability_description).toBe("");
  });

  test("persists custom-single package even when advancement customs also present", () => {
    const out = transformFrontendToBackend(
      makeSheet({
        abilities: [
          {
            id: "advancement-9",
            type: "custom",
            name: "B→A grant",
            _uses: ["use a", "use b"],
            _fromAdvancement: true,
          },
          {
            id: "custom-single",
            type: "custom",
            name: "monkey",
            _uses: ["punch", "kick", "bite"],
          },
        ],
      }),
    );
    expect(out.custom_ability_type).toBe("single_with_3_uses");
    expect(out.custom_ability_description).toBe("monkey");
    expect(out.extra_custom_abilities).toEqual([
      { description: "punch" },
      { description: "kick" },
      { description: "bite" },
    ]);
  });

  test("pads short custom-single _uses so round-trip does not clear package", () => {
    const fe = transformBackendToFrontend({
      custom_ability_type: "single_with_3_uses",
      custom_ability_description: "monkey",
      extra_custom_abilities: [],
    });
    const custom = fe.abilities.find((a) => a.id === "custom-single");
    expect(custom).toBeTruthy();
    expect(custom._uses.length).toBe(3);
    const out = transformFrontendToBackend(makeSheet({ abilities: fe.abilities }));
    expect(out.custom_ability_description).toBe("monkey");
    expect(out.extra_custom_abilities).toHaveLength(3);
  });

  test("persists three separate custom abilities package", () => {
    const out = transformFrontendToBackend(
      makeSheet({
        abilities: [
          {
            id: "custom-0",
            type: "custom",
            name: "Ora",
            description: "Barrage",
          },
          {
            id: "custom-1",
            type: "custom",
            name: "Star Finger",
            description: "Extend",
          },
          {
            id: "custom-2",
            type: "custom",
            name: "Time Stop",
            description: "Za Warudo",
          },
        ],
      }),
    );
    expect(out.custom_ability_type).toBe("three_separate_uses");
    expect(out.extra_custom_abilities).toEqual([
      { name: "Ora", description: "Barrage" },
      { name: "Star Finger", description: "Extend" },
      { name: "Time Stop", description: "Za Warudo" },
    ]);
  });

  test("ignores only-advancement customs when deciding clear vs keep sheet fields", () => {
    const out = transformFrontendToBackend(
      makeSheet({
        abilities: [
          {
            id: "advancement-1",
            type: "custom",
            name: "Grant",
            _uses: ["a", "b"],
            _fromAdvancement: true,
          },
        ],
        custom_ability_description: "stale",
        extra_custom_abilities: [{ description: "stale" }],
      }),
    );
    expect(out.custom_ability_description).toBe("");
    expect(out.extra_custom_abilities).toEqual([]);
  });
});

describe("normalizeCoinBoxes and normalizeStashSlots", () => {
  test("normalizeCoinBoxes pads and truncates to 4 booleans", () => {
    expect(normalizeCoinBoxes(null)).toEqual([false, false, false, false]);
    expect(normalizeCoinBoxes([1, 0, 1])).toEqual([true, false, true, false]);
  });

  test("normalizeStashSlots pads to 40 booleans", () => {
    expect(normalizeStashSlots(undefined).length).toBe(40);
    expect(normalizeStashSlots([true])[0]).toBe(true);
    expect(normalizeStashSlots([true])[1]).toBe(false);
  });
});

describe("transformBackendToFrontend sheet notes and clocks", () => {
  test("maps background_note2 to sheetNotes", () => {
    const fe = transformBackendToFrontend({
      background_note2: "GM notes line",
    });
    expect(fe.sheetNotes).toBe("GM notes line");
  });

  test("normalizes progress_clocks max_segments / filled_segments to segments / filled", () => {
    const fe = transformBackendToFrontend({
      progress_clocks: [
        {
          id: 9,
          name: "Heat",
          max_segments: 6,
          filled_segments: 2,
          visible_to_party: true,
        },
      ],
    });
    expect(fe.clocks).toHaveLength(1);
    expect(fe.clocks[0].segments).toBe(6);
    expect(fe.clocks[0].filled).toBe(2);
    expect(fe.clocks[0].name).toBe("Heat");
  });

  test("save payload sends max_segments 7 and drops Date.now ids", () => {
    const be = transformFrontendToBackend(
      makeSheet({
        clocks: [{ id: 1750000000000, name: "Wannabe", segments: 7, filled: 0 }],
      }),
    );
    expect(be.progress_clocks).toHaveLength(1);
    expect(be.progress_clocks[0].max_segments).toBe(7);
    expect(be.progress_clocks[0].id).toBeUndefined();
  });

  test("maps sheetNotes to background_note2 on save payload", () => {
    const be = transformFrontendToBackend(
      makeSheet({ sheetNotes: "  spare sheet  " }),
    );
    expect(be.background_note2).toBe("  spare sheet  ");
  });
});

describe("transformBackendToFrontend coin and crew stash", () => {
  test("maps XP-bought action dot count", () => {
    const fe = transformBackendToFrontend({
      action_dice_gained: 4,
    });
    expect(fe.actionDiceGained).toBe(4);
  });

  test("maps camelCase XP-bought action dot count from frontend-shaped rows", () => {
    const fe = transformBackendToFrontend({
      actionDiceGained: 4,
    });
    expect(fe.actionDiceGained).toBe(4);
  });

  test("persists inferred XP-bought action dot count", () => {
    const be = transformFrontendToBackend(
      makeSheet({
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
      }),
    );
    expect(be.action_dice_gained).toBe(3);
  });

  test("maps coin_boxes and crew.stash_slots", () => {
    const fe = transformBackendToFrontend({
      coin_boxes: [true, false, false, false],
      crew: { stash_slots: Array.from({ length: 40 }, (_, i) => i === 0) },
    });
    expect(fe.coin).toEqual([true, false, false, false]);
    expect(fe.stash[0]).toBe(true);
    expect(fe.stash[1]).toBe(false);
    expect(fe.stash.length).toBe(40);
  });

  test("maps character stash_slots when no crew", () => {
    const fe = transformBackendToFrontend({
      stash_slots: Array.from({ length: 40 }, (_, i) => i === 3),
    });
    expect(fe.stash[3]).toBe(true);
    expect(fe.stash[0]).toBe(false);
  });

  test("prefers crew stash_slots over character when both exist", () => {
    const fe = transformBackendToFrontend({
      stash_slots: Array(40).fill(true),
      crew: {
        id: 1,
        stash_slots: Array.from({ length: 40 }, (_, i) => i === 0),
      },
    });
    expect(fe.stash[0]).toBe(true);
    expect(fe.stash[1]).toBe(false);
  });

  test("maps trauma from trauma_details names", () => {
    const fe = transformBackendToFrontend({
      trauma: [7],
      trauma_details: [{ id: 7, name: "Unstable", description: "" }],
    });
    expect(fe.trauma.UNSTABLE).toBe(true);
    expect(fe.trauma.COLD).toBe(false);
  });

  test("falls back to raw trauma IDs when trauma_details is empty", () => {
    const fe = transformBackendToFrontend({
      trauma: [7],
      trauma_details: [],
    });
    expect(fe.trauma.UNSTABLE).toBe(true);
  });

  test("accepts string trauma IDs from JSON", () => {
    const fe = transformBackendToFrontend({
      trauma: ["7"],
      trauma_details: [],
    });
    expect(fe.trauma.UNSTABLE).toBe(true);
  });

  test("maps harm slot2 and level4 from backend to frontend", () => {
    const fe = transformBackendToFrontend({
      harm_level1_used: true,
      harm_level1_name: "one",
      harm_level1_slot2_used: true,
      harm_level1_slot2_name: "two",
      harm_level2_used: true,
      harm_level2_name: "a",
      harm_level2_slot2_used: true,
      harm_level2_slot2_name: "b",
      harm_level3_used: true,
      harm_level3_name: "sev",
      harm_level4_used: true,
      harm_level4_name: "fat",
    });
    expect(fe.harm.level1).toEqual(["one", "two"]);
    expect(fe.harm.level2).toEqual(["a", "b"]);
    expect(fe.harm.level3).toEqual(["sev"]);
    expect(fe.harm.level4).toEqual(["fat"]);
    expect(fe.harmEntries).toEqual(fe.harm);
  });
});

describe("transformFrontendToBackend stash_slots", () => {
  test("sends stash_slots when not in a crew", () => {
    const out = transformFrontendToBackend(
      makeSheet({
        crewId: null,
        stash: Array.from({ length: 40 }, (_, i) => i === 2),
      }),
    );
    expect(out.stash_slots[2]).toBe(true);
    expect(out.stash_slots[0]).toBe(false);
  });

  test("omits stash_slots when linked to a crew (crew PATCH handles grid)", () => {
    const out = transformFrontendToBackend(
      makeSheet({
        crewId: 99,
        stash: Array(40).fill(false),
      }),
    );
    expect(out.stash_slots).toBeUndefined();
  });
});

describe("buildMultipartOrJson", () => {
  it("sends the file as image and does not send a string image URL as the image field", () => {
    const file = new File(["x"], "p.png", { type: "image/png" });
    const { multipart, body } = buildMultipartOrJson({
      true_name: "A",
      image: "https://example.com/media/x.png",
      image_url: "https://example.com/media/x.png",
      imageFile: file,
    });
    expect(multipart).toBe(true);
    const uploaded = body.get("image");
    expect(uploaded instanceof File).toBe(true);
    expect((uploaded && uploaded.name) || "").toBe("p.png");
  });

  it("accepts Blob uploads (not only File) for multipart", () => {
    const blob = new Blob([new Uint8Array([0x47, 0x49, 0x46])], {
      type: "image/gif",
    });
    expect(isImageUploadPayload(blob)).toBe(true);
    const { multipart } = buildMultipartOrJson({
      true_name: "B",
      imageFile: blob,
    });
    expect(multipart).toBe(true);
  });

  it("drops stray image URL from JSON saves", () => {
    const { multipart, body } = buildMultipartOrJson({
      true_name: "B",
      image: "https://example.com/wrong.jpg",
      image_url: "https://example.com/ok.jpg",
    });
    expect(multipart).toBe(false);
    const parsed = JSON.parse(body);
    expect(parsed.image).toBeUndefined();
    expect(parsed.image_url).toBe("https://example.com/ok.jpg");
  });

  it("includes explicit image null on JSON PUT so server clears an image field", () => {
    const { multipart, body } = buildMultipartOrJson({
      name: "Faction",
      campaign: 1,
      image: null,
    });
    expect(multipart).toBe(false);
    expect(JSON.parse(body).image).toBe(null);
  });
});

describe("mergeAbilitiesPreferRicherCustoms", () => {
  test("keeps local unique package when server echo drops it", () => {
    const local = [
      { id: 1, type: "standard", name: "Guardian Angel" },
      {
        id: "custom-single",
        type: "custom",
        name: "monkey",
        _uses: ["a", "b", "c"],
      },
    ];
    const server = [{ id: 1, type: "standard", name: "Guardian Angel" }];
    const merged = mergeAbilitiesPreferRicherCustoms(local, server);
    expect(merged.some((a) => a.name === "monkey")).toBe(true);
  });

  test("save wipe: empty preferred clears customs despite stale server echo", () => {
    const payload = [{ id: 1, type: "standard", name: "Guardian Angel" }];
    const server = [
      { id: 1, type: "standard", name: "Guardian Angel" },
      {
        id: "custom-single",
        type: "custom",
        name: "monkey",
        _uses: ["a", "b", "c"],
      },
    ];
    const merged = mergeAbilitiesPreferRicherCustoms(payload, server, {
      emptyPreferredClearsCustoms: true,
    });
    expect(merged.some((a) => a.type === "custom")).toBe(false);
  });

  test("hydrate: empty local yields to server customs", () => {
    const local = [];
    const server = [
      {
        id: "custom-0",
        type: "custom",
        name: "Ora",
        description: "Barrage",
      },
    ];
    const merged = mergeAbilitiesPreferRicherCustoms(local, server);
    expect(merged.some((a) => a.name === "Ora")).toBe(true);
  });
});

describe("transformFrontendToBackend post-allocation autosave omit", () => {
  test("sheetPostChargen detects allocation history signals", () => {
    expect(sheetPostChargen({ id: 75 })).toBe(false);
    expect(sheetPostChargen({ id: 75, hasXpAllocations: true })).toBe(true);
    expect(
      sheetPostChargen({ id: 75, standCoinPointsGained: 1 }),
    ).toBe(true);
    expect(sheetPostChargen({ id: 75, total_xp_spent: 10 })).toBe(true);
    expect(sheetPostChargen({})).toBe(false);
  });

  test("post-allocation payload omits stand grades, level, and action_dice_gained", () => {
    const sheet = makeSheet({
      id: 75,
      hasXpAllocations: true,
      standCoinPointsGained: 2,
      total_xp_spent: 20,
      standStats: {
        power: 5,
        speed: 0,
        range: 0,
        durability: 5,
        precision: 2,
        development: 1,
      },
      actionRatings: {
        HUNT: 2,
        STUDY: 1,
        SURVEY: 1,
        TINKER: 1,
        FINESSE: 1,
        PROWL: 1,
        SKIRMISH: 1,
        WRECK: 0,
        BIZARRE: 0,
        COMMAND: 0,
        CONSORT: 0,
        SWAY: 0,
      },
    });
    const be = transformFrontendToBackend(sheet);
    expect(be.coin_stats).toBeUndefined();
    expect(be.level).toBeUndefined();
    expect(be.action_dice_gained).toBeUndefined();
    expect(be.stand?.power).toBeUndefined();
    expect(be.stand?.development).toBeUndefined();
    expect(be.stand?.name).toBe("Stand");
  });

  test("chargen payload still includes stand grades and level", () => {
    const be = transformFrontendToBackend(
      makeSheet({
        id: 75,
        standStats: {
          power: 4,
          speed: 0,
          range: 0,
          durability: 0,
          precision: 0,
          development: 0,
        },
      }),
    );
    expect(be.coin_stats?.power).toBe("A");
    expect(be.stand?.power).toBe("A");
    expect(typeof be.level).toBe("number");
    expect(typeof be.action_dice_gained).toBe("number");
  });
});

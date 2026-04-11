import {
  transformFrontendToBackend,
  transformBackendToFrontend,
  playbookToBackend,
  normalizeListResponse,
  normalizeCoinBoxes,
  normalizeStashSlots,
  buildMultipartOrJson,
  isImageUploadPayload,
} from "./api";

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
    harmEntries: { level1: [""], level2: [""], level3: [""] },
    xp: {},
    clocks: [],
    campaign: null,
    inventory: [],
    reputation_status: {},
    abilities: [],
  };
  return { ...base, ...overrides };
}

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

describe("transformBackendToFrontend coin and crew stash", () => {
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
});

import {
  getNpcPortraitReplacementFailureState,
  getNpcPortraitSavedState,
  npcFactionValuesFromApi,
} from "./NPCSheet";
import { changedKeys, pickKeys } from "../utils/factionAutosave";

describe("NPCSheet portrait state helpers", () => {
  test("failed replacement restores the last persisted preview and clears pending state", () => {
    expect(
      getNpcPortraitReplacementFailureState("/media/npcs/persisted.png"),
    ).toEqual({
      imageFile: null,
      imagePreview: "/media/npcs/persisted.png",
      portraitPreviewError: false,
    });
  });

  test("upload save previews the uploaded file but keeps image_url empty", () => {
    expect(
      getNpcPortraitSavedState(
        {
          image: "https://api.example.com/media/npc_images/new.png",
          image_url: "",
        },
        "/media/npcs/old.png",
      ),
    ).toEqual({
      imageFile: null,
      imageUrl: "",
      imagePreview: "https://api.example.com/media/npc_images/new.png",
    });
  });

  test("upload save falls back to the last persisted preview when omitted", () => {
    expect(getNpcPortraitSavedState({}, "/media/npcs/existing.png")).toEqual({
      imageFile: null,
      imageUrl: "",
      imagePreview: "/media/npcs/existing.png",
    });
  });

  test("an external image_url in the response stays the link", () => {
    expect(
      getNpcPortraitSavedState({ image: null, image_url: "https://cdn.example.org/a.png" }),
    ).toEqual({
      imageFile: null,
      imageUrl: "https://cdn.example.org/a.png",
      imagePreview: "https://cdn.example.org/a.png",
    });
  });
});

describe("NPCSheet standing helpers", () => {
  // Helpers mirror NPCSheet.jsx (not exported); keep in sync when changing seed/normalize.
  function clampStandingValue(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.max(-3, Math.min(3, Math.trunc(v)));
  }

  function normalizeStandingLocal(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out = {};
    for (const [k, v] of Object.entries(raw)) {
      const sk = String(k).trim();
      if (!sk || !/^\d+$/.test(sk)) continue;
      out[sk] = clampStandingValue(v);
    }
    return out;
  }

  function seedFactionStatusFromCampaign(existing, campaignFactions, selfFactionId) {
    const base =
      existing && typeof existing === "object" && !Array.isArray(existing)
        ? { ...existing }
        : {};
    let changed = false;
    for (const f of campaignFactions || []) {
      if (f == null || f.name == null) continue;
      if (
        selfFactionId != null &&
        selfFactionId !== "" &&
        Number(f.id) === Number(selfFactionId)
      ) {
        continue;
      }
      const name = String(f.name).trim();
      if (!name) continue;
      if (!(name in base)) {
        base[name] = 0;
        changed = true;
      }
    }
    return { next: base, changed };
  }

  test("normalizeStandingLocal clamps and drops bad keys", () => {
    expect(normalizeStandingLocal({ "1": 9, "2": -9, x: 1, "3": "nope" })).toEqual({
      "1": 3,
      "2": -3,
      "3": 0,
    });
  });

  test("seedFactionStatusFromCampaign fills missing peers and skips self", () => {
    const { next, changed } = seedFactionStatusFromCampaign(
      { Allies: 2 },
      [
        { id: 1, name: "Allies" },
        { id: 2, name: "Rivals" },
        { id: 3, name: "Self" },
      ],
      3,
    );
    expect(changed).toBe(true);
    expect(next).toEqual({ Allies: 2, Rivals: 0 });
  });

  test("seedFactionStatusFromCampaign no-ops when already complete", () => {
    const { next, changed } = seedFactionStatusFromCampaign(
      { Allies: 1, Rivals: 0 },
      [
        { id: 1, name: "Allies" },
        { id: 2, name: "Rivals" },
      ],
      null,
    );
    expect(changed).toBe(false);
    expect(next).toEqual({ Allies: 1, Rivals: 0 });
  });
});

describe("NPCSheet faction autosave values", () => {
  const apiFaction = {
    id: 4,
    name: "Passione",
    level: 3,
    hold: "strong",
    contacts: [{ name: "Polpo" }],
    inventory: [],
    faction_status: { Gang: -2 },
    players_see_tier: false,
    players_see_faction_status: false,
  };

  test("a freshly loaded faction has nothing to save", () => {
    const baseline = npcFactionValuesFromApi(apiFaction);
    const loaded = npcFactionValuesFromApi(apiFaction);
    expect(changedKeys(loaded, baseline)).toEqual([]);
  });

  test("one edit sends only that field and keeps hidden flags out of the PATCH", () => {
    const baseline = npcFactionValuesFromApi(apiFaction);
    const edited = { ...baseline, name: "Passione Family" };
    const keys = changedKeys(edited, baseline);
    expect(pickKeys(edited, keys)).toEqual({ name: "Passione Family" });
    expect(baseline.players_see_tier).toBe(false);
    expect(baseline.players_see_faction_status).toBe(false);
  });

  test("missing fields get the sheet's defaults", () => {
    const v = npcFactionValuesFromApi({ id: 1 });
    expect(v).toMatchObject({
      name: "",
      level: 0,
      hold: "weak",
      reputation: 0,
      contacts: [],
      faction_status: {},
      visible_to_players: false,
      players_see_npcs: true,
    });
  });
});

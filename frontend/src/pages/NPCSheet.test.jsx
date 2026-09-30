import {
  getNpcPortraitReplacementFailureState,
  getNpcPortraitSavedState,
} from "./NPCSheet";

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

  test("successful replacement save prefers the persisted path from the response", () => {
    expect(
      getNpcPortraitSavedState(
        { image: "/media/npcs/new.png" },
        "/media/npcs/old.png",
      ),
    ).toEqual({
      imageFile: null,
      imageUrl: "/media/npcs/new.png",
      imagePreview: "/media/npcs/new.png",
    });
  });

  test("successful replacement save falls back to the last persisted path when omitted", () => {
    expect(getNpcPortraitSavedState({}, "/media/npcs/existing.png")).toEqual({
      imageFile: null,
      imageUrl: "/media/npcs/existing.png",
      imagePreview: "/media/npcs/existing.png",
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

import { sheetPayloadDedupeKey, withResolvedHeritage } from "./sheetDedupeKey";

// Opening a sheet showed "Saving… / Saved" with no edit: the baseline was
// taken before these load-time changes landed (2026-11-03).
const base = {
  id: 1,
  name: "PC",
  heritage: 1,
  hasXpAllocations: false,
  clocks: [{ id: 1, name: "Mine", segments: 4, filled: 0 }],
};

describe("sheetPayloadDedupeKey", () => {
  test("ignores hasXpAllocations (loaded after the sheet opens)", () => {
    expect(sheetPayloadDedupeKey({ ...base, hasXpAllocations: true })).toBe(
      sheetPayloadDedupeKey(base),
    );
  });

  test("ignores a clock's clientKey (set on the client after load)", () => {
    const keyed = { ...base, clocks: [{ ...base.clocks[0], clientKey: "id:1" }] };
    expect(sheetPayloadDedupeKey(keyed)).toBe(sheetPayloadDedupeKey(base));
  });

  test("still sees a real clock edit", () => {
    const edited = { ...base, clocks: [{ ...base.clocks[0], filled: 1 }] };
    expect(sheetPayloadDedupeKey(edited)).not.toBe(sheetPayloadDedupeKey(base));
  });

  test("still sees a real field edit", () => {
    expect(sheetPayloadDedupeKey({ ...base, name: "New" })).not.toBe(
      sheetPayloadDedupeKey(base),
    );
  });
});

describe("withResolvedHeritage", () => {
  test("a baseline taken before the heritage list loaded takes the resolved heritage", () => {
    const early = sheetPayloadDedupeKey({ ...base, heritage: null });
    expect(withResolvedHeritage(early, 1)).toBe(sheetPayloadDedupeKey(base));
  });

  test("a baseline that already has a heritage is left alone", () => {
    const key = sheetPayloadDedupeKey({ ...base, heritage: 2 });
    expect(withResolvedHeritage(key, 1)).toBe(key);
  });

  test("other edits made before the heritage resolved still count as edits", () => {
    const early = sheetPayloadDedupeKey({ ...base, heritage: null });
    const edited = sheetPayloadDedupeKey({ ...base, name: "Typed fast" });
    expect(withResolvedHeritage(early, 1)).not.toBe(edited);
  });
});

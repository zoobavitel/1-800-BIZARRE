import {
  normalizePlaybookXpArchetypeKeys,
  inferSeedArchetypeKeys,
  mergedTriggerSentencesForKeys,
  archetypeLabelsJoined,
  STAND_ARCHETYPE_ROWS,
} from "./playbookXpTriggerSrd";

describe("playbookXpTriggerSrd", () => {
  test("normalize dedupes and filters by playbook", () => {
    expect(
      normalizePlaybookXpArchetypeKeys("Stand", ["COLONY", "COLONY", "INVALID"]),
    ).toEqual(["COLONY"]);
    expect(
      normalizePlaybookXpArchetypeKeys("Hamon", ["CAESAR_STYLE", "COLONY"]),
    ).toEqual(["CAESAR_STYLE"]);
  });

  test("inferSeed Stand uses stand type", () => {
    expect(inferSeedArchetypeKeys("Stand", { standType: "SHARED" })).toEqual([
      "SHARED",
    ]);
    expect(inferSeedArchetypeKeys("Stand", { standType: "" })).toEqual([]);
  });

  test("inferSeed Hamon from abilities", () => {
    const keys = inferSeedArchetypeKeys("Hamon", {
      abilities: [
        { type: "hamon", hamon_type: "FOUNDATION" },
        { type: "hamon", hamon_type: "CYBER_STYLE" },
      ],
    });
    expect(keys).toEqual(["CYBER_STYLE"]);
  });

  test("merged sentences respects key order", () => {
    const s = mergedTriggerSentencesForKeys(
      ["COLONY", "SHARED"],
      "Stand",
    );
    expect(s).toContain("multiple targets");
    expect(s).toContain("allies");
  });

  test("archetypeLabelsJoined", () => {
    expect(archetypeLabelsJoined(["TOOLBOUND"], "Stand")).toBe("Tool-Bound");
  });

  test("stand rows cover backend keys", () => {
    const keys = new Set(STAND_ARCHETYPE_ROWS.map((r) => r.key));
    for (const k of [
      "COLONY",
      "TOOLBOUND",
      "PHENOMENA",
      "AUTOMATIC",
      "FIGHTING",
      "SHARED",
      "CONJOINED",
    ]) {
      expect(keys.has(k)).toBe(true);
    }
  });
});

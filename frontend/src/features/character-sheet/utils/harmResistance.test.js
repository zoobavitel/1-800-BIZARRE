import {
  reduceHarmOnce,
  resistableHarmOptions,
  resistedAfterTextEdit,
  shiftAllHarmDown,
} from "./harmResistance";

const harm = {
  level4: [""],
  level3: ["Gut stab"],
  level2: ["", "Sprain"],
  level1: ["", ""],
};

describe("reduceHarmOnce", () => {
  test("lowers one entry and marks the destination resisted", () => {
    const result = reduceHarmOnce(harm, null, "level3:0");
    expect(result.ok).toBe(true);
    expect(result.harm.level3).toEqual([""]);
    expect(result.harm.level2[0]).toBe("Gut stab");
    expect(result.resisted.level2[0]).toBe(true);
    expect(resistableHarmOptions(result.harm, result.resisted).map((o) => o.value)).toEqual([
      "level2:1",
    ]);
  });

  test("a second reduce of that entry does nothing", () => {
    const once = reduceHarmOnce(harm, null, "level3:0");
    const twice = reduceHarmOnce(once.harm, once.resisted, "level2:0");
    expect(twice.ok).toBe(false);
    expect(twice.harm.level2[0]).toBe("Gut stab");
    expect(twice.harm.level1[0]).toBe("");
  });

  test("level 1 is cleared and cannot be lowered again", () => {
    const sheet = {
      level4: [""],
      level3: [""],
      level2: ["", ""],
      level1: ["Bruise", ""],
    };
    const result = reduceHarmOnce(sheet, null, "level1:0");
    expect(result.ok).toBe(true);
    expect(result.harm.level1).toEqual(["", ""]);
    expect(resistableHarmOptions(result.harm, result.resisted)).toEqual([]);
  });

  test("refuses a full lower row without changing the sheet", () => {
    const full = {
      level4: [""],
      level3: ["Severe"],
      level2: ["A", "B"],
      level1: ["", ""],
    };
    const result = reduceHarmOnce(full, null, "level3:0");
    expect(result.ok).toBe(false);
    expect(result.harm.level3).toEqual(["Severe"]);
    expect(result.harm.level2).toEqual(["A", "B"]);
  });

  test("omits a level that cannot move down, and lists it once a slot opens", () => {
    const full = {
      level4: [""],
      level3: ["Severe"],
      level2: ["A", "B"],
      level1: ["", ""],
    };
    expect(resistableHarmOptions(full, null).map((o) => o.value)).toEqual([
      "level2:0",
      "level2:1",
    ]);
    const opened = {
      ...full,
      level2: ["", "B"],
    };
    expect(resistableHarmOptions(opened, null).map((o) => o.value)).toEqual([
      "level3:0",
      "level2:1",
    ]);
    const resisted = {
      level4: [false],
      level3: [true],
      level2: [false, false],
      level1: [false, false],
    };
    expect(resistableHarmOptions(opened, resisted).map((o) => o.value)).toEqual([
      "level2:1",
    ]);
  });
});

describe("resistedAfterTextEdit", () => {
  test("a new name clears the resisted mark", () => {
    const once = reduceHarmOnce(harm, null, "level3:0");
    const next = resistedAfterTextEdit(
      once.resisted,
      "level2",
      0,
      "Gut stab",
      "Broken rib",
    );
    expect(next.level2[0]).toBe(false);
    expect(
      resistableHarmOptions(
        { ...once.harm, level2: ["Broken rib", "Sprain"] },
        next,
      ).map((o) => o.value),
    ).toEqual(["level2:0", "level2:1"]);
  });
});

describe("shiftAllHarmDown", () => {
  test("the resisted mark follows the injury", () => {
    const once = reduceHarmOnce(harm, null, "level3:0");
    const shifted = shiftAllHarmDown(once.harm, once.resisted);
    expect(shifted.harm.level1[0]).toBe("Gut stab");
    expect(shifted.resisted.level1[0]).toBe(true);
    expect(resistableHarmOptions(shifted.harm, shifted.resisted).map((o) => o.value)).toEqual([
      "level1:1",
    ]);
  });
});

import {
  mergeNpcHeritageSelections,
  npcHeritageDefaultsKey,
} from "./npcHeritageDefaults";

const grayMatter = {
  benefits: [
    { id: 1, name: "Hyper-Intelligence", required: true },
    { id: 2, name: "Superior Physiology", required: true },
    { id: 3, name: "Chainsaw Arm", required: false },
  ],
  detriments: [
    { id: 10, name: "Cold Logic", required: true },
    { id: 11, name: "Optional flaw", required: false },
  ],
};

describe("mergeNpcHeritageSelections", () => {
  test("seeds required benefits and detriments when empty", () => {
    const out = mergeNpcHeritageSelections([], [], grayMatter, {
      seedRequired: true,
    });
    expect(out.benefits).toEqual([1, 2]);
    expect(out.detriments).toEqual([10]);
    expect(out.changed).toBe(true);
  });

  test("keeps optional picks and still seeds required", () => {
    const out = mergeNpcHeritageSelections([3], [], grayMatter, {
      seedRequired: true,
    });
    expect(out.benefits).toEqual([1, 2, 3]);
    expect(out.detriments).toEqual([10]);
  });

  test("does not re-force required after GM unchecks when seedRequired false", () => {
    const out = mergeNpcHeritageSelections([3], [], grayMatter, {
      seedRequired: false,
    });
    expect(out.benefits).toEqual([3]);
    expect(out.detriments).toEqual([]);
  });

  test("drops ids outside current heritage catalog", () => {
    const out = mergeNpcHeritageSelections([1, 99], [10, 88], grayMatter, {
      seedRequired: false,
    });
    expect(out.benefits).toEqual([1]);
    expect(out.detriments).toEqual([10]);
  });

  test("clears when heritage details missing and prev empty", () => {
    const out = mergeNpcHeritageSelections([], [], null);
    expect(out.benefits).toEqual([]);
    expect(out.detriments).toEqual([]);
    expect(out.changed).toBe(false);
  });
});

describe("npcHeritageDefaultsKey", () => {
  test("builds stable key", () => {
    expect(npcHeritageDefaultsKey(5, 3)).toBe("5:3");
    expect(npcHeritageDefaultsKey(null, 3)).toBe("new:3");
    expect(npcHeritageDefaultsKey(5, null)).toBe(null);
  });
});

import {
  clampClockFilled,
  clampClockSegments,
  clockWedgeCount,
  isPersistedProgressClockId,
  serializeSheetProgressClocks,
} from "./progressClockSegments";

describe("clampClockSegments", () => {
  test("keeps 7 (does not snap to 8 or 12)", () => {
    expect(clampClockSegments(7)).toBe(7);
    expect(clockWedgeCount(7)).toBe(7);
  });

  test("clamps 1–12", () => {
    expect(clampClockSegments(0)).toBe(1);
    expect(clampClockSegments(12)).toBe(12);
    expect(clampClockSegments(13)).toBe(12);
  });
});

describe("clampClockFilled", () => {
  test("shrinks fill when max drops", () => {
    expect(clampClockFilled(6, 4)).toBe(4);
    expect(clampClockFilled(-1, 7)).toBe(0);
  });
});

describe("isPersistedProgressClockId", () => {
  test("rejects Date.now() temp ids and local strings", () => {
    expect(isPersistedProgressClockId(Date.now())).toBe(false);
    expect(isPersistedProgressClockId("pc-clock-1")).toBe(false);
    expect(isPersistedProgressClockId(42)).toBe(true);
  });
});

describe("serializeSheetProgressClocks", () => {
  test("sends max_segments from segments and drops huge temp ids", () => {
    const rows = serializeSheetProgressClocks([
      { id: Date.now(), name: "Wannabe", segments: 7, filled: 0 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].max_segments).toBe(7);
    expect(rows[0].segments).toBe(7);
    expect(rows[0].id).toBeUndefined();
  });
});

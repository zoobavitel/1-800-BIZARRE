import {
  clampClockFilled,
  clampClockSegments,
  clockWedgeCount,
  clockWedgeFillColor,
  isPersistedProgressClockId,
  mergeSheetProgressClocks,
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

describe("clockWedgeFillColor", () => {
  test("first wedge of 8-segment clock is red", () => {
    expect(clockWedgeFillColor(0, 8)).toBe("#dc2626");
  });

  test("last wedge band of 8-segment clock is green", () => {
    expect(clockWedgeFillColor(7, 8)).toBe("#16a34a");
  });

  test("1-segment clock is red", () => {
    expect(clockWedgeFillColor(0, 1)).toBe("#dc2626");
  });
});

describe("isPersistedProgressClockId", () => {
  test("rejects Date.now() temp ids and local strings", () => {
    expect(isPersistedProgressClockId(Date.now())).toBe(false);
    expect(isPersistedProgressClockId("pc-clock-1")).toBe(false);
    expect(isPersistedProgressClockId(42)).toBe(true);
  });
});

describe("mergeSheetProgressClocks", () => {
  test("keeps clientKey when temp clock maps to server id", () => {
    const prev = [
      {
        id: "pc-clock-1",
        clientKey: "pc-clock-1",
        name: "Infiltrate",
        segments: 4,
        filled: 0,
      },
    ];
    const incoming = [
      {
        id: 99,
        name: "Infiltrate",
        max_segments: 4,
        filled_segments: 0,
        created_by: 3,
      },
    ];
    const merged = mergeSheetProgressClocks(prev, incoming);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(99);
    expect(merged[0].clientKey).toBe("pc-clock-1");
    expect(merged[0].created_by).toBe(3);
  });

  test("appends new server clocks without a local temp", () => {
    const merged = mergeSheetProgressClocks(
      [],
      [{ id: 5, name: "A", max_segments: 6, filled_segments: 1 }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].clientKey).toBe("id:5");
    expect(merged[0].segments).toBe(6);
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

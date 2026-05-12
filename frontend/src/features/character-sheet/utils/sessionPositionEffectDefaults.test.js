import { defaultPositionEffectFromSessionDetail } from "./sessionPositionEffectDefaults";

describe("defaultPositionEffectFromSessionDetail", () => {
  test("uses per-character GM row when present", () => {
    const d = defaultPositionEffectFromSessionDetail(5, {
      default_position: "risky",
      default_effect: "limited",
      position_effect_by_character: {
        5: { position: "Desperate", effect: "greater" },
      },
    });
    expect(d).toEqual({ position: "desperate", effect: "extreme" });
  });

  test("falls back to session defaults when no row", () => {
    const d = defaultPositionEffectFromSessionDetail(9, {
      default_position: "CONTROLLED",
      default_effect: "standard",
      position_effect_by_character: { 1: { position: "risky", effect: "limited" } },
    });
    expect(d).toEqual({ position: "controlled", effect: "standard" });
  });

  test("invalid position falls back to risky", () => {
    const d = defaultPositionEffectFromSessionDetail(1, {
      default_position: "nope",
      default_effect: "extreme",
      position_effect_by_character: {},
    });
    expect(d.position).toBe("risky");
    expect(d.effect).toBe("extreme");
  });

  test("handles null session detail", () => {
    const d = defaultPositionEffectFromSessionDetail(1, null);
    expect(d).toEqual({ position: "risky", effect: "standard" });
  });
});

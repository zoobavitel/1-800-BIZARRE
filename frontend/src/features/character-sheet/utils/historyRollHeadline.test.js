import {
  historyRollHeadline,
  historyRollPositionEffectModifiers,
} from "./historyRollHeadline";

describe("historyRollHeadline", () => {
  test("omits action outcomes on resistance", () => {
    expect(
      historyRollHeadline(
        { roll_type: "RESISTANCE", action_name: "stand_durability" },
        "4",
        "PARTIAL SUCCESS",
      ),
    ).toBe("stand_durability · 4");
  });

  test("keeps action outcomes on action rolls", () => {
    expect(
      historyRollHeadline(
        { roll_type: "ACTION", action_name: "hunt" },
        "6",
        "FULL SUCCESS",
      ),
    ).toBe("hunt · 6 → FULL SUCCESS");
  });
});

describe("historyRollPositionEffectModifiers", () => {
  test("drops position and effect on resistance", () => {
    expect(
      historyRollPositionEffectModifiers({
        roll_type: "RESISTANCE",
        position: "risky",
        effect: "standard",
      }),
    ).toEqual([]);
  });

  test("keeps position and effect on action rolls", () => {
    expect(
      historyRollPositionEffectModifiers({
        roll_type: "ACTION",
        position: "risky",
        effect: "standard",
      }),
    ).toEqual(["Pos risky", "Eff standard"]);
  });
});

import {
  HISTORY_MANUAL_RESISTANCE_ATTR_OPTIONS,
  historyManualResistanceActionName,
} from "./historyManualResistance";

describe("HISTORY_MANUAL_RESISTANCE_ATTR_OPTIONS", () => {
  test("includes Durability as stand_durability", () => {
    expect(HISTORY_MANUAL_RESISTANCE_ATTR_OPTIONS).toEqual(
      expect.arrayContaining([
        { value: "stand_durability", label: "Durability" },
      ]),
    );
  });
});

describe("historyManualResistanceActionName", () => {
  test("passes BitD attributes through", () => {
    expect(historyManualResistanceActionName("insight")).toBe("insight");
    expect(historyManualResistanceActionName("prowess")).toBe("prowess");
    expect(historyManualResistanceActionName("resolve")).toBe("resolve");
  });

  test("maps Durability aliases to live resistance action_name", () => {
    expect(historyManualResistanceActionName("stand_durability")).toBe(
      "stand_durability",
    );
    expect(historyManualResistanceActionName("durability")).toBe(
      "stand_durability",
    );
  });
});

import {
  clampStandingValue,
  formatSignedStanding,
  normalizeStandingMap,
  standingTierLabel,
} from "./standingMaps";

describe("standingMaps", () => {
  test("clampStandingValue clamps to -3..+3", () => {
    expect(clampStandingValue(9)).toBe(3);
    expect(clampStandingValue(-9)).toBe(-3);
    expect(clampStandingValue(1.7)).toBe(1);
    expect(clampStandingValue("nope")).toBe(0);
  });

  test("normalizeStandingMap keeps digit keys only", () => {
    expect(
      normalizeStandingMap({ "7": 2, bad: 1, "3.5": 1, next: 0 }),
    ).toEqual({ "7": 2 });
  });

  test("formatSignedStanding and tier labels", () => {
    expect(formatSignedStanding(2)).toBe("+2");
    expect(formatSignedStanding(-1)).toBe("-1");
    expect(standingTierLabel(3)).toBe("Allied");
    expect(standingTierLabel(-3)).toBe("War");
  });
});

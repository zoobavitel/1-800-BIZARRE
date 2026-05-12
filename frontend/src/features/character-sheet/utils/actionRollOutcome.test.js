import {
  tierDieFromActionPool,
  outcomeFromActionRoll,
  outcomeFromFortuneDiceResults,
} from "./actionRollOutcome";

describe("tierDieFromActionPool", () => {
  test("0 pool 0 dots: two dice use lower", () => {
    expect(tierDieFromActionPool([6, 2], 0, 0)).toBe(2);
  });

  test("0 pool but positive dots (inconsistent): use max", () => {
    expect(tierDieFromActionPool([6, 2], 0, 2)).toBe(6);
  });

  test("positive pool: use max", () => {
    expect(tierDieFromActionPool([2, 6, 3], 3, 2)).toBe(6);
  });
});

describe("outcomeFromActionRoll", () => {
  test("two sixes before tier die", () => {
    expect(outcomeFromActionRoll([6, 6], 0, 0)).toBe("CRITICAL_SUCCESS");
  });

  test("0 pool partial on lower die", () => {
    expect(outcomeFromActionRoll([6, 4], 0, 0)).toBe("PARTIAL_SUCCESS");
  });

  test("0 pool failure", () => {
    expect(outcomeFromActionRoll([5, 2], 0, 0)).toBe("FAILURE");
  });
});

describe("outcomeFromFortuneDiceResults", () => {
  test("uses max not min", () => {
    expect(outcomeFromFortuneDiceResults([6, 2])).toBe("FULL_SUCCESS");
  });
});

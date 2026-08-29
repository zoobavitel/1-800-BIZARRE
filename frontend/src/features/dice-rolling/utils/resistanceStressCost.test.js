import { resistanceStressCost } from "./resistanceStressCost";

describe("resistanceStressCost", () => {
  test("highest 6 costs 0", () => {
    expect(resistanceStressCost([6, 2, 1])).toBe(0);
  });

  test("highest 5 costs 1", () => {
    expect(resistanceStressCost([5, 4])).toBe(1);
  });

  test("highest 1 costs 5", () => {
    expect(resistanceStressCost([1, 1, 1])).toBe(5);
  });

  test("two 6s pay 0 and clear 1", () => {
    expect(resistanceStressCost([6, 6])).toBe(-1);
    expect(resistanceStressCost([6, 6, 3])).toBe(-1);
  });

  test("0-dice cannot crit: two 6s still cost 0", () => {
    expect(resistanceStressCost([6, 6], { zeroDice: true })).toBe(0);
  });

  test("0-dice uses the lower die", () => {
    expect(resistanceStressCost([6, 2], { zeroDice: true })).toBe(4);
  });
});

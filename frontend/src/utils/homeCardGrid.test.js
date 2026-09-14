import {
  HOME_CARD_GRID_FALLBACK_COLUMNS,
  homeCardGridColumnCount,
} from "./homeCardGrid";

describe("homeCardGridColumnCount", () => {
  test("returns fallback for invalid width", () => {
    expect(homeCardGridColumnCount(0)).toBe(HOME_CARD_GRID_FALLBACK_COLUMNS);
    expect(homeCardGridColumnCount(NaN)).toBe(HOME_CARD_GRID_FALLBACK_COLUMNS);
  });

  test("fits one column on narrow containers", () => {
    expect(homeCardGridColumnCount(150)).toBe(1);
    expect(homeCardGridColumnCount(169)).toBe(1);
  });

  test("fits multiple columns as width grows", () => {
    expect(homeCardGridColumnCount(350)).toBe(2);
    expect(homeCardGridColumnCount(813)).toBe(4);
    expect(homeCardGridColumnCount(1200)).toBe(7);
  });
});

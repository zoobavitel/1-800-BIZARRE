import { buildRouteHash, buildRouteHref } from "./spaNavigation";

describe("character hash routes", () => {
  test("new unsaved sheet bound to campaign", () => {
    expect(buildRouteHash("character", { campaignId: 7 })).toBe(
      "character/new/7",
    );
    expect(buildRouteHref("character", { campaignId: 7 })).toBe(
      "#character/new/7",
    );
  });

  test("saved character id still wins over campaignId", () => {
    expect(
      buildRouteHash("character", { characterId: 3, campaignId: 7 }),
    ).toBe("character/3");
  });
});

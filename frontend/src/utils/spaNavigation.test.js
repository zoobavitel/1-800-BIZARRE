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

describe("character picker routes (Characters picker story)", () => {
  test("plain character route is the picker", () => {
    expect(buildRouteHash("character", { characterId: null })).toBe("character");
  });

  test("a new blank character has its own route", () => {
    expect(
      buildRouteHash("character", { characterId: null, newCharacter: true }),
    ).toBe("character/new");
  });

  test("a campaign new character keeps its route", () => {
    expect(
      buildRouteHash("character", {
        characterId: null,
        campaignId: 7,
        newCharacter: true,
      }),
    ).toBe("character/new/7");
  });
});

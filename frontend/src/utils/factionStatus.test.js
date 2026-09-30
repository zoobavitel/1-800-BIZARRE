import {
  applySymmetricFactionStatus,
  normalizeFactionStatusMap,
  seedFactionStatusFromCampaign,
} from "./factionStatus";

describe("normalizeFactionStatusMap", () => {
  test("unwraps accidental {next,changed} and clamps", () => {
    expect(
      normalizeFactionStatusMap({
        next: { "Canary Men": -9, Dirty: "2" },
        changed: true,
      }),
    ).toEqual({ "Canary Men": -3, Dirty: 2 });
  });
});

describe("seedFactionStatusFromCampaign", () => {
  test("fills missing campaign factions as 0 and skips self", () => {
    const { next, changed } = seedFactionStatusFromCampaign(
      { "Canary Men": -3 },
      [
        { id: 1, name: "Dirty Deeds" },
        { id: 2, name: "Canary Men" },
        { id: 3, name: "Other" },
      ],
      1,
    );
    expect(next).toEqual({
      "Canary Men": -3,
      Other: 0,
    });
    expect(changed).toBe(true);
  });
});

describe("applySymmetricFactionStatus", () => {
  test("sets both directions to the same clamped value", () => {
    const { statusA, statusB } = applySymmetricFactionStatus(
      "Dirty Deeds",
      "Canary Men",
      -3,
      { Other: 1 },
      { Nearby: 0 },
    );
    expect(statusA).toEqual({ Other: 1, "Canary Men": -3 });
    expect(statusB).toEqual({ Nearby: 0, "Dirty Deeds": -3 });
  });

  test("remove clears both directions", () => {
    const { statusA, statusB } = applySymmetricFactionStatus(
      "Dirty Deeds",
      "Canary Men",
      null,
      { "Canary Men": -3, Keep: 1 },
      { "Dirty Deeds": -3, KeepB: 2 },
    );
    expect(statusA).toEqual({ Keep: 1 });
    expect(statusB).toEqual({ KeepB: 2 });
  });

  test("no-ops when names missing or same", () => {
    const a = { X: 1 };
    const b = { Y: 2 };
    expect(applySymmetricFactionStatus("", "B", -1, a, b)).toEqual({
      statusA: { X: 1 },
      statusB: { Y: 2 },
    });
    expect(applySymmetricFactionStatus("A", "A", -1, a, b)).toEqual({
      statusA: { X: 1 },
      statusB: { Y: 2 },
    });
  });
});

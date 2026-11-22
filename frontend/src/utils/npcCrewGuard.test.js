import { shouldClearNpcCrew } from "./npcCrewGuard";

// S21: an NPC loads before its campaign list. A missing campaign is not
// a missing crew, so the crew must not be cleared (and then saved as null).
describe("shouldClearNpcCrew", () => {
  it("keeps the crew while the campaign list has not loaded", () => {
    expect(
      shouldClearNpcCrew({ currentCrewId: 7, campaignId: 1, activeCampaign: null }),
    ).toBe(false);
  });

  it("keeps the crew when the campaign has no crews array yet", () => {
    expect(
      shouldClearNpcCrew({ currentCrewId: 7, campaignId: 1, activeCampaign: {} }),
    ).toBe(false);
  });

  it("keeps the crew when it is in the campaign", () => {
    expect(
      shouldClearNpcCrew({
        currentCrewId: 7,
        campaignId: 1,
        activeCampaign: { crews: [{ id: 7 }, { id: 8 }] },
      }),
    ).toBe(false);
  });

  it("clears the crew when it really is not in the loaded campaign", () => {
    expect(
      shouldClearNpcCrew({
        currentCrewId: 7,
        campaignId: 1,
        activeCampaign: { crews: [{ id: 8 }] },
      }),
    ).toBe(true);
  });

  it("clears the crew when the NPC has no campaign any more", () => {
    expect(
      shouldClearNpcCrew({ currentCrewId: 7, campaignId: "", activeCampaign: null }),
    ).toBe(true);
  });

  it("does nothing without a crew", () => {
    expect(
      shouldClearNpcCrew({ currentCrewId: null, campaignId: 1, activeCampaign: { crews: [] } }),
    ).toBe(false);
  });
});

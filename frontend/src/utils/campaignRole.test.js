import { campaignRoleLabel, viewerIsCampaignGm } from "./campaignRole";

const campaign = { id: 1, gm: { id: 7 }, players: [{ id: 8 }] };

describe("campaign GM view (staff see every campaign as its GM)", () => {
  it("the campaign's GM gets the GM view", () => {
    expect(viewerIsCampaignGm(campaign, { id: 7, is_staff: false })).toBe(true);
  });

  it("staff get the GM view of any campaign", () => {
    expect(viewerIsCampaignGm(campaign, { id: 99, is_staff: true })).toBe(true);
  });

  it("a player or a stranger does not", () => {
    expect(viewerIsCampaignGm(campaign, { id: 8, is_staff: false })).toBe(false);
    expect(viewerIsCampaignGm(campaign, { id: 50 })).toBe(false);
    expect(viewerIsCampaignGm(campaign, null)).toBe(false);
    expect(viewerIsCampaignGm(null, { id: 7 })).toBe(false);
  });

  it("matches ids given as numbers or strings", () => {
    expect(viewerIsCampaignGm({ gm: { id: "7" } }, { id: 7 })).toBe(true);
  });

  it("labels staff who aren't the GM as Admin", () => {
    expect(campaignRoleLabel(campaign, { id: 7 })).toBe("GM");
    expect(campaignRoleLabel(campaign, { id: 99, is_staff: true })).toBe("Admin");
    expect(campaignRoleLabel(campaign, { id: 7, is_staff: true })).toBe("GM");
    expect(campaignRoleLabel(campaign, { id: 8 })).toBe("Player");
  });
});

/**
 * Who gets the GM view of a campaign page: its GM, and staff for every
 * campaign (user's rule, 2026-11-08). The API already lets staff see every
 * PC and NPC and do GM actions; this only stops the page hiding them.
 */
function isTheGm(campaign, user) {
  const gmId = campaign?.gm?.id;
  return gmId != null && user?.id != null && Number(gmId) === Number(user.id);
}

export function viewerIsCampaignGm(campaign, user) {
  if (!campaign || !user) return false;
  return isTheGm(campaign, user) || Boolean(user.is_staff);
}

/** Badge text: "GM" for the campaign's GM, "Admin" for other staff. */
export function campaignRoleLabel(campaign, user) {
  if (isTheGm(campaign, user)) return "GM";
  if (user?.is_staff) return "Admin";
  return "Player";
}

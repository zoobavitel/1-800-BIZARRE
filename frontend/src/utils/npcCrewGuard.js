/**
 * Should an NPC's crew be cleared because it is not in its campaign?
 *
 * A campaign that has not loaded yet is not the same as a campaign with no
 * such crew: the NPC can load before the campaign list. Clearing then saves
 * `crew: null` (S21). Clear only when the campaign is loaded and really lacks
 * the crew, or when the NPC has no campaign at all.
 */
export function shouldClearNpcCrew({ currentCrewId, campaignId, activeCampaign }) {
  if (currentCrewId == null) return false;
  if (campaignId == null || campaignId === "") return true;
  if (!activeCampaign || !Array.isArray(activeCampaign.crews)) return false;
  return !activeCampaign.crews.some((c) => Number(c.id) === Number(currentCrewId));
}

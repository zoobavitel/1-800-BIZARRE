/**
 * Sort / collapse Home campaign cards: live session, then active idle, then deactivated.
 */

/**
 * @param {{ is_active?: boolean, active_session?: unknown, active_session_detail?: unknown } | null | undefined} campaign
 * @returns {0 | 1 | 2}
 */
export function campaignHomeSortTier(campaign) {
  if (campaign?.is_active === false) return 2;
  const hasLive =
    campaign?.active_session_detail != null ||
    campaign?.active_session != null;
  return hasLive ? 0 : 1;
}

/**
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
export function compareCampaignsForHome(a, b) {
  const tierDiff = campaignHomeSortTier(a) - campaignHomeSortTier(b);
  if (tierDiff !== 0) return tierDiff;
  const nameA = String(a?.name || "").trim().toLocaleLowerCase();
  const nameB = String(b?.name || "").trim().toLocaleLowerCase();
  if (nameA !== nameB) return nameA.localeCompare(nameB);
  return (a?.id ?? 0) - (b?.id ?? 0);
}

/**
 * @param {object[] | null | undefined} campaigns
 * @returns {object[]}
 */
export function sortCampaignsForHome(campaigns) {
  return [...(campaigns || [])].sort(compareCampaignsForHome);
}

/**
 * Collapsed Home list: only live-session campaigns (tier 0).
 * Expanded: full sorted list.
 *
 * @param {object[] | null | undefined} campaigns
 * @param {{ expanded?: boolean }} [opts]
 * @returns {{ visible: object[], hiddenCount: number }}
 */
export function visibleCampaignsForHome(campaigns, { expanded = false } = {}) {
  const sorted = sortCampaignsForHome(campaigns);
  if (expanded) {
    return { visible: sorted, hiddenCount: 0 };
  }
  const visible = sorted.filter((c) => campaignHomeSortTier(c) === 0);
  return {
    visible,
    hiddenCount: Math.max(0, sorted.length - visible.length),
  };
}

/**
 * Priority for Home character cards.
 * 0 = on a live-session campaign roster
 * 1 = on an active (alive) campaign roster
 * 2 = older / inactive-only / unassigned
 *
 * @param {{ id?: number }} character
 * @param {object[] | null | undefined} campaigns
 * @returns {0 | 1 | 2}
 */
export function characterHomeSortTier(character, campaigns) {
  const charId = character?.id;
  if (charId == null) return 2;
  let best = 2;
  for (const campaign of campaigns || []) {
    const roster = Array.isArray(campaign?.campaign_characters)
      ? campaign.campaign_characters
      : [];
    if (!roster.some((cc) => cc?.id === charId)) continue;
    if (campaign?.is_active === false) continue;
    const live =
      campaign?.active_session_detail != null ||
      campaign?.active_session != null;
    best = Math.min(best, live ? 0 : 1);
  }
  return best;
}

/**
 * @param {object} a
 * @param {object} b
 * @param {object[] | null | undefined} campaigns
 * @returns {number}
 */
export function compareCharactersForHome(a, b, campaigns) {
  const tierDiff =
    characterHomeSortTier(a, campaigns) - characterHomeSortTier(b, campaigns);
  if (tierDiff !== 0) return tierDiff;
  const nameA = String(a?.name || "").trim().toLocaleLowerCase();
  const nameB = String(b?.name || "").trim().toLocaleLowerCase();
  if (nameA !== nameB) return nameA.localeCompare(nameB);
  return (a?.id ?? 0) - (b?.id ?? 0);
}

/**
 * @param {object[] | null | undefined} characters
 * @param {object[] | null | undefined} campaigns
 * @returns {object[]}
 */
export function sortCharactersForHome(characters, campaigns) {
  return [...(characters || [])].sort((a, b) =>
    compareCharactersForHome(a, b, campaigns),
  );
}

/**
 * Collapsed: characters on any active campaign.
 * Expanded: full sorted list.
 *
 * @param {object[] | null | undefined} characters
 * @param {object[] | null | undefined} campaigns
 * @param {{ expanded?: boolean }} [opts]
 * @returns {{ visible: object[], hiddenCount: number }}
 */
export function visibleCharactersForHome(
  characters,
  campaigns,
  { expanded = false } = {},
) {
  const sorted = sortCharactersForHome(characters, campaigns);
  if (expanded) {
    return { visible: sorted, hiddenCount: 0 };
  }
  const visible = sorted.filter(
    (ch) => characterHomeSortTier(ch, campaigns) < 2,
  );
  return {
    visible,
    hiddenCount: Math.max(0, sorted.length - visible.length),
  };
}

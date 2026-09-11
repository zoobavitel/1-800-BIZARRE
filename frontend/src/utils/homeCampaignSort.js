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

/** Max campaign cards shown on Home before "show more". */
export const HOME_CAMPAIGN_PREVIEW_LIMIT = 3;

/**
 * Collapsed: first N of the priority-sorted list (live session, then active
 * idle, then deactivated). Expanded: full sorted list.
 *
 * @param {object[] | null | undefined} campaigns
 * @param {{ expanded?: boolean, limit?: number }} [opts]
 * @returns {{ visible: object[], hiddenCount: number }}
 */
export function visibleCampaignsForHome(
  campaigns,
  { expanded = false, limit = HOME_CAMPAIGN_PREVIEW_LIMIT } = {},
) {
  const sorted = sortCampaignsForHome(campaigns);
  if (expanded) {
    return { visible: sorted, hiddenCount: 0 };
  }
  const previewLimit = Math.max(0, Number(limit) || 0);
  const visible = sorted.slice(0, previewLimit);
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

/** Max character cards shown on Home before "show more". */
export const HOME_CHARACTER_PREVIEW_LIMIT = 3;

/** Max NPC cards shown on Home before "show more". */
export const HOME_NPC_PREVIEW_LIMIT = HOME_CHARACTER_PREVIEW_LIMIT;

/**
 * Collapsed: first N of the priority-sorted list (live session, then active
 * campaign, then everyone else — including unassigned). Expanded: full list.
 *
 * @param {object[] | null | undefined} characters
 * @param {object[] | null | undefined} campaigns
 * @param {{ expanded?: boolean, limit?: number }} [opts]
 * @returns {{ visible: object[], hiddenCount: number }}
 */
export function visibleCharactersForHome(
  characters,
  campaigns,
  { expanded = false, limit = HOME_CHARACTER_PREVIEW_LIMIT } = {},
) {
  const sorted = sortCharactersForHome(characters, campaigns);
  if (expanded) {
    return { visible: sorted, hiddenCount: 0 };
  }
  const previewLimit = Math.max(0, Number(limit) || 0);
  const visible = sorted.slice(0, previewLimit);
  return {
    visible,
    hiddenCount: Math.max(0, sorted.length - visible.length),
  };
}

/**
 * Priority for Home NPC cards.
 * 0 = on a live-session campaign
 * 1 = on an active (alive) campaign
 * 2 = older / inactive-only / unassigned
 *
 * @param {{ id?: number, campaign?: number | { id?: number } | null }} npc
 * @param {object[] | null | undefined} campaigns
 * @returns {0 | 1 | 2}
 */
export function npcHomeSortTier(npc, campaigns) {
  const npcId = npc?.id;
  if (npcId == null) return 2;
  const npcCampaignId =
    npc?.campaign != null && typeof npc.campaign === "object"
      ? npc.campaign.id
      : npc?.campaign;
  let best = 2;
  for (const campaign of campaigns || []) {
    const roster = Array.isArray(campaign?.campaign_npcs)
      ? campaign.campaign_npcs
      : [];
    const onRoster =
      roster.some((n) => n?.id === npcId) ||
      (npcCampaignId != null && campaign?.id === npcCampaignId);
    if (!onRoster) continue;
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
export function compareNpcsForHome(a, b, campaigns) {
  const tierDiff = npcHomeSortTier(a, campaigns) - npcHomeSortTier(b, campaigns);
  if (tierDiff !== 0) return tierDiff;
  const nameA = String(a?.name || "").trim().toLocaleLowerCase();
  const nameB = String(b?.name || "").trim().toLocaleLowerCase();
  if (nameA !== nameB) return nameA.localeCompare(nameB);
  return (a?.id ?? 0) - (b?.id ?? 0);
}

/**
 * @param {object[] | null | undefined} npcs
 * @param {object[] | null | undefined} campaigns
 * @returns {object[]}
 */
export function sortNpcsForHome(npcs, campaigns) {
  return [...(npcs || [])].sort((a, b) => compareNpcsForHome(a, b, campaigns));
}

/**
 * Collapsed: first N of the priority-sorted NPC list. Expanded: full list.
 *
 * @param {object[] | null | undefined} npcs
 * @param {object[] | null | undefined} campaigns
 * @param {{ expanded?: boolean, limit?: number }} [opts]
 * @returns {{ visible: object[], hiddenCount: number }}
 */
export function visibleNpcsForHome(
  npcs,
  campaigns,
  { expanded = false, limit = HOME_NPC_PREVIEW_LIMIT } = {},
) {
  const sorted = sortNpcsForHome(npcs, campaigns);
  if (expanded) {
    return { visible: sorted, hiddenCount: 0 };
  }
  const previewLimit = Math.max(0, Number(limit) || 0);
  const visible = sorted.slice(0, previewLimit);
  return {
    visible,
    hiddenCount: Math.max(0, sorted.length - visible.length),
  };
}

/** Max faction cards shown on Home before "show more". */
export const HOME_FACTION_PREVIEW_LIMIT = HOME_CHARACTER_PREVIEW_LIMIT;

/**
 * Home "Your Factions" ownership: Faction has no creator FK; only the
 * campaign GM can create factions, so "created by me" ≡ campaign.gm.
 * Accepts gm as `{ id }` or bare id; coerces string/number ids.
 *
 * @param {object | null | undefined} campaign
 * @param {number | string | null | undefined} userId
 * @returns {boolean}
 */
export function isCampaignGmForUser(campaign, userId) {
  if (userId == null || userId === "") return false;
  const gm = campaign?.gm;
  const gmId =
    gm != null && typeof gm === "object" && !Array.isArray(gm) ? gm.id : gm;
  if (gmId == null || gmId === "") return false;
  const a = Number(gmId);
  const b = Number(userId);
  return Number.isFinite(a) && Number.isFinite(b) && a === b;
}

/**
 * GM-owned campaigns with factions, ordered like campaign Home cards.
 * Factions within a campaign are alphabetical by name.
 * Player-only campaigns (and their nested factions) are excluded.
 *
 * @param {object[] | null | undefined} campaigns
 * @param {number | string | null | undefined} gmUserId
 * @returns {{ campaign: object, factions: object[] }[]}
 */
export function buildGmFactionGroupsForHome(campaigns, gmUserId) {
  if (gmUserId == null || gmUserId === "") return [];
  const gmCampaigns = sortCampaignsForHome(
    (campaigns || []).filter((c) => isCampaignGmForUser(c, gmUserId)),
  );
  return gmCampaigns
    .map((c) => ({
      campaign: c,
      factions: [...(Array.isArray(c.factions) ? c.factions : [])].sort(
        (a, b) => {
          const nameA = String(a?.name || "").trim().toLocaleLowerCase();
          const nameB = String(b?.name || "").trim().toLocaleLowerCase();
          if (nameA !== nameB) return nameA.localeCompare(nameB);
          return (a?.id ?? 0) - (b?.id ?? 0);
        },
      ),
    }))
    .filter((g) => g.factions.length > 0);
}

/**
 * Collapsed: first N factions across priority-sorted campaign groups
 * (re-grouped for headers). Expanded: full groups.
 *
 * @param {{ campaign: object, factions: object[] }[] | null | undefined} groups
 * @param {{ expanded?: boolean, limit?: number }} [opts]
 * @returns {{ visible: { campaign: object, factions: object[] }[], hiddenCount: number }}
 */
export function visibleFactionGroupsForHome(
  groups,
  { expanded = false, limit = HOME_FACTION_PREVIEW_LIMIT } = {},
) {
  const list = Array.isArray(groups) ? groups : [];
  if (expanded) {
    return { visible: list, hiddenCount: 0 };
  }
  const flat = [];
  for (const g of list) {
    for (const f of g.factions || []) {
      flat.push({ campaign: g.campaign, faction: f });
    }
  }
  const previewLimit = Math.max(0, Number(limit) || 0);
  const slice = flat.slice(0, previewLimit);
  const hiddenCount = Math.max(0, flat.length - slice.length);
  const byCampaignId = new Map();
  const order = [];
  for (const row of slice) {
    const cid = row.campaign?.id;
    if (!byCampaignId.has(cid)) {
      byCampaignId.set(cid, { campaign: row.campaign, factions: [] });
      order.push(cid);
    }
    byCampaignId.get(cid).factions.push(row.faction);
  }
  return {
    visible: order.map((id) => byCampaignId.get(id)),
    hiddenCount,
  };
}

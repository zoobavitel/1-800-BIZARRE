/**
 * ProgressClock visibility: GM tools use `visible_to_players`; player-owned
 * clocks use `visible_to_party` (share with other PCs). Backend always sets
 * `created_by` on create (including GM), so "GM clock" ≠ `created_by == null`.
 */

export function normalizeCampaignGmId(gmRaw) {
  if (gmRaw == null || gmRaw === "") return null;
  if (typeof gmRaw === "object") {
    const id = gmRaw.id;
    if (id == null || id === "") return null;
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(gmRaw);
  return Number.isFinite(n) ? n : null;
}

/** GM session / NPC / unowned clocks — toggle `visible_to_players`. */
export function isGmManagedProgressClock(clk, campaignGmId) {
  if (clk == null) return false;
  if (clk.created_by == null || clk.created_by === "") return true;
  if (clk.npc != null && clk.npc !== "") return true;
  const gm = normalizeCampaignGmId(campaignGmId);
  const creator = Number(clk.created_by);
  if (gm != null && Number.isFinite(creator) && creator === gm) return true;
  return false;
}

/**
 * Whether the GM UI should show the "· players" badge.
 * Includes legacy GM clocks that were toggled via the mis-labeled
 * Visible to party checkbox (wrote `visible_to_party` instead).
 */
export function progressClockShowsPlayersBadge(clk, campaignGmId) {
  if (!clk) return false;
  if (clk.visible_to_players) return true;
  if (isGmManagedProgressClock(clk, campaignGmId) && clk.visible_to_party) {
    return true;
  }
  return false;
}

/**
 * Who sees a clock, as the picker shows it (PC private clocks):
 * `all` is the "All players" flag (`visible_to_players` on GM clocks,
 * `visible_to_party` on a player's clock); `ids` are the picked players.
 * The GM and the clock's creator always see it.
 */
export function clockAudience(clk, campaignGmId) {
  if (!clk) return { all: false, ids: [] };
  const gmClock = isGmManagedProgressClock(clk, campaignGmId);
  const all = gmClock ? progressClockShowsPlayersBadge(clk, campaignGmId) : !!clk.visible_to_party;
  const ids = Array.isArray(clk.visible_to)
    ? clk.visible_to.map(Number).filter(Number.isFinite)
    : [];
  return { all, ids: all ? [] : ids };
}

/** The API patch that sets a clock's audience to `{ all, ids }`. */
export function clockAudiencePatch(clk, campaignGmId, { all, ids }) {
  const visible_to = all ? [] : [...new Set((ids || []).map(Number))];
  if (isGmManagedProgressClock(clk, campaignGmId)) {
    return { visible_to_players: !!all, visible_to_party: false, visible_to };
  }
  return { visible_to_party: !!all, visible_to };
}

/**
 * Players who can be picked to see a clock: the campaign's players (not
 * the GM), labelled "username (PC name)" when they have a PC there.
 */
export function clockPlayerOptions(campaign, excludeUserId = null) {
  if (!campaign) return [];
  const gm = normalizeCampaignGmId(campaign.gm);
  const pcName = new Map();
  for (const ch of campaign.characters || []) {
    const uid = Number(ch?.user?.id ?? ch?.user);
    const name = ch?.true_name || ch?.name;
    if (Number.isFinite(uid) && name && !pcName.has(uid)) pcName.set(uid, name);
  }
  const out = [];
  const seen = new Set();
  for (const p of campaign.players || []) {
    const id = Number(p?.id ?? p);
    if (!Number.isFinite(id) || id === gm || seen.has(id)) continue;
    if (excludeUserId != null && id === Number(excludeUserId)) continue;
    seen.add(id);
    const username = p?.username || `Player ${id}`;
    out.push({ id, label: pcName.has(id) ? `${username} (${pcName.get(id)})` : username });
  }
  return out;
}

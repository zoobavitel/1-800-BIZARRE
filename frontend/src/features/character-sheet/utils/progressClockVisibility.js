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
  if (
    isGmManagedProgressClock(clk, campaignGmId) &&
    clk.visible_to_party
  ) {
    return true;
  }
  return false;
}

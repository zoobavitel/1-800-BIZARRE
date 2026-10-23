/**
 * Pick the session panel refetches for one burst of campaign event reasons.
 *
 * refetchSessionPanel has three SSE paths:
 * - heavy (any HEAVY reason): session, rolls, clocks, crews, characters;
 * - rolls-only (ROLL_ONLY): session and rolls, no clocks;
 * - clocks-only (`progress_clock`): clocks.
 * Any other reason (e.g. `session`) takes the light path: session, rolls, clocks.
 *
 * A burst can mix reasons, so this may return two refetches: a rolls-only pick
 * plus `progress_clock`, so a clock tick next to a roll is not dropped.
 *
 * @param {string[]} reasons distinct reasons left after character-scoped handling
 * @returns {string[]} reasons to pass to refetchSessionPanel("sse", reason)
 */
export function pickSessionPanelRefetches(reasons) {
  if (!reasons.length) return [];
  const heavy = reasons.find((r) => SESSION_PANEL_HEAVY_REASONS.has(r));
  if (heavy != null) return [heavy];
  const rollOnly = reasons.find((r) => SESSION_PANEL_ROLL_ONLY_REASONS.has(r));
  if (rollOnly != null) {
    return reasons.includes("progress_clock")
      ? [rollOnly, "progress_clock"]
      : [rollOnly];
  }
  // Light reasons already include clocks; only a clocks-only burst stays clocks-only.
  return [reasons.find((r) => r !== "progress_clock") ?? "progress_clock"];
}

/** Reasons that pull crews and characters too. */
export const SESSION_PANEL_HEAVY_REASONS = new Set([
  "character",
  "crew",
  "campaign",
  "npc",
  "faction",
  "update",
  "",
]);

/** Reasons that refetch only session and rolls (no clocks). */
const SESSION_PANEL_ROLL_ONLY_REASONS = new Set([
  "roll",
  "group_action",
  "experience_tracker",
]);

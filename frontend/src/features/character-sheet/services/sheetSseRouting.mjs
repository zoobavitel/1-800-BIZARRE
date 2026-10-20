/**
 * Decide what an open character sheet must refetch for a burst of campaign events.
 *
 * Events name the row that changed (`character_id`, `session_id`). A sheet only
 * needs a character it has open, so other players' saves cost it nothing.
 *
 * @param {Array<{ reason?: string, character_id?: number }>} events
 * @param {Iterable<number>} openCharacterIds
 * @returns {{ full: boolean, characterIds: number[], rolls: boolean }}
 */
export function routeSheetEvents(events, openCharacterIds) {
  const open = new Set(openCharacterIds);
  const ids = new Set();
  let full = false;
  let rolls = false;
  for (const ev of events) {
    const reason = String(ev?.reason || "update");
    if (FULL_REASONS.has(reason)) {
      full = true;
      continue;
    }
    if (IGNORED_REASONS.has(reason)) continue;
    if (ROLL_REASONS.has(reason)) rolls = true;
    const cid = Number(ev?.character_id);
    if (cid && open.has(cid)) {
      ids.add(cid);
    } else if (!cid && !ROLL_REASONS.has(reason)) {
      // Event from an older server, or one we cannot scope: be safe.
      full = true;
    }
  }
  return { full, characterIds: full ? [] : [...ids], rolls };
}

/** Campaign-wide changes or reconnect catch-up: refetch everything. */
const FULL_REASONS = new Set(["update", "campaign", "crew", ""]);
/** Changes the sheet does not show. */
const IGNORED_REASONS = new Set(["npc", "faction"]);
/** Changes that only move the session roll list. */
const ROLL_REASONS = new Set(["roll", "group_action", "session"]);

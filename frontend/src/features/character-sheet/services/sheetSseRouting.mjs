/**
 * Decide what an open character sheet must refetch for a burst of campaign events.
 *
 * Events name the row that changed (`character_id`, `session_id`). A sheet only
 * needs a character it has open, so other players' saves cost it nothing.
 *
 * @param {Array<{ reason?: string, character_id?: number }>} events
 * @param {Iterable<number>} openCharacterIds
 * @returns {{
 *   full: boolean,
 *   characterIds: number[],
 *   rolls: boolean,
 *   ownRolls: boolean,
 *   groupActions: boolean,
 * }}
 *   - `rolls`: the session roll list moved (any player).
 *   - `ownRolls`: an open character's rolls or XP tracker moved.
 *   - `groupActions`: the session's group actions may have changed.
 */
export function routeSheetEvents(events, openCharacterIds) {
  const open = new Set(openCharacterIds);
  const ids = new Set();
  let full = false;
  let rolls = false;
  let ownRolls = false;
  let groupActions = false;
  for (const ev of events) {
    const reason = String(ev?.reason || "update");
    if (FULL_REASONS.has(reason)) {
      full = true;
      continue;
    }
    if (IGNORED_REASONS.has(reason)) continue;
    if (ROLL_REASONS.has(reason)) rolls = true;
    if (GROUP_ACTION_REASONS.has(reason)) groupActions = true;
    const cid = Number(ev?.character_id);
    if (cid && open.has(cid)) {
      ids.add(cid);
      if (OWN_ROLL_REASONS.has(reason)) ownRolls = true;
    } else if (!cid && !ROLL_REASONS.has(reason)) {
      // Event from an older server, or one we cannot scope: be safe.
      full = true;
    }
  }
  if (full) {
    return {
      full: true,
      characterIds: [],
      rolls: false,
      ownRolls: false,
      groupActions: false,
    };
  }
  return { full, characterIds: [...ids], rolls, ownRolls, groupActions };
}

/** Campaign-wide changes or reconnect catch-up: refetch everything. */
const FULL_REASONS = new Set(["update", "campaign", "crew", ""]);
/** Changes the sheet does not show. */
const IGNORED_REASONS = new Set(["npc", "faction"]);
/** Changes that only move the session roll list. */
const ROLL_REASONS = new Set(["roll", "group_action", "session"]);
/** Changes to an open character's rolls or XP tracker rows. */
const OWN_ROLL_REASONS = new Set(["roll", "experience_tracker"]);
/** Changes that can open, close, or edit a session group action. */
const GROUP_ACTION_REASONS = new Set(["group_action", "session"]);

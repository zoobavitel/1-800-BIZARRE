/** Shared expand panel chrome for roster PC/NPC/faction floats. */
export const rosterExpandPanelChrome = {
  marginTop: 8,
  padding: 12,
  background: "#0d1117",
  border: "1px solid #4338ca",
  borderRadius: 8,
  position: "relative",
  boxSizing: "border-box",
};

export const rosterTwoColumnGridStyle = (showSecondColumn) => ({
  display: "grid",
  gridTemplateColumns: showSecondColumn ? "1fr 1fr" : "1fr",
  gap: 16,
  marginBottom: 12,
  alignItems: "start",
});

/**
 * Measure bottom of expanded token relative to `.session-roster-tokens` root
 * so expand slot can sit absolute under the opener without pushing the grid.
 */
export function measureRosterExpandTop(tokensEl, expandedEl) {
  if (!tokensEl || !expandedEl) return 0;
  const rootTop = tokensEl.getBoundingClientRect().top;
  const cardBottom = expandedEl.getBoundingClientRect().bottom;
  return Math.max(0, cardBottom - rootTop + (tokensEl.scrollTop || 0));
}

/**
 * Filter faction/NPC roster groups for non-GM players.
 * - Faction shown when visible_to_players !== false
 * - NPCs in that faction when players_see_npcs !== false
 * - Per-NPC visible_to_players !== false (GM still sees all)
 * - Unaffiliated NPCs hidden (no visibility toggle)
 * - Strip tier/hold/rep/notes fields players_see_* hides
 */
export function filterFactionRosterForPlayerView(factionGroups, unaffiliated) {
  const groups = Array.isArray(factionGroups) ? factionGroups : [];
  const filteredGroups = groups
    .filter(({ faction }) => faction && faction.visible_to_players !== false)
    .map(({ faction, npcs }) => {
      const seeNpcs = faction.players_see_npcs !== false;
      const list = seeNpcs
        ? (Array.isArray(npcs) ? npcs : []).filter(
            (n) => n?.visible_to_players !== false,
          )
        : [];
      return {
        faction: sanitizeFactionFieldsForPlayer(faction),
        npcs: list,
      };
    });
  return {
    factionGroups: filteredGroups,
    unaffiliated: [],
  };
}

/** Omit faction card fields the GM hid from players. */
export function sanitizeFactionFieldsForPlayer(faction) {
  if (!faction || typeof faction !== "object") return faction;
  const f = { ...faction };
  if (f.players_see_tier === false) {
    f.level = null;
  }
  if (f.players_see_hold === false) {
    f.hold = "";
  }
  if (f.players_see_reputation === false) {
    f.reputation = null;
  }
  if (f.players_see_notes === false) {
    f.notes = "";
    f.crew_notes = "";
  }
  return f;
}

/** Own PC or GM may edit session/campaign PC expand. */
export function canEditRosterPc(character, user, isGM) {
  if (isGM) return true;
  if (!user?.id || !character) return false;
  const ownerId =
    character.user_id ??
    character.user?.id ??
    (typeof character.user === "number" ? character.user : null);
  return Number(ownerId) === Number(user.id);
}

/**
 * Filter session factionPairs / ungrouped for non-GM players.
 * @param {Array<[number|string, object[]]>} factionPairs
 * @param {Record<string, object>} factionsById
 */
export function filterSessionFactionPairsForPlayer(factionPairs, factionsById) {
  const pairs = Array.isArray(factionPairs) ? factionPairs : [];
  const filtered = [];
  for (const [fid, npcList] of pairs) {
    const fac =
      factionsById?.[fid] ||
      factionsById?.[String(fid)] ||
      {};
    if (fac.visible_to_players === false) continue;
    const seeNpcs = fac.players_see_npcs !== false;
    const list = seeNpcs
      ? (npcList || []).filter((n) => n?.visible_to_players !== false)
      : [];
    filtered.push([fid, list]);
  }
  return { factionPairs: filtered, ungrouped: [] };
}

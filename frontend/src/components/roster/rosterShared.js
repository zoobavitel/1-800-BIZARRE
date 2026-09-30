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

function npcPlayerVisible(npc) {
  return npc?.visible_to_players !== false;
}

function dedupeNpcsById(list) {
  const seen = new Set();
  const out = [];
  for (const n of list) {
    const id = Number(n?.id);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(n);
  }
  return out;
}

/**
 * Filter faction/NPC roster groups for non-GM players.
 * - Faction shown when visible_to_players !== false
 * - NPCs nest under faction when players_see_npcs !== false and See on
 * - See-on NPCs from hidden factions (or players_see_npcs=false) promote to unaffiliated
 * - True orphans with See on appear in unaffiliated
 * - Strip tier/hold/rep/notes fields players_see_* hides
 */
export function filterFactionRosterForPlayerView(factionGroups, unaffiliated) {
  const groups = Array.isArray(factionGroups) ? factionGroups : [];
  const filteredGroups = [];
  const promoted = [];

  for (const entry of groups) {
    const faction = entry?.faction;
    const npcs = Array.isArray(entry?.npcs) ? entry.npcs : [];
    if (!faction) continue;

    if (faction.visible_to_players === false) {
      for (const n of npcs) {
        if (npcPlayerVisible(n)) promoted.push(n);
      }
      continue;
    }

    const seeNpcs = faction.players_see_npcs !== false;
    if (!seeNpcs) {
      for (const n of npcs) {
        if (npcPlayerVisible(n)) promoted.push(n);
      }
      filteredGroups.push({
        faction: sanitizeFactionFieldsForPlayer(faction),
        npcs: [],
      });
      continue;
    }

    filteredGroups.push({
      faction: sanitizeFactionFieldsForPlayer(faction),
      npcs: npcs.filter(npcPlayerVisible),
    });
  }

  const orphans = (Array.isArray(unaffiliated) ? unaffiliated : []).filter(
    npcPlayerVisible,
  );

  return {
    factionGroups: filteredGroups,
    unaffiliated: dedupeNpcsById([...orphans, ...promoted]),
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
 * See-on NPCs whose faction is hidden or has players_see_npcs=false become ungrouped.
 * @param {Array<[number|string, object[]]>} factionPairs
 * @param {Record<string, object>} factionsById
 * @param {object[]} [ungrouped]
 */
export function filterSessionFactionPairsForPlayer(
  factionPairs,
  factionsById,
  ungrouped = [],
) {
  const pairs = Array.isArray(factionPairs) ? factionPairs : [];
  const filtered = [];
  const promoted = [];
  for (const [fid, npcList] of pairs) {
    const fac =
      factionsById?.[fid] ||
      factionsById?.[String(fid)] ||
      {};
    const list = npcList || [];
    if (fac.visible_to_players === false) {
      for (const n of list) {
        if (npcPlayerVisible(n)) promoted.push(n);
      }
      continue;
    }
    const seeNpcs = fac.players_see_npcs !== false;
    if (!seeNpcs) {
      for (const n of list) {
        if (npcPlayerVisible(n)) promoted.push(n);
      }
      filtered.push([fid, []]);
      continue;
    }
    filtered.push([fid, list.filter(npcPlayerVisible)]);
  }
  const orphans = (Array.isArray(ungrouped) ? ungrouped : []).filter(
    npcPlayerVisible,
  );
  return {
    factionPairs: filtered,
    ungrouped: dedupeNpcsById([...orphans, ...promoted]),
  };
}

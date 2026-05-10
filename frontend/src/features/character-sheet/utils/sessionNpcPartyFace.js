/**
 * Derive session NPC row as non-GM viewers receive it from the API.
 * GM/staff campaign payloads include full clocks/stats plus visibility flags;
 * Character sheet session cards should mirror what players see.
 */
export function derivePartyFacingSessionNpc(npc) {
  if (!npc || typeof npc !== "object") {
    return { display: npc, showCard: false };
  }
  const hasGmFlags = Object.prototype.hasOwnProperty.call(
    npc,
    "show_clocks_to_players",
  );
  if (!hasGmFlags) {
    return { display: npc, showCard: true };
  }

  const showAll = !!npc.show_clocks_to_players;
  const showVuln =
    !!npc.show_clocks_to_players ||
    !!npc.show_vulnerability_clock_to_players;
  const revealedConflict = new Set(
    (npc.revealed_conflict_clock_names || []).map((n) => String(n)),
  );
  const revealedAlt = new Set(
    (npc.revealed_alt_clock_names || []).map((n) => String(n)),
  );
  const revealedProgressIds = new Set(
    (npc.revealed_progress_clock_ids || [])
      .map((id) => Number(id))
      .filter((n) => Number.isFinite(n)),
  );

  const conflict_clocks = showAll
    ? [...(npc.conflict_clocks || [])]
    : (npc.conflict_clocks || []).filter((c) =>
        revealedConflict.has(String(c?.name || "")),
      );
  const alt_clocks = showAll
    ? [...(npc.alt_clocks || [])]
    : (npc.alt_clocks || []).filter((c) =>
        revealedAlt.has(String(c?.name || "")),
      );
  const progress_clocks = showAll
    ? [...(npc.progress_clocks || [])]
    : (npc.progress_clocks || []).filter((c) =>
        revealedProgressIds.has(Number(c?.id)),
      );

  const rawStand = npc.stand_coin_stats || {};
  let stand_coin_stats = {};
  if (npc.show_stand_coin_to_players) {
    const revealedStats = (npc.revealed_stand_coin_stats || []).map((k) =>
      String(k).toUpperCase(),
    );
    if (revealedStats.length) {
      for (const key of revealedStats) {
        if (Object.prototype.hasOwnProperty.call(rawStand, key)) {
          stand_coin_stats[key] = rawStand[key];
        }
      }
    } else {
      stand_coin_stats = { ...rawStand };
    }
  }

  let abilities = [];
  if (npc.show_all_abilities_to_players) {
    abilities = [...(npc.abilities || [])];
  } else {
    const allowed = new Set(
      (npc.revealed_ability_names || [])
        .map((n) => String(n).trim().toLowerCase())
        .filter(Boolean),
    );
    if (allowed.size) {
      abilities = (npc.abilities || []).filter((ab) =>
        allowed.has(String(ab?.name || "").trim().toLowerCase()),
      );
    }
  }

  const vulnerability_clock_max = showVuln
    ? Number(npc.vulnerability_clock_max) || 0
    : 0;
  const vulnerability_clock_current = showVuln
    ? Number(npc.vulnerability_clock_current) || 0
    : 0;

  const display = {
    ...npc,
    stand_coin_stats,
    abilities,
    vulnerability_clock_max,
    vulnerability_clock_current,
    conflict_clocks,
    alt_clocks,
    progress_clocks,
  };

  const showCard = !!(
    showAll ||
    showVuln ||
    conflict_clocks.length ||
    alt_clocks.length ||
    progress_clocks.length ||
    Object.keys(stand_coin_stats).length ||
    abilities.length
  );

  return { display, showCard };
}

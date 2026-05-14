/** Pure helpers for GM session end-live XP preview (mirrors backend settle heuristics). */

import {
  archetypeLabelsJoined,
  normalizePlaybookXpArchetypeKeys,
} from "../character-sheet/utils/playbookXpTriggerSrd";

export const SESSION_ENCODED_XP_CAP = 2;

export function rollHasAbilitiesTagForEncodedXp(roll) {
  return String(roll?.description || "")
    .toLowerCase()
    .includes("[abilities:");
}

export function viceStruggleSignalsForEncodedXp(roll) {
  if (String(roll?.roll_type || "").toUpperCase() !== "CLEAR_STRESS") return 0;
  if (!String(roll?.action_name || "").toLowerCase().includes("vice")) return 0;
  const desc = String(roll?.description || "").toLowerCase();
  if (desc.includes("overindulgence")) return 1;
  const o = String(roll?.outcome || "");
  if (o === "FAILURE" || o === "BOTCH") return 1;
  return 0;
}

export function buildSessionEndLiveSummary(rolls, campaignChars, clocks) {
  const list = Array.isArray(rolls) ? rolls : [];
  const byType = {};
  let desperateCount = 0;
  for (const r of list) {
    const t = String(r.roll_type || "").toUpperCase() || "UNKNOWN";
    byType[t] = (byType[t] || 0) + 1;
    if (String(r.position || "").toLowerCase() === "desperate") desperateCount += 1;
  }
  const nameById = new Map(
    (campaignChars || []).map((c) => [
      Number(c.id),
      c.true_name || c.name || `PC #${c.id}`,
    ]),
  );
  const byChar = new Map();
  for (const r of list) {
    const cid = r.character != null ? Number(r.character) : null;
    if (!cid || Number.isNaN(cid)) continue;
    if (!byChar.has(cid)) byChar.set(cid, []);
    byChar.get(cid).push(r);
  }
  const encodedRows = [];
  for (const [cid, crolls] of byChar) {
    const playbookEvents = 0;
    const struggleEvents = crolls.reduce(
      (sum, rr) => sum + viceStruggleSignalsForEncodedXp(rr),
      0,
    );
    const playbookWouldGrant = 0;
    const struggleWouldGrant = Math.min(
      SESSION_ENCODED_XP_CAP,
      struggleEvents,
    );
    encodedRows.push({
      characterId: cid,
      name: nameById.get(cid) || `Character ${cid}`,
      /** @deprecated use playbookEvents — kept for roll signal debugging */
      standoutEvents: playbookEvents,
      playbookEvents,
      struggleEvents,
      standoutWouldGrant: playbookWouldGrant,
      playbookWouldGrant,
      struggleWouldGrant,
      totalEncodedPlaybookXp: playbookWouldGrant + struggleWouldGrant,
    });
  }
  encodedRows.sort((a, b) => a.name.localeCompare(b.name));
  const clockList = Array.isArray(clocks) ? clocks : [];
  const clocksCompleted = clockList.filter((c) => {
    const max = Number(c.max_segments) || 0;
    const filled = Number(c.filled_segments) || 0;
    return max > 0 && filled >= max;
  }).length;
  return {
    rollCount: list.length,
    byType,
    desperateCount,
    encodedRows,
    clockCount: clockList.length,
    clocksCompleted,
  };
}

/** Preview Stand Development session XP banked to the session pool at settle (SRD_DEV). */
export function developmentSessionXpPreviewFromCharacter(ch) {
  if (!ch) return 0;
  const g = String(
    ch?.stand?.development ??
      ch?.coin_stats?.DEVELOPMENT ??
      ch?.coin_stats?.development ??
      "",
  )
    .trim()
    .charAt(0)
    .toUpperCase();
  if (g && "FDCBAS".includes(g)) {
    const map = { F: 0, D: 1, C: 2, B: 3, A: 4, S: 5 };
    return map[g] ?? 0;
  }
  const idx = Math.floor(Number(ch?.standStats?.development));
  if (Number.isFinite(idx) && idx >= 0 && idx <= 5) {
    const table = [0, 1, 2, 3, 4, 5];
    return table[idx] ?? 0;
  }
  return 0;
}

export function sumManualTrackXpForSession(entries, sessionId) {
  const sid = Number(sessionId);
  if (!Number.isFinite(sid)) return 0;
  const re = /^\[(insight|prowess|resolve|heritage|playbook)\]/i;
  const list = Array.isArray(entries) ? entries : entries?.results || [];
  return list.reduce((sum, e) => {
    if (Number(e?.session) !== sid) return sum;
    if (String(e?.trigger || "").toUpperCase() !== "MANUAL") return sum;
    if (!re.test(String(e?.description || ""))) return sum;
    return sum + (Number(e?.xp_gained) || 0);
  }, 0);
}

/** Roll snapshot + per-PC encoded playbook preview + Development→pool preview. */
export function buildSessionEndLivePreview(rolls, campaignChars, clocks, characters) {
  const inner = buildSessionEndLiveSummary(rolls, campaignChars, clocks);
  const charById = new Map((characters || []).map((c) => [Number(c.id), c]));
  const encById = new Map(inner.encodedRows.map((r) => [r.characterId, r]));
  const perPcRows = (campaignChars || []).map((ch) => {
    const id = Number(ch.id);
    const enc = encById.get(id) || {
      characterId: id,
      name: ch.true_name || ch.name || `PC ${id}`,
      standoutEvents: 0,
      playbookEvents: 0,
      struggleEvents: 0,
      standoutWouldGrant: 0,
      playbookWouldGrant: 0,
      struggleWouldGrant: 0,
      totalEncodedPlaybookXp: 0,
    };
    const full = charById.get(id) || ch;
    const developmentPoolXp = developmentSessionXpPreviewFromCharacter(full);
    const pbDisplay =
      full.playbook ??
      full.playbook_display ??
      ch.playbook ??
      ch.playbook_display ??
      "Stand";
    const rawArch =
      full.playbookXpArchetypes ??
      full.playbook_xp_archetypes ??
      ch.playbookXpArchetypes ??
      ch.playbook_xp_archetypes;
    const pbKeys = normalizePlaybookXpArchetypeKeys(pbDisplay, rawArch);
    const playbookArchetypeCaption = pbKeys.length
      ? archetypeLabelsJoined(pbKeys, pbDisplay)
      : "";
    return {
      ...enc,
      characterId: id,
      name: enc.name || ch.true_name || ch.name || `PC ${id}`,
      developmentPoolXp,
      playbookArchetypeCaption,
    };
  });
  return { ...inner, perPcRows };
}

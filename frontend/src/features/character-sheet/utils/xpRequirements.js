/**
 * SRD XP requirement buckets for the character sheet (session + tracker evidence).
 * See docs/1-(800)-BIZARRE SRD.md — end-of-session category caps, desperate rolls, etc.
 */

import { ACTION_ATTR } from "../constants/srd";

export const XP_REQ_CATEGORY_KEYS = {
  DESPERATE: "desperate",
  PLAYBOOK: "playbook",
  BELIEFS: "beliefs",
  STRUGGLE: "struggle",
  INNATE: "innate",
};

export const INNATE_STAND_STATS = ["power", "speed", "precision"];

/**
 * @param {string|undefined} name action_name from roll
 * @returns {keyof typeof ACTION_ATTR|""}
 */
export function actionNameToActionKey(name) {
  if (name == null) return "";
  const raw = String(name).trim();
  if (!raw) return "";
  const u = raw.toUpperCase();
  for (const k of Object.keys(ACTION_ATTR)) {
    if (u === k) return k;
  }
  const token = u.split(/[\s·•|,-]+/)[0];
  for (const k of Object.keys(ACTION_ATTR)) {
    if (token === k) return k;
  }
  return "";
}

/**
 * Sum XP from tracker rows for a session, per trigger set, cap total (default 2).
 * @param {Array<{ session?: number|null, trigger?: string, xp_gained?: number }>} entries
 * @param {number|null|undefined} sessionId
 * @param {string[]} triggers
 * @param {number} [cap=2]
 */
export function sumTrackerXpByTriggers(entries, sessionId, triggers, cap = 2) {
  if (sessionId == null || !Array.isArray(entries) || !triggers.length) return 0;
  const sid = Number(sessionId);
  const set = new Set(triggers);
  let sum = 0;
  for (const e of entries) {
    if (e == null) continue;
    if (e.session == null) continue;
    if (Number(e.session) !== sid) continue;
    if (!set.has(e.trigger)) continue;
    sum += Math.max(0, Number(e.xp_gained) || 0);
  }
  return cap == null ? sum : Math.min(sum, cap);
}

/**
 * @param {Array<Record<string, unknown>>} rolls
 * @param {number|null|undefined} sessionId
 * @param {number|null|undefined} characterId
 * @returns {{ count: number, byAttribute: { insight: number, prowess: number, resolve: number } }}
 */
export function tallyDesperateActionRolls(rolls, sessionId, characterId) {
  const byAttribute = { insight: 0, prowess: 0, resolve: 0 };
  if (
    sessionId == null ||
    characterId == null ||
    !Array.isArray(rolls) ||
    rolls.length === 0
  ) {
    return { count: 0, byAttribute };
  }
  const sid = Number(sessionId);
  const cid = Number(characterId);
  let count = 0;
  for (const r of rolls) {
    if (r == null) continue;
    if (r.session != null && Number(r.session) !== sid) continue;
    if (Number(r.character) !== cid) continue;
    if ((r.roll_type || "").toString().toUpperCase() !== "ACTION") continue;
    const pos = (r.position || "").toString().toLowerCase();
    if (pos !== "desperate") continue;
    count += 1;
    const act = actionNameToActionKey(r.action_name);
    const attr = act ? ACTION_ATTR[act] : null;
    if (attr && Object.prototype.hasOwnProperty.call(byAttribute, attr)) {
      byAttribute[attr] += 1;
    }
  }
  return { count, byAttribute };
}

/**
 * @param {string|undefined} name
 * @returns {"power"|"speed"|"precision"|""}
 */
export function innateStandStatFromActionName(name) {
  const raw = String(name || "").trim().toLowerCase();
  if (!raw) return "";
  const token = raw.startsWith("stand_") ? raw.slice(6) : raw;
  if (INNATE_STAND_STATS.includes(token)) return token;
  return "";
}

/**
 * @param {Array<Record<string, unknown>>} rolls
 * @param {number|null|undefined} sessionId
 * @param {number|null|undefined} characterId
 * @returns {{ count: number, byStat: { power: number, speed: number, precision: number } }}
 */
export function tallyInnateStandDiceRolls(rolls, sessionId, characterId) {
  const byStat = { power: 0, speed: 0, precision: 0 };
  if (
    sessionId == null ||
    characterId == null ||
    !Array.isArray(rolls) ||
    rolls.length === 0
  ) {
    return { count: 0, byStat };
  }
  const sid = Number(sessionId);
  const cid = Number(characterId);
  let count = 0;
  for (const r of rolls) {
    if (r == null) continue;
    if (r.session != null && Number(r.session) !== sid) continue;
    if (Number(r.character) !== cid) continue;
    if ((r.roll_type || "").toString().toUpperCase() !== "ACTION") continue;
    const pos = (r.position || "").toString().toLowerCase();
    if (pos !== "desperate") continue;
    const st = innateStandStatFromActionName(r.action_name);
    if (!st) continue;
    count += 1;
    byStat[st] += 1;
  }
  return { count, byStat };
}

/**
 * @param {object} p
 * @param {number|null|undefined} p.sessionId
 * @param {number|null|undefined} p.characterId
 * @param {unknown} p.trackerEntries response list or { results }
 * @param {unknown} p.rolls response list or { results }
 */
export function buildXpRequirementSnapshot(p) {
  const sessionId = p.sessionId;
  const characterId = p.characterId;
  const asArray = (x) => (Array.isArray(x) ? x : x?.results || []) || [];
  const trackerEntries = asArray(p.trackerEntries);
  const rolls = asArray(p.rolls);

  const hasActiveSession =
    sessionId != null &&
    characterId != null &&
    Number.isFinite(Number(sessionId)) &&
    Number.isFinite(Number(characterId));

  if (!hasActiveSession) {
    return {
      hasActiveSession: false,
      beliefs: 0,
      struggle: 0,
      playbook: 0,
      desperateTrackerNote: 0,
      desperateRolls: { count: 0, byAttribute: { insight: 0, prowess: 0, resolve: 0 } },
      innateTrackerNote: 0,
      innateStandDice: { count: 0, byStat: { power: 0, speed: 0, precision: 0 } },
    };
  }

  const beliefs = sumTrackerXpByTriggers(trackerEntries, sessionId, ["BELIEFS"], 2);
  const struggle = sumTrackerXpByTriggers(trackerEntries, sessionId, ["STRUGGLE"], 2);
  const playbook = sumTrackerXpByTriggers(
    trackerEntries,
    sessionId,
    ["PLAYBOOK_SPECIFIC", "STANDOUT"],
    2,
  );
  const desperateTrackerNote = sumTrackerXpByTriggers(
    trackerEntries,
    sessionId,
    ["DESPERATE", "DESPERATE_ROLL"],
    2,
  );
  const desperateRolls = tallyDesperateActionRolls(rolls, sessionId, characterId);
  const innateTrackerNote = sumTrackerXpByTriggers(
    trackerEntries,
    sessionId,
    ["INNATE"],
    null,
  );
  const innateStandDice = tallyInnateStandDiceRolls(rolls, sessionId, characterId);

  return {
    hasActiveSession: true,
    beliefs,
    struggle,
    playbook,
    desperateTrackerNote,
    desperateRolls,
    innateTrackerNote,
    innateStandDice,
  };
}

export function formatAttrTally(byAttribute) {
  const parts = ["insight", "prowess", "resolve"]
    .filter((k) => (byAttribute[k] || 0) > 0)
    .map((k) => `${k} +${byAttribute[k]}`);
  return parts.length ? parts.join(" · ") : "—";
}

export function formatInnateStandTally(byStat) {
  const parts = INNATE_STAND_STATS
    .filter((k) => (byStat[k] || 0) > 0)
    .map((k) => `${k} +${byStat[k]}`);
  return parts.length ? parts.join(" · ") : "—";
}

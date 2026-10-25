/**
 * Faction autosave helpers shared by the NPC sheet and the session panel.
 *
 * - One save in flight per faction. Edits made during a save queue exactly
 *   one follow-up save, which sends the latest values when the first ends.
 * - A save sends only the fields that differ from the last copy the server
 *   agreed to (the "baseline"), so it can't revert fields another panel or
 *   the reverse-standing sync changed in the meantime.
 * - When the server copy refreshes, fields with unsaved local edits keep the
 *   local value and every other field takes the server value.
 */

/** Deep equality for the plain JSON values a faction holds. */
export function sameValue(a, b) {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/** Keys of `draft` whose value differs from `baseline` (all keys if no baseline). */
export function changedKeys(draft, baseline) {
  if (!draft || typeof draft !== "object") return [];
  if (!baseline || typeof baseline !== "object") return Object.keys(draft);
  return Object.keys(draft).filter((k) => !sameValue(draft[k], baseline[k]));
}

/** Copy of `obj` with only `keys`. */
export function pickKeys(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}

/**
 * Move unsaved local edits onto a fresh server copy.
 *
 * A field where `local` differs from `baseline` keeps the local value. Every
 * other field takes the `server` value. With no local draft, the server copy
 * is used as is.
 */
export function rebaseDraft(local, baseline, server) {
  if (!local) return { ...server };
  const next = { ...server };
  for (const k of changedKeys(local, baseline)) next[k] = local[k];
  return next;
}

/**
 * Run `save(key)` at most once at a time per key.
 *
 * A request made while a save for the same key is in flight marks one
 * follow-up; any number of such requests still give a single follow-up.
 * `save` must read the latest values itself when it runs. It should handle
 * its own errors: a throw ends the run and drops the follow-up.
 *
 * @param {(key: string) => Promise<void>} save
 */
export function createSerialSaveQueue(save) {
  const inFlight = new Set();
  const pending = new Set();
  return {
    async request(key) {
      const k = String(key);
      if (inFlight.has(k)) {
        pending.add(k);
        return;
      }
      inFlight.add(k);
      try {
        do {
          pending.delete(k);
          await save(k);
        } while (pending.has(k));
      } finally {
        inFlight.delete(k);
        pending.delete(k);
      }
    },
    isSaving(key) {
      return inFlight.has(String(key));
    },
  };
}

// --- Session panel drafts -------------------------------------------------
// The session panel edits numbers and JSON as text, so its drafts hold
// strings. These helpers turn a server faction into a draft and a draft
// back into a PATCH body.

const VISIBILITY_FLAGS = [
  "players_see_tier",
  "players_see_hold",
  "players_see_reputation",
  "players_see_notes",
  "players_see_npcs",
];

/** Session-panel draft for a faction from the API. */
export function sessionFactionDraft(f) {
  const draft = {
    name: f?.name ?? "",
    faction_type: f?.faction_type ?? "",
    level: String(f?.level ?? 0),
    hold: String(f?.hold ?? "weak"),
    reputation: String(f?.reputation ?? 0),
    notes: f?.notes ?? "",
    crew_notes: f?.crew_notes ?? "",
    visible_to_players: !!f?.visible_to_players,
    contacts: JSON.stringify(f?.contacts ?? [], null, 2),
    inventory: JSON.stringify(f?.inventory ?? [], null, 2),
    faction_status: JSON.stringify(f?.faction_status ?? {}, null, 2),
  };
  for (const flag of VISIBILITY_FLAGS) draft[flag] = f?.[flag] !== false;
  return draft;
}

function parseJsonText(raw, fallback) {
  const txt = String(raw ?? "").trim();
  if (!txt) return fallback;
  return JSON.parse(txt);
}

function parseIntText(raw) {
  return Number.parseInt(String(raw ?? "0"), 10) || 0;
}

const SESSION_FIELD_TO_API = {
  name: (v) => String(v ?? "").trim(),
  faction_type: (v) => String(v ?? "").trim(),
  level: parseIntText,
  hold: (v) => String(v ?? "weak") || "weak",
  reputation: parseIntText,
  notes: (v) => String(v ?? ""),
  crew_notes: (v) => String(v ?? ""),
  visible_to_players: (v) => !!v,
  contacts: (v) => parseJsonText(v, []),
  inventory: (v) => parseJsonText(v, []),
  faction_status: (v) => parseJsonText(v, {}),
  ...Object.fromEntries(VISIBILITY_FLAGS.map((flag) => [flag, (v) => v !== false])),
};

/**
 * PATCH body for the given draft keys. Unknown keys are skipped.
 * Throws a SyntaxError when a JSON field doesn't parse.
 */
export function sessionFactionPatch(draft, keys) {
  const body = {};
  for (const k of keys) {
    const toApi = SESSION_FIELD_TO_API[k];
    if (toApi) body[k] = toApi(draft?.[k]);
  }
  return body;
}

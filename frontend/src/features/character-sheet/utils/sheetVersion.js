/**
 * Versioned sheet saves (PR 7b).
 *
 * Every character has a `version` the server bumps on every write. The sheet
 * sends the version of the server copy it last adopted (the "base"). A save
 * against an older version gets `409 {code: "version_conflict", current}`.
 *
 * Bodies here are PATCH bodies: the output of the sheet's save pipeline
 * (`transformFrontendToBackend`). They are compared in "units": keys that only
 * make sense together (all ability lists, heritage + its picks, one harm slot)
 * are sent and compared as one.
 *
 * A unit is "edited" when the local value differs from both
 *   - the clean copy (what the sheet showed when it last matched the server), and
 *   - the base (the server copy the sheet last adopted).
 * Differing from the clean copy alone can mean the sheet took a server value.
 * Differing from the base alone can mean the sheet still shows an old value it
 * did not refresh while it had unsaved edits. Neither is a user edit, and
 * sending either would overwrite newer data.
 */

export const MAX_SILENT_RETRIES = 3;

/** Backoff before silent retry n (0-based), before jitter. */
const RETRY_BASE_DELAYS_MS = [250, 500, 1000];

const UNIT_GROUPS = [
  ["vice", ["vice", "custom_vice"]],
  [
    "abilities",
    [
      "standard_abilities",
      "hamon_ability_ids",
      "spin_ability_ids",
      "custom_ability_type",
      "custom_ability_description",
      "extra_custom_abilities",
    ],
  ],
  ["heritage", ["heritage", "selected_benefits", "selected_detriments"]],
  [
    "creation",
    ["action_dots", "action_dice_gained", "level", "coin_stats"],
  ],
  ["harm1a", ["harm_level1_used", "harm_level1_name"]],
  ["harm1b", ["harm_level1_slot2_used", "harm_level1_slot2_name"]],
  ["harm2a", ["harm_level2_used", "harm_level2_name"]],
  ["harm2b", ["harm_level2_slot2_used", "harm_level2_slot2_name"]],
  ["harm3", ["harm_level3_used", "harm_level3_name"]],
  ["harm4", ["harm_level4_used", "harm_level4_name"]],
];

const UNIT_OF_KEY = new Map();
for (const [unit, keys] of UNIT_GROUPS) {
  for (const key of keys) UNIT_OF_KEY.set(key, unit);
}

/** Keys never diffed: files and image removal always ride along when present. */
const PASSTHROUGH_KEYS = new Set(["imageFile", "image", "version"]);

const UNIT_LABELS = {
  true_name: "Name",
  stand_name: "Stand name",
  heritage: "Heritage",
  playbook: "Playbook",
  secondary_playbook: "Playbook",
  playbook_xp_archetypes: "Playbook XP triggers",
  background_note: "Background",
  background_note2: "Notes",
  appearance: "Look",
  vice: "Vice",
  vice_details: "Vice details",
  close_friend: "Close friend",
  rival: "Rival",
  image_url: "Portrait",
  creation: "Action dots and Stand grades",
  stand: "Stand",
  stress: "Stress",
  trauma: "Trauma",
  stand_armor_used: "Armor",
  has_physical_armor_item: "Armor",
  physical_armor_bonus_charges: "Armor",
  physical_armor_used: "Armor",
  spin_armor_used: "Armor",
  hamon_armor_used: "Armor",
  special_armor_used: "Armor",
  harm1a: "Harm",
  harm1b: "Harm",
  harm2a: "Harm",
  harm2b: "Harm",
  harm3: "Harm",
  harm4: "Harm",
  healing_clock_filled: "Healing clock",
  healing_clock_segments: "Healing clock",
  progress_clocks: "Clocks",
  campaign: "Campaign",
  inventory: "Inventory",
  reputation_status: "Reputation",
  npc_standing: "NPC standing",
  abilities: "Abilities",
  fed_today: "Heritage status",
  disguised_as_human: "Heritage status",
  coin_boxes: "Coin",
  stash_slots: "Stash",
};

export function unitOfKey(key) {
  return UNIT_OF_KEY.get(key) || key;
}

/** Human label for a unit, for the conflict banner. */
export function unitLabel(unit) {
  return UNIT_LABELS[unit] || String(unit).replace(/_/g, " ");
}

/** Distinct labels for a list of units, in order. */
export function unitLabels(units) {
  return [...new Set((units || []).map(unitLabel))];
}

/** JSON with sorted object keys, so key order never counts as a change. */
export function stableStringify(value) {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(",")}}`;
}

function unitValue(body, unit) {
  const out = {};
  for (const [key, value] of Object.entries(body || {})) {
    if (PASSTHROUGH_KEYS.has(key)) continue;
    if (unitOfKey(key) === unit) out[key] = value;
  }
  return out;
}

function unitsOf(...bodies) {
  const units = new Set();
  for (const body of bodies) {
    for (const key of Object.keys(body || {})) {
      if (!PASSTHROUGH_KEYS.has(key)) units.add(unitOfKey(key));
    }
  }
  return units;
}

function unitChanged(a, b, unit) {
  return stableStringify(unitValue(a, unit)) !== stableStringify(unitValue(b, unit));
}

/**
 * Units the user edited: local differs from the base and from the clean copy.
 * Only units present in the local body count (the body decides what is sendable).
 * With no clean copy, a difference from the base is enough.
 */
export function editedUnits(localBody, cleanBody, baseBody) {
  const out = [];
  for (const unit of unitsOf(localBody)) {
    if (!unitChanged(localBody, baseBody, unit)) continue;
    if (cleanBody && !unitChanged(localBody, cleanBody, unit)) continue;
    out.push(unit);
  }
  return out.sort();
}

/**
 * Units that really conflict after a 409: the server changed them since the
 * base, and the local value is not already what the server has.
 */
export function conflictingUnits(units, localBody, baseBody, currentBody) {
  return (units || []).filter(
    (unit) =>
      unitChanged(baseBody, currentBody, unit) &&
      unitChanged(localBody, currentBody, unit),
  );
}

/** Units the local body still needs to send against `currentBody`. */
export function unitsStillDifferent(units, localBody, currentBody) {
  return (units || []).filter((unit) => unitChanged(localBody, currentBody, unit));
}

/** The keys of `body` that belong to `units`, plus any passthrough keys. */
export function pickUnits(body, units) {
  const wanted = new Set(units || []);
  const out = {};
  for (const [key, value] of Object.entries(body || {})) {
    if (PASSTHROUGH_KEYS.has(key) || wanted.has(unitOfKey(key))) {
      out[key] = value;
    }
  }
  return out;
}

/** True when a PATCH body carries nothing but the version. */
export function bodyIsEmpty(body) {
  return Object.keys(body || {}).every((k) => k === "version");
}

/** Jittered backoff for silent retry `attempt` (0-based): ~250 ms, ~500 ms, ~1 s. */
export function silentRetryDelayMs(attempt, random = Math.random) {
  const i = Math.min(Math.max(0, attempt), RETRY_BASE_DELAYS_MS.length - 1);
  return Math.round(RETRY_BASE_DELAYS_MS[i] * (0.5 + random()));
}

export function isVersionConflictError(err) {
  return err?.status === 409 && err?.data?.code === "version_conflict";
}

/** Whether a server copy with `incoming` version may replace one with `held`. */
export function isSameOrNewerVersion(held, incoming) {
  if (typeof incoming !== "number") return false;
  return typeof held !== "number" || incoming >= held;
}

/** Thrown when edited fields overlap a newer server change. */
export class SheetConflictError extends Error {
  constructor(units, current) {
    super(
      `Someone else changed ${unitLabels(units).join(", ")} while you were editing.`,
    );
    this.name = "SheetConflictError";
    this.code = "sheet_conflict";
    this.units = units;
    this.labels = unitLabels(units);
    this.current = current;
  }
}

/**
 * Thrown when a newer local edit superseded an update while it was in flight.
 * The server took the save and its reply is the held copy; only applying the
 * reply to the screen is skipped. Kept apart from AbortError on purpose: a
 * request that really aborted was not saved and must not be treated as saved.
 */
export class SupersededSaveError extends Error {
  constructor() {
    super("Save superseded by a newer edit");
    this.name = "SupersededSaveError";
    this.code = "sheet_superseded";
  }
}

export function isSupersededSaveError(err) {
  return err?.code === "sheet_superseded";
}

/** Thrown when silent retries ran out without an overlap; try again later. */
export class SheetSaveRetryError extends Error {
  constructor() {
    super("Having trouble saving, retrying…");
    this.name = "SheetSaveRetryError";
    this.code = "sheet_save_retry";
  }
}

/**
 * Send the edited units with the base version; on a 409, rebase and retry.
 *
 * @param {object} opts
 * @param {object} opts.localBody PATCH body built from the sheet now
 * @param {object | null} opts.cleanBody body built from the sheet's clean copy
 * @param {{ raw: object, body: object }} opts.base adopted server copy and its body
 * @param {(raw: object) => object} opts.bodyFromRaw build a body from a server row
 * @param {(body: object) => Promise<object>} opts.patch sends one PATCH
 * @param {(raw: object) => void} opts.adopt store a newer server copy as the base
 * @param {{ get: () => number, set: (n: number) => void }} opts.retries
 *   silent retries in a row, kept across saves; reset on success
 * @param {string[]} [opts.excludeUnits] units never to send (Reload drops these)
 * @param {(body: object) => object} [opts.finalizeBody] last edits to the body
 * @param {(ms: number) => Promise<void>} [opts.sleep]
 * @param {() => number} [opts.random]
 * @returns {Promise<{ saved: object, sentBody: object, skipped: boolean }>}
 */
export async function runVersionedSheetPatch({
  localBody,
  cleanBody,
  base,
  bodyFromRaw,
  patch,
  adopt,
  retries,
  excludeUnits = [],
  finalizeBody = (b) => b,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random = Math.random,
}) {
  const excluded = new Set(excludeUnits);
  let baseRaw = base.raw;
  let baseBody = base.body;
  let units = editedUnits(localBody, cleanBody, baseBody).filter(
    (u) => !excluded.has(u),
  );
  for (;;) {
    const body = finalizeBody({
      ...pickUnits(localBody, units),
      version: baseRaw.version,
    });
    if (bodyIsEmpty(body)) {
      retries.set(0);
      return { saved: baseRaw, sentBody: body, skipped: true };
    }
    try {
      const saved = await patch(body);
      retries.set(0);
      adopt(saved);
      return { saved, sentBody: body, skipped: false };
    } catch (err) {
      if (!isVersionConflictError(err)) throw err;
      const current = err.data.current;
      const currentBody = bodyFromRaw(current);
      const conflicts = conflictingUnits(units, localBody, baseBody, currentBody);
      adopt(current);
      baseRaw = current;
      baseBody = currentBody;
      if (conflicts.length > 0) throw new SheetConflictError(conflicts, current);
      const attempt = retries.get();
      if (attempt >= MAX_SILENT_RETRIES) throw new SheetSaveRetryError();
      retries.set(attempt + 1);
      units = unitsStillDifferent(units, localBody, currentBody);
      await sleep(silentRetryDelayMs(attempt, random));
    }
  }
}

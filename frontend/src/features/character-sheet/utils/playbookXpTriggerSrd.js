/**
 * Canonical SRD copy for playbook-specific XP archetypes (Advancement tables).
 * Keep in sync with docs/1-(800)-BIZARRE SRD.md and backend
 * characters.services.playbook_xp_archetype.
 */

function playbookToPathKey(pb) {
  if (pb == null || pb === "") return "STAND";
  const u = String(pb).toUpperCase();
  if (u === "HAMON" || u === "SPIN" || u === "STAND") return u;
  const raw = String(pb);
  if (raw === "Hamon") return "HAMON";
  if (raw === "Spin") return "SPIN";
  if (raw === "Stand") return "STAND";
  return "STAND";
}

/** @typedef {{ key: string, label: string, trigger: string }} ArchetypeRow */

/** @type {readonly ArchetypeRow[]} */
export const STAND_ARCHETYPE_ROWS = Object.freeze([
  {
    key: "COLONY",
    label: "Colony",
    trigger:
      "Address a challenge by coordinating your Stand's units across multiple targets or fronts.",
  },
  {
    key: "AUTOMATIC",
    label: "Automatic",
    trigger:
      "Address a challenge by allowing your Stand to act on a trigger you set in advance.",
  },
  {
    key: "TOOLBOUND",
    label: "Tool-Bound",
    trigger:
      "Address a challenge by channeling your Stand through an object, machine, or medium.",
  },
  {
    key: "FIGHTING",
    label: "Fighting Spirit",
    trigger:
      "Address a challenge through direct Stand confrontation or sustained physical force.",
  },
  {
    key: "PHENOMENA",
    label: "Phenomena",
    trigger:
      "Address a challenge by exploiting the bizarre or reality-defying nature of your Stand.",
  },
  {
    key: "SHARED",
    label: "Shared",
    trigger:
      "Address a challenge by extending your Stand's reach to cover allies or multiple locations.",
  },
]);

/** @type {readonly ArchetypeRow[]} */
export const SPIN_ARCHETYPE_ROWS = Object.freeze([
  {
    key: "CAVALIER",
    label: "Cavalier",
    trigger:
      "Address a challenge through momentum, speed, or superior positioning.",
  },
  {
    key: "EXECUTIONER",
    label: "Executioner",
    trigger:
      "Address a challenge by targeting a specific vulnerability or body part with precision.",
  },
  {
    key: "MEDICO",
    label: "Medico",
    trigger:
      "Address a challenge by treating harm, diagnosing injury, or stabilizing an ally with Spin.",
  },
  {
    key: "BALLBREAKER",
    label: "Ballbreaker",
    trigger:
      "Address a challenge by disabling or nullifying an enemy's power, resource, or ability.",
  },
]);

/** @type {readonly ArchetypeRow[]} */
export const HAMON_ARCHETYPE_ROWS = Object.freeze([
  {
    key: "TRADITIONALIST",
    label: "Traditionalist",
    trigger:
      "Address a challenge through disciplined Hamon technique, mentorship, or self-sacrifice.",
  },
  {
    key: "ADAPTIVE_FLOW",
    label: "Adaptive Flow",
    trigger:
      "Address a challenge by applying Hamon in an improvised or unexpected way.",
  },
  {
    key: "CYBER_HAMONIST",
    label: "Cyber-Hamonist",
    trigger:
      "Address a challenge by channeling Ripple through technology or cybernetics.",
  },
  {
    key: "DARK_RESONANCE",
    label: "Dark Resonance",
    trigger:
      "Address a challenge by draining, corrupting, or inverting another's life force.",
  },
  {
    key: "BIO_HARMONICS",
    label: "Bio-Harmonics",
    trigger:
      "Address a challenge through biological dominance, absorption, or physical transformation.",
  },
]);

const _STAND_KEYS = new Set(STAND_ARCHETYPE_ROWS.map((r) => r.key));
const _SPIN_KEYS = new Set(SPIN_ARCHETYPE_ROWS.map((r) => r.key));
const _HAMON_KEYS = new Set(HAMON_ARCHETYPE_ROWS.map((r) => r.key));

/**
 * @param {string|undefined|null} playbookDisplayOrApi
 * @returns {"STAND"|"HAMON"|"SPIN"}
 */
export function normalizePlaybookPathKey(playbookDisplayOrApi) {
  const u = playbookToPathKey(playbookDisplayOrApi || "STAND");
  if (u === "HAMON" || u === "SPIN") return u;
  return "STAND";
}

/**
 * @param {"STAND"|"HAMON"|"SPIN"} path
 * @returns {readonly ArchetypeRow[]}
 */
export function archetypeRowsForPlaybookPath(path) {
  if (path === "HAMON") return HAMON_ARCHETYPE_ROWS;
  if (path === "SPIN") return SPIN_ARCHETYPE_ROWS;
  return STAND_ARCHETYPE_ROWS;
}

/**
 * @param {string|undefined|null} playbookDisplayOrApi
 * @returns {readonly ArchetypeRow[]}
 */
export function archetypeRowsForCharacterPlaybook(playbookDisplayOrApi) {
  return archetypeRowsForPlaybookPath(
    normalizePlaybookPathKey(playbookDisplayOrApi),
  );
}

/**
 * Dedupe preserving order; filter to allowed keys for playbook.
 * @param {string|undefined|null} playbookDisplayOrApi
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizePlaybookXpArchetypeKeys(playbookDisplayOrApi, raw) {
  const path = normalizePlaybookPathKey(playbookDisplayOrApi);
  const allowed =
    path === "HAMON" ? _HAMON_KEYS : path === "SPIN" ? _SPIN_KEYS : _STAND_KEYS;
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const x of raw) {
    const k = String(x || "")
      .trim()
      .toUpperCase();
    if (!allowed.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

/**
 * @param {string[]} keys
 * @param {string|undefined|null} playbookDisplayOrApi
 * @returns {string}
 */
export function mergedTriggerSentencesForKeys(keys, playbookDisplayOrApi) {
  const path = normalizePlaybookPathKey(playbookDisplayOrApi);
  const rows = archetypeRowsForPlaybookPath(path);
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const parts = [];
  for (const k of keys || []) {
    const row = byKey.get(k);
    if (row) parts.push(row.trigger);
  }
  return parts.join(" ");
}

/**
 * @param {string[]} keys
 * @param {string|undefined|null} playbookDisplayOrApi
 * @returns {string}
 */
export function archetypeLabelsJoined(keys, playbookDisplayOrApi) {
  const path = normalizePlaybookPathKey(playbookDisplayOrApi);
  const rows = archetypeRowsForPlaybookPath(path);
  const byKey = new Map(rows.map((r) => [r.key, r.label]));
  return (keys || [])
    .map((k) => byKey.get(k))
    .filter(Boolean)
    .join(" · ");
}

/**
 * Infer initial archetype keys when the saved list is empty (Stand type / ability paths).
 * @param {string|undefined|null} playbookDisplayOrApi
 * @param {{ standType?: string, abilities?: Array<{ type?: string, hamon_type?: string, spin_type?: string }> }} opts
 * @returns {string[]}
 */
export function inferSeedArchetypeKeys(playbookDisplayOrApi, opts = {}) {
  const path = normalizePlaybookPathKey(playbookDisplayOrApi);
  const abilities = Array.isArray(opts.abilities) ? opts.abilities : [];
  if (path === "STAND") {
    const t = String(opts.standType || "")
      .trim()
      .toUpperCase();
    return t && _STAND_KEYS.has(t) ? [t] : [];
  }
  if (path === "HAMON") {
    const out = [];
    const seen = new Set();
    for (const a of abilities) {
      if (String(a?.type || "").toLowerCase() !== "hamon") continue;
      const k = String(a?.hamon_type || "")
        .trim()
        .toUpperCase();
      if (k && k !== "FOUNDATION" && _HAMON_KEYS.has(k) && !seen.has(k)) {
        seen.add(k);
        out.push(k);
      }
    }
    return out;
  }
  const out = [];
  const seen = new Set();
  for (const a of abilities) {
    if (String(a?.type || "").toLowerCase() !== "spin") continue;
    const k = String(a?.spin_type || "")
      .trim()
      .toUpperCase();
    if (k && k !== "FOUNDATION" && _SPIN_KEYS.has(k) && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

// Utility functions for character sheet operations

export const getAttributeDice = (actions, actionRatings) => {
  return actions.filter((action) => actionRatings[action] > 0).length;
};

export const getTotalXP = (xpTracks) => {
  return Object.values(xpTracks).reduce((total, xp) => total + xp, 0);
};

export const createDefaultCharacter = () => ({
  name: "",
  standName: "",
  heritage: null,
  background: "",
  look: "",
  vice: "",
  crew: "",
  actionRatings: {
    HUNT: 0,
    STUDY: 0,
    SURVEY: 0,
    TINKER: 0,
    FINESSE: 0,
    PROWL: 0,
    SKIRMISH: 0,
    WRECK: 0,
    BIZARRE: 0,
    COMMAND: 0,
    CONSORT: 0,
    SWAY: 0,
  },
  /* Six D ranks = 6 coin points (SRD-valid baseline); player reallocates from here. */
  standStats: {
    power: 1,
    speed: 1,
    range: 1,
    durability: 1,
    precision: 1,
    development: 1,
  },
  stress: Array(9).fill(false),
  trauma: [],
  armor: { armor: false, heavy: false, special: false },
  harmEntries: {
    level3: [""],
    level2: ["", ""],
    level1: ["", ""],
  },
  coin: Array(4).fill(false),
  stash: Array(40).fill(false),
  healingClock: 0,
  xp: {
    insight: 0,
    prowess: 0,
    resolve: 0,
    heritage: 0,
    playbook: 0,
  },
  abilities: [],
  clocks: [],
  selected_benefits: [],
  selected_detriments: [],
});

export const viceOptions = [
  "Gambling",
  "Obsession",
  "Violence",
  "Pleasure",
  "Stupor",
  "Weird",
  "Obligation",
  "Faith",
  "Luxury",
  "Art",
  "Competition",
  "Power",
  "Adventure",
  "Solitude",
  "Justice",
];

export const standardAbilities = [
  "Ambush",
  "Cascade Effect",
  "Final Barrage",
  "Parry and Break",
  "Phantom Pain",
  "Savage",
  "Spin-Boosted Blow",
  "Steady Barrage",
  "Invigorated",
  "Legendary Guard",
  "Battleborn",
  "Swan Song",
  "Iron Will",
  "Tough as Nails",
  "Fortitude",
  "Overdrive",
  "Masochist",
  "Undying Will",
  "Rule of Cool",
  "Bizarre Step",
  "Cloak & Dagger",
  "Mesmeriser",
  "Saboteur",
  "Shadow",
  "Subterfuge",
  "Bizarre Intuition",
  "Focused",
  "Like Looking into a Mirror",
  "Mastermind",
  "Neural Lace",
  "Scout",
  "Shared Vision",
  "Aura of Confidence",
  "Notorious",
  "Scoundrel",
  "Trust in Me",
  "Foresight",
  "Bodyguard",
  "Guardian",
  "Functioning Vice",
  "Stand Proud",
  "Analyst",
  "Expertise",
  "Calculating",
  "The Devil's Footsteps",
  "Superhero Landing",
  "Daredevil",
  "Bizarre Improvisation",
  "Automatic Trigger",
  "Weapon Recall",
  "Stand Evolution",
  "Channel Force",
  "Requiem",
];

/**
 * Convert an array of selected trauma names to a list of Trauma IDs for the backend.
 * @param {string[]} traumaNames - e.g. ["COLD", "HAUNTED"]
 * @param {Array<{ id: number, name: string }>} traumasList - from referenceAPI.getTraumas()
 * @returns {number[]} List of trauma IDs to send to API
 */
export function traumaNamesToIds(traumaNames, traumasList = []) {
  if (!Array.isArray(traumaNames)) return [];
  const nameToId = Object.fromEntries(
    (traumasList || []).map((t) => [(t.name || "").toUpperCase(), t.id]),
  );
  return traumaNames
    .map((n) => nameToId[n.toUpperCase()])
    .filter((id) => id != null);
}

/**
 * Resolve sheet heritage to an integer PK for the API (strict FK; never send display names).
 * @param {*} heritageValue - from normalized sheet (number, digit string, name string, null, etc.)
 * @param {Array<{ id: number|string, name?: string }>} heritageList - from reference API (must be non-empty)
 * @returns {number}
 */
export function resolveHeritagePkForSave(heritageValue, heritageList) {
  if (!heritageList?.length) {
    throw new Error(
      "Could not resolve heritage: heritages unavailable. Use Retry or refresh the page.",
    );
  }
  const first = heritageList[0];
  const firstPk =
    typeof first.id === "number" && Number.isFinite(first.id)
      ? first.id
      : typeof first.id === "string" && /^\d+$/.test(String(first.id).trim())
        ? parseInt(String(first.id).trim(), 10)
        : NaN;
  if (!Number.isFinite(firstPk)) {
    throw new Error(
      "Could not resolve heritage: heritages unavailable. Use Retry or refresh the page.",
    );
  }

  if (heritageValue == null || heritageValue === "") {
    return firstPk;
  }
  if (typeof heritageValue === "number" && Number.isFinite(heritageValue)) {
    return heritageValue;
  }
  if (typeof heritageValue === "string") {
    const s = heritageValue.trim();
    if (!s) return firstPk;
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    const match = heritageList.find(
      (h) => (h.name || "").toLowerCase() === s.toLowerCase(),
    );
    if (match) {
      const id = match.id;
      if (typeof id === "number" && Number.isFinite(id)) return id;
      if (typeof id === "string" && /^\d+$/.test(id.trim()))
        return parseInt(id.trim(), 10);
    }
    return firstPk;
  }
  const asStr = String(heritageValue).trim();
  if (/^\d+$/.test(asStr)) return parseInt(asStr, 10);
  return firstPk;
}

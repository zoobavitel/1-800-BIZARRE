/**
 * SRD-derived constants for 1-(800)-BIZARRE (see docs/1-(800)-BIZARRE SRD.md).
 * Single source of truth for grades, skills, trauma, vice, and stat tables.
 */

// Stand Coin grades — PC sheet uses index 0–5 (F–S); S is GM-only for PCs
export const GRADE = ["F", "D", "C", "B", "A", "S"];
export const GRADE_INDEX = { F: 0, D: 1, C: 2, B: 3, A: 4, S: 5 };
export const INDEX_TO_GRADE = (i) =>
  GRADE[Math.min(5, Math.max(0, Math.floor(Number(i) || 0)))] ?? "F";

// Character creation (SRD: 7 action dots total, max 2 per action at creation)
export const MAX_CREATION_DOTS = 7;
export const MAX_DOTS_PER_ACTION_CREATION = 2;
/** Skilled From Birth: one action may start at 3 dots (SRD). */
export const MAX_DOTS_PER_ACTION_SKILLED_FROM_BIRTH = 3;

/**
 * Per-action creation cap; Skilled From Birth allows 3 dots on one action only.
 * @param {{ hasSkilledFromBirth?: boolean, actionRatings?: Record<string, number>, action?: string }} opts
 */
export function maxDotsPerActionAtCreation({
  hasSkilledFromBirth = false,
  actionRatings = {},
  action = "",
} = {}) {
  if (!hasSkilledFromBirth) return MAX_DOTS_PER_ACTION_CREATION;
  const otherAtThree = Object.entries(actionRatings).some(
    ([k, v]) => k !== action && Number(v) === MAX_DOTS_PER_ACTION_SKILLED_FROM_BIRTH,
  );
  if (otherAtThree && Number(actionRatings[action]) !== MAX_DOTS_PER_ACTION_SKILLED_FROM_BIRTH) {
    return MAX_DOTS_PER_ACTION_CREATION;
  }
  return MAX_DOTS_PER_ACTION_SKILLED_FROM_BIRTH;
}

/** SRD Stand Coin creation: allocate six grade-values (indices F=0 … S=5 sum to budget 6 across six stats). */
export const STAND_COIN_CREATION_POINT_SUM = 6;

// 12 skills from SRD
export const SKILLS = [
  "BIZARRE",
  "COMMAND",
  "CONSORT",
  "FINESSE",
  "HUNT",
  "PROWL",
  "SKIRMISH",
  "STUDY",
  "SURVEY",
  "SWAY",
  "TINKER",
  "WRECK",
];

// Attribute mapping: which skills feed into Insight, Prowess, Resolve
export const ACTION_ATTR = {
  HUNT: "insight",
  STUDY: "insight",
  SURVEY: "insight",
  TINKER: "insight",
  FINESSE: "prowess",
  PROWL: "prowess",
  SKIRMISH: "prowess",
  WRECK: "prowess",
  BIZARRE: "resolve",
  COMMAND: "resolve",
  CONSORT: "resolve",
  SWAY: "resolve",
};

// Action descriptions (SRD)
export const ACTION_DESC = {
  BIZARRE: "Open mind to paranormal power; communicate with bizarre entities.",
  COMMAND: "Compel swift obedience; intimidate; lead group actions.",
  CONSORT:
    "Socialize with friends/contacts; access resources, information, people, places.",
  FINESSE:
    "Dextrous manipulation; subtle misdirection; pick pockets; duel; drive.",
  HUNT: "Track a target; ambush; precision/aimed attack.",
  PROWL: "Move skillfully and quietly; sneak; strike from hiding.",
  SKIRMISH: "Close combat; brawl; wrestle; hold position.",
  STUDY: "Scrutinize details; research; detect lies or true feelings.",
  SURVEY:
    "Observe situation; anticipate outcomes; spot trouble or opportunities.",
  SWAY: "Influence with guile, charm, or argument; lie; persuade.",
  TINKER:
    "Fiddle with devices; create/alter gadgets; pick locks; disable alarms.",
  WRECK: "Savage force; smash; sabotage; chaos.",
};

// Devil's Bargain common detriments (SRD) — in exchange for +1 die
export const DEVILS_BARGAIN_DETRIMENTS = [
  "Collateral damage, unintended harm",
  "Sacrifice coin or an item",
  "Betray a friend or loved one",
  "Offend or anger a faction",
  "Start and/or tick a troublesome clock",
  "Add +2 Wanted Stars to the crew from evidence or witnesses",
  "Suffer harm",
];

// Resistance attribute tooltips (SRD: which consequence type each resists)
export const RESISTANCE_ATTR_DESC = {
  INSIGHT: "Resistance (deception/understanding)",
  PROWESS: "Resistance (physical harm)",
  RESOLVE: "Resistance (mental strain)",
};

// Vice options (SRD / playbook)
export const VICE_OPTIONS = [
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

// Trauma conditions (SRD)
export const TRAUMA_KEYS = [
  "COLD",
  "HAUNTED",
  "OBSESSED",
  "PARANOID",
  "RECKLESS",
  "SOFT",
  "UNSTABLE",
  "VICIOUS",
];

export const DEFAULT_TRAUMA = Object.fromEntries(
  TRAUMA_KEYS.map((k) => [k, false]),
);

/** Fixture order srd_traumas.json pk 1..8 → sheet keys (for API `trauma` ID list fallback). */
export const TRAUMA_PK_TO_KEY = Object.fromEntries(
  TRAUMA_KEYS.map((k, i) => [i + 1, k]),
);

/** Sheet keys → fixture PKs (when /traumas/ list empty or missing a name). */
export const TRAUMA_KEY_TO_PK = Object.fromEntries(
  TRAUMA_KEYS.map((k, i) => [k, i + 1]),
);

// Durability → Stand armor charges (+ resist tiers). SRD_DEV: durability does **not** change stress track length (baseline 9).
// SRD `docs/1-(800)-BIZARRE SRD.md` Stand Armor table: F:1, D:2, C:3, B:4, A:5, S:6.
export const DUR_TABLE = [
  { armorCharges: 1, resistanceReduceLevels: 1 }, // F(0)
  { armorCharges: 2, resistanceReduceLevels: 1 }, // D(1)
  { armorCharges: 3, resistanceReduceLevels: 1 }, // C(2)
  { armorCharges: 4, resistanceReduceLevels: 1 }, // B(3)
  { armorCharges: 5, resistanceReduceLevels: 1 }, // A(4)
  { armorCharges: 6, resistanceReduceLevels: 2 }, // S(5)
];

/**
 * Stand / path armor pool (when the Stand takes the hit) — matches NPC
 * `stand_armor_charges` and SRD Stand Armor table. Separate from physical user armor.
 */
export const STAND_PATH_ARMOR_CHARGES_BY_GRADE = {
  F: 1,
  D: 2,
  C: 3,
  B: 4,
  A: 5,
  S: 6,
};

/** @param {number} durabilityIdx Stand Coin durability index 0–5 (F…S) */
export function standPathArmorMaxFromDurabilityIndex(durabilityIdx) {
  const g = INDEX_TO_GRADE(durabilityIdx);
  return STAND_PATH_ARMOR_CHARGES_BY_GRADE[g] ?? 0;
}

// Development → session XP bonus per grade (index = stat value 0–5, F…S)
export const DEV_SESSION_XP = [0, 1, 2, 3, 4, 5];

// Per-grade descriptions for PC sheet (index = stat value 0–4)
export const PC_STAT_DESC = {
  power: [
    "Human-level strength; baseline to above-average physical capability",
    "Can break through standard materials (wood, metal plating)",
    "Can shatter stone and heavy structural materials",
    "Can destroy reinforced structures and thick concrete barriers",
    "Can demolish large buildings and city blocks with ease",
  ],
  speed: [
    "25(50) ft · Desperate when ambushed · Push yourself to dash",
    "30(60) ft · Desperate when ambushed · Push yourself to dash",
    "35(70) ft · Desperate when ambushed · Risky vs D or F speed attackers · Push yourself to dash",
    "40(80) ft · Risky when ambushed vs equal or slower threats · Push yourself to dash",
    "60(120) ft · Risky or better when ambushed · Push yourself to dash",
  ],
  range: [
    "10(20) ft · Extension −2 effect",
    "20(40) ft · Push to extend · Extension −1 effect",
    "40(80) ft · Push to extend · Extension −1 effect",
    "50(100) ft · Push to extend",
    "100(200) ft · Push to extend",
  ],
  durability: [
    "1 Stand armor charge (stress track stays 9 — durability does not add boxes)",
    "2 Stand armor charges",
    "3 Stand armor charges",
    "4 Stand armor charges",
    "5 Stand armor charges",
    "6 Stand armor charges · Durability resist may reduce harm by two levels",
  ],
  precision: [
    "1s and double 1s count as critical fail",
    "Double 1s count as critical fail",
    "Cannot critical fail",
    "3 counts as partial success (inherits C)",
    "5 counts as success (inherits B + C)",
  ],
  development: [
    "Standard XP gain only",
    "+1 XP at end of each session",
    "+2 XP at end of each session",
    "+3 XP at end of each session",
    "+4 XP/session · Spend 2 stress to borrow an ability (GM discretion)",
  ],
};

// Default stand stat keys (for iteration / validation)
export const STAND_STAT_KEYS = [
  "power",
  "speed",
  "range",
  "durability",
  "precision",
  "development",
];

/** SRD_DEV: dice pools parallel to playbook actions — not Range/Development. */
export const STAND_ROLL_KEYS_ACTIVE = ["power", "speed", "precision"];

/** POWER / PRECISION / SPEED row order in ACTION RATINGS grid (Durability heading above). */
export const STAND_COLUMN_ROLL_ORDER = ["power", "precision", "speed"];

/** Includes durability when the Stand absorbs a hit (resistance-shaped). */
export const STAND_ROLL_KEYS_ALL = [
  ...STAND_ROLL_KEYS_ACTIVE,
  "durability",
];

/** SRD_DEV Stand Coin passives — no dice pools. */
export const STAND_PASSIVE_KEYS = ["range", "development"];

/**
 * Dice pool from Stand grade index 0–5 (F→S).
 * Matches SRD_DEV A=4 … F=0; S uses same 4d cap as A (no fifth die).
 */
export function standGradeIndexToDicePool(idx) {
  const diceByIdx = [0, 1, 2, 3, 4, 4];
  const i = Math.min(5, Math.max(0, Math.floor(Number(idx) || 0)));
  return diceByIdx[i] ?? 0;
}

// Default action rating keys (12 skills, uppercase)
export const ACTION_RATING_KEYS = [
  "HUNT",
  "STUDY",
  "SURVEY",
  "TINKER",
  "FINESSE",
  "PROWL",
  "SKIRMISH",
  "WRECK",
  "BIZARRE",
  "COMMAND",
  "CONSORT",
  "SWAY",
];

/** Convert backend grade letter to frontend index (0–5 for F–S) */
export function gradeToIndex(grade) {
  if (grade == null || grade === "") return 1;
  const g = String(grade).toUpperCase();
  return GRADE_INDEX[g] ?? 1;
}

/** Convert frontend index (0–5) to backend grade letter */
export function indexToGrade(i) {
  const idx = typeof i === "number" ? i : 1;
  return GRADE[Math.min(5, Math.max(0, Math.floor(idx)))] ?? "D";
}

/**
 * SRD-derived constants for 1(800)Bizarre (see docs/1(800)-Bizarre SRD.txt).
 * Single source of truth for grades, skills, trauma, vice, and stat tables.
 */

// Stand Coin grades — PC sheet uses index 0–4 (F–A); S is GM-only for PCs
export const GRADE = ['F', 'D', 'C', 'B', 'A'];
export const GRADE_INDEX = { F: 0, D: 1, C: 2, B: 3, A: 4, S: 5 };
export const INDEX_TO_GRADE = (i) => (GRADE[i] ?? 'F');

// Character creation (SRD: 7 action dots total, max 2 per action at creation)
export const MAX_CREATION_DOTS = 7;
export const MAX_DOTS_PER_ACTION_CREATION = 2;

// 12 skills from SRD
export const SKILLS = [
  'BIZARRE', 'COMMAND', 'CONSORT', 'FINESSE', 'HUNT', 'PROWL',
  'SKIRMISH', 'STUDY', 'SURVEY', 'SWAY', 'TINKER', 'WRECK',
];

// Attribute mapping: which skills feed into Insight, Prowess, Resolve
export const ACTION_ATTR = {
  HUNT: 'insight', STUDY: 'insight', SURVEY: 'insight', TINKER: 'insight',
  FINESSE: 'prowess', PROWL: 'prowess', SKIRMISH: 'prowess', WRECK: 'prowess',
  BIZARRE: 'resolve', COMMAND: 'resolve', CONSORT: 'resolve', SWAY: 'resolve',
};

// Resistance attribute tooltips (SRD: which consequence type each resists)
export const RESISTANCE_ATTR_DESC = {
  INSIGHT: 'Resistance (deception/understanding)',
  PROWESS: 'Resistance (physical harm)',
  RESOLVE: 'Resistance (mental strain)',
};

// Vice options (SRD / playbook)
export const VICE_OPTIONS = [
  'Gambling', 'Obsession', 'Violence', 'Pleasure', 'Stupor', 'Weird',
  'Obligation', 'Faith', 'Luxury', 'Art', 'Competition', 'Power',
  'Adventure', 'Solitude', 'Justice',
];

// Trauma conditions (SRD)
export const TRAUMA_KEYS = [
  'COLD', 'HAUNTED', 'OBSESSED', 'PARANOID',
  'RECKLESS', 'SOFT', 'UNSTABLE', 'VICIOUS',
];

export const DEFAULT_TRAUMA = Object.fromEntries(
  TRAUMA_KEYS.map((k) => [k, false])
);

// Durability → stress max bonus and armor charges (PC sheet; index = stat value 0–4)
export const DUR_TABLE = [
  { stressBonus: -1, armorCharges: 0 }, // F(0)
  { stressBonus: 0, armorCharges: 1 },   // D(1)
  { stressBonus: 1, armorCharges: 1 },  // C(2)
  { stressBonus: 2, armorCharges: 2 },  // B(3)
  { stressBonus: 3, armorCharges: 3 },  // A(4)
];

// Development → session XP bonus per grade (index = stat value 0–4)
export const DEV_SESSION_XP = [0, 1, 2, 3, 4];

// Per-grade descriptions for PC sheet (index = stat value 0–4)
export const PC_STAT_DESC = {
  power: [
    'Human-level strength; baseline to above-average physical capability',
    'Can break through standard materials (wood, metal plating)',
    'Can shatter stone and heavy structural materials',
    'Can destroy reinforced structures and thick concrete barriers',
    'Can demolish large buildings and city blocks with ease',
  ],
  speed: [
    '25(50) ft · Push yourself to dash',
    '30(60) ft · Acts before F · Push yourself to dash',
    '35(70) ft · Acts before D, F · Push yourself to dash',
    '40(80) ft · Acts before C, D, F · Push yourself to dash',
    '60(120) ft · Acts before B, C, D, F · Push yourself to dash',
  ],
  range: [
    '10(20) ft · Extension −2 effect',
    '20(40) ft · Push to extend · Extension −1 effect',
    '40(80) ft · Push to extend · Extension −1 effect',
    '50(100) ft · Push to extend',
    '100(200) ft · Push to extend',
  ],
  durability: [
    '−1 stress max · 0 armor charges',
    '±0 stress max · 1 armor charge',
    '+1 stress max · 1 armor charge',
    '+2 stress max · 2 armor charges',
    '+3 stress max · 3 armor charges',
  ],
  precision: [
    '1s and double 1s count as critical fail',
    'Double 1s count as critical fail',
    'Cannot critical fail',
    '3 counts as partial success (inherits C)',
    '5 counts as success (inherits B + C)',
  ],
  development: [
    'Standard XP gain only',
    '+1 XP at end of each session',
    '+2 XP at end of each session',
    '+3 XP at end of each session',
    '+4 XP/session · Spend 2 stress to borrow an ability (GM discretion)',
  ],
};

// Default stand stat keys (for iteration / validation)
export const STAND_STAT_KEYS = [
  'power', 'speed', 'range', 'durability', 'precision', 'development',
];

// Default action rating keys (12 skills, uppercase)
export const ACTION_RATING_KEYS = [
  'HUNT', 'STUDY', 'SURVEY', 'TINKER',
  'FINESSE', 'PROWL', 'SKIRMISH', 'WRECK',
  'BIZARRE', 'COMMAND', 'CONSORT', 'SWAY',
];

/** Convert backend grade letter to frontend index (0–4 for PC; S→4 if needed) */
export function gradeToIndex(grade) {
  if (grade == null || grade === '') return 1;
  const g = String(grade).toUpperCase();
  return GRADE_INDEX[g] ?? 1;
}

/** Convert frontend index (0–4) to backend grade letter */
export function indexToGrade(i) {
  const idx = typeof i === 'number' ? i : 1;
  return GRADE[Math.min(4, Math.max(0, idx))] ?? 'D';
}

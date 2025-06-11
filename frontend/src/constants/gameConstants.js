// Character-related constants
export const SKILL_CATEGORIES = {
  INSIGHT: 'insight',
  PROWESS: 'prowess',
  RESOLVE: 'resolve'
};

export const SKILLS = {
  [SKILL_CATEGORIES.INSIGHT]: ['hunt', 'study', 'survey', 'tinker'],
  [SKILL_CATEGORIES.PROWESS]: ['finesse', 'prowl', 'skirmish', 'wreck'],
  [SKILL_CATEGORIES.RESOLVE]: ['bizarre', 'command', 'consort', 'sway']
};

export const COIN_STATS = {
  POWER: 'power',
  SPEED: 'speed',
  RANGE: 'range',
  DURABILITY: 'durability',
  PRECISION: 'precision',
  DEVELOPMENT: 'development'
};

export const MAX_VALUES = {
  SKILL_POINTS: 7,
  SKILL_DOTS_AT_CREATION: 2,
  SKILL_DOTS_MAX: 4,
  COIN_POINTS: 10,
  COIN_DOTS_MAX: 5,
  STRESS_BOXES: 12
};

export const XP_COSTS = {
  SKILL_ADVANCEMENT: 5,
  COIN_STAT_ADVANCEMENT: 10,
  HP_PURCHASE: 5 // 5 XP = 1 HP
};

export const HERITAGES = {
  HUMAN: 'Human',
  ROCK_HUMAN: 'Rock Human',
  VAMPIRE: 'Vampire',
  PILLAR_MAN: 'Pillar Man',
  GRAY_MATTER: 'Gray Matter',
  HAUNTING: 'Haunting',
  CYBORG: 'Cyborg',
  ORACLE: 'Oracle'
};

export const TRAUMA_OPTIONS = [
  'Cold', 'Haunted', 'Obsessed', 'Paranoid', 
  'Reckless', 'Soft', 'Unstable', 'Vicious'
];

export const VICE_OPTIONS = [
  'N/A', 'Faith', 'Gambling', 'Luxury', 
  'Obligation', 'Pleasure', 'Stupor', 'Weird'
];

export const HARM_LEVELS = {
  LEVEL_1: 'level1',
  LEVEL_2: 'level2', 
  LEVEL_3: 'level3'
};

export const DICE_RESULTS = {
  FAILURE: 'Failure',
  PARTIAL_SUCCESS: 'Partial Success',
  SUCCESS: 'Success',
  CRITICAL_SUCCESS: 'Critical Success'
};

export const VALIDATION_MESSAGES = {
  SKILL_POINTS_EXCEEDED: 'Total skill points cannot exceed 7',
  SKILL_DOTS_EXCEEDED: 'Individual skills cannot exceed 2 points at creation',
  COIN_POINTS_EXCEEDED: 'Total coin points cannot exceed 10',
  INVALID_SKILL_VALUE: 'Skill value must be between 0-4',
  INVALID_COIN_VALUE: 'Coin stat value must be between 0-5',
  INSUFFICIENT_XP: 'Insufficient XP for this advancement',
  DATA_CORRUPTED: 'Character data corrupted - recovered from backup'
};

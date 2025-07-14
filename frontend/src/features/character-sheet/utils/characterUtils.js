// Utility functions for character sheet operations

export const getAttributeDice = (actions, actionRatings) => {
  return actions.filter(action => actionRatings[action] > 0).length;
};

export const getTotalXP = (xpTracks) => {
  return Object.values(xpTracks).reduce((total, xp) => total + xp, 0);
};

export const createDefaultCharacter = () => ({
  name: '',
  standName: '',
  heritage: 'Human',
  background: '',
  look: '',
  vice: '',
  crew: '',
  actionRatings: {
    HUNT: 0, STUDY: 0, SURVEY: 0, TINKER: 0,
    FINESSE: 0, PROWL: 0, SKIRMISH: 0, WRECK: 0,
    BIZARRE: 0, COMMAND: 0, CONSORT: 0, SWAY: 0
  },
  standStats: {
    power: 1, speed: 1, range: 1, durability: 1, precision: 1, development: 1
  },
  stress: Array(9).fill(false),
  trauma: {
    COLD: false, HAUNTED: false, OBSESSED: false, PARANOID: false,
    RECKLESS: false, SOFT: false, UNSTABLE: false, VICIOUS: false
  },
  armor: { armor: false, heavy: false, special: false },
  harmEntries: {
    level3: [''],
    level2: ['', ''],
    level1: ['', '']
  },
  coin: Array(4).fill(false),
  stash: Array(40).fill(false),
  healingClock: 0,
  xp: {
    insight: 0, prowess: 0, resolve: 0, heritage: 0, playbook: 0
  },
  abilities: [],
  clocks: []
});

export const viceOptions = [
  'Gambling', 'Obsession', 'Violence', 'Pleasure', 'Stupor', 'Weird', 
  'Obligation', 'Faith', 'Luxury', 'Art', 'Competition', 'Power', 
  'Adventure', 'Solitude', 'Justice'
];

export const standardAbilities = [
  'Shadow', 'Iron Will', 'Functioning Vice', 'Foresight', 'Calculating',
  'Like Looking into a Mirror', 'Trust in Me', 'Subterfuge', 'Cloak & Dagger',
  'Artificer', 'Analyst', 'Fortitude', 'Venomous', 'Bizarre Ward',
  'Physicker', 'Saboteur', 'Leader', 'Vigorous', 'Bodyguard', 'Savage',
  'Tough as Nails', 'Sharpshooter', 'Steady Barrage', 'Reflexes',
  'Bizarre Improvisation', 'Stand Evolution', 'Stand Fusion', 'Stand Recall'
]; 
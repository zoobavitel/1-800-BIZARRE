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
  clocks: [],
  selected_benefits: [],
  selected_detriments: [],
});

export const viceOptions = [
  'Gambling', 'Obsession', 'Violence', 'Pleasure', 'Stupor', 'Weird', 
  'Obligation', 'Faith', 'Luxury', 'Art', 'Competition', 'Power', 
  'Adventure', 'Solitude', 'Justice'
];

export const standardAbilities = [
  'Ambush', 'Cascade Effect', 'Final Barrage', 'Parry and Break',
  'Phantom Pain', 'Savage', 'Spin-Boosted Blow', 'Steady Barrage',
  'Invigorated', 'Legendary Guard', 'Battleborn', 'Swan Song',
  'Iron Will', 'Tough as Nails', 'Fortitude', 'Overdrive',
  'Masochist', 'Undying Will', 'Rule of Cool',
  'Bizarre Step', 'Cloak & Dagger', 'Mesmeriser', 'Saboteur', 'Shadow', 'Subterfuge',
  'Bizarre Intuition', 'Focused', 'Like Looking into a Mirror',
  'Mastermind', 'Neural Lace', 'Scout', 'Shared Vision',
  'Aura of Confidence', 'Notorious', 'Scoundrel', 'Trust in Me',
  'Foresight', 'Bodyguard', 'Guardian', 'Functioning Vice',
  'Stand Proud', 'Analyst', 'Expertise', 'Calculating',
  'The Devil\'s Footsteps', 'Superhero Landing', 'Daredevil', 'Bizarre Improvisation',
  'Automatic Trigger', 'Weapon Recall', 'Stand Evolution', 'Channel Force', 'Requiem'
];

/**
 * Convert sheet trauma checkbox object to list of Trauma IDs for backend.
 * @param {Record<string, boolean>} traumaObj - e.g. { COLD: true, HAUNTED: false, ... }
 * @param {Array<{ id: number, name: string }>} traumasList - from referenceAPI.getTraumas()
 * @returns {number[]} List of trauma IDs to send to API
 */
export function traumaObjectToIds(traumaObj, traumasList = []) {
  if (!traumaObj || typeof traumaObj !== 'object') return [];
  const nameToId = Object.fromEntries(
    (traumasList || []).map((t) => [(t.name || '').toUpperCase(), t.id])
  );
  return Object.entries(traumaObj)
    .filter(([, checked]) => checked)
    .map(([name]) => nameToId[name.toUpperCase()])
    .filter((id) => id != null);
} 
export const factionData = {
  isGM: true, // Toggle for GM vs Player view
  campaignName: 'Diamond is Unbreakable',
  factions: [
    {
      id: 1,
      name: 'Speedwagon Foundation',
      type: 'MERCHANT',
      hold: 'strong',
      reputation: 3,
      notes: 'International organization funding bizarre research'
    },
    {
      id: 2,
      name: 'Morioh Police',
      type: 'POLITICAL',
      hold: 'weak',
      reputation: 1,
      notes: 'Local law enforcement, unaware of Stand users'
    },
    {
      id: 3,
      name: 'Angelo Gang',
      type: 'CRIMINAL',
      hold: 'weak',
      reputation: -2,
      notes: 'Small-time criminals with supernatural connections'
    },
    {
      id: 4,
      name: 'Higashikata Family',
      type: 'NOBLE',
      hold: 'strong',
      reputation: 2,
      notes: 'Wealthy family with hidden Stand heritage'
    }
  ],
  relationships: [
    { sourceId: 1, targetId: 2, value: 1, notes: 'Cooperative relationship' },
    { sourceId: 1, targetId: 3, value: -3, notes: 'Actively opposing' },
    { sourceId: 2, targetId: 3, value: -2, notes: 'Criminal investigation' },
    { sourceId: 4, targetId: 1, value: 2, notes: 'Financial support' }
  ],
  crewRelationships: [
    { factionId: 1, value: 2, notes: 'Aided in investigation' },
    { factionId: 2, value: 0, notes: 'Neutral standing' },
    { factionId: 3, value: -1, notes: 'Disrupted operations' },
    { factionId: 4, value: 1, notes: 'Family connections' }
  ]
};

export const standardAbilities = [
  'Shadow', 'Iron Will', 'Functioning Vice', 'Foresight', 'Calculating',
  'Like Looking into a Mirror', 'Trust in Me', 'Subterfuge', 'Cloak & Dagger',
  'Artificer', 'Analyst', 'Fortitude', 'Venomous', 'Bizarre Ward',
  'Physicker', 'Saboteur', 'Leader', 'Vigorous', 'Bodyguard', 'Savage',
  'Tough as Nails', 'Sharpshooter', 'Steady Barrage', 'Reflexes',
  'Bizarre Improvisation', 'Stand Evolution', 'Stand Fusion', 'Stand Recall'
];

export const viceOptions = [
  'Gambling', 'Obsession', 'Violence', 'Pleasure', 'Stupor', 'Weird', 
  'Obligation', 'Faith', 'Luxury', 'Art', 'Competition', 'Power', 
  'Adventure', 'Solitude', 'Justice'
];

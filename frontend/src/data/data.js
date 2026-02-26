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

export const viceOptions = [
  'Gambling', 'Obsession', 'Violence', 'Pleasure', 'Stupor', 'Weird', 
  'Obligation', 'Faith', 'Luxury', 'Art', 'Competition', 'Power', 
  'Adventure', 'Solitude', 'Justice'
];

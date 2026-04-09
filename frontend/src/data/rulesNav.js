/**
 * Navigation structure for the Rules page, mirroring the SRD table of contents.
 * Each item opens public/srd/<slug>.md (slug null → overview at game-rules-srd).
 */
export const RULES_NAV = [
  {
    label: 'The Basics',
    expanded: true,
    items: [
      { label: 'Overview', slug: null },
      { label: 'The Basics', slug: 'the-basics' },
      { label: 'The Core System', slug: 'the-core-system' },
      { label: 'Skills & Attributes', slug: 'skills-attributes' },
      { label: 'Heritage', slug: 'heritage' },
      { label: 'Stand Coin Stats', slug: 'stand-coin-stats' },
      { label: 'Stress & Trauma', slug: 'stress-trauma' },
      { label: 'Skill Checks', slug: 'skill-checks' },
      { label: 'Position & Effect', slug: 'position-effect' },
      { label: 'Consequences & Harm', slug: 'consequences-harm' },
      { label: 'Resistance & Armor', slug: 'resistance-armor' },
      { label: 'Flashbacks', slug: 'flashbacks' },
      { label: 'Progress Clocks', slug: 'progress-clocks' },
      { label: 'Fortune Checks', slug: 'fortune-checks' },
      { label: 'Gathering Information', slug: 'gathering-information' },
      { label: 'Coin & Stash', slug: 'coin-stash' },
      { label: 'Reputation', slug: 'reputation' },
      { label: 'Advancement', slug: 'advancement' },
    ],
  },
  {
    label: 'The Mission',
    expanded: true,
    items: [
      { label: 'The Mission', slug: 'the-mission' },
      { label: 'Combat & Initiative', slug: 'combat-initiative' },
      { label: 'Actions in Combat', slug: 'actions-in-combat' },
      { label: 'Teamwork', slug: 'teamwork' },
      { label: 'Claims', slug: 'claims' },
    ],
  },
  {
    label: 'Downtime',
    expanded: true,
    items: [
      { label: 'Downtime', slug: 'downtime' },
      { label: 'Payoff', slug: 'payoff' },
      { label: 'Wanted Level', slug: 'wanted-level' },
      { label: 'Entanglements', slug: 'entanglements' },
      { label: 'Downtime Activities', slug: 'downtime-activities' },
      { label: 'Vice', slug: 'vice' },
    ],
  },
  {
    label: 'The Characters',
    expanded: true,
    items: [
      { label: 'The Characters', slug: 'the-characters' },
      { label: 'Character Creation', slug: 'character-creation' },
      { label: 'Stand Playbook & Example Builds', slug: 'stand-playbook-example-builds' },
      { label: 'Spin Playbook', slug: 'spin-playbook' },
      { label: 'Hamon Playbook', slug: 'hamon-playbook' },
    ],
  },
  {
    label: 'Resources',
    expanded: true,
    items: [
      { label: 'STANDARD ABILITIES', slug: 'standard-abilities' },
      { label: 'Resources', slug: 'resources' },
      { label: 'GM Cheat Sheet', slug: 'gm-cheat-sheet' },
      { label: 'Da Bay sicks', slug: 'da-bay-sicks' },
    ],
  },
];

export interface CharacterData {
  name: string;
  standName: string;
  heritage: string;
  background: string;
  look: string;
  vice: string;
  crew: string;
}

export interface ActionRatings {
  HUNT: number;
  STUDY: number;
  SURVEY: number;
  TINKER: number;
  FINESSE: number;
  PROWL: number;
  SKIRMISH: number;
  WRECK: number;
  BIZARRE: number;
  COMMAND: number;
  CONSORT: number;
  SWAY: number;
}

export interface StandStats {
  power: number;
  speed: number;
  range: number;
  durability: number;
  precision: number;
  development: number;
}

export interface XPTracks {
  insight: number;
  prowess: number;
  resolve: number;
  heritage: number;
  playbook: number;
}

export interface TraumaChecks {
  COLD: boolean;
  HAUNTED: boolean;
  OBSESSED: boolean;
  PARANOID: boolean;
  RECKLESS: boolean;
  SOFT: boolean;
  UNSTABLE: boolean;
  VICIOUS: boolean;
}

export interface HarmEntries {
  level3: string[];
  level2: string[];
  level1: string[];
}

export interface ArmorUses {
  armor: boolean;
  heavy: boolean;
  special: boolean;
}

export interface Ability {
  id: number;
  name: string;
  type: 'standard' | 'custom' | 'playbook';
  description?: string;
}

export interface CustomClock {
  id: number;
  name: string;
  segments: number;
  filled: number;
}

export interface Character {
  id?: number;
  name: string;
  standName: string;
  heritage: string;
  background: string;
  look: string;
  vice: string;
  crew: string;
  actionRatings: ActionRatings;
  standStats: StandStats;
  stress: boolean[];
  trauma: TraumaChecks;
  armor: ArmorUses;
  harmEntries: HarmEntries;
  coin: boolean[];
  stash: boolean[];
  healingClock: number;
  xp: XPTracks;
  abilities: Ability[];
  clocks: CustomClock[];
  lastModified?: string;
} 
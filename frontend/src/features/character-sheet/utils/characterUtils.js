// Utility functions for character sheet operations

import { MAX_CREATION_DOTS, TRAUMA_KEY_TO_PK } from "../constants/srd";

export const getAttributeDice = (actions, actionRatings) => {
  return actions.filter((action) => actionRatings[action] > 0).length;
};

export const getTotalXP = (xpTracks) => {
  return Object.values(xpTracks).reduce((total, xp) => total + xp, 0);
};

export const createDefaultCharacter = (overrides = {}) => ({
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
  trauma: {
    COLD: false,
    HAUNTED: false,
    OBSESSED: false,
    PARANOID: false,
    RECKLESS: false,
    SOFT: false,
    UNSTABLE: false,
    VICIOUS: false,
  },
  armor: { armor: false, heavy: false, special: false },
  standArmorUsed: 0,
  hasPhysicalArmorItem: false,
  physicalArmorBonusCharges: 0,
  physicalArmorUsed: 0,
  unallocatedXp: 0,
  harm: {
    level4: [""],
    level3: [""],
    level2: ["", ""],
    level1: ["", ""],
  },
  harmEntries: {
    level4: [""],
    level3: [""],
    level2: ["", ""],
    level1: ["", ""],
  },
  coin: Array(4).fill(false),
  stash: Array(40).fill(false),
  healingClock: 0,
  standCoinPointsGained: 0,
  actionDiceGained: 0,
  xp: {
    insight: 0,
    prowess: 0,
    resolve: 0,
    heritage: 0,
    playbook: 0,
  },
  abilities: [],
  clocks: [],
  sheetNotes: "",
  inventory: [],
  selected_benefits: [],
  selected_detriments: [],
  standType: "",
  standTypeCustom: "",
  standForms: [],
  standConsciousness: "",
  playbookXpArchetypes: [],
  campaign: null,
  ...overrides,
});

export const countActionDots = (actionRatings = {}) => {
  if (!actionRatings || typeof actionRatings !== "object") return 0;
  return Object.values(actionRatings).reduce(
    (sum, value) => sum + Math.max(0, Number(value) || 0),
    0,
  );
};

export const computeActionDotBudget = ({
  actionRatings = {},
  actionDiceGained = 0,
  creationDots = MAX_CREATION_DOTS,
} = {}) => {
  const totalActionDots = countActionDots(actionRatings);
  const serverGained = Math.max(0, Number(actionDiceGained) || 0);
  const inferredGained = Math.max(0, totalActionDots - creationDots);
  const gained = Math.max(serverGained, inferredGained);
  const maxActionDotsBudget = creationDots + gained;
  return {
    totalActionDots,
    actionDotsFromXp: gained,
    maxActionDotsBudget,
    dotsRemaining: maxActionDotsBudget - totalActionDots,
  };
};

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
 * Convert sheet trauma checkbox object to list of Trauma IDs for backend.
 * @param {Record<string, boolean>} traumaObj - e.g. { COLD: true, HAUNTED: false, ... }
 * @param {Array<{ id: number, name: string }>} traumasList - from referenceAPI.getTraumas()
 * @returns {number[]} List of trauma IDs to send to API
 */
export function traumaObjectToIds(traumaObj, traumasList = []) {
  if (!traumaObj || typeof traumaObj !== "object") return [];
  const nameToId = Object.fromEntries(
    (traumasList || []).map((t) => [(t.name || "").toUpperCase(), t.id]),
  );
  return Object.entries(traumaObj)
    .filter(([, checked]) => checked)
    .map(([name]) => {
      const key = String(name || "").toUpperCase();
      const fromList = nameToId[key];
      if (fromList != null) return fromList;
      // /traumas/ empty or stale: still map SRD keys to fixture PKs so autosave
      // cannot wipe checked boxes by sending trauma: [].
      return TRAUMA_KEY_TO_PK[key] ?? null;
    })
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

/**
 * Crew PK from a Character-like API object (`crew_id` or nested `crew`).
 * CharacterSheet only loads crew-mode faction reputation when this is set
 * (`activeMode === "CREW MODE"` + `charData.crewId`).
 *
 * @param {Record<string, unknown>|null|undefined} c
 * @returns {number|string|null}
 */
export function getCharacterCrewId(c) {
  if (c == null || typeof c !== "object") return null;
  if (c.crew_id != null && c.crew_id !== "") return c.crew_id;
  const crew = c.crew;
  if (crew != null && typeof crew === "object" && crew.id != null) return crew.id;
  if (crew != null && crew !== "") return crew;
  return null;
}

/**
 * True when some campaign PC is assigned to a crew — same precondition as
 * CharacterSheet crew sheet loading `crewAPI.getCrew` for FACTION REPUTATION.
 *
 * @param {unknown[]} charactersOrRoster
 */
export function rosterHasLinkedCrewForCrewSheetFactionUi(charactersOrRoster) {
  const list = Array.isArray(charactersOrRoster) ? charactersOrRoster : [];
  return list.some((ch) => {
    const raw = getCharacterCrewId(ch);
    if (raw == null || raw === "") return false;
    const n =
      typeof raw === "number" ? raw : parseInt(String(raw).trim(), 10);
    return Number.isFinite(n) && n > 0;
  });
}

/** Owner user PK from sheet character (API `user` or transformed `user_id`). */
export function resolveCharacterOwnerUserId(character) {
  if (character == null) return null;
  const ownerId =
    character.user_id ??
    (typeof character.user === "object"
      ? character.user?.id
      : character.user);
  if (ownerId == null || ownerId === "") return null;
  const n = Number(ownerId);
  return Number.isFinite(n) ? n : null;
}

export function resolveCharacterCampaignIdFromField(character) {
  if (character == null) return null;
  const raw = character.campaign;
  const id = typeof raw === "object" && raw !== null ? raw.id : raw;
  if (id == null || id === "") return null;
  const n = typeof id === "number" ? id : parseInt(String(id), 10);
  return Number.isFinite(n) ? n : null;
}

/** Campaign whose roster lists this character (no active session required). */
export function findCampaignHostingCharacter(characterId, campaigns = []) {
  if (characterId == null) return null;
  const cid = Number(characterId);
  if (!Number.isFinite(cid)) return null;
  return (
    (campaigns || []).find((camp) =>
      (camp?.campaign_characters || []).some(
        (ch) => Number(ch?.id) === cid,
      ),
    ) ?? null
  );
}

export function resolveCharacterCampaignContext(
  character,
  campaigns = [],
  extraCampaignId = null,
) {
  const fromField = resolveCharacterCampaignIdFromField(character);
  const hosting = findCampaignHostingCharacter(character?.id, campaigns);
  let campaignId = fromField ?? hosting?.id ?? null;
  if (
    campaignId == null &&
    extraCampaignId != null &&
    extraCampaignId !== ""
  ) {
    const n = Number(extraCampaignId);
    if (Number.isFinite(n)) campaignId = n;
  }
  const campaignRecord =
    (campaigns || []).find((c) => Number(c?.id) === Number(campaignId)) ||
    hosting ||
    null;
  return { campaignId, campaignRecord, hostingCampaign: hosting };
}

export function isUserCampaignGmForCharacter(
  user,
  { isGMProp = false, campaignRecord, campaignId } = {},
) {
  if (user?.id == null) return false;
  if (campaignId == null) return false;
  if (Boolean(isGMProp)) return true;
  if (user.is_staff) return true;
  const gmId = campaignRecord?.gm?.id ?? campaignRecord?.gm;
  return gmId != null && Number(gmId) === Number(user.id);
}

export function isGmViewingPlayerCharacterSheet(
  user,
  character,
  { isCampaignGm, campaignId } = {},
) {
  if (!isCampaignGm || character?.id == null || user?.id == null) return false;
  if (campaignId == null) return false;
  const ownerId = resolveCharacterOwnerUserId(character);
  if (ownerId == null) return true;
  return ownerId !== Number(user.id);
}

/** Radar grades editable until first XP-bought Stand Coin rank (not locked by action dots). */
export function isStandCoinChargenEditable({
  canEditSheet,
  hasStandPlaybook,
  standCoinPointsGained,
} = {}) {
  if (!canEditSheet || !hasStandPlaybook) return false;
  return Math.max(0, Number(standCoinPointsGained) || 0) === 0;
}

export function isUserGmOfCharacterCampaign(user, character, campaigns = []) {
  if (user?.id == null || character?.id == null) return false;
  const { campaignId, campaignRecord } = resolveCharacterCampaignContext(
    character,
    campaigns,
  );
  if (campaignId == null) return false;
  return isUserCampaignGmForCharacter(user, { campaignRecord, campaignId });
}

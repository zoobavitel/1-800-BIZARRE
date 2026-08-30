// Character Sheet Feature - Public API
export { useCharacterSheet } from "./hooks/useCharacterSheet";
export { useReferenceData } from "./hooks/useReferenceData";
export {
  getAttributeDice,
  getTotalXP,
  createDefaultCharacter,
  countActionDots,
  computeActionDotBudget,
  viceOptions,
  standardAbilities,
  traumaObjectToIds,
  resolveHeritagePkForSave,
  resolveCharacterCampaignContext,
  isUserCampaignGmForCharacter,
  isGmViewingPlayerCharacterSheet,
  isUserGmOfCharacterCampaign,
  isStandCoinChargenEditable,
  sheetCustomAbilityContentScore,
  mergeAbilitiesPreferRicherCustoms,
  playbookAbilityRequiredLevel,
  isSpinFoundationAbility,
  isHamonFoundationAbility,
  playbookGateLevel,
  playbookAbilityLevelMet,
  playbookAbilityRequirementLabel,
  countCombinedNonFoundationPlaybookAbilities,
  playbookAbilitySlotBudget,
  canAddNonFoundationPlaybookAbility,
  computePcLevelFromSheet,
} from "./utils/characterUtils";
export * from "./services/api";

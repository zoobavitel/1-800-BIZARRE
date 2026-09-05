import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  GRADE,
  GRADE_INDEX,
  INDEX_TO_GRADE,
  MAX_CREATION_DOTS,
  maxDotsPerActionAtCreation,
  STAND_COIN_CREATION_POINT_SUM,
  PC_STAT_DESC,
  STAND_STAT_KEYS,
  STAND_ROLL_KEYS_ACTIVE,
  STAND_COLUMN_ROLL_ORDER,
  STAND_PASSIVE_KEYS,
  standPathArmorMaxFromDurabilityIndex,
  DEV_SESSION_XP,
  ACTION_ATTR,
  ACTION_DESC,
  RESISTANCE_ATTR_DESC,
  VICE_OPTIONS,
  DEFAULT_TRAUMA,
  DEVILS_BARGAIN_DETRIMENTS,
} from "../features/character-sheet/constants/srd";
import NpcsStandCoin from "../components/NpcsStandCoin";
import AdvancementPlanStrip from "../features/character-sheet/components/AdvancementPlanStrip";
import AdvancementPlanPanel from "../features/character-sheet/components/AdvancementPlanPanel";
import {
  characterAPI,
  campaignAPI,
  crewAPI,
  crewHistoryAPI,
  factionAPI,
  rollAPI,
  progressClockAPI,
  referenceAPI,
  experienceTrackerAPI,
  xpHistoryAPI,
  groupActionAPI,
  characterHistoryAPI,
  sessionAPI,
  equipmentAPI,
  normalizeHarmObject,
  computeActionDotBudget,
  resolveMediaUrl,
  normalizeCharacterInventory,
  PLAYBOOK_SHEET_OPTIONS,
  hasPlaybook,
  transformBackendToFrontend,
  resolveCharacterCampaignContext,
  isUserCampaignGmForCharacter,
  isGmViewingPlayerCharacterSheet,
  isStandCoinChargenEditable as standCoinChargenUnlocked,
  mergeAbilitiesPreferRicherCustoms,
  playbookAbilityRequirementLabel,
  canAddNonFoundationPlaybookAbility,
  countCombinedNonFoundationPlaybookAbilities,
  playbookAbilitySlotBudget,
  mergePlaybookFoundationAbilities,
  abilitiesMissingPlaybookFoundations,
  isPlaybookFoundationAbility,
  shouldSkipServerOwnedFieldHydration,
  computeHealingClockAfterSegments,
  normalizeCrewFromCharacter,
  resolveCrewFromCampaign,
} from "../features/character-sheet";
import { useAuth } from "../features/auth";
import {
  PositionStack,
  EffectShapes,
  HistoryBranchIcon,
} from "../components/position-effect/PositionEffectIndicators";
import {
  computeActionPoolBreakdown,
  computeBaseDicePool,
  computeStandRollPool,
  INSIGHT_ACTIONS,
  PROWESS_ACTIONS,
  RESOLVE_ACTIONS,
} from "../features/character-sheet/utils/actionDicePool";
import { computeAbilityHeritageRollBonuses } from "../features/character-sheet/utils/rollAbilityHeritageModifiers";
import { defaultPositionEffectFromSessionDetail } from "../features/character-sheet/utils/sessionPositionEffectDefaults";
import {
  isGmManagedProgressClock,
  normalizeCampaignGmId,
} from "../features/character-sheet/utils/progressClockVisibility";
import {
  clampClockFilled,
  clampClockSegments,
  clockWedgeCount,
  isPersistedProgressClockId,
  normalizeSheetProgressClock,
} from "../features/character-sheet/utils/progressClockSegments";
import CharacterSheetInventoryList from "../features/character-sheet/components/CharacterSheetInventoryList";
import CharacterSheetArmorPanel from "../features/character-sheet/components/CharacterSheetArmorPanel";
import {
  normalizeLoadoutEntry,
  inventoryHasPhysicalArmor,
  inventoryPhysicalArmorCharges,
  inventoryHasSpecialArmor,
  inventorySpecialArmorCount,
} from "../features/character-sheet/utils/loadoutUtils";
import {
  markPcAutosaveBusyCollision,
  schedulePcPendingResaveDrain,
} from "../features/character-sheet/utils/pcAutosaveQueue";
import {
  HISTORY_MANUAL_RESISTANCE_ATTR_OPTIONS,
  historyManualResistanceActionName,
} from "../features/character-sheet/utils/historyManualResistance";
import {
  tierDieFromActionPool,
  outcomeFromActionRoll,
  outcomeFromFortuneDiceResults,
  OUTCOME_BAND_SHORT_LABEL,
  outcomeApiToSheetDisplay,
} from "../features/character-sheet/utils/actionRollOutcome";
import {
  bumpEffectTier,
  normalizeEffectTier,
} from "../features/character-sheet/utils/rollEffectPreview";
import {
  buildXpRequirementSnapshot,
  formatAttrTally,
  formatInnateStandTally,
} from "../features/character-sheet/utils/xpRequirements";
import {
  archetypeRowsForCharacterPlaybook,
  inferSeedArchetypeKeys,
  normalizePlaybookPathKey,
  normalizePlaybookXpArchetypeKeys,
  STAND_ARCHETYPE_ROWS,
} from "../features/character-sheet/utils/playbookXpTriggerSrd";
import {
  adjustActionRollBonusSupports,
  abilityExcludedFromActionRollDicePoolBonuses,
  characterHasIronWill,
  invigoratedHealingBonusApplies,
  characterHasLegendaryGuard,
  characterHasPhantomPain,
  characterHasRippleBreathing,
} from "../features/character-sheet/utils/abilityRollBonusMeta";
import {
  alienUnderstandingHeritagePenaltyApplies,
  heritageEntryIsAlienUnderstanding,
} from "../features/character-sheet/utils/heritageRollBonusMeta";
import { derivePartyFacingSessionNpc } from "../features/character-sheet/utils/sessionNpcPartyFace";
import { getResistanceResultSheetAbilityReminders } from "../features/character-sheet/utils/sheetAbilityResistanceReminders";

function archetypesEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
    return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const STAND_FORM_PRESETS = ["Humanoid", "Non-Humanoid", "Phenomenon"];
const STAND_CONSCIOUSNESS_GRADES = ["A", "B", "C", "D", "E", "F"];

function normalizeStandFormsList(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const x of raw) {
    const s = String(x || "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** Same ordering as Insight / Prowess / Resolve columns on the sheet. */
const SHEET_STANDARD_ACTION_COLUMNS = [
  ...INSIGHT_ACTIONS,
  ...PROWESS_ACTIONS,
  ...RESOLVE_ACTIONS,
];
const HEALING_ACTION_CHOICES = [...SHEET_STANDARD_ACTION_COLUMNS];

/** Extra heal-other/teammate treatment pool choices for Stand playbook (Stand Coin stats). */
const STAND_HEAL_ACTION_EXTRA_CHOICES = ["PRECISION", "SPEED"];

const CREW_HISTORY_FIELD_KEYS = new Set([
  "name",
  "rep",
  "turf",
  "level",
  "hold",
  "wanted_level",
  "coin",
  "description",
  "notes",
  "stash",
  "upgrade_progress",
  "xp",
  "advancement_points",
  "stash_slots",
  "proposed_name",
]);

function upgradesToProgress(upgrades) {
  const p = {};
  if (!upgrades) return p;
  Object.entries(upgrades.lair || {}).forEach(([k, v]) => {
    p[`lair_${k}`] = !!v;
  });
  Object.entries(upgrades.training || {}).forEach(([k, v]) => {
    p[`training_${k}`] = !!v;
  });
  return p;
}

function progressToUpgrades(progress) {
  const base = {
    lair: {
      carriage: false,
      boat: false,
      hidden: false,
      quarters: false,
      secure: false,
      vault: false,
      workshop: false,
    },
    training: {
      insight: false,
      prowess: false,
      resolve: false,
      personal: false,
      mastery: false,
    },
  };
  if (!progress || typeof progress !== "object") return base;
  Object.entries(progress).forEach(([key, val]) => {
    const parts = key.split("_");
    if (parts.length >= 2) {
      const group = parts[0];
      const rest = parts.slice(1).join("_");
      if (group === "lair" && rest in base.lair) base.lair[rest] = !!val;
      if (group === "training" && rest in base.training)
        base.training[rest] = !!val;
    }
  });
  return base;
}

function reputationTierLabel(v) {
  const n = Number(v) || 0;
  if (n <= -2) return "Hostile";
  if (n >= 2) return "Allied";
  return "Neutral";
}

function computeResistanceSummary(diceResults) {
  const sorted = (Array.isArray(diceResults) ? diceResults : [])
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 6);
  const highest = sorted.length ? Math.max(...sorted) : 0;
  const sixes = sorted.filter((d) => d === 6).length;
  const isCritical = sixes >= 2;
  const stressCost = isCritical ? -1 : Math.max(0, 6 - highest);
  const outcome = isCritical
    ? "CRITICAL_SUCCESS"
    : highest >= 6
      ? "FULL_SUCCESS"
      : highest >= 4
        ? "PARTIAL_SUCCESS"
        : "FAILURE";
  return { highest, isCritical, stressCost, outcome };
}

/** Vice manual record: highest die = stress cleared; outcome for stored roll only */
function computeViceManualSummary(diceResults) {
  const nums = (Array.isArray(diceResults) ? diceResults : [])
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 6);
  const highest = nums.length ? Math.max(...nums) : 0;
  const outcome =
    highest >= 6
      ? "FULL_SUCCESS"
      : highest >= 4
        ? "PARTIAL_SUCCESS"
        : "FAILURE";
  return { highest, outcome };
}

function normalizeAbilityName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const RETIRED_SHEET_ABILITY_NAMES = new Set(["parry and break"]);

function stripRetiredSheetAbilities(list) {
  return (Array.isArray(list) ? list : []).filter(
    (a) => !RETIRED_SHEET_ABILITY_NAMES.has(normalizeAbilityName(a?.name)),
  );
}

function newCustomAbilityModalDraft() {
  return {
    type: "three_separate_uses",
    items: [
      { name: "", description: "" },
      { name: "", description: "" },
      { name: "", description: "" },
    ],
  };
}

function customAbilityModalFromSheetCustoms(customs) {
  const single = customs.find(
    (a) => a.id === "custom-single" || Array.isArray(a._uses),
  );
  if (single) {
    const uses = [...(single._uses || ["", "", ""])].slice(0, 3);
    while (uses.length < 3) uses.push("");
    return {
      type: "three_separate_uses",
      items: uses.map((useText, i) => ({
        name:
          i === 0 && String(single.name || "").trim()
            ? String(single.name).trim()
            : `Ability ${i + 1}`,
        description: String(useText || "").trim(),
      })),
    };
  }
  const three = customs.filter((a) => !Array.isArray(a._uses));
  const items = three.length
    ? three.map((a) => ({
        name: a.name || "",
        description: a.description || "",
      }))
    : [
        { name: "", description: "" },
        { name: "", description: "" },
        { name: "", description: "" },
      ];
  while (items.length < 3) items.push({ name: "", description: "" });
  return {
    type: "three_separate_uses",
    items: items.slice(0, 3),
  };
}

const VICE_OVERINDULGE_CHOICES = [
  { value: "", label: "If overindulged, pick an outcome…" },
  {
    value: "trouble",
    label:
      "Attract Trouble — extra entanglement (fortune roll for GM or GM choice)",
  },
  {
    value: "brag",
    label: "Brag about your exploits — +2 wanted levels",
  },
  {
    value: "lost",
    label:
      "Lost — gone weeks; play another PC until return; on return, all harm healed",
  },
  {
    value: "tapped",
    label:
      "Tapped — current purveyor cuts you off; find a new source for your vice",
  },
];

function viceOverindulgeLabel(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  const hit = VICE_OVERINDULGE_CHOICES.find((o) => o.value === v);
  return hit ? hit.label : v;
}

/** Group roll board outcome label + color (SRD tiers; two sixes = critical before tier die). */
const GROUP_ROLL_BOARD_BAND = {
  critical: { label: "Critical", color: "#e9d5ff" },
  success: { label: "Success", color: "#34d399" },
  partial: { label: "Partial", color: "#fbbf24" },
  fail: { label: "Fail", color: "#f87171" },
};

const HISTORY_FIELD_LABELS = {
  true_name: "Name",
  stand_name: "Stand name",
  appearance: "Look",
  background_note: "Background",
  inventory: "Inventory",
  stress: "Stress",
  trauma: "Trauma",
  armor_charges: "Armor",
  regular_armor_used: "Armor spent",
  special_armor_used: "Special armor spent",
  harm_level1_name: "Harm Lv1",
  harm_level1_slot2_name: "Harm Lv1 (slot 2)",
  harm_level2_name: "Harm Lv2",
  harm_level2_slot2_name: "Harm Lv2 (slot 2)",
  harm_level3_name: "Harm Lv3",
  harm_level4_name: "Harm Lv4",
  coin_stats: "Stand coin stats",
  heritage: "Heritage",
  selected_benefits: "Heritage benefits",
  selected_detriments: "Heritage detriments",
  level: "Level",
  crew: "Crew",
  action_dots: "Action dots",
  xp_clocks: "XP tracks",
  total_xp_spent: "Total XP spent",
  heritage_points_gained: "Heritage points gained",
  stand_coin_points_gained: "Stand coin points gained",
  action_dice_gained: "Action dice gained",
};

function historyFieldLabel(key) {
  return HISTORY_FIELD_LABELS[key] || key.replace(/_/g, " ");
}

function stringifyValue(v) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return String(v);
  try {
    return JSON.stringify(v);
  } catch (_err) {
    return String(v);
  }
}

const XP_LEDGER_HISTORY_KEYS = new Set([
  "xp_clocks",
  "total_xp_spent",
  "heritage_points_gained",
  "stand_coin_points_gained",
  "action_dice_gained",
  "action_dots",
]);

/** Backend `xp_clocks` keys; level-up / minor advance spend from one track only. */
const XP_SPEND_TRACK_ORDER = [
  "insight",
  "prowess",
  "resolve",
  "heritage",
  "playbook",
];

const XP_TRACK_SPEND_LABELS = {
  insight: "Insight",
  prowess: "Prowess",
  resolve: "Resolve",
  heritage: "Heritage",
  playbook: "Playbook",
};

/** Caps applied when a roll response ticks a track locally. Playbook is uncapped (innate). */
const XP_TRACK_APPLY_CAP = {
  insight: 5,
  prowess: 5,
  resolve: 5,
  heritage: 5,
};

const ATTRIBUTE_XP_SPEND_TRACKS = new Set(["insight", "prowess", "resolve"]);

function actionOptionsForXpSpendTrack(actionRatings, spendTrack) {
  const actions = Object.keys(actionRatings || {});
  if (!ATTRIBUTE_XP_SPEND_TRACKS.has(spendTrack)) {
    // Backend spend_xp_for_action_dice(xp_type) accepts any xp_type for dot buys.
    return actions;
  }
  const filtered = actions.filter((action) => ACTION_ATTR[action] === spendTrack);
  return filtered.length ? filtered : actions;
}

/** One-line summary when a sheet save touched XP / advancement fields. */
function summarizeXpSpendFromHistoryEntry(entry) {
  const changed = entry?.changed_fields;
  if (!changed || typeof changed !== "object") return null;
  const parts = [];
  for (const key of Object.keys(changed)) {
    if (!XP_LEDGER_HISTORY_KEYS.has(key)) continue;
    const chunk = changed[key];
    if (!chunk || typeof chunk !== "object") continue;
    if (key === "xp_clocks") {
      const oldXC = chunk.old;
      const newXC = chunk.new;
      if (
        oldXC &&
        newXC &&
        typeof oldXC === "object" &&
        typeof newXC === "object"
      ) {
        const keys = new Set([
          ...Object.keys(oldXC),
          ...Object.keys(newXC),
        ]);
        for (const k of keys) {
          const o = Number(oldXC[k]) || 0;
          const n = Number(newXC[k]) || 0;
          if (n === o) continue;
          parts.push(
            `${k}: ${o}→${n}${
              n < o ? ` (−${o - n} on track)` : ` (+${n - o} on track)`
            }`,
          );
        }
      }
      continue;
    }
    const o = chunk.old;
    const n = chunk.new;
    if (JSON.stringify(o) === JSON.stringify(n)) continue;
    parts.push(
      `${historyFieldLabel(key)}: ${stringifyValue(o)} → ${stringifyValue(n)}`,
    );
  }
  if (!parts.length) return null;
  return `Advancement / XP: ${parts.join("; ")}`;
}

// ─── Dice pool (pre-roll preview) ─────────────────────────────────────────────

const DicePoolStrip = ({ label, count }) => {
  const n = Math.max(0, Number(count) || 0);
  if (n < 1) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 5,
          alignItems: "center",
        }}
      >
        {Array.from({ length: n }, (_, i) => (
          <span
            key={`${label}-${i}`}
            style={{ fontSize: 20, lineHeight: 1 }}
            title={label}
          >
            🎲
          </span>
        ))}
      </div>
    </div>
  );
};

// ─── ProgressClock ────────────────────────────────────────────────────────────

const arrowBtnStyle = {
  background: "none",
  border: "none",
  color: "#6b7280",
  cursor: "pointer",
  fontSize: "16px",
  padding: "2px 4px",
  lineHeight: 1,
};
const ProgressClock = ({
  size = 80,
  segments = 4,
  filled = 0,
  onClick = null,
  interactive = false,
}) => {
  const n = clockWedgeCount(segments);
  const fill = clampClockFilled(filled, n);
  const r = size / 2 - 4,
    cx = size / 2,
    cy = size / 2;
  const sa = 360 / n;
  const showArrows = interactive && onClick;
  const svg = (
    <svg width={size} height={size}>
      {Array.from({ length: n }, (_, i) => {
        const a1 = ((i * sa - 90) * Math.PI) / 180;
        const a2 = (((i + 1) * sa - 90) * Math.PI) / 180;
        const x1 = cx + r * Math.cos(a1),
          y1 = cy + r * Math.sin(a1);
        const x2 = cx + r * Math.cos(a2),
          y2 = cy + r * Math.sin(a2);
        return (
          <path
            key={i}
            d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${sa > 180 ? 1 : 0} 1 ${x2} ${y2} Z`}
            fill={i < fill ? "#dc2626" : "transparent"}
            stroke="#6b7280"
            strokeWidth="1"
            style={{ cursor: interactive ? "pointer" : "default" }}
            onClick={
              interactive && onClick
                ? () => onClick(i < fill ? i : i + 1)
                : undefined
            }
          />
        );
      })}
    </svg>
  );
  if (showArrows) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <button
          type="button"
          style={arrowBtnStyle}
          onClick={() => onClick(Math.max(0, fill - 1))}
          title="Decrease filled ticks"
        >
          −
        </button>
        {svg}
        <button
          type="button"
          style={arrowBtnStyle}
          onClick={() => onClick(Math.min(n, fill + 1))}
          title="Increase filled ticks"
        >
          +
        </button>
      </div>
    );
  }
  return svg;
};

/**
 * Exclude entries that are clearly not recover-in-play treatment bolsters:
 * recon/stealth (Scout), offensive melee/attack (+1d) (Zoom Punch), or non-treatment resistance/counterattack wording.
 */
function healBolsterCandidateExcludedFromRecoverPlay(combinedTextLower) {
  const t = String(combinedTextLower || "").toLowerCase();
  if (!t.trim()) return false;
  const treatmentAdjacent =
    /\b(heal(?:ing)?\b|\brecovery\b(?:\s+rolls?\b|\s+treatment\b)?|healing clock|recovery treatment|recovery rolls?|treatment roll|stabili|\bsuture\b|\bmedic|\bmedical|\btreat(?:ment)?\b|\bpatient\b|\btherapy\b|\breviv|\brestore\b|\bsegment\b|injur(?:y)?|harm\b|blood\b|bleed(?:ing)?)/i.test(
      t,
    );
  if (
    /\b(successful\s+)?resistance\s+rolls?\b/i.test(t) &&
    /\bcounterattack\b/i.test(t) &&
    !treatmentAdjacent
  ) {
    return true;
  }
  if (
    /\b(gather\s+info\s+to\s+locate|locate\s+a\s+target|avoid\s+detection|camouflage)\b/i.test(
      t,
    ) &&
    !treatmentAdjacent
  ) {
    return true;
  }
  if (
    (/\bmelee\s+strike\b/.test(t) ||
      /\+\s*1d\s+when\s+attacking\b/.test(t) ||
      /\battack(?:ing)?\s+from\s+unexpected\s+angles\b/.test(t)) &&
    !treatmentAdjacent
  ) {
    return true;
  }
  return false;
}

/** Recover-in-play / healing bolster picker: narrows abilities + heritage copy (not overly broad generic "stress"). */
function healBolsterCandidateMatchesCombinedText(
  combinedTextLower,
  hasRollDiceOrEffectFromDescription,
) {
  if (healBolsterCandidateExcludedFromRecoverPlay(combinedTextLower))
    return false;
  const hasHealFlavor =
    /\b(healing|heal\b|recovery|recover(y)?\b|stabili[sz]|suture|\bmedic|operative|\btreat\b|patient|\btherapy|blood|bleed(?:ing)?|injur(?:y)?|hurt\b|repair\b|segment|operative|infusion|\brepair\b[^\n]{0,40}\bharm\b|restore\b)/i.test(
      combinedTextLower,
    );
  const healClockOrRecoveryRoll =
    /\b(healing clock|recovery roll|recovery rolls|treatment roll|recovery treatment)\b/i.test(
      combinedTextLower,
    );
  const allyAid =
    /\b(assist\s+a\s+teammate|protect\s+a\s+teammate|teammates?|allies|another\s+crew|another\s+pc)\b/i.test(
      combinedTextLower,
    );
  const positionForSafety = /\+\s*\d\s*position\b|gain\s+.{0,24}position\b|better\s+position\b/i.test(
    combinedTextLower,
  );
  const stressSpentHeal =
    /\bstress\b/.test(combinedTextLower) &&
    /\b(heal|segment|recovery|stabili|medic|treat|patient|suture|blood|reviv|restore)\b/i.test(
      combinedTextLower,
    );
  if (hasHealFlavor || healClockOrRecoveryRoll || stressSpentHeal || positionForSafety)
    return true;
  if (
    hasRollDiceOrEffectFromDescription &&
    (hasHealFlavor || healClockOrRecoveryRoll || allyAid)
  )
    return true;
  if (hasRollDiceOrEffectFromDescription && /\b(inject|surgery|first aid|field kit|tourniquet)\b/i.test(combinedTextLower))
    return true;
  return false;
}

/** Turns healing bolster picker keys into dice-pool `{ dice, effect }` toggles (max supported each). */
function buildHealRollBoostPresetFromSelections(
  selectedKeys,
  candidates,
  abilityRollBonusOptions,
  heritageRollBonusOptions,
) {
  const keySet = new Set(
    Array.isArray(selectedKeys) ? selectedKeys.map((k) => String(k)) : [],
  );
  const abilitiesPreset = {};
  const heritagePreset = {};
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { abilities: abilitiesPreset, heritage: heritagePreset };
  }
  candidates.forEach((c) => {
    if (!c || !keySet.has(String(c.key))) return;
    const boostId = String(c.boostKey);
    if (c.rollKind === "ability") {
      const ab = abilityRollBonusOptions.find(
        (x) => String(x.id ?? x.name) === boostId,
      );
      if (!ab) return;
      abilitiesPreset[boostId] = {
        dice: !!ab.supportsDice,
        effect: !!ab.supportsEffect,
      };
      return;
    }
    if (c.rollKind === "heritage") {
      const hb = heritageRollBonusOptions.find(
        (x) => String(x.id ?? x.name) === boostId,
      );
      if (!hb) return;
      heritagePreset[boostId] = {
        dice: !!hb.supportsDice,
        effect: !!hb.supportsEffect,
      };
    }
  });
  return { abilities: abilitiesPreset, heritage: heritagePreset };
}

// ─── CharacterSheetWrapper ────────────────────────────────────────────────────

const CATEGORY_LABELS = {
  aggression: "Aggression",
  endurance: "Endurance",
  cunning: "Cunning",
  awareness: "Awareness",
  presence: "Presence",
  teamwork: "Teamwork",
  adaptability: "Adaptability",
  stand_nature: "Stand Nature",
};

/** Compare kit rows without extra server-normalized fields causing false mismatch. */
function inventorySyncFingerprint(inv) {
  return JSON.stringify(
    normalizeCharacterInventory(inv).map((item) => ({
      id: String(item.id ?? ""),
      name: String(item.name || ""),
      armor_kind: String(item.armor_kind || ""),
      load: Number(item.load) || 0,
      detail: String(item.detail || ""),
      category: String(item.category || ""),
    })),
  );
}

function hasMeaningfulDraftChanges(payload) {
  if (!payload || payload.id) return false;
  const textFields = [
    payload.name,
    payload.standName,
    payload.background,
    payload.look,
    payload.vice,
    payload.viceDetails,
    payload.crew,
    payload.image_url,
  ];
  if (textFields.some((v) => String(v ?? "").trim() !== "")) return true;
  if (payload.campaign != null && payload.campaign !== "") return true;
  if ((payload.playbook || "Stand") !== "Stand") return true;
  if (String(payload.secondaryPlaybook || "").trim() !== "") return true;
  if ((payload.stressFilled || 0) > 0) return true;
  if ((payload.standArmorUsed || 0) > 0) return true;
  if (inventoryHasPhysicalArmor(payload.inventory)) return true;
  if ((payload.physicalArmorBonusCharges || 0) > 0) return true;
  if ((payload.physicalArmorUsed || 0) > 0) return true;
  if ((payload.unallocatedXp || 0) > 0) return true;
  if ((payload.healingClock || 0) > 0) return true;
  if ((payload.coinFilled || 0) > 0) return true;
  if (Object.values(payload.xp || {}).some((v) => (Number(v) || 0) > 0))
    return true;
  if (Object.values(payload.actionRatings || {}).some((v) => (Number(v) || 0) > 0))
    return true;
  if (
    Object.entries(payload.standStats || {}).some(
      ([, v]) => (Number(v) || 0) !== 1,
    )
  )
    return true;
  if (Object.values(payload.trauma || {}).some(Boolean)) return true;
  const harm = payload.harm || {};
  if (
    Object.values(harm).some(
      (arr) => Array.isArray(arr) && arr.some((x) => String(x || "").trim() !== ""),
    )
  )
    return true;
  if (Array.isArray(payload.stash) && payload.stash.some(Boolean)) return true;
  if (Array.isArray(payload.abilities) && payload.abilities.length > 0) return true;
  if (Array.isArray(payload.clocks) && payload.clocks.length > 0) return true;
  if (
    Array.isArray(payload.selected_benefits) &&
    payload.selected_benefits.length > 0
  )
    return true;
  if (
    Array.isArray(payload.selected_detriments) &&
    payload.selected_detriments.length > 0
  )
    return true;
  if (String(payload.sheetNotes ?? "").trim() !== "") return true;
  if (Array.isArray(payload.inventory) && payload.inventory.length > 0)
    return true;
  if (
    Array.isArray(payload.playbookXpArchetypes) &&
    payload.playbookXpArchetypes.length > 0
  )
    return true;
  if (String(payload.standTypeCustom || "").trim() !== "") return true;
  if (Array.isArray(payload.standForms) && payload.standForms.length > 0)
    return true;
  if (String(payload.standConsciousness || "").trim() !== "") return true;
  return false;
}

function pickHealClockAction(candidate) {
  const keys = Object.keys(ACTION_ATTR || {});
  const u = String(candidate || "TINKER").trim().toUpperCase();
  return keys.includes(u) ? u : "TINKER";
}

/**
 * Downtime recovery tick table from a persisted action roll (`roll_action`) result.
 * Self-treatment in downtime (−1 tick) per SRD. Matches server segment logic otherwise.
 */
function downtimeHealingTicksFromApiRoll(res, subtractOneForSelfTreatment) {
  const rolled = Array.isArray(res?.dice_results)
    ? res.dice_results
        .map((d) => Number(d))
        .filter((n) => Number.isFinite(n))
    : [];
  const critical = rolled.filter((d) => d === 6).length >= 2;
  const hi = Number.isFinite(Number(res?.highest))
    ? Number(res.highest)
    : rolled.length > 0
      ? Math.max(...rolled)
      : 0;
  let ticks = critical ? 5 : hi >= 6 ? 3 : hi >= 4 ? 2 : 1;
  if (subtractOneForSelfTreatment) ticks = Math.max(0, ticks - 1);
  const bandLabel = critical ? "Critical" : hi >= 6 ? "6" : hi >= 4 ? "4/5" : "1–3";
  return { ticks, bandLabel, critical };
}

/** True when this roll is downtime healing-clock treatment (not recover-in-play P/E). */
function isDowntimeHealingHealAttempt(ht) {
  if (!ht || typeof ht !== "object") return false;
  const cad = String(ht.treatmentCadence ?? ht.treatment_cadence ?? "")
    .trim()
    .toLowerCase();
  if (cad === "downtime") return true;
  if (cad === "mid_action") return false;
  if (
    String(ht.kind || "").toLowerCase() === "heal_other" &&
    ht.recoverInPlayTreatment === false &&
    ht.usesSessionPositionEffect === false
  ) {
    return true;
  }
  return false;
}

function readCharSheetBool(characterId, section, defaultValue) {
  if (characterId == null || characterId === "") return defaultValue;
  try {
    const raw = window.localStorage.getItem(
      `biz:char-sheet:${section}:${characterId}`,
    );
    if (raw == null || raw === "") return defaultValue;
    const v = JSON.parse(raw);
    return typeof v === "boolean" ? v : defaultValue;
  } catch {
    return defaultValue;
  }
}

function writeCharSheetBool(characterId, section, value) {
  if (characterId == null || characterId === "") return;
  try {
    window.localStorage.setItem(
      `biz:char-sheet:${section}:${characterId}`,
      JSON.stringify(!!value),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

function readCharSheetNotesInventory(characterId, defaultValue) {
  if (characterId == null || characterId === "") return defaultValue;
  try {
    const raw = window.localStorage.getItem(
      `biz:char-sheet:notes-inventory:${characterId}`,
    );
    if (raw == null || raw === "") return defaultValue;
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return defaultValue;
    return {
      notes: typeof o.notes === "boolean" ? o.notes : defaultValue.notes,
      inventory:
        typeof o.inventory === "boolean"
          ? o.inventory
          : defaultValue.inventory,
    };
  } catch {
    return defaultValue;
  }
}

function writeCharSheetNotesInventory(characterId, value) {
  if (characterId == null || characterId === "") return;
  try {
    window.localStorage.setItem(
      `biz:char-sheet:notes-inventory:${characterId}`,
      JSON.stringify(value),
    );
  } catch {
    /* ignore */
  }
}

const CharacterSheetWrapper = ({
  character,
  onClose,
  onSave,
  onSwitchCharacter,
  onCrewNameUpdated,
  allCharacters = [],
  campaigns = [],
  heritages = [],
  heritagesLoading = false,
  heritagesError = null,
  onRetryHeritages,
  isGM = false,
  onCampaignRefresh,
  onDraftMetaChange,
  /** Merge XP clocks / free pool from allocate|deallocate|undo into the open tab so poll hydrate cannot stale-overwrite. */
  onCharacterXpSync,
  /** Merge stress/trauma (and related) into the open tab after local trauma-clear so poll cannot restore max stress. */
  onCharacterStressTraumaSync,
  /** Incremented when CharacterPage finishes a remote sync (poll, SSE, visibility) so session rolls refetch. */
  sessionDataPollTick = 0,
  /** SSE reason that should abort in-flight sheet PATCH (character / experience_tracker / pending_advance). */
  sheetRealtimeReason = "",
  onSheetRealtimeReasonHandled,
  /** When true, skip merging server character snapshots into XP / stand / action state (avoids poll overwriting local spends before autosave). */
  sheetDraftIsDirty = false,
  /** After reset-sheet: parent replaces tab character and remounts this wrapper. */
  onCharacterReloaded,
}) => {
  const { user } = useAuth();
  /** Last XP clocks/pool applied from a dedicated XP API; blocks stale parent hydrate until tab catches up. */
  const xpClocksTruthRef = useRef(null);
  /** Local stress+trauma after marking trauma at max stress; blocks stale poll/hydrate restore. */
  const stressTraumaTruthRef = useRef(null);
  /** Bumped when draft deps change; stale in-flight autosaves must not win lastSaved. */
  const draftGenRef = useRef(0);
  /** Abort in-flight autosave PATCH when allocation APIs return fresher state. */
  const autosaveAbortRef = useRef(null);
  /** Sync guard so Confirm cannot double-fire before levelUpBusy re-renders. */
  const levelUpInFlightRef = useRef(false);
  const pendingResaveRef = useRef(false);
  /**
   * Same-tick protect before meta effect computes isDirty.
   * Set sync in edit handlers; cleared unconditionally after meta pass (or 500ms fallback).
   */
  const dirtyIntentRef = useRef(false);
  const dirtyIntentFallbackTimerRef = useRef(null);
  const lastDraftMetaRef = useRef({
    payload: null,
    isNewCharacter: true,
    isDirty: false,
    isSaving: false,
    dirtyIntent: false,
  });
  /** User touched server-owned field controls this draft; gates hydrate omit + PATCH include. */
  const fieldTouchRef = useRef({
    stress: false,
    trauma: false,
    xp: false,
    healingClock: false,
    inventory: false,
  });
  const markDirtyIntent = useCallback(() => {
    dirtyIntentRef.current = true;
    const nextMeta = {
      ...lastDraftMetaRef.current,
      dirtyIntent: true,
    };
    lastDraftMetaRef.current = nextMeta;
    onDraftMetaChange?.(nextMeta);
    if (dirtyIntentFallbackTimerRef.current) {
      clearTimeout(dirtyIntentFallbackTimerRef.current);
    }
    dirtyIntentFallbackTimerRef.current = setTimeout(() => {
      if (!dirtyIntentRef.current) return;
      dirtyIntentRef.current = false;
      const cleared = {
        ...lastDraftMetaRef.current,
        dirtyIntent: false,
      };
      lastDraftMetaRef.current = cleared;
      onDraftMetaChange?.(cleared);
    }, 500);
  }, [onDraftMetaChange]);
  const markFieldTouch = useCallback(
    (field) => {
      if (!field || !Object.prototype.hasOwnProperty.call(fieldTouchRef.current, field)) {
        return;
      }
      fieldTouchRef.current = { ...fieldTouchRef.current, [field]: true };
      markDirtyIntent();
    },
    [markDirtyIntent],
  );
  const ownerUsername =
    character?.creator_username || character?.user_username || character?.username || "";
  const ownerLabel = ownerUsername
    ? `Created by ${ownerUsername}`
    : character?.user_id
      ? `Created by user #${character.user_id}`
      : "Created by unknown";
  const canEditSheet = !character?.id || isGM || character?.user_id === user?.id;
  const canEditPlan = canEditSheet;
  const canCreateManualHistoryRecord = isGM || character?.user_id === user?.id;
  const characterCampaignContext = useMemo(
    () => resolveCharacterCampaignContext(character, campaigns),
    [character, campaigns],
  );
  const campaignIdFromCharacter = characterCampaignContext.campaignId;
  const charCampaignFromContext = characterCampaignContext.campaignRecord;
  // Campaign assignment (normalize: backend may send campaign as object or ID)
  const [campaignId, setCampaignId] = useState(() => campaignIdFromCharacter);
  const charCampaignFromPicker = useMemo(() => {
    const pickedId = Number.parseInt(String(campaignId || "").trim(), 10);
    if (!Number.isFinite(pickedId)) return null;
    return (campaigns || []).find((c) => Number(c?.id) === pickedId) ?? null;
  }, [campaigns, campaignId]);
  const effectiveCampaignLookupId = useMemo(() => {
    const pickedId = Number.parseInt(String(campaignId || "").trim(), 10);
    if (Number.isFinite(pickedId)) return pickedId;
    return campaignIdFromCharacter;
  }, [campaignId, campaignIdFromCharacter]);
  const [campaignLookup, setCampaignLookup] = useState(null);
  useEffect(() => {
    const fromList =
      charCampaignFromContext ||
      charCampaignFromPicker ||
      (campaigns || []).find(
        (c) => Number(c?.id) === Number(effectiveCampaignLookupId),
      );
    if (fromList || effectiveCampaignLookupId == null) {
      setCampaignLookup(null);
      return undefined;
    }
    let cancelled = false;
    campaignAPI
      .getCampaign(effectiveCampaignLookupId)
      .then((c) => {
        if (!cancelled) setCampaignLookup(c);
      })
      .catch(() => {
        if (!cancelled) setCampaignLookup(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    charCampaignFromContext,
    charCampaignFromPicker,
    campaigns,
    effectiveCampaignLookupId,
  ]);
  const charCampaign =
    charCampaignFromContext || charCampaignFromPicker || campaignLookup;
  const isCampaignGm = useMemo(
    () =>
      isUserCampaignGmForCharacter(user, {
        isGMProp: isGM,
        campaignRecord: charCampaign,
        campaignId: campaignIdFromCharacter,
      }),
    [user, isGM, charCampaign, campaignIdFromCharacter],
  );
  const isGmViewingPc = useMemo(
    () =>
      isGmViewingPlayerCharacterSheet(user, character, {
        isCampaignGm,
        campaignId: campaignIdFromCharacter,
      }),
    [user, character, isCampaignGm, campaignIdFromCharacter],
  );
  const [activeMode, setActiveMode] = useState("CHARACTER MODE");
  const [planMode, setPlanMode] = useState(false);
  const [planPanelOpen, setPlanPanelOpen] = useState(false);
  const [advancementPlan, setAdvancementPlan] = useState(
    () => character?.advancementPlan || [],
  );
  const [planBusy, setPlanBusy] = useState(false);
  const [planSessionHint, setPlanSessionHint] = useState(null);
  /** When Coin plan click would land B→A — pick a_grant before POST. */
  const [planBADraft, setPlanBADraft] = useState(null); // { stat }
  const [planBABranch, setPlanBABranch] = useState("two_standard");
  const [planBAStdIds, setPlanBAStdIds] = useState(["", ""]);
  const [planBAUniques, setPlanBAUniques] = useState([
    { name: "", use: "" },
    { name: "", use: "" },
  ]);
  const [planBAStdId, setPlanBAStdId] = useState("");
  const [planBAError, setPlanBAError] = useState(null);
  /** After Cancel, don't auto-reopen B→A draft until user picks again / plan off. */
  const [planBASuppressed, setPlanBASuppressed] = useState(false);
  const activeSessionId =
    charCampaign?.active_session ??
    (typeof charCampaign?.active_session === "object"
      ? charCampaign?.active_session?.id
      : null);
  const characterId = character?.id;

  /** GM Session bulk editor: per-PC position/effect for this session (overrides defaults). */
  const sessionOverridePositionEffect = useMemo(() => {
    const asd = charCampaign?.active_session_detail;
    if (!asd || characterId == null) return null;
    const m = asd.position_effect_by_character;
    if (!m || typeof m !== "object") return null;
    const row = m[String(characterId)] ?? m[characterId];
    return row && typeof row === "object" ? row : null;
  }, [charCampaign?.active_session_detail, characterId]);

  const sessionLoadoutEntry = useMemo(() => {
    const asd = charCampaign?.active_session_detail;
    if (!asd || characterId == null) return normalizeLoadoutEntry(null);
    const m = asd.loadout_by_character;
    if (!m || typeof m !== "object") return normalizeLoadoutEntry(null);
    return normalizeLoadoutEntry(m[String(characterId)] ?? m[characterId]);
  }, [charCampaign?.active_session_detail, characterId]);

  const handleLoadoutChange = useCallback(
    async (nextEntry) => {
      if (!activeSessionId || characterId == null) return;
      try {
        await sessionAPI.patchSession(activeSessionId, {
          loadout_by_character: { [String(characterId)]: nextEntry },
        });
        onCampaignRefresh?.();
      } catch (err) {
        console.error("Loadout save failed:", err);
      }
    },
    [activeSessionId, characterId, onCampaignRefresh],
  );

  /** GM campaign payloads include full NPC stats; mirror player visibility on the sheet. */
  const sessionNpcsPartyFacingDisplay = useMemo(() => {
    const raw =
      charCampaign?.active_session_detail?.session_npcs_with_clocks || [];
    return raw
      .map((npc) => derivePartyFacingSessionNpc(npc))
      .filter((x) => x.showCard)
      .map((x) => x.display);
  }, [charCampaign?.active_session_detail?.session_npcs_with_clocks]);

  const maxStandGradeIndex =
    character?.gm_can_have_s_rank_stand_stats === true ? 5 : 4;
  const pcStandCoinMaxLetter = maxStandGradeIndex === 5 ? "S" : "A";

  // Resolve heritage: backend sends ID; new tabs may have null until heritages load
  const resolveHeritageId = (h) => {
    if (h == null || h === "") return heritages[0]?.id ?? null;
    if (typeof h === "number")
      return heritages.some((x) => x.id === h) ? h : (heritages[0]?.id ?? null);
    const match = heritages.find(
      (x) => (x.name || "").toLowerCase() === String(h).toLowerCase(),
    );
    return match?.id ?? heritages[0]?.id ?? null;
  };

  // Identity
  const initialCrew = normalizeCrewFromCharacter(character);
  const [charData, setCharData] = useState({
    // Unsaved drafts should start truly blank even if upstream placeholders exist.
    name: character?.id ? (character?.name || "") : "",
    standName: character?.standName || "",
    heritage: resolveHeritageId(character?.heritage),
    background: character?.background || "",
    look: character?.look || "",
    vice: character?.vice || "",
    viceDetails: character?.viceDetails ?? character?.vice_details ?? "",
    crew: initialCrew.crew,
    crewId: initialCrew.crewId,
    sheetNotes: character?.sheetNotes ?? "",
    inventory: normalizeCharacterInventory(character?.inventory),
    fed_today:
      typeof character?.fed_today === "boolean" ? character.fed_today : null,
    disguised_as_human:
      typeof character?.disguised_as_human === "boolean"
        ? character.disguised_as_human
        : null,
  });

  const handlePromoteItemToCampaign = useCallback(
    async (item) => {
      const cid =
        campaignId != null && campaignId !== ""
          ? parseInt(String(campaignId), 10)
          : NaN;
      if (!Number.isFinite(cid)) return;
      if (!String(item?.name || "").trim()) return;
      try {
        await equipmentAPI.fromKitItem({
          campaign: cid,
          name: item.name,
          detail: item.detail,
          category: item.category,
          load: item.load,
          quality: item.quality,
          coin_value: item.coin_value,
          source_character: characterId,
        });
      } catch (err) {
        console.error("Promote to campaign library failed:", err);
      }
    },
    [campaignId, characterId],
  );

  const handlePublishItemToSite = useCallback(
    async (item) => {
      const cid =
        campaignId != null && campaignId !== ""
          ? parseInt(String(campaignId), 10)
          : NaN;
      if (!Number.isFinite(cid)) return;
      if (!String(item?.name || "").trim()) return;
      try {
        const created = await equipmentAPI.fromKitItem({
          campaign: cid,
          name: item.name,
          detail: item.detail,
          category: item.category,
          load: item.load,
          quality: item.quality,
          coin_value: item.coin_value,
          source_character: characterId,
        });
        const scope = String(created?.scope || "").toUpperCase();
        if (scope === "TEMPLATE" || scope === "SITE") return;
        if (created?.id) await equipmentAPI.publishToSite(created.id);
      } catch (err) {
        console.error("Publish to site catalog failed:", err);
      }
    },
    [campaignId, characterId],
  );

  // Portrait state
  const [imageUrl, setImageUrl] = useState(character?.image_url || "");
  const [imagePreview, setImagePreview] = useState(
    character?.image || character?.image_url || "",
  );
  const [removeImageRequested, setRemoveImageRequested] = useState(false);
  const [portraitUrlModalOpen, setPortraitUrlModalOpen] = useState(false);
  const [portraitUrlDraft, setPortraitUrlDraft] = useState("");

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState(null);
  const [exportPdfStatus, setExportPdfStatus] = useState(null);
  const [exportPdfError, setExportPdfError] = useState(null);
  const debounceRef = useRef(null);
  const mountedRef = useRef(false);
  const savingRef = useRef(false);
  const lastSavedPayloadRef = useRef(null);

  useEffect(() => {
    lastSavedPayloadRef.current = null;
  }, [character?.id]);

  useEffect(() => {
    fieldTouchRef.current = {
      stress: false,
      trauma: false,
      xp: false,
      healingClock: false,
      inventory: false,
    };
  }, [character?.id]);

  useEffect(() => {
    lastSavedPayloadRef.current = null;
  }, [sessionDataPollTick]);

  const openPortraitUrlModal = useCallback(() => {
    setPortraitUrlDraft(String(imageUrl || "").trim());
    setPortraitUrlModalOpen(true);
  }, [imageUrl]);

  const savePortraitUrlFromModal = useCallback(() => {
    const next = String(portraitUrlDraft || "").trim();
    if (next) {
      setImageUrl(next);
      setImagePreview(next);
      setRemoveImageRequested(false);
    }
    setPortraitUrlModalOpen(false);
  }, [portraitUrlDraft]);

  const handleRemovePortrait = useCallback(() => {
    setImageUrl("");
    setImagePreview("");
    setRemoveImageRequested(true);
  }, []);

  const handleExportPdf = useCallback(async () => {
    if (!characterId) return;
    setExportPdfStatus("exporting");
    setExportPdfError(null);
    try {
      const baseName = String(charData.name || character?.name || "character")
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 80);
      await characterAPI.exportPdf(
        characterId,
        `${baseName || "character"}-character-sheet.pdf`,
      );
      setExportPdfStatus("done");
      window.setTimeout(
        () => setExportPdfStatus((s) => (s === "done" ? null : s)),
        2500,
      );
    } catch (err) {
      setExportPdfStatus("error");
      setExportPdfError(err?.message || "Export failed");
    }
  }, [characterId, charData.name, character?.name]);

  useEffect(() => {
    if (!portraitUrlModalOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setPortraitUrlModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [portraitUrlModalOpen]);

  // Sync crew/crewId when character or campaign roster changes.
  useEffect(() => {
    const resolved = resolveCrewFromCampaign(
      charCampaign,
      characterId,
      character,
    );
    setCharData((prev) =>
      prev.crew !== resolved.crew || prev.crewId !== resolved.crewId
        ? { ...prev, crew: resolved.crew, crewId: resolved.crewId }
        : prev,
    );
  }, [
    character,
    character?.crew,
    character?.crewId,
    character?.crew_id,
    character?.crew_name,
    character?.personal_crew_name,
    characterId,
    charCampaign,
    charCampaign?.id,
    charCampaign?.crews,
    charCampaign?.campaign_characters,
  ]);

  useEffect(() => {
    if (sheetDraftIsDirty) return;
    const sn = character?.sheetNotes ?? "";
    const inv = normalizeCharacterInventory(character?.inventory);
    setCharData((prev) => {
      // After inventory autosave (incl. Del), dirty/saving can clear before the
      // parent character prop catches up. Keep local kit until server matches
      // so deleted rows do not reappear.
      let nextInv = inv;
      if (fieldTouchRef.current.inventory) {
        const localFp = inventorySyncFingerprint(prev.inventory);
        const serverFp = inventorySyncFingerprint(inv);
        if (localFp !== serverFp) {
          nextInv = prev.inventory;
        } else {
          fieldTouchRef.current.inventory = false;
        }
      }
      if (
        (prev.sheetNotes ?? "") === sn &&
        JSON.stringify(prev.inventory ?? []) === JSON.stringify(nextInv ?? [])
      ) {
        return prev;
      }
      return { ...prev, sheetNotes: sn, inventory: nextInv };
    });
  }, [
    character?.id,
    character?.sheetNotes,
    character?.inventory,
    sheetDraftIsDirty,
  ]);

  /** Persist crew label: shared campaign crew (PATCH crew) or personal_crew_name / create+link. Used in Character and Crew mode. */
  const commitCrewName = useCallback(async () => {
    if (!characterId) return;
    const name = (charData.crew || "").trim();
    const crewCampaignId = (c) =>
      typeof c?.campaign === "object" ? c.campaign?.id : c?.campaign;

    if (charData.crewId) {
      if (name === (character?.crew || "")) return;
      try {
        await crewAPI.patchCrew(charData.crewId, { name });
        onCrewNameUpdated?.(name, charData.crewId, characterId);
      } catch (err) {
        console.error("Failed to update crew name:", err);
      }
      return;
    }

    const cid = campaignId ? parseInt(String(campaignId), 10) : NaN;
    if (!Number.isFinite(cid)) {
      if (name === (character?.crew || "")) return;
      try {
        await characterAPI.patchCharacter(characterId, {
          personal_crew_name: name,
        });
        setCharData((p) => ({ ...p, crew: name }));
        onCrewNameUpdated?.(name, null, characterId);
      } catch (err) {
        console.error("Failed to save crew name:", err);
      }
      return;
    }

    if (!name) return;
    try {
      const crews = await crewAPI.getCrews();
      let crewRow = (crews || []).find(
        (c) => crewCampaignId(c) === cid && (c.name || "").trim() === name,
      );
      if (!crewRow) {
        crewRow = await crewAPI.createCrew({ name, campaign: cid });
      }
      await characterAPI.patchCharacter(characterId, { crew_id: crewRow.id });
      const resolvedName = crewRow.name || name;
      setCharData((p) => ({ ...p, crewId: crewRow.id, crew: resolvedName }));
      onCrewNameUpdated?.(resolvedName, crewRow.id, characterId);
    } catch (err) {
      console.error("Failed to create/link crew:", err);
    }
  }, [
    characterId,
    charData.crew,
    charData.crewId,
    campaignId,
    character?.crew,
    onCrewNameUpdated,
  ]);

  // Sync vice/viceDetails when character changes (e.g. switching tabs or after load)
  useEffect(() => {
    const newVice = character?.vice ?? "";
    const newViceDetails =
      character?.viceDetails ?? character?.vice_details ?? "";
    setCharData((prev) =>
      prev.vice !== newVice || prev.viceDetails !== newViceDetails
        ? { ...prev, vice: newVice, viceDetails: newViceDetails }
        : prev,
    );
  }, [
    character?.id,
    character?.vice,
    character?.viceDetails,
    character?.vice_details,
  ]);

  useEffect(() => {
    const fedToday =
      typeof character?.fed_today === "boolean" ? character.fed_today : null;
    setCharData((prev) =>
      prev.fed_today !== fedToday ? { ...prev, fed_today: fedToday } : prev,
    );
  }, [character?.id, character?.fed_today]);

  useEffect(() => {
    const v =
      typeof character?.disguised_as_human === "boolean"
        ? character.disguised_as_human
        : null;
    setCharData((prev) =>
      prev.disguised_as_human !== v ? { ...prev, disguised_as_human: v } : prev,
    );
  }, [character?.id, character?.disguised_as_human]);

  // When parent merges id before full GET/list row arrives, fill empty identity from server (avoid PATCH wiping true_name, etc.)
  useEffect(() => {
    if (sheetDraftIsDirty) return;
    setCharData((prev) => {
      const patch = {};
      const n = character?.id ? (character?.name ?? "") : "";
      if (n && !(prev.name || "").trim()) patch.name = n;
      const sn = character?.standName ?? "";
      if (sn && !(prev.standName || "").trim()) patch.standName = sn;
      const bg = character?.background ?? "";
      if (bg && !(prev.background || "").trim()) patch.background = bg;
      const look = character?.look ?? "";
      if (look && !(prev.look || "").trim()) patch.look = look;
      return Object.keys(patch).length ? { ...prev, ...patch } : prev;
    });
  }, [
    character?.id,
    character?.name,
    character?.standName,
    character?.background,
    character?.look,
    sheetDraftIsDirty,
  ]);

  // Portrait: sync from server/merged character; do not clobber while a file upload is pending
  useEffect(() => {
    setImageUrl(character?.image_url || "");
    setImagePreview(character?.image || character?.image_url || "");
    setRemoveImageRequested(false);
  }, [character?.id, character?.image, character?.image_url]);

  // Sync heritage when heritages load (e.g. new char has heritage: 'Human' string)
  useEffect(() => {
    if (!heritages?.length) return;
    if (typeof charData.heritage === "number") return;
    const resolved = resolveHeritageId(character?.heritage);
    if (resolved != null && resolved !== charData.heritage) {
      setCharData((prev) => ({ ...prev, heritage: resolved }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid loops; only re-resolve when heritages or API heritage changes
  }, [heritages, character?.heritage]);

  // Sync selected benefits/detriments when character changes (e.g. switching tabs)
  // Only update when content differs to avoid save loop: updateActiveCharTab passes new array refs
  // after each save; without value comparison we'd trigger setState → auto-save → save → loop.
  useEffect(() => {
    const newBenefits = Array.isArray(character?.selected_benefits)
      ? character.selected_benefits
      : [];
    const newDetriments = Array.isArray(character?.selected_detriments)
      ? character.selected_detriments
      : [];
    const arrEqual = (a, b) =>
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => v === b[i]);
    setSelectedBenefits((prev) =>
      arrEqual(prev, newBenefits) ? prev : newBenefits,
    );
    setSelectedDetriments((prev) =>
      arrEqual(prev, newDetriments) ? prev : newDetriments,
    );
  }, [
    character?.id,
    character?.selected_benefits,
    character?.selected_detriments,
  ]);

  // When heritage changes, reset to required benefits/detriments for the new heritage
  useEffect(() => {
    if (!charData.heritage || !heritages?.length) return;
    const h = heritages.find((x) => x.id === charData.heritage);
    if (!h?.benefits || !h?.detriments) return;
    const reqBenIds = (h.benefits || [])
      .filter((b) => b.required)
      .map((b) => b.id);
    const reqDetIds = (h.detriments || [])
      .filter((d) => d.required)
      .map((d) => d.id);
    setSelectedBenefits((prev) => {
      const valid = prev.filter((id) =>
        (h.benefits || []).some((b) => b.id === id),
      );
      const merged = [...new Set([...reqBenIds, ...valid])];
      return merged.length ? merged : prev;
    });
    setSelectedDetriments((prev) => {
      const valid = prev.filter((id) =>
        (h.detriments || []).some((d) => d.id === id),
      );
      const merged = [...new Set([...reqDetIds, ...valid])];
      return merged.length ? merged : prev;
    });
  }, [charData.heritage, heritages]);

  // FIX 2+3: Stand Coin Stats — F(0)..A(4); S is GM-only
  const [standStats, setStandStats] = useState(
    character?.standStats || {
      power: 1,
      speed: 1,
      range: 1,
      durability: 1,
      precision: 1,
      development: 1,
    },
  );

  // Sync standStats when character changes (e.g. switching tabs)
  useEffect(() => {
    if (sheetDraftIsDirty) return;
    const next = character?.standStats;
    if (next && typeof next === "object") {
      setStandStats((prev) => {
        const keys = [
          "power",
          "speed",
          "range",
          "durability",
          "precision",
          "development",
        ];
        const changed = keys.some((k) => (prev[k] ?? 1) !== (next[k] ?? 1));
        return changed ? { ...prev, ...next } : prev;
      });
    }
  }, [character?.id, character?.standStats, sheetDraftIsDirty]);

  // FIX 1: Action ratings — creation enforces 7 total / max 2 per action
  const [actionRatings, setActionRatings] = useState(
    character?.actionRatings || {
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
  );

  // Sync action dots when loaded character arrives (missing sync caused blank action_dots on save)
  useEffect(() => {
    if (sheetDraftIsDirty) return;
    const next = character?.actionRatings;
    if (!next || typeof next !== "object") return;
    setActionRatings((prev) => {
      const keys = [...new Set([...Object.keys(prev), ...Object.keys(next)])];
      const changed = keys.some(
        (k) => (Number(prev[k]) || 0) !== (Number(next[k]) || 0),
      );
      return changed ? { ...prev, ...next } : prev;
    });
  }, [character?.id, character?.actionRatings, sheetDraftIsDirty]);

  // Stress — tracked as filled count; max derived from Durability
  const [stressFilled, setStressFilled] = useState(
    character?.stressFilled || 0,
  );

  // Trauma (object from API or DEFAULT_TRAUMA)
  const [trauma, setTrauma] = useState(
    character?.trauma &&
      typeof character.trauma === "object" &&
      !Array.isArray(character.trauma)
      ? { ...DEFAULT_TRAUMA, ...character.trauma }
      : DEFAULT_TRAUMA,
  );

  // SRD_DEV: Stand path armor (Durability) vs physical gear (fiction / GM pool)
  const [standArmorUsed, setStandArmorUsed] = useState(
    character?.standArmorUsed ?? 0,
  );
  const [physicalArmorUsed, setPhysicalArmorUsed] = useState(
    () =>
      Math.min(
        6,
        Math.max(0, Math.floor(Number(character?.physicalArmorUsed) || 0)),
      ),
  );
  const [spinArmorUsed, setSpinArmorUsed] = useState(
    () =>
      Math.min(
        3,
        Math.max(0, Math.floor(Number(character?.spinArmorUsed) || 0)),
      ),
  );
  const [hamonArmorUsed, setHamonArmorUsed] = useState(
    () =>
      Math.min(
        3,
        Math.max(0, Math.floor(Number(character?.hamonArmorUsed) || 0)),
      ),
  );
  const [specialArmorUsed, setSpecialArmorUsed] = useState(
    () => Math.max(0, Math.floor(Number(character?.specialArmorUsed) || 0)),
  );

  const inventoryHasArmor = useMemo(
    () => inventoryHasPhysicalArmor(charData.inventory),
    [charData.inventory],
  );

  const inventoryArmorCharges = useMemo(
    () => inventoryPhysicalArmorCharges(charData.inventory),
    [charData.inventory],
  );

  const inventoryHasSpecial = useMemo(
    () => inventoryHasSpecialArmor(charData.inventory),
    [charData.inventory],
  );

  const inventorySpecialCount = useMemo(
    () => inventorySpecialArmorCount(charData.inventory),
    [charData.inventory],
  );

  const physicalArmorMax = useMemo(() => {
    if (!inventoryHasArmor) return 0;
    return Math.min(6, Math.max(0, inventoryArmorCharges));
  }, [inventoryHasArmor, inventoryArmorCharges]);

  useEffect(() => {
    if (!inventoryHasArmor) {
      setPhysicalArmorUsed(0);
      return;
    }
    setPhysicalArmorUsed((used) =>
      Math.min(used, inventoryArmorCharges),
    );
  }, [inventoryHasArmor, inventoryArmorCharges]);

  useEffect(() => {
    if (!inventoryHasSpecial) {
      setSpecialArmorUsed(0);
      return;
    }
    setSpecialArmorUsed((used) => Math.min(used, inventorySpecialCount));
  }, [inventoryHasSpecial, inventorySpecialCount]);

  // Harm (API can send harm or harmEntries; always keep L1/L2×2, L3, L4)
  const [harm, setHarm] = useState(() =>
    normalizeHarmObject(character?.harm || character?.harmEntries),
  );
  const [healingClock, setHealingClock] = useState(
    character?.healingClock ?? 0,
  );
  const [healingClockSegments, setHealingClockSegments] = useState(() =>
    Math.min(
      5,
      Math.max(4, Math.floor(Number(character?.healingClockSegments) || 4)),
    ),
  );

  const [healingRecoverBusy, setHealingRecoverBusy] = useState(false);
  const [healingRecoverErr, setHealingRecoverErr] = useState(null);
  const [healingRecoverMsg, setHealingRecoverMsg] = useState("");
  /** Action rating used for downtime + mid-action healing-clock recover (default Tinker); per-character localStorage. */
  const [selfHealingRecoverAction, setSelfHealingRecoverAction] =
    useState("TINKER");

  // Coin & Stash (API sends coin as array; sheet uses coinFilled number)
  const [coinFilled, setCoinFilled] = useState(
    typeof character?.coinFilled === "number"
      ? character.coinFilled
      : Array.isArray(character?.coin)
        ? character.coin.filter(Boolean).length
        : 0,
  );
  const [stashBoxes, setStashBoxes] = useState(
    character?.stash && Array.isArray(character.stash)
      ? character.stash
      : Array(40).fill(false),
  );

  // XP tracks
  const [xp, setXp] = useState(
    character?.xp || {
      insight: 0,
      prowess: 0,
      resolve: 0,
      heritage: 0,
      playbook: 0,
    },
  );
  const [unallocatedXp, setUnallocatedXp] = useState(
    Math.max(0, Math.floor(Number(character?.unallocatedXp) || 0)),
  );
  const [pendingAdvanceCounts, setPendingAdvanceCounts] = useState(() => ({
    ...(character?.pendingAdvanceCounts || {}),
  }));
  const [poolAllocateBusy, setPoolAllocateBusy] = useState(false);
  const [poolTickError, setPoolTickError] = useState(null);

  // Abort in-flight autosave when SSE says character / XP / pending advanced.
  useEffect(() => {
    const reason = String(sheetRealtimeReason || "");
    if (
      reason !== "character" &&
      reason !== "experience_tracker" &&
      reason !== "pending_advance" &&
      reason !== "advancement_plan"
    ) {
      return;
    }
    if (autosaveAbortRef.current) {
      autosaveAbortRef.current.abort();
      autosaveAbortRef.current = null;
    }
    draftGenRef.current += 1;
    onSheetRealtimeReasonHandled?.();
  }, [sheetRealtimeReason, onSheetRealtimeReasonHandled]);

  // Hydrate sheet from server when character payload arrives after first paint (same class of bug as actionRatings).
  // Stress/trauma/XP are server-owned: merge unless the user touched that field's control this draft
  // (broad sheetDraftIsDirty must NOT block stress while e.g. inventory is dirty).
  useEffect(() => {
    const truth = stressTraumaTruthRef.current;
    if (truth) {
      const parentStress = Number(character?.stressFilled);
      if (
        Number.isFinite(parentStress) &&
        parentStress === truth.stressFilled
      ) {
        // Parent caught up on stress; trauma lock may still be active via trauma effect.
      } else if (
        typeof truth.stressFilled === "number" &&
        Number.isFinite(parentStress) &&
        parentStress !== truth.stressFilled
      ) {
        return;
      }
    }
    if (fieldTouchRef.current.stress) return;
    const v = character?.stressFilled;
    if (typeof v === "number") setStressFilled((p) => (p !== v ? v : p));
  }, [character?.id, character?.stressFilled, sheetDraftIsDirty]);

  useEffect(() => {
    const truth = stressTraumaTruthRef.current;
    if (truth?.trauma) {
      const parentT = character?.trauma;
      const keys = Object.keys(truth.trauma);
      const matches =
        parentT &&
        typeof parentT === "object" &&
        !Array.isArray(parentT) &&
        keys.every((k) => !!parentT[k] === !!truth.trauma[k]);
      if (matches) {
        // Keep stress half of the lock if stress still diverges.
        if (
          typeof truth.stressFilled === "number" &&
          Number(character?.stressFilled) !== truth.stressFilled
        ) {
          stressTraumaTruthRef.current = {
            stressFilled: truth.stressFilled,
            trauma: null,
          };
        } else {
          stressTraumaTruthRef.current = null;
        }
      } else {
        return;
      }
    }
    if (fieldTouchRef.current.trauma) return;
    const t = character?.trauma;
    if (!t || typeof t !== "object" || Array.isArray(t)) return;
    // Trauma: server object wins wholesale (no element-level merge).
    setTrauma((prev) => {
      const next = { ...DEFAULT_TRAUMA, ...t };
      return Object.keys(DEFAULT_TRAUMA).every((k) => !!next[k] === !!prev[k])
        ? prev
        : next;
    });
    // character?.stressFilled: used when splitting stress/trauma truth lock after trauma catches up
  }, [character?.id, character?.stressFilled, character?.trauma, sheetDraftIsDirty]);

  useEffect(() => {
    if (sheetDraftIsDirty) return;
    const h = character?.harm || character?.harmEntries;
    if (!h || typeof h !== "object") return;
    setHarm((prev) => {
      const next = normalizeHarmObject(h);
      const levels = ["level4", "level3", "level2", "level1"];
      const same = levels.every(
        (lv) => JSON.stringify(prev[lv]) === JSON.stringify(next[lv]),
      );
      return same ? prev : { ...prev, ...next };
    });
  }, [
    character?.id,
    character?.harm,
    character?.harmEntries,
    sheetDraftIsDirty,
  ]);

  useEffect(() => {
    if (
      shouldSkipServerOwnedFieldHydration("healingClock", {
        fieldTouches: fieldTouchRef.current,
        sheetDraftIsDirty,
      })
    ) {
      return;
    }
    const h = character?.healingClock;
    if (typeof h !== "number") return;
    setHealingClock((p) => (p !== h ? h : p));
  }, [character?.id, character?.healingClock, sheetDraftIsDirty]);

  useEffect(() => {
    // Same dirty/truth gate as xp clocks: poll can deliver a stale snapshot while a
    // just-completed allocate/deallocate is still the source of truth locally.
    const truth = xpClocksTruthRef.current;
    if (truth) {
      const parentPool = Math.max(
        0,
        Math.floor(Number(character?.unallocatedXp) || 0),
      );
      if (parentPool !== truth.unallocatedXp) return;
    }
    if (fieldTouchRef.current.xp) return;
    const v = character?.unallocatedXp;
    if (typeof v !== "number") return;
    const n = Math.max(0, Math.floor(v));
    setUnallocatedXp((p) => (p !== n ? n : p));
  }, [character?.id, character?.unallocatedXp, sheetDraftIsDirty]);

  useEffect(() => {
    if (sheetDraftIsDirty) return;
    if (typeof character?.standArmorUsed === "number" && Number.isFinite(character.standArmorUsed))
      setStandArmorUsed(Math.max(0, Math.floor(character.standArmorUsed)));
    const u = character?.physicalArmorUsed;
    if (typeof u === "number" && Number.isFinite(u))
      setPhysicalArmorUsed(Math.min(6, Math.max(0, Math.floor(u))));
    const spin = character?.spinArmorUsed;
    if (typeof spin === "number" && Number.isFinite(spin))
      setSpinArmorUsed(Math.min(3, Math.max(0, Math.floor(spin))));
    const hamon = character?.hamonArmorUsed;
    if (typeof hamon === "number" && Number.isFinite(hamon))
      setHamonArmorUsed(Math.min(3, Math.max(0, Math.floor(hamon))));
    const special = character?.specialArmorUsed;
    if (typeof special === "number" && Number.isFinite(special))
      setSpecialArmorUsed(Math.max(0, Math.floor(special)));
  }, [
    character?.id,
    character?.standArmorUsed,
    character?.physicalArmorUsed,
    character?.spinArmorUsed,
    character?.hamonArmorUsed,
    character?.specialArmorUsed,
    sheetDraftIsDirty,
  ]);

  useEffect(() => {
    const truth = xpClocksTruthRef.current;
    if (truth) {
      const parentPool = Math.max(
        0,
        Math.floor(Number(character?.unallocatedXp) || 0),
      );
      const parentXp = character?.xp;
      const xpMatches =
        parentXp &&
        typeof parentXp === "object" &&
        ["insight", "prowess", "resolve", "heritage", "playbook"].every(
          (k) => (Number(parentXp[k]) || 0) === (Number(truth.xp?.[k]) || 0),
        );
      if (xpMatches && parentPool === truth.unallocatedXp) {
        xpClocksTruthRef.current = null;
      } else {
        return;
      }
    }
    if (fieldTouchRef.current.xp) {
      return;
    }
    const nx = character?.xp;
    if (!nx || typeof nx !== "object") return;
    setXp((prev) => {
      const keys = [...new Set([...Object.keys(prev), ...Object.keys(nx)])];
      const changed = keys.some((k) => (prev[k] ?? 0) !== (nx[k] ?? 0));
      return changed ? { ...prev, ...nx } : prev;
    });
  }, [character?.id, character?.xp, character?.unallocatedXp, sheetDraftIsDirty]);

  useEffect(() => {
    if (sheetDraftIsDirty) return;
    const counts = character?.pendingAdvanceCounts;
    if (counts && typeof counts === "object") {
      setPendingAdvanceCounts({ ...counts });
    }
  }, [character?.id, character?.pendingAdvanceCounts, sheetDraftIsDirty]);

  useEffect(() => {
    const plan = character?.advancementPlan;
    if (Array.isArray(plan)) {
      setAdvancementPlan(plan);
    }
  }, [character?.id, character?.advancementPlan]);

  // FIX 6: Level-up modal state — see below near other modal state

  // Hydrate coin/stash only when switching characters (id change). Parent refresh (campaign list refetch,
  // getCharacters) reuses the same id with a new object; syncing on character.coin/stash then wiped
  // local boxes before autosave ran.
  useEffect(() => {
    if (character?.id == null) return;
    if (Array.isArray(character?.coin)) {
      setCoinFilled(character.coin.filter(Boolean).length);
    } else if (
      typeof character?.coinFilled === "number" &&
      Number.isFinite(character.coinFilled)
    ) {
      setCoinFilled(character.coinFilled);
    }
    if (Array.isArray(character?.stash)) {
      setStashBoxes(character.stash);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate coin/stash only on id change (see comment above)
  }, [character?.id]);

  // Heritage benefits and detriments (arrays of IDs)
  const [selectedBenefits, setSelectedBenefits] = useState(
    Array.isArray(character?.selected_benefits)
      ? character.selected_benefits
      : [],
  );
  const [selectedDetriments, setSelectedDetriments] = useState(
    Array.isArray(character?.selected_detriments)
      ? character.selected_detriments
      : [],
  );

  // Tooltip for benefit/detriment description: { type, id, name, description } or null
  const [descTooltip, setDescTooltip] = useState(null);
  const [descTooltipPinned, setDescTooltipPinned] = useState(false); // true when opened by click

  // Close pinned tooltip when clicking outside
  useEffect(() => {
    if (!descTooltipPinned || !descTooltip) return;
    const handleClick = (e) => {
      if (!e.target.closest("[data-desc-tooltip-trigger]")) {
        setDescTooltip(null);
        setDescTooltipPinned(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [descTooltipPinned, descTooltip]);

  // FIX 6: Level-up modal state
  const [showLevelUp, setShowLevelUp] = useState(false);
  /** When set, level-up modal redeems this track's pending advance. */
  const [levelUpLockTrack, setLevelUpLockTrack] = useState(null);
  const [levelUpChoice, setLevelUpChoice] = useState("stat");
  const [levelUpStat, setLevelUpStat] = useState("power");
  const levelUpDot1 = "HUNT";
  const levelUpDot2 = "HUNT";
  const [levelUpSpendTrack, setLevelUpSpendTrack] = useState("playbook");
  const [minorAdvanceSpendTrack, setMinorAdvanceSpendTrack] =
    useState("insight");
  /** Attribute/heritage track advance picker (pending → redeem for advance). */
  const [showTrackAdvance, setShowTrackAdvance] = useState(null);
  const [levelUpBusy, setLevelUpBusy] = useState(false);
  const [levelUpError, setLevelUpError] = useState(null);
  const [minorAdvanceBusy, setMinorAdvanceBusy] = useState(false);
  const [minorAdvanceError, setMinorAdvanceError] = useState(null);
  const [levelUpBtoARewardBranch, setLevelUpBtoARewardBranch] = useState(
    "two_unique_plus_one_standard",
  );
  const [levelUpRewardUniques, setLevelUpRewardUniques] = useState([
    { name: "", use: "" },
    { name: "", use: "" },
  ]);
  const [levelUpRewardStandardId, setLevelUpRewardStandardId] = useState("");
  const [levelUpRewardStandardIds, setLevelUpRewardStandardIds] = useState([
    "",
    "",
  ]);
  const [pendingStandAReward, setPendingStandAReward] = useState(
    () => character?.pendingStandAReward || null,
  );
  const [pendingStandABranch, setPendingStandABranch] = useState(
    "two_standard",
  );
  const [pendingStandAStdIds, setPendingStandAStdIds] = useState(["", ""]);
  const [pendingStandAUniques, setPendingStandAUniques] = useState([
    { name: "", use: "" },
    { name: "", use: "" },
  ]);
  const [pendingStandAStdId, setPendingStandAStdId] = useState("");
  const [pendingStandABusy, setPendingStandABusy] = useState(false);
  const [pendingStandAError, setPendingStandAError] = useState(null);
  const [xpAllocationRows, setXpAllocationRows] = useState([]);
  const [xpAllocationUndoBusy, setXpAllocationUndoBusy] = useState(false);
  const [resetSheetBusy, setResetSheetBusy] = useState(false);
  const [xpAllocationActionError, setXpAllocationActionError] = useState(null);
  /** Top-of-page notice after XP spend undo/redo (what specifically changed). */
  const [xpActionToast, setXpActionToast] = useState(null);
  useEffect(() => {
    if (!xpActionToast) return undefined;
    const t = window.setTimeout(() => setXpActionToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [xpActionToast]);
  const [gmUndoStatus, setGmUndoStatus] = useState({
    available: false,
    summary: null,
  });
  const [gmUndoBusy, setGmUndoBusy] = useState(false);
  const [gmUndoError, setGmUndoError] = useState(null);
  const [gmRedoStatus, setGmRedoStatus] = useState({
    available: false,
    summary: null,
  });
  const [gmRedoBusy, setGmRedoBusy] = useState(false);
  const [gmRedoError, setGmRedoError] = useState(null);
  // FIX 7: Minor advance action selector
  const [minorAdvanceAction, setMinorAdvanceAction] = useState("HUNT");
  const minorAdvanceActions = useMemo(
    () =>
      actionOptionsForXpSpendTrack(actionRatings, minorAdvanceSpendTrack),
    [actionRatings, minorAdvanceSpendTrack],
  );

  useEffect(() => {
    if (!showLevelUp) return;
    // Take advance locks the pending's track. Do not fall back to a
    // leftover 10-mark track (or insight) when clocks sit at 0/10.
    if (levelUpLockTrack) {
      setLevelUpSpendTrack(levelUpLockTrack);
      return;
    }
    setLevelUpSpendTrack((prev) => {
      if ((Number(xp[prev]) || 0) >= 10) return prev;
      return (
        XP_SPEND_TRACK_ORDER.find((t) => (Number(xp[t]) || 0) >= 10) ||
        XP_SPEND_TRACK_ORDER[0]
      );
    });
  }, [showLevelUp, xp, levelUpLockTrack]);

  useEffect(() => {
    const next = character?.pendingStandAReward || null;
    setPendingStandAReward((prev) => {
      const prevId = prev?.allocation_id ?? null;
      const nextId = next?.allocation_id ?? null;
      if (prevId === nextId) {
        if (!nextId) return null;
        // Keep open; refresh metadata if server sent a newer object.
        return next;
      }
      return next;
    });
  }, [character?.id, character?.pendingStandAReward]);

  useEffect(() => {
    setMinorAdvanceSpendTrack((prev) => {
      if ((Number(xp[prev]) || 0) >= 5) return prev;
      return (
        XP_SPEND_TRACK_ORDER.find((t) => (Number(xp[t]) || 0) >= 5) ||
        XP_SPEND_TRACK_ORDER[0]
      );
    });
  }, [xp]);

  useEffect(() => {
    if (!minorAdvanceActions.length) return;
    if (minorAdvanceActions.includes(minorAdvanceAction)) return;
    setMinorAdvanceAction(minorAdvanceActions[0]);
  }, [minorAdvanceAction, minorAdvanceActions]);

  // Abilities & Clocks
  const [abilities, setAbilities] = useState(
    stripRetiredSheetAbilities(character?.abilities || []),
  );
  const [standardAbilitiesList, setStandardAbilitiesList] = useState([]);

  // Fetch standard abilities for dropdown
  useEffect(() => {
    referenceAPI
      .getAbilities()
      .then((list) => setStandardAbilitiesList(list || []))
      .catch(() => setStandardAbilitiesList([]));
  }, []);

  const [spinAbilitiesList, setSpinAbilitiesList] = useState([]);
  useEffect(() => {
    referenceAPI
      .getSpinAbilities()
      .then((list) => setSpinAbilitiesList(list || []))
      .catch(() => setSpinAbilitiesList([]));
  }, []);

  const [hamonAbilitiesList, setHamonAbilitiesList] = useState([]);
  useEffect(() => {
    referenceAPI
      .getHamonAbilities()
      .then((list) => setHamonAbilitiesList(list || []))
      .catch(() => setHamonAbilitiesList([]));
  }, []);

  /** Stand / Hamon / Spin path — declared before combined abilities so recall row can key off it. */
  const [playbook, setPlaybook] = useState(character?.playbook || "Stand");

  const hasStandPlaybook = playbook === "Stand";
  const isHamonPlaybook = playbook === "Hamon";
  const isSpinPlaybook = playbook === "Spin";
  const showSpinArmor =
    isSpinPlaybook || (abilities || []).some((a) => a?.type === "spin");
  const showHamonArmor =
    isHamonPlaybook || (abilities || []).some((a) => a?.type === "hamon");
  /** Stand in either slot: Durability + Power/Precision/Speed column. */
  const showStandCoinActionColumn = hasStandPlaybook;

  // Load abilities when switching character only — do not re-sync on every `character.abilities`
  // reference change or removals are overwritten by stale server data before autosave completes.
  useEffect(() => {
    setAbilities(stripRetiredSheetAbilities(character?.abilities || []));
  }, [character?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- only reset on sheet identity

  useEffect(() => {
    if (!isSpinPlaybook || spinAbilitiesList.length === 0) return;
    setAbilities((prev) => {
      if (!abilitiesMissingPlaybookFoundations(prev, spinAbilitiesList, "spin")) {
        return prev;
      }
      if (canEditSheet) markDirtyIntent();
      return mergePlaybookFoundationAbilities(prev, spinAbilitiesList, "spin");
    });
  }, [
    character?.id,
    isSpinPlaybook,
    spinAbilitiesList,
    canEditSheet,
    markDirtyIntent,
  ]);

  useEffect(() => {
    if (!isHamonPlaybook || hamonAbilitiesList.length === 0) return;
    setAbilities((prev) => {
      if (!abilitiesMissingPlaybookFoundations(prev, hamonAbilitiesList, "hamon")) {
        return prev;
      }
      if (canEditSheet) markDirtyIntent();
      return mergePlaybookFoundationAbilities(prev, hamonAbilitiesList, "hamon");
    });
  }, [
    character?.id,
    isHamonPlaybook,
    hamonAbilitiesList,
    canEditSheet,
    markDirtyIntent,
  ]);

  const currentHeritage = useMemo(() => {
    const hid = charData?.heritage;
    if (hid == null || !Array.isArray(heritages) || heritages.length === 0) return null;
    return heritages.find((h) => h && h.id === hid) || null;
  }, [charData?.heritage, heritages]);

  const hasSkilledFromBirth = useMemo(() => {
    if (!currentHeritage) return false;
    const benefit = (currentHeritage.benefits || []).find(
      (b) =>
        String(b?.name || "")
          .trim()
          .toLowerCase() === "skilled from birth",
    );
    return Boolean(benefit && selectedBenefits.includes(benefit.id));
  }, [currentHeritage, selectedBenefits]);

  const hasSlowerRecovery = useMemo(() => {
    if (!currentHeritage) return false;
    const detriment = (currentHeritage.detriments || []).find(
      (d) =>
        String(d?.name || "")
          .trim()
          .toLowerCase() === "slower recovery",
    );
    return Boolean(detriment && selectedDetriments.includes(detriment.id));
  }, [currentHeritage, selectedDetriments]);

  useEffect(() => {
    if (sheetDraftIsDirty) return;
    const seg = character?.healingClockSegments;
    if (typeof seg !== "number") return;
    const n = Math.min(5, Math.max(4, Math.floor(seg)));
    setHealingClockSegments((p) => (p !== n ? n : p));
  }, [character?.id, character?.healingClockSegments, sheetDraftIsDirty]);

  useEffect(() => {
    setHealingClockSegments(hasSlowerRecovery ? 5 : 4);
  }, [hasSlowerRecovery]);

  useEffect(() => {
    setHealingClock((prev) => {
      const n = Math.max(0, Math.min(healingClockSegments, Number(prev) || 0));
      return n === prev ? prev : n;
    });
  }, [healingClockSegments]);

  const heritageAutoAbilities = useMemo(() => {
    if (!currentHeritage) return [];
    const selectedBen = new Set(
      (Array.isArray(selectedBenefits) ? selectedBenefits : []).map((x) => Number(x)),
    );
    const selectedDet = new Set(
      (Array.isArray(selectedDetriments) ? selectedDetriments : []).map((x) => Number(x)),
    );
    const rows = [];
    (currentHeritage.benefits || []).forEach((b) => {
      if (!b) return;
      const selected = Boolean(b.required) || selectedBen.has(Number(b.id));
      if (!selected) return;
      rows.push({
        id: `heritage-benefit-${b.id ?? b.name}`,
        name: String(b.name || "").trim(),
        description: String(b.description || "").trim(),
        type: "heritage",
        heritageSource: "benefit",
      });
    });
    (currentHeritage.detriments || []).forEach((d) => {
      if (!d) return;
      const selected = Boolean(d.required) || selectedDet.has(Number(d.id));
      if (!selected) return;
      rows.push({
        id: `heritage-detriment-${d.id ?? d.name}`,
        name: String(d.name || "").trim(),
        description: String(d.description || "").trim(),
        type: "heritage",
        heritageSource: "detriment",
      });
    });
    return rows.filter((x) => x.name);
  }, [currentHeritage, selectedBenefits, selectedDetriments]);

  const combinedAbilitiesForDisplay = useMemo(() => {
    const seen = new Set();
    const out = [];
    (abilities || []).forEach((a, idx) => {
      const key = `${String(a?.type || "").toLowerCase()}:${normalizeAbilityName(a?.name)}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ ...a, _uiOrigin: "sheet", _uiIndex: idx });
    });
    heritageAutoAbilities.forEach((a) => {
      const key = `${String(a?.type || "").toLowerCase()}:${normalizeAbilityName(a?.name)}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ ...a, _uiOrigin: "heritage" });
    });
    /** Universal Stand-playbook option when Stand is in either slot. */
    const recallStandPlaybook = hasStandPlaybook;
    if (recallStandPlaybook) {
      const recallNorm = normalizeAbilityName("Stand Recall");
      const alreadyHasRecall = out.some(
        (a) => normalizeAbilityName(a?.name) === recallNorm,
      );
      const ukey = "universal:stand-recall";
      if (!alreadyHasRecall && !seen.has(ukey)) {
        seen.add(ukey);
        out.push({
          id: "stand-universal-recall",
          name: "Stand Recall",
          description:
            "Pay 2 stress (push yourself) to recall your Stand from wherever it is to your position—this is effectively instantaneous. After that, the fiction may call for a Stand-coin roll: often Durability to resist harm to the Stand, but if you are acting with the recalled Stand right away, Power, Speed, or Precision may apply instead (table agrees which pool fits).",
          type: "stand",
          _uiOrigin: "stand_universal",
        });
      }
    }
    return out.filter(
      (a) => !RETIRED_SHEET_ABILITY_NAMES.has(normalizeAbilityName(a?.name)),
    );
  }, [abilities, heritageAutoAbilities, hasStandPlaybook]);

  /** SRD Invigorated on self-recover — read sheet state, server `character.abilities`, and heritage echoes. */
  const selfRecoverInvigoratedDice = useMemo(
    () =>
      invigoratedHealingBonusApplies(abilities) ||
      invigoratedHealingBonusApplies(character?.abilities) ||
      invigoratedHealingBonusApplies(heritageAutoAbilities)
        ? 1
        : 0,
    [abilities, character?.abilities, heritageAutoAbilities],
  );

  const hasNoFeedDetriment = useMemo(() => {
    return heritageAutoAbilities.some(
      (a) =>
        String(a.heritageSource || "") === "detriment" &&
        /without feeding/i.test(String(a.name || "")),
    );
  }, [heritageAutoAbilities]);

  const hasAlienUnderstandingDetriment = useMemo(() => {
    const hid = charData?.heritage;
    const h =
      hid != null && Array.isArray(heritages) && heritages.length
        ? heritages.find((x) => x.id === hid)
        : null;
    const d = (h?.detriments || []).find((x) => heritageEntryIsAlienUnderstanding(x));
    if (!d) return false;
    return (
      Boolean(d.required) ||
      (Array.isArray(selectedDetriments) && selectedDetriments.includes(d.id))
    );
  }, [charData?.heritage, heritages, selectedDetriments]);

  const alienUnderstandingDetrimentId = useMemo(() => {
    const hid = charData?.heritage;
    const h =
      hid != null && Array.isArray(heritages) && heritages.length
        ? heritages.find((x) => x.id === hid)
        : null;
    const d = (h?.detriments || []).find((x) => heritageEntryIsAlienUnderstanding(x));
    return d?.id ?? null;
  }, [charData?.heritage, heritages]);

  useEffect(() => {
    if (charData.disguised_as_human !== true) return;
    const aid = alienUnderstandingDetrimentId;
    if (aid == null) return;
    setHeritageRollBoost((prev) => {
      const k = String(aid);
      if (!prev[k]?.dice) return prev;
      return { ...prev, [k]: { ...prev[k], dice: false } };
    });
  }, [charData.disguised_as_human, alienUnderstandingDetrimentId]);

  // Sync playbook labels when character changes (API uses STAND/HAMON/SPIN; sheet uses Stand/Hamon/Spin)
  useEffect(() => {
    if (character?.playbook != null && character.playbook !== "") {
      setPlaybook(character.playbook);
    }
  }, [character?.id, character?.playbook]);

  const [standType, setStandType] = useState(character?.standType || "");
  const [standTypeCustom, setStandTypeCustom] = useState(
    () => String(character?.standTypeCustom || "").trim(),
  );
  const [standForms, setStandForms] = useState(() =>
    normalizeStandFormsList(character?.standForms),
  );
  const [standConsciousness, setStandConsciousness] = useState(() => {
    const c = String(character?.standConsciousness || "")
      .trim()
      .toUpperCase()
      .slice(0, 1);
    return STAND_CONSCIOUSNESS_GRADES.includes(c) ? c : "";
  });
  const [standFormCustomDraft, setStandFormCustomDraft] = useState("");
  const [playbookXpArchetypes, setPlaybookXpArchetypes] = useState(() =>
    normalizePlaybookXpArchetypeKeys(
      character?.playbook || "Stand",
      character?.playbookXpArchetypes,
    ),
  );
  /** After first seed or any non-empty server archetypes, do not re-infer from stand type. */
  const archetypeSeedAppliedRef = useRef(false);

  useEffect(() => {
    setStandType(String(character?.standType || "").trim());
  }, [character?.id, character?.standType]);

  useEffect(() => {
    if (sheetDraftIsDirty) return;
    setStandTypeCustom(String(character?.standTypeCustom || "").trim());
  }, [character?.id, character?.standTypeCustom, sheetDraftIsDirty]);

  useEffect(() => {
    if (sheetDraftIsDirty) return;
    setStandForms(normalizeStandFormsList(character?.standForms));
  }, [character?.id, character?.standForms, sheetDraftIsDirty]);

  useEffect(() => {
    if (sheetDraftIsDirty) return;
    const c = String(character?.standConsciousness || "")
      .trim()
      .toUpperCase()
      .slice(0, 1);
    setStandConsciousness(STAND_CONSCIOUSNESS_GRADES.includes(c) ? c : "");
  }, [character?.id, character?.standConsciousness, sheetDraftIsDirty]);

  useEffect(() => {
    // Reset seed gate only when switching characters — empty server list after
    // clear must not re-infer Fighting Spirit from Stand.type.
    archetypeSeedAppliedRef.current = false;
    const fromServer = normalizePlaybookXpArchetypeKeys(
      character?.playbook,
      character?.playbookXpArchetypes,
    );
    if (fromServer.length > 0) {
      archetypeSeedAppliedRef.current = true;
    }
    // Intentionally only on character id — empty archetypes must not re-open seed.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once per character
  }, [character?.id]);

  useEffect(() => {
    if (sheetDraftIsDirty) return;
    const fromServer = normalizePlaybookXpArchetypeKeys(
      character?.playbook,
      character?.playbookXpArchetypes,
    );
    if (fromServer.length > 0) {
      archetypeSeedAppliedRef.current = true;
    }
    const next = fromServer;
    setPlaybookXpArchetypes((prev) =>
      archetypesEqual(prev, next) ? prev : next,
    );
  }, [
    character?.id,
    character?.playbook,
    character?.playbookXpArchetypes,
    sheetDraftIsDirty,
  ]);

  useEffect(() => {
    setPlaybookXpArchetypes((prev) => {
      const next = normalizePlaybookXpArchetypeKeys(playbook, prev);
      return archetypesEqual(prev, next) ? prev : next;
    });
  }, [playbook]);

  useEffect(() => {
    if (sheetDraftIsDirty) return;
    if (!characterId) return;
    if (archetypeSeedAppliedRef.current) return;
    const fromServer = normalizePlaybookXpArchetypeKeys(
      character?.playbook,
      character?.playbookXpArchetypes,
    );
    if (fromServer.length > 0) {
      archetypeSeedAppliedRef.current = true;
      return;
    }
    const seed = inferSeedArchetypeKeys(playbook, { standType, abilities });
    if (!seed.length) return;
    archetypeSeedAppliedRef.current = true;
    setPlaybookXpArchetypes((prev) =>
      archetypesEqual(prev, seed) ? prev : seed,
    );
  }, [
    sheetDraftIsDirty,
    characterId,
    character?.playbook,
    character?.playbookXpArchetypes,
    playbook,
    standType,
    abilities,
  ]);

  // Sync campaign when character changes
  useEffect(() => {
    const c = character?.campaign;
    const id = (typeof c === "object" ? c?.id : c) ?? "";
    setCampaignId((prev) => (String(prev) !== String(id) ? id : prev));
  }, [character?.id, character?.campaign]);

  // Assign/unassign character to campaign via dedicated API (ensures save for existing characters)
  const handleCampaignChange = useCallback(
    async (newCampaignId) => {
      const currentCampaign = character?.campaign;
      const currentId =
        (typeof currentCampaign === "object"
          ? currentCampaign?.id
          : currentCampaign) || null;
      const prevId = String(campaignId || "");
      setCampaignId(newCampaignId);
      setCampaignAssignError(null);
      if (!characterId) return; // New character: normal save will handle campaign on create
      setCampaignAssignStatus("saving");
      try {
        const cid = newCampaignId ? parseInt(newCampaignId, 10) : null;
        if (cid) {
          await campaignAPI.assignCharacter(cid, characterId);
          setCampaignAssignStatus("saved");
          const pickedCampaign =
            (campaigns || []).find((c) => Number(c?.id) === cid) ?? null;
          if (pickedCampaign) {
            const crewResolved = resolveCrewFromCampaign(
              pickedCampaign,
              characterId,
              character,
            );
            if (crewResolved.crew || crewResolved.crewId) {
              setCharData((prev) => ({
                ...prev,
                crew: crewResolved.crew || prev.crew,
                crewId: crewResolved.crewId ?? prev.crewId,
              }));
            }
          }
        } else if (currentId) {
          await campaignAPI.unassignCharacter(currentId, characterId);
          setCampaignAssignStatus("saved");
        }
        onCampaignRefresh?.();
      } catch (err) {
        setCampaignAssignStatus("error");
        setCampaignAssignError(err?.message || "Failed to assign campaign");
        setCampaignId(prevId); // Revert on error
      }
      setTimeout(() => {
        setCampaignAssignStatus(null);
        setCampaignAssignError(null);
      }, 5000);
    },
    [characterId, character, campaigns, campaignId, onCampaignRefresh],
  );

  const [clocks, setClocks] = useState(character?.clocks || []);
  useEffect(() => {
    if (sheetDraftIsDirty) return;
    const incoming = Array.isArray(character?.clocks)
      ? character.clocks.map((c) => normalizeSheetProgressClock(c)).filter(Boolean)
      : [];
    setClocks((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(incoming)) return prev;
      return incoming;
    });
  }, [character?.id, character?.clocks, sheetDraftIsDirty]);
  const [clockEditorOpen, setClockEditorOpen] = useState(false);
  const [newClockName, setNewClockName] = useState("");
  const [newClockSegments, setNewClockSegments] = useState(4);
  const [newClockShared, setNewClockShared] = useState(false);
  const [customAbilityModal, setCustomAbilityModal] = useState(null); // { type, name, uses, items } or null
  // Standard ability picker (Option A: searchable dropdown + preview)
  const [standardAbilitySearch, setStandardAbilitySearch] = useState("");
  const [standardAbilitySelected, setStandardAbilitySelected] = useState(null);
  const [standardAbilityPickerOpen, setStandardAbilityPickerOpen] =
    useState(false);
  const standardAbilityPickerRef = useRef(null);
  const [spinAbilitySearch, setSpinAbilitySearch] = useState("");
  const [spinAbilitySelected, setSpinAbilitySelected] = useState(null);
  const [spinAbilityPickerOpen, setSpinAbilityPickerOpen] = useState(false);
  const spinAbilityPickerRef = useRef(null);
  const [hamonAbilitySearch, setHamonAbilitySearch] = useState("");
  const [hamonAbilitySelected, setHamonAbilitySelected] = useState(null);
  const [hamonAbilityPickerOpen, setHamonAbilityPickerOpen] = useState(false);
  const hamonAbilityPickerRef = useRef(null);
  const [expandedAbilityId, setExpandedAbilityId] = useState(null);
  const [abilitiesSectionExpanded, setAbilitiesSectionExpanded] = useState(() =>
    readCharSheetBool(characterId, "abilities", true),
  );
  const [clocksSectionExpanded, setClocksSectionExpanded] = useState(() =>
    readCharSheetBool(characterId, "clocks", true),
  );
  const [notesInventoryExpanded, setNotesInventoryExpanded] = useState(() =>
    readCharSheetNotesInventory(characterId, {
      notes: true,
      inventory: true,
    }),
  );

  // Close standard / spin / hamon ability pickers when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        standardAbilityPickerRef.current &&
        !standardAbilityPickerRef.current.contains(e.target)
      ) {
        setStandardAbilityPickerOpen(false);
        setStandardAbilitySelected(null);
        setStandardAbilitySearch("");
      }
      if (
        spinAbilityPickerRef.current &&
        !spinAbilityPickerRef.current.contains(e.target)
      ) {
        setSpinAbilityPickerOpen(false);
        setSpinAbilitySelected(null);
        setSpinAbilitySearch("");
      }
      if (
        hamonAbilityPickerRef.current &&
        !hamonAbilityPickerRef.current.contains(e.target)
      ) {
        setHamonAbilityPickerOpen(false);
        setHamonAbilitySelected(null);
        setHamonAbilitySearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const prevPlaybookRef = useRef(playbook);
  useEffect(() => {
    if (prevPlaybookRef.current === "Spin" && playbook !== "Spin") {
      setAbilities((p) => p.filter((a) => a.type !== "spin"));
    }
    if (prevPlaybookRef.current === "Hamon" && playbook !== "Hamon") {
      setAbilities((p) => p.filter((a) => a.type !== "hamon"));
    }
    prevPlaybookRef.current = playbook;
  }, [playbook]);

  // Dice result
  const [diceResult, setDiceResult] = useState(null);
  /** { dice, highest, dicePool, wouldOverindulge, stressBefore, applied?, overindulge? } */
  const [viceRollResult, setViceRollResult] = useState(null);

  // Crew
  const [crewData, setCrewData] = useState({
    rep: 0,
    turf: 0,
    hold: "strong",
    tier: 0,
    wanted: 0,
    coin: 0,
    description: "",
    specialAbilities: [],
    upgrades: {
      lair: {
        carriage: false,
        boat: false,
        hidden: false,
        quarters: false,
        secure: false,
        vault: false,
        workshop: false,
      },
      training: {
        insight: false,
        prowess: false,
        resolve: false,
        personal: false,
        mastery: false,
      },
    },
    notes: "",
    image: "",
    image_url: "",
    // Per-session crew XP trigger toggles ({sid: {challenge, reputation, goals,
    // credited}}). Reset visually each session because the UI only reads the
    // row for the campaign's current active_session.
    sessionXpTriggers: {},
    // { sid: { characterIdStr: int } } — server tallies “Bolster reputation” edges.
    sessionRepContributions: {},
    // True when any crew PC has ExperienceTracker xp_gained>0 this active session.
    activeSessionCrewXpAvailable: false,
  });
  // Network state for the crew XP trigger PATCH; surfaces errors next to the
  // toggles without blocking the rest of the sheet.
  const [crewXpTriggerSaving, setCrewXpTriggerSaving] = useState(false);
  const [crewXpTriggerError, setCrewXpTriggerError] = useState(null);
  const [crewPortraitUrlDraft, setCrewPortraitUrlDraft] = useState("");
  const [crewPortraitSaving, setCrewPortraitSaving] = useState(false);
  const [crewPortraitMsg, setCrewPortraitMsg] = useState(null);
  const [crewFactionLinks, setCrewFactionLinks] = useState([]);
  const [crewFactionAddName, setCrewFactionAddName] = useState("");
  const [crewFactionAddExistingId, setCrewFactionAddExistingId] = useState("");
  const [crewFactionAddRep, setCrewFactionAddRep] = useState(0);
  const [crewFactionAddBusy, setCrewFactionAddBusy] = useState(false);
  const [crewFactionAddErr, setCrewFactionAddErr] = useState(null);
  const [crewHistoryEntries, setCrewHistoryEntries] = useState([]);
  const [crewHistoryOpen, setCrewHistoryOpen] = useState(() =>
    readCharSheetBool(characterId, "crew-history", false),
  );
  const crewHydratedRef = useRef(false);

  const buildCrewPatchPayload = useCallback(() => {
    return {
      rep: crewData.rep,
      turf: crewData.turf,
      level: crewData.tier,
      wanted_level: crewData.wanted,
      coin: crewData.coin,
      hold: crewData.hold,
      description: crewData.description,
      notes: crewData.notes,
      upgrade_progress: upgradesToProgress(crewData.upgrades),
    };
  }, [crewData]);

  const crewPortraitSrc = useMemo(
    () => resolveMediaUrl(crewData.image || crewData.image_url || ""),
    [crewData.image, crewData.image_url],
  );

  useEffect(() => {
    if (activeMode !== "CREW MODE" || !charData.crewId) {
      crewHydratedRef.current = false;
      return undefined;
    }
    const cid = charData.crewId;
    let cancelled = false;
    crewHydratedRef.current = false;
    crewAPI
      .getCrew(cid)
      .then((d) => {
        if (cancelled) return;
        setCrewData((p) => ({
          ...p,
          rep: Math.min(6, Math.max(0, Number(d.rep) || 0)),
          turf: Math.min(6, Math.max(0, Number(d.turf) || 0)),
          tier: Math.min(4, Math.max(0, Number(d.level) || 0)),
          wanted: Math.min(5, Math.max(0, Number(d.wanted_level) || 0)),
          coin: Math.min(4, Math.max(0, Number(d.coin) || 0)),
          hold: d.hold === "weak" || d.hold === "strong" ? d.hold : p.hold,
          description: d.description ?? "",
          notes: d.notes ?? "",
          image: d.image ?? "",
          image_url: d.image_url ?? "",
          upgrades: progressToUpgrades(d.upgrade_progress),
          specialAbilities: (d.special_abilities || []).map((a) => ({
            name: a.name,
            description: a.description || "",
          })),
          sessionXpTriggers:
            d.session_xp_triggers && typeof d.session_xp_triggers === "object"
              ? d.session_xp_triggers
              : {},
          sessionRepContributions:
            d.session_rep_contributions &&
            typeof d.session_rep_contributions === "object"
              ? d.session_rep_contributions
              : {},
          activeSessionCrewXpAvailable: !!d.active_session_crew_earned_xp,
        }));
        setCrewPortraitUrlDraft(String(d.image_url || "").trim());
        setCrewFactionLinks(d.faction_relationships || []);
        crewHydratedRef.current = true;
      })
      .catch(() => {
        if (!cancelled) setCrewFactionLinks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeMode, charData.crewId]);

  /** Light sync: standing rows + visibility can change from GM / other clients while staying in crew mode. */
  useEffect(() => {
    if (activeMode !== "CREW MODE" || !charData.crewId) return undefined;
    let cancelled = false;
    crewAPI
      .getCrew(charData.crewId)
      .then((d) => {
        if (cancelled) return;
        setCrewFactionLinks(d.faction_relationships || []);
        if (d.session_xp_triggers && typeof d.session_xp_triggers === "object") {
          setCrewData((p) => ({
            ...p,
            sessionXpTriggers: d.session_xp_triggers,
            sessionRepContributions:
              d.session_rep_contributions &&
              typeof d.session_rep_contributions === "object"
                ? d.session_rep_contributions
                : p.sessionRepContributions,
            activeSessionCrewXpAvailable: !!d.active_session_crew_earned_xp,
          }));
        } else {
          setCrewData((p) => ({
            ...p,
            activeSessionCrewXpAvailable: !!d.active_session_crew_earned_xp,
          }));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeMode, charData.crewId, sessionDataPollTick]);

  useEffect(() => {
    if (activeMode !== "CREW MODE" || !charData.crewId) return;
    crewHistoryAPI
      .list({ crew: charData.crewId })
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : rows?.results || [];
        setCrewHistoryEntries(list);
      })
      .catch(() => setCrewHistoryEntries([]));
  }, [activeMode, charData.crewId]);

  /**
   * Toggle one of the three crew XP trigger booleans for the active session.
   * Read-modify-write of `crewData.sessionXpTriggers[activeSessionId]`; the
   * backend merges with existing rows and gates by active-session + crew XP.
   */
  const handleCrewXpTriggerToggle = useCallback(
    (triggerKey) => {
      if (!charData.crewId || !activeSessionId) return;
      const sid = String(activeSessionId);
      const prevRow = (crewData.sessionXpTriggers || {})[sid] || {};
      const nextRow = {
        challenge: !!prevRow.challenge,
        reputation: !!prevRow.reputation,
        goals: !!prevRow.goals,
        [triggerKey]: !prevRow[triggerKey],
      };
      setCrewData((p) => ({
        ...p,
        sessionXpTriggers: {
          ...(p.sessionXpTriggers || {}),
          [sid]: { ...(p.sessionXpTriggers?.[sid] || {}), ...nextRow },
        },
      }));
      setCrewXpTriggerSaving(true);
      setCrewXpTriggerError(null);
      crewAPI
        .patchCrew(charData.crewId, {
          session_xp_triggers: { [sid]: nextRow },
        })
        .then((d) => {
          if (d && typeof d.session_xp_triggers === "object") {
            setCrewData((p) => ({
              ...p,
              sessionXpTriggers: d.session_xp_triggers,
              sessionRepContributions:
                d.session_rep_contributions &&
                typeof d.session_rep_contributions === "object"
                  ? d.session_rep_contributions
                  : p.sessionRepContributions,
              activeSessionCrewXpAvailable: !!d.active_session_crew_earned_xp,
            }));
          }
        })
        .catch((err) => {
          setCrewXpTriggerError(err?.message || "Failed to save toggle");
          setCrewData((p) => ({
            ...p,
            sessionXpTriggers: {
              ...(p.sessionXpTriggers || {}),
              [sid]: prevRow,
            },
          }));
        })
        .finally(() => setCrewXpTriggerSaving(false));
    },
    [
      activeSessionId,
      charData.crewId,
      crewData.sessionXpTriggers,
    ],
  );

  const activeSessionCrewXpRow = useMemo(() => {
    if (!activeSessionId) return null;
    const map = crewData.sessionXpTriggers || {};
    const row = map[String(activeSessionId)] || map[activeSessionId];
    return row && typeof row === "object" ? row : null;
  }, [activeSessionId, crewData.sessionXpTriggers]);

  const activeSessionRepContribLines = useMemo(() => {
    if (!activeSessionId) return [];
    const sid = String(activeSessionId);
    const row = (crewData.sessionRepContributions || {})[sid];
    if (!row || typeof row !== "object") return [];
    const roster = charCampaign?.campaign_characters || [];
    return Object.entries(row)
      .map(([cid, raw]) => {
        const n = Number(raw) || 0;
        if (n <= 0) return null;
        const c = roster.find((x) => String(x.id) === String(cid));
        const label =
          (c && (c.name || c.true_name || c.display_name)) || `PC #${cid}`;
        return { cid, label, n };
      })
      .filter(Boolean);
  }, [
    activeSessionId,
    crewData.sessionRepContributions,
    charCampaign?.campaign_characters,
  ]);

  useEffect(() => {
    if (!crewHydratedRef.current || !charData.crewId) return undefined;
    const t = setTimeout(() => {
      crewAPI
        .patchCrew(charData.crewId, buildCrewPatchPayload())
        .then(() => {
          const cid = Number.parseInt(String(campaignId || ""), 10);
          const wanted = Math.min(5, Math.max(0, Number(crewData.wanted) || 0));
          const currentCampaignWanted = Number(charCampaign?.wanted_stars ?? 0);
          if (
            isGM &&
            Number.isFinite(cid) &&
            wanted !== currentCampaignWanted
          ) {
            campaignAPI
              .patchCampaign(cid, { wanted_stars: wanted })
              .then(() => onCampaignRefresh?.())
              .catch(() => {});
          }
        })
        .catch(() => {});
    }, 900);
    return () => clearTimeout(t);
  }, [
    charData.crewId,
    buildCrewPatchPayload,
    campaignId,
    charCampaign?.wanted_stars,
    isGM,
    onCampaignRefresh,
    crewData.rep,
    crewData.turf,
    crewData.tier,
    crewData.wanted,
    crewData.coin,
    crewData.hold,
    crewData.description,
    crewData.notes,
    crewData.upgrades,
  ]);

  // ─── Derived Values ──────────────────────────────────────────────────────────

  const campaignForCrewFactionAdd = useMemo(
    () =>
      (campaigns || []).find(
        (c) =>
          Number(c.id) ===
          Number.parseInt(String(campaignId || "").trim(), 10),
      ) ?? null,
    [campaigns, campaignId],
  );

  const crewLinkableFactions = useMemo(() => {
    const facs = campaignForCrewFactionAdd?.factions || [];
    const linkedIds = new Set(
      (crewFactionLinks || []).map((r) => Number(r.faction_id)),
    );
    return facs.filter((f) => f?.id != null && !linkedIds.has(Number(f.id)));
  }, [campaignForCrewFactionAdd?.factions, crewFactionLinks]);

  /** Non-GMs only see standings for factions the GM has revealed (matches CrewSerializer). */
  const crewFactionLinksForDisplay = useMemo(() => {
    const list = crewFactionLinks || [];
    if (isGM) return list;
    return list.filter((r) => r.visible_to_players !== false);
  }, [crewFactionLinks, isGM]);

  const handleAddCrewFactionLink = useCallback(async () => {
    if (!charData.crewId || !campaignId) return;
    const nameTrim = crewFactionAddName.trim();
    const exId = Number.parseInt(String(crewFactionAddExistingId || ""), 10);
    const rep = Math.min(3, Math.max(-3, Number(crewFactionAddRep) || 0));
    if (nameTrim && Number.isFinite(exId)) {
      setCrewFactionAddErr("Use either a new name or an existing faction, not both.");
      return;
    }
    if (!nameTrim && !Number.isFinite(exId)) {
      setCrewFactionAddErr("Enter a new faction name or pick an existing faction.");
      return;
    }
    setCrewFactionAddBusy(true);
    setCrewFactionAddErr(null);
    try {
      let fid = null;
      if (nameTrim) {
        const created = await factionAPI.createFaction({
          campaign: Number.parseInt(String(campaignId), 10),
          name: nameTrim,
          visible_to_players: false,
        });
        fid = created?.id ?? created?.pk;
      } else {
        fid = exId;
      }
      if (!fid) {
        setCrewFactionAddErr("Could not resolve faction to link.");
        return;
      }
      await crewAPI.patchCrew(charData.crewId, {
        faction_relationships: [{ faction_id: fid, reputation_value: rep }],
      });
      const crewRes = await crewAPI.getCrew(charData.crewId);
      setCrewFactionLinks(crewRes.faction_relationships || []);
      setCrewFactionAddName("");
      setCrewFactionAddExistingId("");
      setCrewFactionAddRep(0);
      onCampaignRefresh?.();
    } catch (e) {
      setCrewFactionAddErr(
        e?.message || "Could not create or link faction. Try a different name.",
      );
    } finally {
      setCrewFactionAddBusy(false);
    }
  }, [
    charData.crewId,
    campaignId,
    crewFactionAddName,
    crewFactionAddExistingId,
    crewFactionAddRep,
    onCampaignRefresh,
  ]);

  const rawDur = Number(standStats.durability);
  const durVal = Math.min(
    5,
    Math.max(0, Number.isFinite(rawDur) ? Math.floor(rawDur) : 0),
  );
  const devVal = Math.min(
    5,
    Math.max(
      0,
      Number.isFinite(Number(standStats.development))
        ? Math.floor(Number(standStats.development))
        : 0,
    ),
  );
  /** SRD_DEV: stress track fixed at 9; Stand Durability only affects armor (+ resist tiers). */
  const maxStress = 9;
  const applyStressCost = useCallback(
    (cost) => {
      const spend = Number(cost) || 0;
      if (spend <= 0) return;
      // Server/roll-applied stress: truth-lock only — do NOT mark field touch
      // (autosave must omit stress so concurrent PATCH cannot clobber).
      setStressFilled((prev) => {
        const current = Number(prev) || 0;
        const afterSpend = current + spend;
        let next;
        let nextTrauma = null;
        if (afterSpend <= maxStress) {
          next = afterSpend;
        } else {
          const overflow = afterSpend - maxStress;
          setTrauma((prevTrauma) => {
            const firstOpen = Object.entries(prevTrauma || {}).find(
              ([, checked]) => !checked,
            )?.[0];
            if (!firstOpen) {
              nextTrauma = prevTrauma;
              return prevTrauma;
            }
            nextTrauma = { ...prevTrauma, [firstOpen]: true };
            return nextTrauma;
          });
          next = Math.max(0, overflow);
        }
        const truth = {
          stressFilled: next,
          trauma: nextTrauma
            ? { ...DEFAULT_TRAUMA, ...nextTrauma }
            : stressTraumaTruthRef.current?.trauma || null,
        };
        stressTraumaTruthRef.current = truth;
        onCharacterStressTraumaSync?.({
          stressFilled: next,
          ...(truth.trauma ? { trauma: truth.trauma } : {}),
        });
        return next;
      });
    },
    [maxStress, onCharacterStressTraumaSync],
  );
  const standArmorMax = standPathArmorMaxFromDurabilityIndex(durVal);
  const showStandArmor =
    standArmorMax > 0 &&
    hasPlaybook(playbook, character?.secondaryPlaybook, "Stand");
  const sessionDevXP = DEV_SESSION_XP[devVal] ?? 0;

  useEffect(() => {
    setStandArmorUsed((u) => {
      const n = Math.min(
        standArmorMax,
        Math.max(0, Math.floor(Number(u) || 0)),
      );
      return n === u ? u : n;
    });
  }, [standArmorMax]);

  useEffect(() => {
    setPhysicalArmorUsed((u) => {
      const n = Math.min(
        physicalArmorMax,
        Math.max(0, Math.floor(Number(u) || 0)),
      );
      return n === u ? u : n;
    });
  }, [physicalArmorMax]);

  const {
    totalActionDots,
    actionDotsFromXp,
    maxActionDotsBudget,
    dotsRemaining,
  } = computeActionDotBudget({
    actionRatings,
    actionDiceGained:
      character?.actionDiceGained ?? character?.action_dice_gained,
  });
  const totalStandPoints = Object.values(standStats).reduce((s, v) => s + v, 0);
  /** Chargen baseline 6 + XP-bought ranks (server); if total sum ran ahead of a stale counter, match the sheet so we do not false-alarm. */
  const standCoinIndexBudget = Math.max(
    STAND_COIN_CREATION_POINT_SUM +
      Math.max(0, Number(character?.standCoinPointsGained) || 0),
    totalStandPoints,
  );
  /** First-level radar clicks until an XP-bought Stand Coin rank. Action dots do not lock this. */
  const isStandCoinChargenEditable = useMemo(
    () =>
      standCoinChargenUnlocked({
        canEditSheet,
        hasStandPlaybook,
        standCoinPointsGained: character?.standCoinPointsGained,
      }),
    [canEditSheet, hasStandPlaybook, character?.standCoinPointsGained],
  );
  const aRankCount = Object.values(standStats).reduce(
    (n, idx) => n + (INDEX_TO_GRADE(idx) === "A" ? 1 : 0),
    0,
  );
  const canAffordLevelUp =
    Number(pendingAdvanceCounts?.playbook || 0) > 0;
  // XP expenditure accounting
  // Each stand coin grade = 10 XP (cost of one level-up stat advance)
  // Each action dot = 5 XP (cost of one minor advance)
  // Level 1 baseline = 95 XP (6 coin pts × 10 + 7 dots × 5)
  const totalSpentXP = totalStandPoints * 10 + totalActionDots * 5;
  const pcLevel = 1 + Math.floor((totalSpentXP - 95) / 10);
  const isChargenIncomplete = pcLevel < 1;
  const primaryIsSpinOrHamon = playbook === "Spin" || playbook === "Hamon";
  const hasAcquiredStand = useMemo(() => {
    if (playbook === "Stand") return true;
    return (xpAllocationRows || []).some(
      (a) =>
        !a.undone_at && a.allocation_type === "LEVEL_UP_ACQUIRE_STAND",
    );
  }, [playbook, xpAllocationRows]);
  const isPostChargen = useMemo(
    () => (xpAllocationRows || []).some((a) => !a.undone_at),
    [xpAllocationRows],
  );
  const playbookAbilitySlots = useMemo(
    () => playbookAbilitySlotBudget(xpAllocationRows),
    [xpAllocationRows],
  );
  const nonFoundationPlaybookUsed = useMemo(
    () => countCombinedNonFoundationPlaybookAbilities(abilities),
    [abilities],
  );
  const CHARGEN_LEVEL_PROMPT =
    "begin allocating your action dots / playbook requirements (stand coin stats allocation)";

  /** Sheet standards only (not heritage / Stand Recall / advancement grants). */
  const sheetStandardCount = useMemo(
    () => (abilities || []).filter((a) => a?.type === "standard").length,
    [abilities],
  );
  const hasSheetCustomPackage = useMemo(
    () =>
      (abilities || []).some(
        (a) => a?.type === "custom" && !a._fromAdvancement,
      ),
    [abilities],
  );
  // SRD: Stand L1 = 2 standards; each A (incl. chargen A) grants +2 std OR 2 unique + 1 std
  // via B→A / chargen A UI — not free +Standard. Hamon/Spin L1 = 1 standard.
  // Free +Standard only fills base / chargen-A quota; hide once full (or post-chargen base).
  const maxL1StandardAbilities =
    playbook === "Stand" ? 2 + aRankCount * 2 : 1;
  const maxFreeStandardAbilities = isPostChargen
    ? playbook === "Stand"
      ? 2
      : 1
    : maxL1StandardAbilities;
  const showAddStandardButton =
    canEditSheet && sheetStandardCount < maxFreeStandardAbilities;
  const showAddCustomButton =
    canEditSheet &&
    !hasSheetCustomPackage &&
    hasPlaybook(playbook, character?.secondaryPlaybook, "Stand");

  useEffect(() => {
    if (!showAddStandardButton) {
      setStandardAbilityPickerOpen(false);
      setStandardAbilitySelected(null);
      setStandardAbilitySearch("");
    }
  }, [showAddStandardButton]);

  useEffect(() => {
    if (!showAddCustomButton) {
      setCustomAbilityModal(null);
    }
  }, [showAddCustomButton]);

  // PC

  const getAttributeDice = (actions) =>
    actions.filter((a) => actionRatings[a] > 0).length;

  const viceAttributeDice = useMemo(() => {
    const groups = [
      { key: "INSIGHT", actions: ["HUNT", "STUDY", "SURVEY", "TINKER"] },
      { key: "PROWESS", actions: ["FINESSE", "PROWL", "SKIRMISH", "WRECK"] },
      { key: "RESOLVE", actions: ["BIZARRE", "COMMAND", "CONSORT", "SWAY"] },
    ];
    return groups.map((g) => ({
      ...g,
      dice: g.actions.filter((a) => (actionRatings[a] ?? 0) > 0).length,
    }));
  }, [actionRatings]);

  const viceDicePool = useMemo(() => {
    const vals = viceAttributeDice.map((g) => g.dice);
    return vals.length ? Math.min(...vals) : 0;
  }, [viceAttributeDice]);

  const viceLowestLabels = useMemo(() => {
    return viceAttributeDice
      .filter((g) => g.dice === viceDicePool)
      .map((g) => g.key)
      .join(", ");
  }, [viceAttributeDice, viceDicePool]);

  const traumaMarkedCount = useMemo(
    () => Object.values(trauma || {}).filter(Boolean).length,
    [trauma],
  );

  /** At max stress, block manual clear until player marks a trauma (first or another). */
  const stressMaxNeedsTraumaClear = useMemo(
    () => (Number(stressFilled) || 0) >= maxStress,
    [stressFilled, maxStress],
  );

  const toggleTraumaMark = useCallback(
    (traumaKey) => {
      markFieldTouch("trauma");
      // Trauma clear at max also writes stress — include stress in this draft PATCH.
      const gaining = !(trauma[traumaKey] ?? false);
      const atMax = (Number(stressFilled) || 0) >= maxStress;
      if (gaining && atMax) {
        markFieldTouch("stress");
      }
      const nextStress = gaining && atMax ? 0 : stressFilled;
      const nextTrauma = { ...trauma, [traumaKey]: gaining };
      if (gaining && atMax) {
        setStressFilled(0);
      }
      setTrauma((p) => ({ ...p, [traumaKey]: gaining }));
      stressTraumaTruthRef.current = {
        stressFilled: Number(nextStress) || 0,
        trauma: { ...DEFAULT_TRAUMA, ...nextTrauma },
      };
      onCharacterStressTraumaSync?.({
        stressFilled: Number(nextStress) || 0,
        trauma: { ...DEFAULT_TRAUMA, ...nextTrauma },
      });
    },
    [
      trauma,
      stressFilled,
      maxStress,
      onCharacterStressTraumaSync,
      markFieldTouch,
    ],
  );

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const applyBackendCharacter = useCallback((backendChar) => {
    if (!backendChar) return;
    const fe = transformBackendToFrontend(backendChar);
    if (fe.xp) setXp(fe.xp);
    if (typeof fe.unallocatedXp === "number") {
      setUnallocatedXp(Math.max(0, Math.floor(fe.unallocatedXp)));
    }
    if (fe.pendingAdvanceCounts && typeof fe.pendingAdvanceCounts === "object") {
      setPendingAdvanceCounts({ ...fe.pendingAdvanceCounts });
    } else if (Array.isArray(fe.pendingAdvances)) {
      const counts = {};
      for (const p of fe.pendingAdvances) {
        if (!p?.track) continue;
        counts[p.track] = (counts[p.track] || 0) + 1;
      }
      setPendingAdvanceCounts(counts);
    }
    if (fe.xp || typeof fe.unallocatedXp === "number") {
      const truth = {
        xp: fe.xp ? { ...fe.xp } : null,
        unallocatedXp:
          typeof fe.unallocatedXp === "number"
            ? Math.max(0, Math.floor(fe.unallocatedXp))
            : null,
      };
      if (truth.xp && typeof truth.unallocatedXp === "number") {
        xpClocksTruthRef.current = truth;
        onCharacterXpSync?.(truth);
      }
      // Allocate/deallocate included XP — clear xp field touch.
      fieldTouchRef.current = { ...fieldTouchRef.current, xp: false };
    }
    if (fe.standStats) setStandStats(fe.standStats);
    if (fe.actionRatings) setActionRatings(fe.actionRatings);
    if (fe.abilities) {
      // XP/claim responses can omit a just-saved unique package; keep richer local customs.
      setAbilities((prev) =>
        mergeAbilitiesPreferRicherCustoms(prev, fe.abilities),
      );
    }
    if (
      Object.prototype.hasOwnProperty.call(
        backendChar,
        "pending_stand_a_reward",
      ) ||
      Object.prototype.hasOwnProperty.call(fe, "pendingStandAReward")
    ) {
      setPendingStandAReward(fe.pendingStandAReward || null);
    }
    setCharData((prev) => ({
      ...prev,
      xp: fe.xp,
      standStats: fe.standStats,
      actionRatings: fe.actionRatings,
      abilities: fe.abilities
        ? mergeAbilitiesPreferRicherCustoms(
            Array.isArray(prev.abilities) ? prev.abilities : [],
            fe.abilities,
          )
        : prev.abilities,
      standCoinPointsGained: fe.standCoinPointsGained,
      actionDiceGained: fe.actionDiceGained,
      unallocatedXp:
        typeof fe.unallocatedXp === "number"
          ? Math.max(0, Math.floor(fe.unallocatedXp))
          : prev.unallocatedXp,
      pendingAdvanceCounts: fe.pendingAdvanceCounts || prev.pendingAdvanceCounts,
      pendingAdvances: fe.pendingAdvances || prev.pendingAdvances,
    }));
  }, [onCharacterXpSync]);

  /** After server-owned XP/stand allocation APIs — invalidate stale autosaves. */
  const applyAllocationBackendCharacter = useCallback(
    (backendChar) => {
      if (!backendChar) return;
      if (autosaveAbortRef.current) {
        autosaveAbortRef.current.abort();
        autosaveAbortRef.current = null;
      }
      draftGenRef.current += 1;
      applyBackendCharacter(backendChar);
    },
    [applyBackendCharacter],
  );

  const claimPendingStandAReward = useCallback(async () => {
    if (!characterId || !pendingStandAReward?.allocation_id) return;
    let reward;
    if (pendingStandABranch === "two_unique_plus_one_standard") {
      const uniques = pendingStandAUniques.map((u) => ({
        name: String(u?.name || "").trim(),
        use: String(u?.use || "").trim(),
      }));
      if (!uniques.every((u) => u.name && u.use) || !pendingStandAStdId) {
        setPendingStandAError(
          "Fill both unique ability names and their function, and pick a standard ability.",
        );
        return;
      }
      reward = {
        branch: "two_unique_plus_one_standard",
        unique_abilities: uniques,
        standard_ability_id: Number(pendingStandAStdId),
      };
    } else {
      if (!pendingStandAStdIds[0] || !pendingStandAStdIds[1]) {
        setPendingStandAError("Pick two standard abilities.");
        return;
      }
      reward = {
        branch: "two_standard",
        standard_ability_ids: pendingStandAStdIds.map((id) => Number(id)),
      };
    }
    setPendingStandABusy(true);
    setPendingStandAError(null);
    try {
      draftGenRef.current += 1;
      const res = await characterAPI.claimStandAReward(characterId, {
        allocation_id: pendingStandAReward.allocation_id,
        reward,
      });
      if (res?.character) applyAllocationBackendCharacter(res.character);
      else setPendingStandAReward(res?.pending_stand_a_reward || null);
      if (Array.isArray(res?.allocations)) setXpAllocationRows(res.allocations);
      setPendingStandABranch("two_standard");
      setPendingStandAStdIds(["", ""]);
      setPendingStandAUniques([
        { name: "", use: "" },
        { name: "", use: "" },
      ]);
      setPendingStandAStdId("");
    } catch (err) {
      setPendingStandAError(err?.message || "Could not claim B→A reward.");
    } finally {
      setPendingStandABusy(false);
    }
  }, [
    characterId,
    pendingStandAReward,
    pendingStandABranch,
    pendingStandAUniques,
    pendingStandAStdId,
    pendingStandAStdIds,
    applyAllocationBackendCharacter,
  ]);

  const refreshXpAllocations = useCallback(async () => {
    if (!characterId) {
      setXpAllocationRows([]);
      return;
    }
    try {
      const res = await characterAPI.getXpAllocations(characterId, {
        includeUndone: true,
      });
      const rows = Array.isArray(res) ? res : res?.results || [];
      setXpAllocationRows(rows);
    } catch {
      setXpAllocationRows([]);
    }
  }, [characterId]);

  const refreshGmUndoStatus = useCallback(async () => {
    if (!characterId || !isGmViewingPc) {
      setGmUndoStatus({ available: false, summary: null });
      return;
    }
    try {
      const res = await characterAPI.getGmUndoStatus(characterId);
      setGmUndoStatus(
        res?.available
          ? { available: true, summary: res.summary || null }
          : { available: false, summary: null },
      );
    } catch {
      setGmUndoStatus({ available: false, summary: null });
    }
  }, [characterId, isGmViewingPc]);

  const refreshGmRedoStatus = useCallback(async () => {
    if (!characterId || !isGmViewingPc) {
      setGmRedoStatus({ available: false, summary: null });
      return;
    }
    try {
      const res = await characterAPI.getGmRedoStatus(characterId);
      setGmRedoStatus(
        res?.available
          ? { available: true, summary: res.summary || null }
          : { available: false, summary: null },
      );
    } catch {
      setGmRedoStatus({ available: false, summary: null });
    }
  }, [characterId, isGmViewingPc]);

  const handleUndoLatestAllocation = useCallback(
    async (e) => {
      e?.stopPropagation?.();
      if (!characterId || xpAllocationUndoBusy) return;
      setXpAllocationUndoBusy(true);
      setXpAllocationActionError(null);
      try {
        const res = await characterAPI.undoLatestAllocation(characterId);
        if (res?.character) applyAllocationBackendCharacter(res.character);
        if (Array.isArray(res?.allocations)) {
          setXpAllocationRows(res.allocations);
        } else {
          await refreshXpAllocations();
        }
        const detail =
          (typeof res?.summary === "string" && res.summary.trim()) ||
          "XP spend";
        const toastMsg = `Undone: ${detail}`;
        setXpActionToast({ kind: "ok", message: toastMsg });
      } catch (err) {
        const msg = err?.message || "Failed to undo allocation";
        setXpAllocationActionError(msg);
        setXpActionToast({ kind: "err", message: msg });
      } finally {
        setXpAllocationUndoBusy(false);
      }
    },
    [
      characterId,
      xpAllocationUndoBusy,
      applyAllocationBackendCharacter,
      refreshXpAllocations,
    ],
  );

  const handleResetCharacterSheet = useCallback(
    async (e) => {
      e?.stopPropagation?.();
      if (!characterId || resetSheetBusy || !canEditSheet) return;
      const ok = window.confirm(
        "Reset this character sheet?\n\nKeeps campaign, name, crew, look, vice, and heritage.\nClears extra heritage picks, playbook, trauma, stress, XP, dots, abilities, and harm.\n\nThis cannot be undone.",
      );
      if (!ok) return;
      setResetSheetBusy(true);
      setXpAllocationActionError(null);
      try {
        const res = await characterAPI.resetCharacterSheet(characterId);
        const backendChar = res?.character;
        if (backendChar) {
          const fe = transformBackendToFrontend(backendChar);
          onCharacterReloaded?.(fe);
        }
        if (Array.isArray(res?.allocations)) {
          setXpAllocationRows(res.allocations);
        } else {
          setXpAllocationRows([]);
        }
        setXpActionToast({ kind: "ok", message: "Character sheet reset." });
      } catch (err) {
        const msg = err?.message || "Failed to reset character";
        setXpAllocationActionError(msg);
        setXpActionToast({ kind: "err", message: msg });
      } finally {
        setResetSheetBusy(false);
      }
    },
    [
      characterId,
      resetSheetBusy,
      canEditSheet,
      onCharacterReloaded,
    ],
  );

  const handleUndoAllocationById = useCallback(
    async (allocationId) => {
      if (!characterId || xpAllocationUndoBusy) return;
      setXpAllocationUndoBusy(true);
      setXpAllocationActionError(null);
      try {
        const res = await characterAPI.removeAllocationResult(
          characterId,
          allocationId,
        );
        if (res?.character) applyAllocationBackendCharacter(res.character);
        if (Array.isArray(res?.allocations)) {
          setXpAllocationRows(res.allocations);
        } else {
          await refreshXpAllocations();
        }
        const detail =
          (typeof res?.summary === "string" && res.summary.trim()) ||
          "XP spend";
        setXpActionToast({ kind: "ok", message: `Undone: ${detail}` });
      } catch (err) {
        const msg = err?.message || "Failed to undo allocation";
        setXpAllocationActionError(msg);
        setXpActionToast({ kind: "err", message: msg });
      } finally {
        setXpAllocationUndoBusy(false);
      }
    },
    [
      characterId,
      xpAllocationUndoBusy,
      applyAllocationBackendCharacter,
      refreshXpAllocations,
    ],
  );

  // FIX 1: Creation-mode dot clicks — hard cap 7 total / max 2 per action (3 with Skilled From Birth)
  const updateActionRating = (action, newVal) => {
    const maxDots = maxDotsPerActionAtCreation({
      hasSkilledFromBirth,
      actionRatings,
      action,
    });
    if (newVal < 0 || newVal > maxDots) return;
    const delta = newVal - actionRatings[action];
    if (delta > 0 && totalActionDots + delta > maxActionDotsBudget) return;
    setActionRatings((p) => ({ ...p, [action]: newVal }));
  };

  // FIX 2: Hard cap at A by default; S only when gm_can_have_s_rank_stand_stats
  const incrementStat = useCallback(
    (stat) => {
      setStandStats((p) => {
        if (p[stat] >= maxStandGradeIndex) return p;
        const currentTotal = Object.values(p).reduce((s, v) => s + v, 0);
        if (currentTotal >= standCoinIndexBudget) return p;
        return { ...p, [stat]: p[stat] + 1 };
      });
    },
    [maxStandGradeIndex, standCoinIndexBudget],
  );

  // FIX 3: Prevent all-F — at least one stat must stay D or higher
  const decrementStat = useCallback((stat) => {
    setStandStats((p) => {
      if (p[stat] <= 0) return p;
      const allWouldBeF = Object.entries(p).every(([k, v]) =>
        k === stat ? v - 1 === 0 : v === 0,
      );
      if (allWouldBeF) return p;
      return { ...p, [stat]: p[stat] - 1 };
    });
  }, []);

  const standCoinGrades = useMemo(() => {
    const out = {};
    for (const k of STAND_STAT_KEYS) {
      const raw = Math.max(
        0,
        Math.min(maxStandGradeIndex, Number(standStats[k]) || 0),
      );
      out[k] = INDEX_TO_GRADE(raw);
    }
    return out;
  }, [standStats, maxStandGradeIndex]);

  const pcStandCoinReadouts = useMemo(() => {
    const out = {};
    for (const k of STAND_STAT_KEYS) {
      const val = Math.max(0, Number(standStats[k]) || 0);
      const rows = PC_STAT_DESC[k] || [];
      const safeIdx = Math.min(val, Math.max(0, rows.length - 1));
      let text = rows[safeIdx] ?? "";
      if (k === "durability" && val === 4) {
        text += " · Resistance reduces harm 2 levels";
      }
      if (k === "precision" && val === 4) {
        text += " · 5s also count as success";
      }
      out[k] = text;
    }
    return out;
  }, [standStats]);

  /** Owned Coin grade + queued plan bumps for one stat (plan-mode effective). */
  const effectiveCoinGradeWithPlanQueue = useCallback(
    (key) => {
      let effective =
        INDEX_TO_GRADE(standStats?.[key]) || INDEX_TO_GRADE(0);
      const queued = (advancementPlan || [])
        .filter(
          (i) =>
            i.kind === "coin_grade" &&
            (i.status === "queued" || !i.status) &&
            i.payload?.stat === key,
        )
        .slice()
        .sort(
          (a, b) =>
            (a.order || 0) - (b.order || 0) || (a.id || 0) - (b.id || 0),
        );
      for (const item of queued) {
        const to = item.payload?.to_grade;
        if (to && GRADE_INDEX[to] != null) effective = to;
      }
      return effective;
    },
    [standStats, advancementPlan],
  );

  /** Stats where next plan Coin bump is legal B→A (needs a_grant). */
  const planLegalBAStats = useMemo(() => {
    if (!planMode || !isPostChargen || !canEditPlan) return [];
    return STAND_STAT_KEYS.filter(
      (k) => effectiveCoinGradeWithPlanQueue(k) === "B",
    );
  }, [
    planMode,
    isPostChargen,
    canEditPlan,
    effectiveCoinGradeWithPlanQueue,
  ]);

  const showPlanBAGrantUI =
    planMode &&
    isPostChargen &&
    canEditPlan &&
    (Boolean(planBADraft?.stat) || planLegalBAStats.length > 0);

  useEffect(() => {
    if (!showPlanBAGrantUI || planBASuppressed) return;
    setAbilitiesSectionExpanded(true);
    if (planBADraft?.stat) return;
    if (planLegalBAStats.length === 1) {
      setPlanBADraft({ stat: planLegalBAStats[0] });
      setPlanBAError(null);
      setPlanBABranch("two_standard");
    }
  }, [
    showPlanBAGrantUI,
    planBASuppressed,
    planLegalBAStats,
    planBADraft?.stat,
  ]);

  const bumpStandCoinGrade = useCallback(
    async (key, delta) => {
      if (planMode && isPostChargen && canEditPlan) {
        if (delta === -1) return;
        if (delta !== 1 || !characterId || planBusy) return;

        const effective = effectiveCoinGradeWithPlanQueue(key);
        const fromIdx = GRADE_INDEX[effective] ?? 0;
        const toGrade = GRADE[Math.min(fromIdx + 1, GRADE.length - 1)];
        const landsOnA = effective === "B" && toGrade === "A";
        if (landsOnA) {
          setPlanBASuppressed(false);
          setPlanBADraft({ stat: key });
          setPlanBAError(null);
          setPlanBABranch("two_standard");
          setAbilitiesSectionExpanded(true);
          setXpActionToast({
            kind: "ok",
            message: `${key.toUpperCase()} B→A needs an A-grant — pick 2 standards or 2 unique + 1 standard below.`,
          });
          return;
        }

        setPlanBusy(true);
        try {
          const res = await characterAPI.addAdvancementPlanItem(characterId, {
            track: "playbook",
            kind: "coin_grade",
            payload: { stat: key },
          });
          if (Array.isArray(res?.items)) {
            setAdvancementPlan(res.items);
          }
        } catch (err) {
          const msg =
            err?.message || "Failed to queue Stand Coin grade (plan).";
          if (/a_grant/i.test(msg)) {
            setPlanBASuppressed(false);
            setPlanBADraft({ stat: key });
            setPlanBAError(null);
            setAbilitiesSectionExpanded(true);
          }
          setXpActionToast({ kind: "err", message: msg });
        } finally {
          setPlanBusy(false);
        }
        return;
      }
      if (delta === 1) incrementStat(key);
      else if (delta === -1) decrementStat(key);
    },
    [
      planMode,
      isPostChargen,
      canEditPlan,
      characterId,
      planBusy,
      effectiveCoinGradeWithPlanQueue,
      incrementStat,
      decrementStat,
    ],
  );

  const confirmPlanBAGrant = useCallback(async () => {
    if (!characterId || !planBADraft?.stat || planBusy) return;
    let a_grant;
    if (planBABranch === "two_unique_plus_one_standard") {
      const uniques = planBAUniques.map((u) => ({
        name: String(u?.name || "").trim(),
        use: String(u?.use || "").trim(),
      }));
      if (!uniques.every((u) => u.name && u.use) || !planBAStdId) {
        setPlanBAError(
          "Fill both unique names + functions, and pick a standard ability.",
        );
        return;
      }
      a_grant = {
        branch: "two_unique_plus_one_standard",
        unique_abilities: uniques,
        standard_ability_id: Number(planBAStdId),
      };
    } else {
      if (!planBAStdIds[0] || !planBAStdIds[1]) {
        setPlanBAError("Pick two standard abilities.");
        return;
      }
      a_grant = {
        branch: "two_standard",
        standard_ability_ids: planBAStdIds.map((id) => Number(id)),
      };
    }
    setPlanBusy(true);
    setPlanBAError(null);
    try {
      const res = await characterAPI.addAdvancementPlanItem(characterId, {
        track: "playbook",
        kind: "coin_grade",
        payload: { stat: planBADraft.stat, a_grant },
      });
      if (Array.isArray(res?.items)) setAdvancementPlan(res.items);
      setPlanBADraft(null);
      setPlanBAStdIds(["", ""]);
      setPlanBAUniques([
        { name: "", use: "" },
        { name: "", use: "" },
      ]);
      setPlanBAStdId("");
      setXpActionToast({
        kind: "ok",
        message: `Queued ${String(planBADraft.stat).toUpperCase()} B→A with A-grant.`,
      });
    } catch (err) {
      setPlanBAError(err?.message || "Failed to queue B→A plan item.");
    } finally {
      setPlanBusy(false);
    }
  }, [
    characterId,
    planBADraft,
    planBusy,
    planBABranch,
    planBAUniques,
    planBAStdId,
    planBAStdIds,
  ]);

  const queuePlanAbility = useCallback(
    async ({ abilityId, abilitySource, abilityName }) => {
      if (!characterId || !canEditPlan || planBusy) return false;
      setPlanBusy(true);
      try {
        const res = await characterAPI.addAdvancementPlanItem(characterId, {
          track: "playbook",
          kind: "ability",
          payload: {
            ability_id: abilityId,
            ability_source: abilitySource,
            ability_name: abilityName,
          },
        });
        if (Array.isArray(res?.items)) setAdvancementPlan(res.items);
        setXpActionToast({
          kind: "ok",
          message: `Queued ${abilityName || "ability"} for next playbook fill.`,
        });
        return true;
      } catch (err) {
        setXpActionToast({
          kind: "err",
          message: err?.message || "Failed to queue ability.",
        });
        return false;
      } finally {
        setPlanBusy(false);
      }
    },
    [characterId, canEditPlan, planBusy],
  );

  const toggleXP = async (track, idx) => {
    markFieldTouch("xp");
    const maxVals = {
      insight: 5,
      prowess: 5,
      resolve: 5,
      heritage: 5,
      playbook: 10,
    };

    const cur = Number(xp?.[track]) || 0;
    // Innate overflow lives above 10; box ticks must not dump remainder into the pool.
    if (track === "playbook" && cur > 10) {
      return;
    }
    // Click filled box → clear from that index up; click empty → fill through it.
    const desired = Math.min(idx < cur ? idx : idx + 1, maxVals[track]);
    if (!characterId) {
      return;
    }
    if (!canEditSheet) {
      return;
    }
    if (desired === cur) {
      return;
    }
    if (poolAllocateBusy) {
      return;
    }

    const delta = desired - cur;
    if (delta === 0) return;

    if (delta > 0 && unallocatedXp < delta) {
      const msg = `Not enough XP in free pool (need ${delta}).`;
      setSaveErrorMessage(msg);
      setPoolTickError(msg);
      return;
    }

    setPoolAllocateBusy(true);
    setSaveErrorMessage(null);
    setPoolTickError(null);
    try {
      const res =
        delta > 0
          ? await characterAPI.allocatePoolXp(characterId, {
              track,
              amount: delta,
            })
          : await characterAPI.deallocatePoolXp(characterId, {
              track,
              amount: -delta,
            });
      // Prefer full character echo so clocks + free pool stay in sync with parent
      // hydrate / autosave (partial setXp alone races with poll).
      if (res?.character) {
        applyAllocationBackendCharacter(res.character);
      } else {
        const nextPool = Number(res?.unallocated_xp);
        const nextXp =
          res?.xp_clocks && typeof res.xp_clocks === "object"
            ? { ...xp, ...res.xp_clocks }
            : null;
        if (Number.isFinite(nextPool)) {
          setUnallocatedXp(Math.max(0, nextPool));
        }
        if (nextXp) {
          setXp(nextXp);
        }
        setCharData((prev) => ({
          ...prev,
          ...(nextXp ? { xp: nextXp } : {}),
          ...(Number.isFinite(nextPool)
            ? { unallocatedXp: Math.max(0, nextPool) }
            : {}),
        }));
      }
    } catch (e) {
      const msg =
        e?.message ||
        (delta > 0
          ? "Could not allocate pool XP"
          : "Could not return XP to free pool");
      setSaveErrorMessage(msg);
      setPoolTickError(msg);
    } finally {
      setPoolAllocateBusy(false);
    }
  };

  const levelUpIsBtoA = useMemo(
    () =>
      levelUpChoice === "stat" &&
      standStats[levelUpStat] === GRADE.indexOf("B"),
    [levelUpChoice, levelUpStat, standStats],
  );

  // FIX 6: Confirm level-up — redeem open PendingAdvance (no second XP deduct).
  const confirmLevelUp = async () => {
    if (levelUpInFlightRef.current) return;
    const track = levelUpLockTrack || levelUpSpendTrack || "playbook";
    const pendingCount = Number(pendingAdvanceCounts?.[track] || 0);
    if (pendingCount < 1 || !characterId) return;

    if (levelUpChoice === "stat" && levelUpIsBtoA) {
      if (levelUpBtoARewardBranch === "two_unique_plus_one_standard") {
        const filled = levelUpRewardUniques.every(
          (u) => String(u?.name || "").trim() && String(u?.use || "").trim(),
        );
        if (!filled || !levelUpRewardStandardId) {
          setLevelUpError(
            "B→A reward: fill both unique ability names and their function, and pick a standard ability.",
          );
          return;
        }
      } else if (
        !levelUpRewardStandardIds[0] ||
        !levelUpRewardStandardIds[1]
      ) {
        setLevelUpError("B→A reward: pick two standard abilities.");
        return;
      }
    }

    levelUpInFlightRef.current = true;
    setLevelUpBusy(true);
    setLevelUpError(null);
    // Pause dirty-sheet PATCH so SQLite is not held while we redeem pending.
    if (autosaveAbortRef.current) {
      autosaveAbortRef.current.abort();
      autosaveAbortRef.current = null;
    }
    draftGenRef.current += 1;
    const body = {
      xp_track: track,
      choice: levelUpChoice,
      from_pool: false,
    };
    if (levelUpChoice === "stat") {
      body.stand_stat = levelUpStat;
      if (levelUpIsBtoA) {
        if (levelUpBtoARewardBranch === "two_unique_plus_one_standard") {
          body.reward = {
            branch: "two_unique_plus_one_standard",
            unique_abilities: levelUpRewardUniques.map((u) => ({
              name: String(u?.name || "").trim(),
              use: String(u?.use || "").trim(),
            })),
            standard_ability_id: Number(levelUpRewardStandardId),
          };
        } else {
          body.reward = {
            branch: "two_standard",
            standard_ability_ids: levelUpRewardStandardIds.map((id) =>
              Number(id),
            ),
          };
        }
      }
    } else if (levelUpChoice === "dots") {
      body.actions = [levelUpDot1, levelUpDot2];
    }

    try {
      const res = await characterAPI.applyLevelUp(characterId, body);
      if (res?.character) applyAllocationBackendCharacter(res.character);
      if (Array.isArray(res?.allocations)) setXpAllocationRows(res.allocations);
      setShowLevelUp(false);
      setLevelUpLockTrack(null);
    } catch (err) {
      if (err?.name === "AbortError") {
        setLevelUpError("Request timed out. If coin did not change, try Confirm again.");
      } else {
        setLevelUpError(err?.message || "Level up failed");
      }
    } finally {
      levelUpInFlightRef.current = false;
      setLevelUpBusy(false);
    }
  };

  const spendXPForDot = async () => {
    const track = minorAdvanceSpendTrack;
    const pendingCount = Number(pendingAdvanceCounts?.[track] || 0);
    const action = minorAdvanceAction;
    if (
      pendingCount < 1 ||
      !minorAdvanceActions.includes(action) ||
      actionRatings[action] >= 4 ||
      !characterId
    )
      return;

    setMinorAdvanceBusy(true);
    setMinorAdvanceError(null);
    try {
      const res = await characterAPI.applyMinorAdvance(characterId, {
        xp_track: track,
        action,
      });
      if (res?.character) applyAllocationBackendCharacter(res.character);
      if (Array.isArray(res?.allocations)) setXpAllocationRows(res.allocations);
      setShowTrackAdvance(null);
    } catch (err) {
      setMinorAdvanceError(err?.message || "Minor advance failed");
    } finally {
      setMinorAdvanceBusy(false);
    }
  };

  // Roll modal for campaign/session context (position, effect, push)
  const [rollPending, setRollPending] = useState(null);
  /** Scroll Action ratings dice-preview into view when opened from deeper sections (e.g. CREW ACTIONS heal teammate). */
  const actionRollDicePoolPreviewElRef = useRef(null);
  const lastScrolledRollPendingKeyRef = useRef("");
  const [resistancePending, setResistancePending] = useState(null);
  const [rollModal, setRollModal] = useState({
    push_effect: false,
    push_dice: false,
    devil_bargain_dice: false,
    devil_bargain_note: "",
  });
  const [healOtherRecoveryIntent, setHealOtherRecoveryIntent] = useState({
    enabled: false,
    actionName: "TINKER",
    targetId: "",
    selectedBolsterKeys: [],
    bolsterNote: "",
  });
  const [rollAbilityBoost, setRollAbilityBoost] = useState({});
  const [heritageRollBoost, setHeritageRollBoost] = useState({});
  /** Phantom Pain: spend 1 stress when using the ability through cover/barriers (fiction). */
  const [phantomPainThroughCover, setPhantomPainThroughCover] = useState(false);
  /** Ripple Breathing: waive push stress (2) once per active session episode. */
  const [rippleBreathingFreePush, setRippleBreathingFreePush] = useState(false);
  /** Pending crew-assist (+1d): teammate already spent stress; include on Roll unless unchecked. */
  const [includePendingAssistDie, setIncludePendingAssistDie] = useState(true);
  const [resistanceAbilityBoost, setResistanceAbilityBoost] = useState({});
  const [resistancePushDice, setResistancePushDice] = useState(false);
  const [resistanceMitigationChoice, setResistanceMitigationChoice] = useState("");
  const [rollApiError, setRollApiError] = useState(null);
  /** User confirms SRD-aligned stress overflow (trauma) when push/incap/etc. exceeds empty boxes. */
  const [stressOverflowConfirmed, setStressOverflowConfirmed] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(() =>
    readCharSheetBool(characterId, "history-panel", false),
  );
  const [historyMode, setHistoryMode] = useState("session");
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyWriteError, setHistoryWriteError] = useState(null);
  const [historySessionId, setHistorySessionId] = useState(null);
  const [historyCharacterFilter, setHistoryCharacterFilter] = useState("all");
  const [historyRefreshTick, setHistoryRefreshTick] = useState(0);
  const [historyUndoBusy, setHistoryUndoBusy] = useState(null);
  const [historyUndoError, setHistoryUndoError] = useState(null);
  const [showHistoryManualModal, setShowHistoryManualModal] = useState(false);
  const [historyManualSaving, setHistoryManualSaving] = useState(false);
  /** Manual history ACTION row: same shape as roll modal `rollAbilityBoost` (+1d / +1 effect toggles). */
  const [historyManualAbilityBoost, setHistoryManualAbilityBoost] = useState({});
  const [historyManualHeritageBoost, setHistoryManualHeritageBoost] = useState({});
  const [historyManual, setHistoryManual] = useState({
    rollType: "ACTION",
    sessionId: "",
    action: "bizarre",
    dice: "4,5",
    outcome: "FULL_SUCCESS",
    position: "risky",
    effect: "standard",
    resistanceHarmTarget: "",
    viceOverindulge: "",
    fortunePublicLabel: "",
    fortuneRevealPlayers: true,
    pushDice: false,
    pushEffect: false,
    devil: false,
    helpDie: false,
    groupAction: false,
    groupActionId: "",
    xpTrack: "playbook",
    xpAmount: "1",
    xpReason: "",
  });
  /** GM-only: allow editing outcome band on manual session history (audit); default derived from dice. */
  const [historyOutcomeBandGmUnlock, setHistoryOutcomeBandGmUnlock] =
    useState(false);

  useEffect(() => {
    setHistoryOutcomeBandGmUnlock(false);
  }, [
    historyManual.rollType,
    historyManual.dice,
    historyManual.action,
    historyManual.pushDice,
    historyManual.devil,
    historyManual.helpDie,
    historyManualAbilityBoost,
    historyManualHeritageBoost,
  ]);

  const [showXpHistoryModal, setShowXpHistoryModal] = useState(false);
  const [xpTimelineLoading, setXpTimelineLoading] = useState(false);
  const [xpTimelineError, setXpTimelineError] = useState(null);
  const [xpTimelineRows, setXpTimelineRows] = useState([]);
  const [xpReqTracker, setXpReqTracker] = useState([]);
  const [xpReqRolls, setXpReqRolls] = useState([]);
  const [activeGroupAction, setActiveGroupAction] = useState(null);
  const [groupGoalDraft, setGroupGoalDraft] = useState("");
  const [groupActionNameDraft, setGroupActionNameDraft] = useState("");
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupActionErr, setGroupActionErr] = useState(null);
  const [groupActionRolls, setGroupActionRolls] = useState([]);
  const [groupActionLoading, setGroupActionLoading] = useState(false);
  /** Last session+group id we showed full-panel spinner for; unchanged on sheet poll tick → silent refetch */
  const groupRollFetchSpinnerKeyRef = useRef("");
  const [crewGroupExpanded, setCrewGroupExpanded] = useState(() =>
    readCharSheetBool(characterId, "crew-group", false),
  );
  const [crewAssistExpanded, setCrewAssistExpanded] = useState(() =>
    readCharSheetBool(characterId, "crew-assist", true),
  );
  const [crewHealExpanded, setCrewHealExpanded] = useState(() =>
    readCharSheetBool(characterId, "crew-heal", true),
  );
  const [assistTargetId, setAssistTargetId] = useState("");
  const [assistGrantBusy, setAssistGrantBusy] = useState(false);
  const [assistGrantMsg, setAssistGrantMsg] = useState(null);
  const [assistGrantErr, setAssistGrantErr] = useState(null);
  const [healOtherDraft, setHealOtherDraft] = useState({
    targetId: "",
    actionName: "TINKER",
    selectedBolsterKeys: [],
    /** 'recover_in_play' | legacy 'score' = recover-in-play, show P/E; 'downtime' = downtime, hide P/E */
    treatmentPhase: "recover_in_play",
  });
  const [rollGoalDraft, setRollGoalDraft] = useState("");
  const [showDevilsBargainModal, setShowDevilsBargainModal] = useState(false);
  const [devilBargainConfirmed, setDevilBargainConfirmed] = useState(false);
  const [expandedActionInfo, setExpandedActionInfo] = useState(null);

  useEffect(() => {
    const defaultsNoId = () => {
      setAbilitiesSectionExpanded(true);
      setClocksSectionExpanded(true);
      setNotesInventoryExpanded({ notes: true, inventory: true });
      setShowHistoryPanel(false);
      setCrewGroupExpanded(false);
      setCrewAssistExpanded(true);
      setCrewHealExpanded(true);
      setCrewHistoryOpen(false);
    };
    if (characterId == null || characterId === "") {
      defaultsNoId();
      return;
    }
    setAbilitiesSectionExpanded(
      readCharSheetBool(characterId, "abilities", true),
    );
    setClocksSectionExpanded(readCharSheetBool(characterId, "clocks", true));
    setNotesInventoryExpanded(
      readCharSheetNotesInventory(characterId, {
        notes: true,
        inventory: true,
      }),
    );
    setShowHistoryPanel(
      readCharSheetBool(characterId, "history-panel", false),
    );
    setCrewGroupExpanded(
      readCharSheetBool(characterId, "crew-group", false),
    );
    setCrewAssistExpanded(
      readCharSheetBool(characterId, "crew-assist", true),
    );
    setCrewHealExpanded(readCharSheetBool(characterId, "crew-heal", true));
    setCrewHistoryOpen(
      readCharSheetBool(characterId, "crew-history", false),
    );
  }, [characterId]);

  const setAbilitiesSectionExpandedPersist = useCallback((updater) => {
    setAbilitiesSectionExpanded((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      writeCharSheetBool(characterId, "abilities", next);
      return next;
    });
  }, [characterId]);

  const setClocksSectionExpandedPersist = useCallback((updater) => {
    setClocksSectionExpanded((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      writeCharSheetBool(characterId, "clocks", next);
      return next;
    });
  }, [characterId]);

  const setNotesInventoryExpandedPersist = useCallback((updater) => {
    setNotesInventoryExpanded((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      writeCharSheetNotesInventory(characterId, next);
      return next;
    });
  }, [characterId]);

  const setShowHistoryPanelPersist = useCallback((updater) => {
    setShowHistoryPanel((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      writeCharSheetBool(characterId, "history-panel", next);
      return next;
    });
  }, [characterId]);

  const setCrewGroupExpandedPersist = useCallback((updater) => {
    setCrewGroupExpanded((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      writeCharSheetBool(characterId, "crew-group", next);
      return next;
    });
  }, [characterId]);

  const setCrewAssistExpandedPersist = useCallback((updater) => {
    setCrewAssistExpanded((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      writeCharSheetBool(characterId, "crew-assist", next);
      return next;
    });
  }, [characterId]);

  const setCrewHealExpandedPersist = useCallback((updater) => {
    setCrewHealExpanded((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      writeCharSheetBool(characterId, "crew-heal", next);
      return next;
    });
  }, [characterId]);

  const setCrewHistoryOpenPersist = useCallback((updater) => {
    setCrewHistoryOpen((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      writeCharSheetBool(characterId, "crew-history", next);
      return next;
    });
  }, [characterId]);

  const [campaignAssignStatus, setCampaignAssignStatus] = useState(null);
  const [campaignAssignError, setCampaignAssignError] = useState(null);
  const [resistanceHarmTarget, setResistanceHarmTarget] = useState("");
  const [resistanceApplyErr, setResistanceApplyErr] = useState(null);
  const harmLevel3Used =
    ((harm?.level3?.[0] ?? "")?.toString?.()?.trim?.() ?? "") !== "";

  const filledHarmOptions = useMemo(() => {
    const levels = [
      ["level1", "Level 1"],
      ["level2", "Level 2"],
      ["level3", "Level 3"],
      ["level4", "Level 4"],
    ];
    const out = [];
    levels.forEach(([level, label]) => {
      const slots = Array.isArray(harm?.[level]) ? harm[level] : [];
      slots.forEach((value, idx) => {
        if (String(value || "").trim()) {
          out.push({
            value: `${level}:${idx}`,
            label: `${label}${slots.length > 1 ? String.fromCharCode(65 + idx) : ""} — ${String(value).trim()}`,
          });
        }
      });
    });
    return out;
  }, [harm]);

  /** True when manual vice dice highest exceeds current marked stress → must pick consequence */
  const viceManualWouldOverindulge = useMemo(() => {
    if (String(historyManual.rollType || "").toUpperCase() !== "VICE")
      return false;
    const diceResults = String(historyManual.dice || "")
      .split(/[\s,]+/)
      .map((n) => parseInt(n.trim(), 10))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 6);
    if (!diceResults.length) return false;
    const hi = Math.max(...diceResults);
    return hi > (Number(stressFilled) || 0);
  }, [historyManual.rollType, historyManual.dice, stressFilled]);

  const clearHarmSlot = useCallback((target) => {
    const downgradeMap = {
      level4: "level3",
      level3: "level2",
      level2: "level1",
      level1: null,
    };
    const [level, idxRaw] = String(target || "").split(":");
    const idx = parseInt(String(idxRaw || ""), 10);
    if (!level || !Number.isFinite(idx)) return false;
    const cur = {
      level4: Array.isArray(harm?.level4) ? [...harm.level4] : [""],
      level3: Array.isArray(harm?.level3) ? [...harm.level3] : [""],
      level2: Array.isArray(harm?.level2) ? [...harm.level2] : ["", ""],
      level1: Array.isArray(harm?.level1) ? [...harm.level1] : ["", ""],
    };
    const row = cur[level];
    if (!Array.isArray(row) || idx < 0 || idx >= row.length) return false;
    const value = String(row[idx] || "").trim();
    if (!value) return false;

    const nextLevel = downgradeMap[level];
    row[idx] = "";
    if (!nextLevel) {
      setHarm(cur);
      return true;
    }

    const toRow = cur[nextLevel];
    if (!Array.isArray(toRow) || toRow.length === 0) return false;
    const preferredSlot = idx < toRow.length ? idx : -1;
    let targetSlot = preferredSlot;
    if (targetSlot < 0 || String(toRow[targetSlot] || "").trim()) {
      targetSlot = toRow.findIndex((v) => !String(v || "").trim());
    }
    if (targetSlot < 0) return false;
    toRow[targetSlot] = value;
    setHarm(cur);
    return true;
  }, [harm]);

  const downgradeAllHarmByOneLevel = useCallback((prev) => {
    const p = normalizeHarmObject(prev);
    const keep = (v) => String(v || "").trim().length > 0;
    const l4 = keep(p.level4?.[0]) ? p.level4[0] : "";
    const l3 = keep(p.level3?.[0]) ? p.level3[0] : "";
    const l2a = keep(p.level2?.[0]) ? p.level2[0] : "";
    const l2b = keep(p.level2?.[1]) ? p.level2[1] : "";
    return {
      level4: [""],
      level3: [l4],
      level2: [l3, ""],
      level1: [l2a, l2b],
    };
  }, []);

  const handleHealingClockAdjust = useCallback(
    (nextFilled) => {
      markFieldTouch("healingClock");
      const cap = healingClockSegments;
      setHealingClock((prev) => {
        const cur = Math.max(0, Math.min(cap, Number(prev) || 0));
        const next = Math.max(0, Math.min(cap, Number(nextFilled) || 0));
        if (next <= cur) return next;
        const completions = Math.floor(next / cap) - Math.floor(cur / cap);
        const remainder = next % cap;
        if (completions > 0) {
          setHarm((hPrev) => {
            let out = normalizeHarmObject(hPrev);
            for (let i = 0; i < completions; i += 1) {
              out = downgradeAllHarmByOneLevel(out);
            }
            return out;
          });
        }
        return remainder;
      });
    },
    [downgradeAllHarmByOneLevel, healingClockSegments, markFieldTouch],
  );

  const advanceHealingClockBySegments = useCallback(
    (segmentsToAdd) => {
      const cap = healingClockSegments;
      const add = Math.max(0, Math.floor(Number(segmentsToAdd) || 0));
      if (!add) return;
      markFieldTouch("healingClock");
      setHealingClock((prev) => {
        const { nextFilled, completions } = computeHealingClockAfterSegments({
          currentFilled: prev,
          segmentsToAdd: add,
          segmentCap: cap,
        });
        if (completions > 0) {
          setHarm((hPrev) => {
            let out = normalizeHarmObject(hPrev);
            for (let i = 0; i < completions; i += 1) {
              out = downgradeAllHarmByOneLevel(out);
            }
            return out;
          });
        }
        return nextFilled;
      });
    },
    [downgradeAllHarmByOneLevel, healingClockSegments, markFieldTouch],
  );

  const applyRecoverySegmentsToTrack = useCallback(
    (currentClock, currentHarm, segmentsToAdd, segmentCap = healingClockSegments) => {
      const cap = Math.min(5, Math.max(4, Math.floor(Number(segmentCap) || 4)));
      const { nextFilled, completions } = computeHealingClockAfterSegments({
        currentFilled: currentClock,
        segmentsToAdd,
        segmentCap: cap,
      });
      if (completions === 0 && nextFilled === Math.max(0, Math.min(cap, Number(currentClock) || 0))) {
        return {
          nextClock: nextFilled,
          nextHarm: normalizeHarmObject(currentHarm),
        };
      }
      let nextHarm = normalizeHarmObject(currentHarm);
      for (let i = 0; i < completions; i += 1) {
        nextHarm = downgradeAllHarmByOneLevel(nextHarm);
      }
      return {
        nextClock: nextFilled,
        nextHarm,
      };
    },
    [downgradeAllHarmByOneLevel, healingClockSegments],
  );

  const extractHarmFromBackendCharacter = useCallback((rawCharacter) => {
    const slot = (used, name) => (used ? String(name ?? "") : "");
    return normalizeHarmObject({
      level4: [
        slot(rawCharacter?.harm_level4_used, rawCharacter?.harm_level4_name),
      ],
      level3: [
        slot(rawCharacter?.harm_level3_used, rawCharacter?.harm_level3_name),
      ],
      level2: [
        slot(rawCharacter?.harm_level2_used, rawCharacter?.harm_level2_name),
        slot(
          rawCharacter?.harm_level2_slot2_used,
          rawCharacter?.harm_level2_slot2_name,
        ),
      ],
      level1: [
        slot(rawCharacter?.harm_level1_used, rawCharacter?.harm_level1_name),
        slot(
          rawCharacter?.harm_level1_slot2_used,
          rawCharacter?.harm_level1_slot2_name,
        ),
      ],
    });
  }, []);

  const buildHarmPatchPayload = useCallback((nextHarm) => {
    const normalizeSlot = (value) => String(value ?? "").trim();
    const l1a = normalizeSlot(nextHarm?.level1?.[0]);
    const l1b = normalizeSlot(nextHarm?.level1?.[1]);
    const l2a = normalizeSlot(nextHarm?.level2?.[0]);
    const l2b = normalizeSlot(nextHarm?.level2?.[1]);
    const l3 = normalizeSlot(nextHarm?.level3?.[0]);
    const l4 = normalizeSlot(nextHarm?.level4?.[0]);
    return {
      harm_level1_used: !!l1a,
      harm_level1_name: l1a,
      harm_level1_slot2_used: !!l1b,
      harm_level1_slot2_name: l1b,
      harm_level2_used: !!l2a,
      harm_level2_name: l2a,
      harm_level2_slot2_used: !!l2b,
      harm_level2_slot2_name: l2b,
      harm_level3_used: !!l3,
      harm_level3_name: l3,
      harm_level4_used: !!l4,
      harm_level4_name: l4,
    };
  }, []);

  const rollRecoveryTreatment = useCallback((tinkerDice) => {
    // SRD: Recover uses healer skill (Tinker) then advances healing clock.
    // 1-3: +1 segment; 4/5: +2; 6: +3; critical (2+ sixes): +5.
    const diceCount = Math.max(0, Math.floor(Number(tinkerDice) || 0));

    let results = [];
    let highest = 0;
    let sixes = 0;
    let critical = false;

    if (diceCount <= 0) {
      // No-Tinker approximation: treat like their existing "0 dice" flow by
      // rolling 2d and taking the lower die.
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      results = [d1, d2];
      highest = Math.min(d1, d2);
      sixes = 0;
      critical = false;
    } else {
      results = Array.from({ length: diceCount }, () => {
        const d = Math.floor(Math.random() * 6) + 1;
        return d;
      });
      highest = Math.max(...results);
      sixes = results.filter((d) => d === 6).length;
      critical = sixes >= 2;
    }

    const segments = critical
      ? 5
      : highest >= 6
        ? 3
        : highest >= 4
          ? 2
          : 1;

    return {
      results,
      highest,
      sixes,
      critical,
      segments,
    };
  }, []);

  const performHealingRecover = useCallback(
    async (mode) => {
      // mode: "downtime" | "mid-action"
      if (!canEditSheet) return;
      if (healingRecoverBusy) return;

      const isMidAction = mode === "mid-action";
      if (isMidAction && !activeSessionId) return;

      const recoveryActionName = pickHealClockAction(selfHealingRecoverAction);
      const baseRecoverDice = Math.max(
        0,
        Math.floor(Number(actionRatings?.[recoveryActionName]) || 0),
      );
      const invigoratedDice = selfRecoverInvigoratedDice;
      const healingDiceCount = baseRecoverDice + invigoratedDice;
      /** Log downtime recover into Session History via campaign active session when open session id missing. */
      const logSessionRaw = isMidAction
        ? activeSessionId
        : activeSessionId || charCampaign?.active_session;
      const logSessionId =
        typeof logSessionRaw === "object" && logSessionRaw?.id != null
          ? logSessionRaw.id
          : logSessionRaw;

      setHealingRecoverBusy(true);
      setHealingRecoverErr(null);
      setHealingRecoverMsg("");

      try {
        if (characterId && logSessionId) {
          const res = await characterAPI.rollAction(characterId, {
            session_id: logSessionId,
            recovery_context:
              mode === "mid-action" ? "self_mid_action" : "self_downtime",
            action: recoveryActionName.toLowerCase(),
            bonus_dice: invigoratedDice,
          });
          const segs = Math.max(
            0,
            Math.floor(Number(res?.recovery_segments) || 0),
          );
          if (Number(res?.stress_spent) > 0) {
            applyStressCost(Number(res.stress_spent));
          }
          if (segs > 0) {
            advanceHealingClockBySegments(segs);
          }
          const modeLabel =
            mode === "mid-action"
              ? "Mid-action recover"
              : "Downtime recover";
          const bandText = String(res?.recovery_band || "").trim() || "—";
          const poolLabel =
            invigoratedDice > 0
              ? `${baseRecoverDice}+1 Invigorated (${healingDiceCount}d total)`
              : `${healingDiceCount}d`;
          setHealingRecoverMsg(
            `${modeLabel}: ${recoveryActionName} (${poolLabel}) rolled ${bandText} → +${segs} healing segments (logged to session ${logSessionId})`,
          );
          setHistoryRefreshTick((x) => x + 1);
          onCampaignRefresh?.();
          return;
        }

        // SRD: 2 stress; no session-linked log when there is nowhere to persist a Roll.
        applyStressCost(2);
        const roll = rollRecoveryTreatment(healingDiceCount);
        advanceHealingClockBySegments(roll.segments);

        const bandText = roll.critical
          ? "critical"
          : roll.highest >= 6
            ? "6"
            : roll.highest >= 4
              ? "4/5"
              : "1-3";

        const modeLabel =
          mode === "mid-action"
            ? "Mid-action recover"
            : "Downtime recover";
        const poolLabel =
          invigoratedDice > 0
            ? `${baseRecoverDice}+1 Invigorated (${healingDiceCount}d total)`
            : `${healingDiceCount}d`;
        setHealingRecoverMsg(
          `${modeLabel}: ${recoveryActionName} (${poolLabel}) rolled ${bandText} → +${roll.segments} healing segments (offline — choose a session above to save to Session History).`,
        );
      } catch (e) {
        setHealingRecoverErr(e?.message || "Recover failed");
      } finally {
        setHealingRecoverBusy(false);
      }
    },
    [
      selfRecoverInvigoratedDice,
      activeSessionId,
      charCampaign?.active_session,
      characterId,
      actionRatings,
      advanceHealingClockBySegments,
      applyStressCost,
      canEditSheet,
      healingRecoverBusy,
      rollRecoveryTreatment,
      selfHealingRecoverAction,
      onCampaignRefresh,
    ],
  );

  const xpReqSnapshot = useMemo(
    () =>
      buildXpRequirementSnapshot({
        sessionId: activeSessionId,
        characterId,
        trackerEntries: xpReqTracker,
        rolls: xpReqRolls,
      }),
    [activeSessionId, characterId, xpReqTracker, xpReqRolls],
  );

  const planSessionHadRef = useRef(false);
  useEffect(() => {
    const hasSession = Boolean(
      xpReqSnapshot.hasActiveSession || activeSessionId,
    );
    const rising = hasSession && !planSessionHadRef.current;
    planSessionHadRef.current = hasSession;
    if (!rising || isGM || !planMode) return undefined;
    setPlanMode(false);
    setPlanSessionHint("Plan mode off — active session.");
    const t = window.setTimeout(() => setPlanSessionHint(null), 4000);
    return () => window.clearTimeout(t);
  }, [xpReqSnapshot.hasActiveSession, activeSessionId, planMode, isGM]);

  useEffect(() => {
    if (!planMode) {
      setPlanBADraft(null);
      setPlanBAError(null);
      setPlanBASuppressed(false);
    }
  }, [planMode]);

  const plannedCoinGrades = useMemo(() => {
    const map = {};
    const queued = (advancementPlan || [])
      .filter(
        (i) =>
          i.kind === "coin_grade" &&
          (i.status === "queued" || !i.status),
      )
      .slice()
      .sort(
        (a, b) =>
          (a.order || 0) - (b.order || 0) || (a.id || 0) - (b.id || 0),
      );
    const gradeRank = { F: 0, D: 1, C: 2, B: 3, A: 4, S: 5 };
    for (const item of queued) {
      const stat = item.payload?.stat;
      const grade = item.payload?.to_grade;
      if (!stat || !grade) continue;
      const prev = map[stat];
      const prevRank = gradeRank[prev?.grade] ?? -1;
      const nextRank = gradeRank[grade] ?? -1;
      if (nextRank >= prevRank) {
        map[stat] = {
          grade,
          blocked: Boolean(item.blocked_reason || item.blockedReason),
        };
      }
    }
    return map;
  }, [advancementPlan]);

  /** Extra action dots queued per action key (uppercase sheet keys). */
  const plannedActionDotCounts = useMemo(() => {
    const map = {};
    for (const item of advancementPlan || []) {
      if (item.kind !== "action_dot") continue;
      if (item.status && item.status !== "queued") continue;
      const action = String(item.payload?.action || "").toUpperCase();
      if (!action) continue;
      map[action] = (map[action] || 0) + 1;
    }
    return map;
  }, [advancementPlan]);

  const queuePlanActionDot = useCallback(
    async (action) => {
      if (!characterId || !canEditPlan || planBusy) return;
      const track = ACTION_ATTR[action];
      if (!track) {
        setXpActionToast({
          kind: "err",
          message: `Unknown action track for ${action}.`,
        });
        return;
      }
      const owned = Math.max(0, Math.floor(Number(actionRatings[action]) || 0));
      const planned = plannedActionDotCounts[action] || 0;
      if (owned + planned >= 4) {
        setXpActionToast({
          kind: "err",
          message: `${action} already at max (4) including planned dots.`,
        });
        return;
      }
      setPlanBusy(true);
      try {
        const res = await characterAPI.addAdvancementPlanItem(characterId, {
          track,
          kind: "action_dot",
          payload: { action: String(action).toLowerCase() },
        });
        if (Array.isArray(res?.items)) setAdvancementPlan(res.items);
        setXpActionToast({
          kind: "ok",
          message: `Queued +1 ${action} on ${track} fill.`,
        });
      } catch (err) {
        setXpActionToast({
          kind: "err",
          message: err?.message || "Failed to queue action dot.",
        });
      } finally {
        setPlanBusy(false);
      }
    },
    [
      characterId,
      canEditPlan,
      planBusy,
      actionRatings,
      plannedActionDotCounts,
    ],
  );

  const handlePlanReorder = useCallback(
    async (track, orderedIds) => {
      if (!characterId || planBusy) return;
      setPlanBusy(true);
      try {
        const res = await characterAPI.reorderAdvancementPlan(characterId, {
          track,
          ordered_ids: orderedIds,
        });
        if (Array.isArray(res?.items)) setAdvancementPlan(res.items);
      } catch (err) {
        setXpActionToast({
          kind: "err",
          message: err?.message || "Failed to reorder plan",
        });
      } finally {
        setPlanBusy(false);
      }
    },
    [characterId, planBusy],
  );

  const handlePlanDelete = useCallback(
    async (itemId) => {
      if (!characterId || planBusy) return;
      setPlanBusy(true);
      try {
        const res = await characterAPI.deleteAdvancementPlanItem(
          characterId,
          itemId,
        );
        if (Array.isArray(res?.items)) setAdvancementPlan(res.items);
      } catch (err) {
        setXpActionToast({
          kind: "err",
          message: err?.message || "Failed to delete plan item",
        });
      } finally {
        setPlanBusy(false);
      }
    },
    [characterId, planBusy],
  );

  const [xpToggleBusyTrigger, setXpToggleBusyTrigger] = useState(null);
  const [xpToggleError, setXpToggleError] = useState(null);

  const refetchXpReqTracker = useCallback(async () => {
    if (!characterId) return;
    const asArray = (res) => (Array.isArray(res) ? res : res?.results || []);
    try {
      const r = await experienceTrackerAPI.list({ character: characterId });
      setXpReqTracker(asArray(r));
    } catch {
      // keep prior state; error surfacing handled where relevant
    }
  }, [characterId]);

  const togglePlaybookXpArchetypeKey = useCallback((key) => {
    setPlaybookXpArchetypes((prev) => {
      const had = prev.includes(key);
      const nextSet = new Set(prev);
      if (had) nextSet.delete(key);
      else nextSet.add(key);
      const order = archetypeRowsForCharacterPlaybook(playbook).map(
        (r) => r.key,
      );
      const next = order.filter((k) => nextSet.has(k));
      if (
        normalizePlaybookPathKey(playbook) === "STAND" &&
        next.length > 0
      ) {
        setStandType(next[0]);
      }
      return next;
    });
  }, [playbook]);

  /**
   * Toggle an end-of-session XP trigger (BELIEFS / STRUGGLE / playbook-specific)
   * for the character. delta > 0 awards +1 (capped per SRD 2 / trigger / session); delta < 0
   * revokes the most recent toggled trigger entry. Both player owner and GM can call.
   */
  const handleXpTriggerToggle = useCallback(
    async (trigger, delta) => {
      if (!characterId || !trigger) return;
      if (!xpReqSnapshot.hasActiveSession) return;
      setXpToggleError(null);
      setXpToggleBusyTrigger(trigger);
      try {
        if (delta > 0) {
          const res = await experienceTrackerAPI.award({
            character: characterId,
            trigger,
          });
          const granted = Number(res?.granted) || 0;
          if (granted > 0) {
            setXp((prev) => ({
              ...prev,
              playbook: Math.min(10, (Number(prev.playbook) || 0) + granted),
            }));
          }
        } else {
          const res = await experienceTrackerAPI.revoke({
            character: characterId,
            trigger,
          });
          const revoked = Number(res?.revoked) || 0;
          if (revoked > 0) {
            setXp((prev) => ({
              ...prev,
              playbook: Math.max(0, (Number(prev.playbook) || 0) - revoked),
            }));
          }
        }
        await refetchXpReqTracker();
      } catch (err) {
        setXpToggleError(err?.message || "Could not toggle XP trigger.");
      } finally {
        setXpToggleBusyTrigger(null);
      }
    },
    [characterId, xpReqSnapshot.hasActiveSession, refetchXpReqTracker],
  );

  /**
   * Active-session XP tracker entries for this character (most recent first).
   * Exposes attribution (PLAYER / GM / AUTO + awarded_by_username), session
   * name, and the entry id so the UI can render a per-row delete button.
   */
  const xpReqActiveSessionEntries = useMemo(() => {
    if (!activeSessionId) return [];
    const rows = Array.isArray(xpReqTracker) ? xpReqTracker : [];
    return rows
      .filter((r) => Number(r?.session) === Number(activeSessionId))
      .slice()
      .sort(
        (a, b) =>
          new Date(b.session_date || 0) - new Date(a.session_date || 0),
      );
  }, [activeSessionId, xpReqTracker]);

  const [xpEntryDeleteBusy, setXpEntryDeleteBusy] = useState(null);
  const handleDeleteXpEntry = useCallback(
    async (entry) => {
      if (!entry?.id) return;
      const amount = Number(entry.xp_gained) || 0;
      const clockKey = (entry.clock_key || "").trim();
      setXpToggleError(null);
      setXpEntryDeleteBusy(entry.id);
      try {
        await experienceTrackerAPI.remove(entry.id);
        if (amount > 0 && clockKey) {
          setXp((prev) => {
            const cur = Number(prev?.[clockKey]) || 0;
            return { ...prev, [clockKey]: Math.max(0, cur - amount) };
          });
        }
        await refetchXpReqTracker();
      } catch (err) {
        setXpToggleError(err?.message || "Could not delete XP entry.");
      } finally {
        setXpEntryDeleteBusy(null);
      }
    },
    [refetchXpReqTracker],
  );

  const handleHistoryRowUndo = useCallback(
    async (row) => {
      if (!row || historyUndoBusy) return;
      const busyKey = row.key;
      setHistoryUndoBusy(busyKey);
      setHistoryUndoError(null);
      try {
        if (row.type === "sheet_edit" && row.entryId) {
          const res = await characterHistoryAPI.undo(row.entryId);
          if (res?.character) applyAllocationBackendCharacter(res.character);
        } else if (row.type === "xp_tracker" && row.entryId) {
          const amount = Number(row.xpGained) || 0;
          const clockKey = (row.clockKey || "").trim();
          await experienceTrackerAPI.remove(row.entryId);
          if (amount > 0 && clockKey === "pool") {
            setUnallocatedXp((p) => Math.max(0, (Number(p) || 0) - amount));
          } else if (amount > 0 && clockKey) {
            setXp((prev) => {
              const cur = Number(prev?.[clockKey]) || 0;
              return { ...prev, [clockKey]: Math.max(0, cur - amount) };
            });
          }
          await refetchXpReqTracker();
        } else {
          return;
        }
        setHistoryRefreshTick((x) => x + 1);
        await refreshXpAllocations();
      } catch (err) {
        setHistoryUndoError(err?.message || "Failed to undo change");
      } finally {
        setHistoryUndoBusy(null);
      }
    },
    [
      historyUndoBusy,
      applyAllocationBackendCharacter,
      refetchXpReqTracker,
      refreshXpAllocations,
    ],
  );

  const handleUndoLatestGmChange = useCallback(
    async (e) => {
      e?.stopPropagation?.();
      if (!characterId || gmUndoBusy || !gmUndoStatus?.available) return;
      setGmUndoBusy(true);
      setGmUndoError(null);
      try {
        const res = await characterAPI.undoLatestGmChange(characterId);
        if (res?.character) applyAllocationBackendCharacter(res.character);
        if (Array.isArray(res?.allocations)) {
          setXpAllocationRows(res.allocations);
        } else {
          await refreshXpAllocations();
        }
        if (res?.status) {
          setGmUndoStatus(
            res.status.available
              ? { available: true, summary: res.status.summary || null }
              : { available: false, summary: null },
          );
        } else {
          await refreshGmUndoStatus();
        }
        await refreshGmRedoStatus();
        setHistoryRefreshTick((x) => x + 1);
        await refetchXpReqTracker();
      } catch (err) {
        setGmUndoError(err?.message || "Failed to undo GM XP award");
      } finally {
        setGmUndoBusy(false);
      }
    },
    [
      characterId,
      gmUndoBusy,
      gmUndoStatus?.available,
      applyAllocationBackendCharacter,
      refreshXpAllocations,
      refreshGmUndoStatus,
      refreshGmRedoStatus,
      refetchXpReqTracker,
    ],
  );

  const handleRedoLatestAllocation = useCallback(
    async (e) => {
      e?.stopPropagation?.();
      if (!characterId || xpAllocationUndoBusy) return;
      setXpAllocationUndoBusy(true);
      setXpAllocationActionError(null);
      try {
        const res = await characterAPI.redoLatestAllocation(characterId);
        if (res?.character) applyAllocationBackendCharacter(res.character);
        if (Array.isArray(res?.allocations)) {
          setXpAllocationRows(res.allocations);
        } else {
          await refreshXpAllocations();
        }
        const detail =
          (typeof res?.summary === "string" && res.summary.trim()) ||
          "XP spend";
        setXpActionToast({ kind: "ok", message: `Redone: ${detail}` });
      } catch (err) {
        const msg = err?.message || "Failed to redo allocation";
        setXpAllocationActionError(msg);
        setXpActionToast({ kind: "err", message: msg });
      } finally {
        setXpAllocationUndoBusy(false);
      }
    },
    [
      characterId,
      xpAllocationUndoBusy,
      applyAllocationBackendCharacter,
      refreshXpAllocations,
    ],
  );

  const handleRedoLatestGmChange = useCallback(
    async (e) => {
      e?.stopPropagation?.();
      if (!characterId || gmRedoBusy || !gmRedoStatus?.available) return;
      setGmRedoBusy(true);
      setGmRedoError(null);
      try {
        const res = await characterAPI.redoLatestGmChange(characterId);
        if (res?.character) applyAllocationBackendCharacter(res.character);
        if (Array.isArray(res?.allocations)) {
          setXpAllocationRows(res.allocations);
        } else {
          await refreshXpAllocations();
        }
        if (res?.status) {
          setGmRedoStatus(
            res.status.available
              ? { available: true, summary: res.status.summary || null }
              : { available: false, summary: null },
          );
        } else {
          await refreshGmRedoStatus();
        }
        await refreshGmUndoStatus();
        setHistoryRefreshTick((x) => x + 1);
        await refetchXpReqTracker();
      } catch (err) {
        setGmRedoError(err?.message || "Failed to redo GM XP award");
      } finally {
        setGmRedoBusy(false);
      }
    },
    [
      characterId,
      gmRedoBusy,
      gmRedoStatus?.available,
      applyAllocationBackendCharacter,
      refreshXpAllocations,
      refreshGmRedoStatus,
      refreshGmUndoStatus,
      refetchXpReqTracker,
    ],
  );

  useEffect(() => {
    if (!characterId) {
      setXpReqTracker([]);
      return;
    }
    const asArray = (res) => (Array.isArray(res) ? res : res?.results || []);
    experienceTrackerAPI
      .list({ character: characterId })
      .then((r) => setXpReqTracker(asArray(r)))
      .catch(() => setXpReqTracker([]));
  }, [characterId, sessionDataPollTick]);

  useEffect(() => {
    if (!characterId || !activeSessionId) {
      setXpReqRolls([]);
      return;
    }
    const asArray = (res) => (Array.isArray(res) ? res : res?.results || []);
    rollAPI
      .getRolls({ session: activeSessionId })
      .then((r) => setXpReqRolls(asArray(r)))
      .catch(() => setXpReqRolls([]));
  }, [characterId, activeSessionId, sessionDataPollTick]);

  useEffect(() => {
    setHistorySessionId(activeSessionId || null);
    setHistoryManual((p) => ({
      ...p,
      sessionId: activeSessionId ? String(activeSessionId) : "",
    }));
  }, [activeSessionId]);

  useEffect(() => {
    if (characterId == null) return;
    setHistoryCharacterFilter(String(characterId));
  }, [characterId, showHistoryPanel, historyMode]);

  useEffect(() => {
    if (!showHistoryPanel) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowHistoryPanelPersist(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showHistoryPanel, setShowHistoryPanelPersist]);

  useEffect(() => {
    refreshXpAllocations();
  }, [characterId, refreshXpAllocations]);

  useEffect(() => {
    refreshGmUndoStatus();
    refreshGmRedoStatus();
  }, [refreshGmUndoStatus, refreshGmRedoStatus, sessionDataPollTick, historyRefreshTick]);

  useEffect(() => {
    if (!showXpHistoryModal || !characterId) return;
    setXpTimelineLoading(true);
    setXpTimelineError(null);
    setXpAllocationActionError(null);
    const asArray = (res) => (Array.isArray(res) ? res : res?.results || []);
    Promise.all([
      experienceTrackerAPI.list({ character: characterId }).catch(() => []),
      xpHistoryAPI.list({ character: characterId }).catch(() => []),
      characterAPI
        .getXpAllocations(characterId, { includeUndone: true })
        .catch(() => []),
    ])
      .then(([et, xh, allocations]) => {
        const rows = [
          ...asArray(et).map((e) => ({
            key: `t-${e.id}`,
            kind: "earn",
            when: e.session_date,
            text: `${e.trigger_display || e.trigger || "XP"}: ${e.description || ""} (+${e.xp_gained ?? 0} XP)`,
          })),
          ...asArray(xh).map((x) => ({
            key: `h-${x.id}`,
            kind: "earn",
            when: x.timestamp,
            text: `${x.reason || "XP"} (+${x.amount ?? 0})`,
          })),
          ...asArray(allocations).map((a) => ({
            key: `a-${a.id}`,
            kind: "spend",
            when: a.created_at,
            text: a.summary || a.allocation_type_display || "XP spend",
            allocation: a,
          })),
        ];
        rows.sort((a, b) => new Date(b.when) - new Date(a.when));
        setXpTimelineRows(rows);
        setXpAllocationRows(asArray(allocations));
      })
      .catch((e) => setXpTimelineError(e.message))
      .finally(() => setXpTimelineLoading(false));
  }, [showXpHistoryModal, characterId]);

  useEffect(() => {
    if (!showHistoryPanel) return;
    if (!characterId) {
      setHistoryRows([]);
      return;
    }
    setHistoryLoading(true);
    setHistoryError(null);
    const asArray = (res) => (Array.isArray(res) ? res : res?.results || []);
    if (historyMode === "sheet") {
      Promise.all([
        characterHistoryAPI.list({ character: characterId }),
        experienceTrackerAPI.list({ character: characterId }).catch(() => []),
        xpHistoryAPI.list({ character: characterId }).catch(() => []),
      ])
        .then(([histRes, etRes, xhRes]) => {
          const rows = [];
          asArray(histRes).forEach((entry) => {
            const changed = entry.changed_fields || {};
            const details = Object.keys(changed).map((k) => ({
              key: k,
              label: historyFieldLabel(k),
              oldValue: stringifyValue(changed[k]?.old),
              newValue: stringifyValue(changed[k]?.new),
            }));
            rows.push({
              key: `sheet-${entry.id}`,
              entryId: entry.id,
              timestamp: entry.timestamp,
              actor: entry.editor_username || "system",
              type: "sheet_edit",
              sessionTag: "Out of session",
              details,
              revertedAt: entry.reverted_at || null,
              canUndo: Boolean(entry.can_undo),
              undoBlockReason: entry.undo_block_reason || null,
            });
          });
          asArray(etRes).forEach((e) => {
            rows.push({
              key: `et-all-${e.id}`,
              entryId: e.id,
              timestamp: e.session_date,
              actor: "xp (tracker)",
              characterId: e.character ?? characterId,
              type: "xp_tracker",
              text: `+${e.xp_gained ?? 0} XP — ${e.trigger_display || e.trigger || "XP"}: ${e.description || "—"}`,
              modifiers: e.session
                ? [`Session #${e.session}`]
                : ["No session link"],
              xpGained: e.xp_gained,
              clockKey: e.clock_key,
              canUndo: Boolean(e.can_undo_from_sheet),
              undoBlockReason: e.undo_block_reason || null,
            });
          });
          asArray(xhRes).forEach((x) => {
            rows.push({
              key: `xh-all-${x.id}`,
              timestamp: x.timestamp,
              actor: "xp (ledger)",
              characterId: x.character ?? characterId,
              type: "xp_ledger",
              text: `+${x.amount ?? 0} XP — ${x.reason || "—"}`,
              modifiers: x.session
                ? [`Session #${x.session}`]
                : [],
            });
          });
          rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setHistoryRows(rows);
        })
        .catch((e) => setHistoryError(e.message))
        .finally(() => setHistoryLoading(false));
      return;
    }

    if (!historySessionId) {
      const roster = charCampaign?.campaign_characters || [];
      let targetIds = [];
      if (historyCharacterFilter === "all" && isGM && roster.length) {
        targetIds = roster.map((c) => c.id).filter((id) => id != null);
      } else {
        const tid = parseInt(
          String(historyCharacterFilter || characterId || ""),
          10,
        );
        if (Number.isFinite(tid)) targetIds = [tid];
      }
      if (!targetIds.length) {
        setHistoryRows([]);
        setHistoryLoading(false);
        return;
      }
      const nameById = new Map(
        roster.map((c) => [
          c.id,
          c.true_name || c.name || `PC ${c.id}`,
        ]),
      );
      Promise.all(
        targetIds.map((cid) =>
          Promise.all([
            experienceTrackerAPI.list({ character: cid }).catch(() => []),
            xpHistoryAPI.list({ character: cid }).catch(() => []),
            characterHistoryAPI.list({ character: cid }).catch(() => []),
          ]).then(([et, xh, hist]) => ({
            cid,
            et: asArray(et),
            xh: asArray(xh),
            hist: asArray(hist),
          })),
        ),
      )
        .then((bundles) => {
          const rows = [];
          for (const b of bundles) {
            const cname = nameById.get(b.cid) || `PC ${b.cid}`;
            b.et.forEach((e) => {
              rows.push({
                key: `et-${e.id}-${b.cid}`,
                timestamp: e.session_date,
                actor: "xp (tracker)",
                characterId: b.cid,
                type: "xp_tracker",
                text: `[${cname}] +${e.xp_gained ?? 0} XP — ${e.trigger_display || e.trigger || "XP"}: ${e.description || "—"}`,
                modifiers: e.session
                  ? [`Session #${e.session}`]
                  : [],
              });
            });
            b.xh.forEach((x) => {
              rows.push({
                key: `xh-${x.id}-${b.cid}`,
                timestamp: x.timestamp,
                actor: "xp (ledger)",
                characterId: b.cid,
                type: "xp_ledger",
                text: `[${cname}] +${x.amount ?? 0} XP — ${x.reason || "—"}`,
                modifiers: x.session
                  ? [`Session #${x.session}`]
                  : [],
              });
            });
            b.hist.forEach((entry) => {
              const spend = summarizeXpSpendFromHistoryEntry(entry);
              if (!spend) return;
              rows.push({
                key: `xpspend-${entry.id}-${b.cid}`,
                timestamp: entry.timestamp,
                actor: entry.editor_username || "sheet",
                characterId: b.cid,
                type: "xp_spend",
                text: `[${cname}] ${spend}`,
                modifiers: [],
              });
            });
          }
          rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setHistoryRows(rows);
        })
        .catch((e) => setHistoryError(e.message))
        .finally(() => setHistoryLoading(false));
      return;
    }
    if (historySessionId === "all") {
      const sessions = charCampaign?.sessions || [];
      const sessionNameById = new Map(
        sessions.map((s) => [Number(s.id), s.name || `Session ${s.id}`]),
      );
      if (!sessions.length) {
        setHistoryRows([]);
        setHistoryLoading(false);
        return;
      }
      Promise.all(
        sessions.map((s) =>
          Promise.all([
            rollAPI.getRolls({ session: s.id }).catch(() => []),
            sessionAPI.getSession(s.id).catch(() => null),
            progressClockAPI
              .getProgressClocks({
                session: s.id,
                ...(charCampaign?.id ? { campaign: charCampaign.id } : {}),
              })
              .catch(() => []),
          ]).then(([rollsRes, sessionRes, clocksRes]) => ({
            sid: Number(s.id),
            rollsRes,
            sessionRes,
            clocksRes,
          })),
        ),
      )
        .then((bundles) => {
          const rows = [];
          const targetCid = String(characterId);
          for (const b of bundles) {
            const sLabel =
              sessionNameById.get(b.sid) || `Session ${b.sid}`;
            const sTag = `[${sLabel}]`;
            asArray(b.rollsRes).forEach((r) => {
              const isFortune =
                String(r.roll_type || "").toUpperCase() === "FORTUNE";
              if (isFortune && !r.fortune_reveal_outcome && !isGM) return;
              if (
                String(r.character || "") !== targetCid &&
                String(r.recovery_target ?? r.recoveryTarget ?? "") !==
                  targetCid
              )
                return;
              const diceStr = [].concat(r.results || []).join(", ");
              const outcomeDisp = String(r.outcome || "").replace(/_/g, " ");
              rows.push({
                key: `roll-${r.id}-all`,
                timestamp: r.timestamp,
                actor: r.rolled_by_username || r.character_name || "unknown",
                characterId: r.character,
                recoveryTargetId:
                  r.recovery_target == null
                    ? null
                    : Number(r.recovery_target),
                type: "roll",
                rollType: r.roll_type,
                text: `${sTag} ${
                  (r.roll_type || "").toUpperCase() === "FORTUNE" &&
                  !r.fortune_reveal_outcome
                    ? `${r.action_name || "Fortune"} (redacted)`
                    : `${r.action_name || "Roll"} · ${diceStr} → ${outcomeDisp}`
                }`,
                modifiers: [
                  r.position ? `Pos ${r.position}` : null,
                  r.effect ? `Eff ${r.effect}` : null,
                  r.push_for_dice ? "Push(+1d)" : null,
                  r.push_for_effect ? "Push(+effect)" : null,
                  r.uses_devil_bargain ? "Devil's bargain" : null,
                  r.roller_stress_spent
                    ? `Stress ${r.roller_stress_spent}`
                    : null,
                ].filter(Boolean),
              });
            });
            (b.sessionRes?.events || []).forEach((evt) => {
              if (evt.character && String(evt.character) !== targetCid)
                return;
              rows.push({
                key: `evt-${evt.id}-all`,
                timestamp: evt.timestamp,
                actor: "session",
                characterId: evt.character || null,
                type: "event",
                text: `${sTag} ${evt.event_type}: ${stringifyValue(evt.details)}`,
                modifiers: [],
              });
            });
            (b.sessionRes?.stress_history || []).forEach((s) => {
              if (s.character && String(s.character) !== targetCid) return;
              rows.push({
                key: `stress-${s.id}-all`,
                timestamp: s.timestamp,
                actor: "stress",
                characterId: s.character || null,
                type: "stress",
                text: `${sTag} Stress ${s.amount > 0 ? "+" : ""}${s.amount} (${s.reason || "update"})`,
                modifiers: [],
              });
            });
            (b.sessionRes?.xp_entries || []).forEach((x) => {
              if (String(x.character || "") !== targetCid) return;
              const desc = String(x.description || "").trim();
              rows.push({
                key: `xp-${x.id}-all`,
                timestamp: x.session_date || b.sessionRes?.session_date,
                actor: "xp (tracker)",
                characterId: x.character || null,
                type: "xp",
                text: `${sTag} +${x.xp_gained ?? 0} XP — ${
                  x.trigger_display || x.trigger || "trigger"
                }${desc ? `: ${desc}` : ""}`,
                modifiers: [],
              });
            });
            (b.sessionRes?.xp_history || []).forEach((x) => {
              if (String(x.character || "") !== targetCid) return;
              rows.push({
                key: `xph-${x.id}-all`,
                timestamp: x.timestamp,
                actor: "xp (ledger)",
                characterId: x.character || null,
                type: "xp_ledger",
                text: `${sTag} +${x.amount ?? 0} XP — ${x.reason || "—"}`,
                modifiers: [],
              });
            });
            asArray(b.clocksRes).forEach((clk) => {
              rows.push({
                key: `clock-${clk.id}-all`,
                timestamp:
                  clk.updated_at || clk.created_at || b.sessionRes?.session_date,
                actor:
                  clk.created_by_username ||
                  clk.created_by_character_name ||
                  "clock",
                characterId: null,
                type: "clock",
                text: `${sTag} Clock ${clk.name}: ${clk.filled_segments}/${clk.max_segments}`,
                modifiers: [
                  clk.visible_to_party ? "Shared party" : "Private",
                ],
              });
            });
          }
          rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setHistoryRows(rows);
        })
        .catch((e) => setHistoryError(e.message))
        .finally(() => setHistoryLoading(false));
      return;
    }
    Promise.all([
      rollAPI.getRolls({ session: historySessionId }).catch(() => []),
      sessionAPI.getSession(historySessionId).catch(() => null),
      progressClockAPI
        .getProgressClocks({
          session: historySessionId,
          ...(charCampaign?.id ? { campaign: charCampaign.id } : {}),
        })
        .catch(() => []),
    ])
      .then(([rollsRes, sessionRes, clocksRes]) => {
        const rows = [];
        asArray(rollsRes).forEach((r) => {
          const isFortune = String(r.roll_type || "").toUpperCase() === "FORTUNE";
          // Hide unrevealed fortunes from non-GMs only; GMs still see full rows.
          if (isFortune && !r.fortune_reveal_outcome && !isGM) return;
          const diceStr = []
            .concat(r.results || [])
            .join(", ");
          const outcomeDisp = String(r.outcome || "").replace(/_/g, " ");
          const recCtx = String(
            r.recovery_context ?? r.recoveryContext ?? "",
          ).toLowerCase();
          const recTgtNm = String(
            r.recovery_target_character_name ??
              r.recoveryTargetCharacterName ??
              "",
          ).trim();
          const recoveryTgtRaw =
            r.recovery_target ?? r.recoveryTarget ?? null;
          const recoveryTargetId =
            recoveryTgtRaw == null ? null : Number(recoveryTgtRaw);

          rows.push({
            key: `roll-${r.id}`,
            timestamp: r.timestamp,
            actor: r.rolled_by_username || r.character_name || "unknown",
            characterId: r.character,
            recoveryTargetId:
              recoveryTargetId != null && Number.isFinite(recoveryTargetId)
                ? recoveryTargetId
                : null,
            type: "roll",
            rollType: r.roll_type,
            text:
              (r.roll_type || "").toUpperCase() === "FORTUNE" &&
              !r.fortune_reveal_outcome
                ? `${r.action_name || "Fortune"} (redacted)`
                : (r.roll_type || "").toUpperCase() === "CLEAR_STRESS"
                  ? (() => {
                      const clears = []
                        .concat(r.results || [])
                        .map((x) => Number(x))
                        .filter((n) => Number.isFinite(n));
                      const hi = clears.length ? Math.max(...clears) : 0;
                      const label =
                        String(r.action_name || "").toLowerCase() === "vice"
                          ? "Vice"
                          : r.action_name || "Clear stress";
                      const desc = String(r.description || "").trim();
                      const parts = desc.split(" Overindulgence: ");
                      const overTail =
                        parts.length > 1 ? parts[parts.length - 1].trim() : "";
                      return `${label} · ${clears.join(", ")} → clears ${hi} stress${
                        overTail ? ` · ${overTail}` : ""
                      }`;
                    })()
                  : recCtx === "self_downtime" || recCtx === "self_mid_action"
                    ? (String(r.description || "").trim() ||
                        `${r.action_name || "recover"} · ${diceStr} → ${outcomeDisp}`)
                    : recCtx === "ally" && recTgtNm
                      ? `Recovery → ${recTgtNm}: ${r.action_name || "recover"} · ${diceStr} → ${outcomeDisp}`
                      : recCtx === "self_treatment_roll"
                        ? `Recovery (self treatment): ${r.action_name || "recover"} · ${diceStr} → ${outcomeDisp}`
                        : `${r.action_name || "Roll"} · ${diceStr} → ${outcomeDisp}`,
            modifiers: [
              r.position ? `Pos ${r.position}` : null,
              r.effect ? `Eff ${r.effect}` : null,
              Number(r.pool_bonus_dice) > 0
                ? `Pool +${r.pool_bonus_dice}d (abilities / heritage)`
                : null,
              (() => {
                const d = String(r.description || "");
                const tags = [];
                if (/\[abilities:/i.test(d)) tags.push("Abilities");
                if (/\[heritage:/i.test(d)) tags.push("Heritage");
                return tags.length ? tags.join(" · ") : null;
              })(),
              Array.isArray(r.modifier_sources) && r.modifier_sources.length > 0
                ? `Sources: ${r.modifier_sources
                    .map((s) => s?.name || s?.delta)
                    .filter(Boolean)
                    .slice(0, 3)
                    .join(", ")}`
                : null,
              r.push_for_dice ? "Push(+1d)" : null,
              r.push_for_effect ? "Push(+effect)" : null,
              r.uses_devil_bargain ? "Devil's bargain" : null,
              r.roller_stress_spent ? `Stress ${r.roller_stress_spent}` : null,
              ...(Array.isArray(r.xp_award_details) &&
              r.xp_award_details.length > 0
                ? r.xp_award_details
                : r.xp_award_detail
                  ? [r.xp_award_detail]
                  : []
              )
                .filter((d) => d?.xp_gained)
                .map(
                  (d) =>
                    `+${d.xp_gained} XP (${d.trigger_label || d.trigger || "roll"})`,
                ),
            ].filter(Boolean),
          });
        });

        const events = (sessionRes?.events || []).map((evt) => ({
          key: `evt-${evt.id}`,
          timestamp: evt.timestamp,
          actor: "session",
          characterId: evt.character || null,
          type: "event",
          text: `${evt.event_type}: ${stringifyValue(evt.details)}`,
          modifiers: [],
        }));
        rows.push(...events);

        const stressRows = (sessionRes?.stress_history || []).map((s) => ({
          key: `stress-${s.id}`,
          timestamp: s.timestamp,
          actor: "stress",
          characterId: s.character || null,
          type: "stress",
          text: `Stress ${s.amount > 0 ? "+" : ""}${s.amount} (${s.reason || "update"})`,
          modifiers: [],
        }));
        rows.push(...stressRows);

        const charFilter =
          historyCharacterFilter === "all"
            ? null
            : String(historyCharacterFilter);
        const xpEntryMatches = (x) =>
          !charFilter || String(x.character || "") === charFilter;
        const xpHistMatches = (x) =>
          !charFilter || String(x.character || "") === charFilter;

        const xpRows = (sessionRes?.xp_entries || [])
          .filter(xpEntryMatches)
          .map((x) => {
            const desc = String(x.description || "").trim();
            return {
              key: `xp-${x.id}`,
              timestamp: x.session_date || sessionRes?.session_date,
              actor: "xp (tracker)",
              characterId: x.character || null,
              type: "xp",
              text: `+${x.xp_gained ?? 0} XP — ${x.trigger_display || x.trigger || "trigger"}${desc ? `: ${desc}` : ""}`,
              modifiers: [],
            };
          });
        rows.push(...xpRows);

        const legacyXpRows = (sessionRes?.xp_history || [])
          .filter(xpHistMatches)
          .map((x) => ({
            key: `xph-${x.id}`,
            timestamp: x.timestamp,
            actor: "xp (ledger)",
            characterId: x.character || null,
            type: "xp_ledger",
            text: `+${x.amount ?? 0} XP — ${x.reason || "—"}`,
            modifiers: [],
          }));
        rows.push(...legacyXpRows);

        asArray(clocksRes).forEach((clk) => {
          rows.push({
            key: `clock-${clk.id}`,
            timestamp: clk.updated_at || clk.created_at || sessionRes?.session_date,
            actor:
              clk.created_by_username ||
              clk.created_by_character_name ||
              "clock",
            characterId: null,
            type: "clock",
            text: `Clock ${clk.name}: ${clk.filled_segments}/${clk.max_segments}`,
            modifiers: [clk.visible_to_party ? "Shared party" : "Private"],
          });
        });

        const filtered =
          historyCharacterFilter === "all"
            ? rows
            : rows.filter(
                (rw) =>
                  String(rw.characterId || "") ===
                    String(historyCharacterFilter) ||
                  String(rw.recoveryTargetId ?? "") ===
                    String(historyCharacterFilter),
              );
        filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setHistoryRows(filtered);
      })
      .catch((e) => setHistoryError(e.message))
      .finally(() => setHistoryLoading(false));
  }, [
    showHistoryPanel,
    historyMode,
    historySessionId,
    historyCharacterFilter,
    characterId,
    charCampaign?.id,
    charCampaign?.campaign_characters,
    charCampaign?.sessions,
    isGM,
    historyRefreshTick,
  ]);

  const helpCandidates = useMemo(() => {
    const roster = charCampaign?.campaign_characters || [];
    const same = roster.filter(
      (c) =>
        c.id !== characterId && charData.crewId && c.crewId === charData.crewId,
    );
    if (same.length) return same;
    return roster.filter((c) => c.id !== characterId);
  }, [charCampaign?.campaign_characters, characterId, charData.crewId]);

  const healOtherTargets = useMemo(() => {
    const roster = charCampaign?.campaign_characters || [];
    return roster.filter((c) => String(c.id) !== String(characterId));
  }, [charCampaign?.campaign_characters, characterId]);

  const healOtherRecoveryCandidates = useMemo(() => {
    const roster = charCampaign?.campaign_characters || [];
    return roster.filter((c) => String(c.id) !== String(characterId));
  }, [charCampaign?.campaign_characters, characterId]);

  const healingIntentActionName = useMemo(() => {
    const selected = String(healOtherRecoveryIntent.actionName || "")
      .trim()
      .toUpperCase();
    if (HEALING_ACTION_CHOICES.includes(selected)) return selected;
    if (
      showStandCoinActionColumn &&
      STAND_HEAL_ACTION_EXTRA_CHOICES.includes(selected)
    ) {
      return selected;
    }
    return "TINKER";
  }, [healOtherRecoveryIntent.actionName, showStandCoinActionColumn]);

  const rollActionName = useMemo(() => {
    if (healOtherRecoveryIntent.enabled) return healingIntentActionName;
    if (
      rollPending?.standRoll &&
      String(rollPending?.standStat || "").trim()
    ) {
      return (
        `${String(rollPending.standStat).trim().toUpperCase()} (Stand)`
      );
    }
    return String(rollPending?.actionName || "").trim().toUpperCase();
  }, [
    healOtherRecoveryIntent.enabled,
    healingIntentActionName,
    rollPending?.actionName,
    rollPending?.standRoll,
    rollPending?.standStat,
  ]);

  const groupParticipants = useMemo(() => {
    const roster = charCampaign?.campaign_characters || [];
    if (charData.crewId) {
      const sameCrew = roster.filter((c) => c.crewId === charData.crewId);
      if (sameCrew.length) return sameCrew;
    }
    return roster;
  }, [charCampaign?.campaign_characters, charData.crewId]);

  const groupActionChoices = useMemo(
    () => Object.keys(ACTION_ATTR || {}).sort(),
    [],
  );
  const healRollActionChoices = useMemo(
    () => Object.keys(ACTION_ATTR || {}).sort(),
    [],
  );

  /** Heal-other row: playbook actions plus Stand Precision/Speed when applicable. */
  const healOtherHealActionChoices = useMemo(() => {
    if (!showStandCoinActionColumn) return healRollActionChoices;
    return [...healRollActionChoices, ...STAND_HEAL_ACTION_EXTRA_CHOICES];
  }, [healRollActionChoices, showStandCoinActionColumn]);

  useEffect(() => {
    if (showStandCoinActionColumn) return;
    setHealOtherDraft((p) =>
      STAND_HEAL_ACTION_EXTRA_CHOICES.includes(
        String(p.actionName || "").trim().toUpperCase(),
      )
        ? { ...p, actionName: "TINKER" }
        : p,
    );
  }, [showStandCoinActionColumn]);

  useEffect(() => {
    if (showStandCoinActionColumn) return;
    setGroupActionNameDraft((prev) =>
      String(prev || "").trim().toLowerCase().startsWith("stand_") ? "" : prev,
    );
  }, [showStandCoinActionColumn]);

  useEffect(() => {
    if (!characterId) {
      setSelfHealingRecoverAction("TINKER");
      return;
    }
    try {
      const stored = window.localStorage.getItem(
        `biz:self-healing-recover-action:${characterId}`,
      );
      setSelfHealingRecoverAction(pickHealClockAction(stored));
    } catch {
      setSelfHealingRecoverAction("TINKER");
    }
  }, [characterId]);

  useEffect(() => {
    if (!activeSessionId) {
      setActiveGroupAction(null);
      return;
    }
    groupActionAPI
      .list({ session: activeSessionId })
      .then((res) => {
        const rows = Array.isArray(res) ? res : res?.results || [];
        const open = rows.find((ga) => ga.status === "OPEN") || null;
        setActiveGroupAction(open);
      })
      .catch(() => {
        /* keep prior OPEN GA; clearing here caused missing group_action_id on submit */
      });
  }, [activeSessionId, sessionDataPollTick]);

  // Leader may create a group action after this sheet already has activeSessionId; refetch when opening an action roll.
  useEffect(() => {
    if (!activeSessionId || !rollPending?.actionName) return;
    let cancelled = false;
    groupActionAPI
      .list({ session: activeSessionId })
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res) ? res : res?.results || [];
        const open = rows.find((ga) => ga.status === "OPEN") || null;
        setActiveGroupAction(open);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeSessionId, rollPending?.actionName]);

  useEffect(() => {
    if (!activeGroupAction?.id) return;
    if (activeGroupAction.action_name) {
      setGroupActionNameDraft(
        String(activeGroupAction.action_name).toUpperCase(),
      );
    }
    setGroupGoalDraft(String(activeGroupAction.goal_label || ""));
  }, [
    activeGroupAction?.id,
    activeGroupAction?.action_name,
    activeGroupAction?.goal_label,
  ]);

  useEffect(() => {
    if (activeGroupAction?.id) {
      setCrewGroupExpandedPersist(true);
    }
  }, [activeGroupAction?.id, setCrewGroupExpandedPersist]);

  useEffect(() => {
    if (!activeGroupAction?.id) {
      setGroupActionRolls([]);
      setGroupActionLoading(false);
      groupRollFetchSpinnerKeyRef.current = "";
      return;
    }
    const spinnerKey = `${activeSessionId}:${activeGroupAction.id}`;
    if (groupRollFetchSpinnerKeyRef.current !== spinnerKey) {
      groupRollFetchSpinnerKeyRef.current = spinnerKey;
      setGroupActionLoading(true);
    }
    rollAPI
      .getRolls({
        session: activeSessionId,
        group_action: activeGroupAction.id,
      })
      .then((res) => {
        const rows = Array.isArray(res) ? res : res?.results || [];
        setGroupActionRolls(rows);
      })
      .catch(() => setGroupActionRolls([]))
      .finally(() => setGroupActionLoading(false));
  }, [activeGroupAction?.id, activeSessionId, sessionDataPollTick]);

  const groupRollBoard = useMemo(() => {
    if (!activeGroupAction?.id) return [];
    const byCharacter = new Map();
    (groupActionRolls || [])
      .filter(
        (r) =>
          String((r.roll_type || "").toUpperCase()) === "ACTION" &&
          String((r.action_name || "").toLowerCase()) ===
            String(activeGroupAction.action_name || "").toLowerCase(),
      )
      .forEach((r) => {
        const existing = byCharacter.get(r.character);
        if (!existing) {
          byCharacter.set(r.character, r);
          return;
        }
        const a = new Date(existing.timestamp || 0).getTime();
        const b = new Date(r.timestamp || 0).getTime();
        if (b > a) byCharacter.set(r.character, r);
      });
    return groupParticipants.map((p) => {
      const roll = byCharacter.get(p.id) || null;
      let failed = null;
      let outcomeBand = null;
      if (roll) {
        const dice = ((roll.results || []).map(Number) || []).filter((n) =>
          Number.isFinite(n),
        );
        if (!dice.length) {
          failed = true;
          outcomeBand = "fail";
        } else {
          const pool = Number(roll.dice_pool) || 0;
          const dots = Number(roll.pool_action_rating) || 0;
          const tierDie = tierDieFromActionPool(dice, pool, dots);
          // Match backend group resolve: tier 1–3 fails (ignore stale outcome field).
          failed = tierDie <= 3;
          const sixes = dice.filter((d) => d === 6).length;
          if (sixes >= 2) outcomeBand = "critical";
          else if (tierDie >= 6) outcomeBand = "success";
          else if (tierDie >= 4) outcomeBand = "partial";
          else outcomeBand = "fail";
        }
      }
      return {
        id: p.id,
        name: p.true_name || p.name || `PC ${p.id}`,
        roll,
        failed,
        outcomeBand,
      };
    });
  }, [activeGroupAction, groupActionRolls, groupParticipants]);

  const groupFailures = useMemo(
    () =>
      groupRollBoard.filter(
        (r) =>
          r.failed === true &&
          String(r.id) !== String(activeGroupAction?.leader),
      ).length,
    [groupRollBoard, activeGroupAction?.leader],
  );
  const groupPendingCount = useMemo(
    () => groupRollBoard.filter((r) => !r.roll).length,
    [groupRollBoard],
  );
  const activeGroupLeaderName = useMemo(() => {
    if (!activeGroupAction?.leader) return "";
    const roster = charCampaign?.campaign_characters || [];
    const leader = roster.find(
      (c) => String(c.id) === String(activeGroupAction.leader),
    );
    return leader?.true_name || leader?.name || `PC ${activeGroupAction.leader}`;
  }, [activeGroupAction?.leader, charCampaign?.campaign_characters]);

  const isOpenGroupLeader = useMemo(
    () =>
      Boolean(
        activeGroupAction?.id &&
          String(activeGroupAction.leader) === String(characterId),
      ),
    [activeGroupAction?.id, activeGroupAction?.leader, characterId],
  );

  /** With an OPEN group action, only the leader may edit chosen action / goal (before-start: anyone configuring). */
  const canEditGroupActionSetupFields =
    !activeGroupAction?.id || isOpenGroupLeader;

  const supportsAbilityBonusDice = useCallback((description) => {
    return /\+1d\b|\bplus\s*1d\b/i.test(String(description || ""));
  }, []);
  const supportsAbilityBonusEffect = useCallback((description) => {
    return /\+1\s*effect\b|\bplus\s*1\s*effect\b/i.test(
      String(description || ""),
    );
  }, []);

  /**
   * Catalog abilities added with "Add to sheet" often store only { id, name, type }
   * on `character.abilities` — roll bonuses must mirror the abilities panel, which
   * resolves description from `/api/abilities/` reference lists by id + type.
   */
  const effectiveRollBonusAbilityDescription = useCallback(
    (ab) => {
      const raw = String(ab?.description ?? "").trim();
      if (raw) return ab.description || "";
      if (ab.type === "standard") {
        const ref = standardAbilitiesList.find(
          (x) => String(x.id) === String(ab.id),
        );
        return ref?.description || "";
      }
      if (ab.type === "spin") {
        const ref = spinAbilitiesList.find(
          (x) => String(x.id) === String(ab.id),
        );
        return ref?.description || "";
      }
      if (ab.type === "hamon") {
        const ref = hamonAbilitiesList.find(
          (x) => String(x.id) === String(ab.id),
        );
        return ref?.description || "";
      }
      return "";
    },
    [standardAbilitiesList, spinAbilitiesList, hamonAbilitiesList],
  );

  const abilityRollBonusOptions = useMemo(() => {
    const rollAbleTypes = new Set(["standard", "spin", "hamon", "custom"]);
    return (abilities || [])
      .filter((a) => a && rollAbleTypes.has(a.type))
      .map((ab) => {
        const resolvedDesc = effectiveRollBonusAbilityDescription(ab);
        const baseDice = supportsAbilityBonusDice(resolvedDesc);
        const baseEffect = supportsAbilityBonusEffect(resolvedDesc);
        const adj = adjustActionRollBonusSupports(ab, {
          supportsDice: baseDice,
          supportsEffect: baseEffect,
        });
        return {
          ...ab,
          rollBonusResolvedDescription: resolvedDesc,
          supportsDice: adj.supportsDice,
          supportsEffect: adj.supportsEffect,
        };
      })
      .filter((ab) => !abilityExcludedFromActionRollDicePoolBonuses(ab?.name))
      .filter((ab) => ab.supportsDice || ab.supportsEffect);
  }, [
    abilities,
    effectiveRollBonusAbilityDescription,
    supportsAbilityBonusDice,
    supportsAbilityBonusEffect,
  ]);

  const heritageRollBonusOptions = useMemo(() => {
    const supportsActionRollFromHeritage = (benefit) => {
      const name = String(benefit?.name || "").trim().toLowerCase();
      const desc = String(benefit?.description || "").trim().toLowerCase();
      // Resistance-only bonuses (e.g., Superior Physiology) should not appear
      // in action roll pool modifiers.
      if (name === "superior physiology") return false;
      if (/\bresist(?:ing|ance)?\b/.test(desc)) return false;
      return true;
    };
    const hid = charData?.heritage;
    const h =
      hid != null && Array.isArray(heritages) && heritages.length
        ? heritages.find((x) => x.id === hid)
        : null;
    const fromBenefits = (h?.benefits || [])
      .filter(
        (b) =>
          b &&
          ((Array.isArray(selectedBenefits) &&
            selectedBenefits.includes(b.id)) ||
            b.required),
      )
      .map((b) => ({
        ...b,
        supportsDice: supportsAbilityBonusDice(b.description),
        supportsEffect: supportsAbilityBonusEffect(b.description),
        supportsPenaltyDice: false,
      }))
      .filter(
        (hb) =>
          supportsActionRollFromHeritage(hb) &&
          (hb.supportsDice || hb.supportsEffect),
      );

    const alienOpts = (h?.detriments || [])
      .filter((d) => d && heritageEntryIsAlienUnderstanding(d))
      .filter(
        (d) =>
          Boolean(d.required) ||
          (Array.isArray(selectedDetriments) && selectedDetriments.includes(d.id)),
      )
      .map((d) => ({
        ...d,
        supportsDice: false,
        supportsEffect: false,
        supportsPenaltyDice: true,
      }));

    return [...fromBenefits, ...alienOpts];
  }, [
    charData?.heritage,
    heritages,
    selectedBenefits,
    selectedDetriments,
    supportsAbilityBonusDice,
    supportsAbilityBonusEffect,
  ]);

  const phantomPainRollDescription = useMemo(() => {
    if (!characterHasPhantomPain(abilities)) return "";
    const ab =
      abilities.find(
        (a) =>
          a &&
          String(a.type || "").toLowerCase() === "standard" &&
          String(a.name || "").trim().toLowerCase() === "phantom pain",
      ) || null;
    return ab ? String(effectiveRollBonusAbilityDescription(ab) || "").trim() : "";
  }, [abilities, effectiveRollBonusAbilityDescription]);

  /** SRD Invigorated: +1d to healing treatment — auto when pool is explicitly a heal/recovery declaration. */
  const healingTreatmentBonusContext = useMemo(() => {
    if (rollPending?.healAttempt && typeof rollPending.healAttempt === "object")
      return true;
    const tid = String(healOtherRecoveryIntent.targetId || "").trim();
    return Boolean(healOtherRecoveryIntent.enabled && tid.length > 0);
  }, [
    rollPending?.healAttempt,
    healOtherRecoveryIntent.enabled,
    healOtherRecoveryIntent.targetId,
  ]);

  const { bonusDiceFromAbilities, abilityEffectSteps, abilityBonusAudit } =
    useMemo(() => {
      if (rollPending?.standRoll) {
        return {
          bonusDiceFromAbilities: 0,
          abilityEffectSteps: 0,
          abilityBonusAudit: [],
        };
      }
      const r = computeAbilityHeritageRollBonuses({
        abilityRollBonusOptions,
        heritageRollBonusOptions: [],
        abilityBoostMap: rollAbilityBoost,
        heritageBoostMap: {},
        healingTreatmentBonusContext,
        standRoll: false,
        reflexCtx: { rollPending, healingTreatmentBonusContext },
      });
      return {
        bonusDiceFromAbilities: r.bonusDiceFromAbilities,
        abilityEffectSteps: r.abilityEffectSteps,
        abilityBonusAudit: r.abilityBonusAudit,
      };
    }, [
      abilityRollBonusOptions,
      rollAbilityBoost,
      healingTreatmentBonusContext,
      rollPending,
    ]);

  const {
    bonusDiceFromHeritage,
    heritageEffectSteps,
    heritageBonusAudit,
  } = useMemo(() => {
    const r = computeAbilityHeritageRollBonuses({
      abilityRollBonusOptions: [],
      heritageRollBonusOptions,
      abilityBoostMap: {},
      heritageBoostMap: heritageRollBoost,
      healingTreatmentBonusContext,
      standRoll: !!rollPending?.standRoll,
      reflexCtx: { rollPending, healingTreatmentBonusContext },
    });
    return {
      bonusDiceFromHeritage: r.bonusDiceFromHeritage,
      heritageEffectSteps: r.heritageEffectSteps,
      heritageBonusAudit: r.heritageBonusAudit,
    };
  }, [
    heritageRollBonusOptions,
    heritageRollBoost,
    rollPending,
    healingTreatmentBonusContext,
  ]);

  const heritagePenaltyDiceActive = useMemo(() => {
    const ctx = {
      rollPending,
      healingTreatmentBonusContext,
      rollActionName,
      disguisedAsHuman: charData.disguised_as_human,
    };
    if (!alienUnderstandingHeritagePenaltyApplies(ctx)) return 0;
    let p = 0;
    heritageRollBonusOptions.forEach((hb) => {
      if (!hb.supportsPenaltyDice) return;
      const id = hb.id ?? hb.name;
      const b = heritageRollBoost[id];
      if (b?.dice) p += 1;
    });
    return Math.min(3, p);
  }, [
    heritageRollBonusOptions,
    heritageRollBoost,
    rollPending,
    healingTreatmentBonusContext,
    rollActionName,
    charData.disguised_as_human,
  ]);

  const totalBonusDiceFromAbilitiesAndHeritage =
    bonusDiceFromAbilities + bonusDiceFromHeritage;

  /** Manual session-history ACTION record: same +1d / +1 effect rules as `rollAction` payload (no Invigorated auto — not a declared heal/recovery roll). */
  const manualHistoryAbilityTotals = useMemo(
    () =>
      computeAbilityHeritageRollBonuses({
        abilityRollBonusOptions,
        heritageRollBonusOptions,
        abilityBoostMap: historyManualAbilityBoost,
        heritageBoostMap: historyManualHeritageBoost,
        healingTreatmentBonusContext: false,
        standRoll: false,
        reflexCtx: { rollPending: null, healingTreatmentBonusContext: false },
      }),
    [
      abilityRollBonusOptions,
      heritageRollBonusOptions,
      historyManualAbilityBoost,
      historyManualHeritageBoost,
    ],
  );

  const manualHistoryEffectPreview = useMemo(() => {
    const base = normalizeEffectTier(historyManual.effect);
    const steps =
      (historyManual.pushEffect ? 1 : 0) +
      manualHistoryAbilityTotals.abilityEffectSteps +
      manualHistoryAbilityTotals.heritageEffectSteps;
    return bumpEffectTier(base, steps);
  }, [
    historyManual.effect,
    historyManual.pushEffect,
    manualHistoryAbilityTotals.abilityEffectSteps,
    manualHistoryAbilityTotals.heritageEffectSteps,
  ]);

  const manualHistorySuggestedDice = useMemo(() => {
    if (String(historyManual.rollType || "").toUpperCase() !== "ACTION")
      return null;
    const an = String(historyManual.action || "").trim();
    const base = computeBaseDicePool(an, actionRatings);
    const push = historyManual.pushDice ? 1 : 0;
    const devil = historyManual.devil ? 1 : 0;
    const help = historyManual.helpDie ? 1 : 0;
    const bonus =
      manualHistoryAbilityTotals.bonusDiceFromAbilities +
      manualHistoryAbilityTotals.bonusDiceFromHeritage;
    return base + push + devil + help + bonus;
  }, [
    historyManual.rollType,
    historyManual.action,
    historyManual.pushDice,
    historyManual.devil,
    historyManual.helpDie,
    actionRatings,
    manualHistoryAbilityTotals.bonusDiceFromAbilities,
    manualHistoryAbilityTotals.bonusDiceFromHeritage,
  ]);

  const historyManualParsedDice = useMemo(() => {
    return String(historyManual.dice || "")
      .split(/[\s,]+/)
      .map((n) => parseInt(n.trim(), 10))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 6);
  }, [historyManual.dice  ]);

  const historyManualDerivedOutcomeApi = useMemo(() => {
    const rt = String(historyManual.rollType || "").toUpperCase();
    if (!historyManualParsedDice.length) return null;
    if (rt === "FORTUNE") {
      return outcomeFromFortuneDiceResults(historyManualParsedDice);
    }
    if (rt === "ACTION" && manualHistorySuggestedDice != null) {
      const { action_rating } = computeActionPoolBreakdown(
        historyManual.action,
        actionRatings,
      );
      return outcomeFromActionRoll(
        historyManualParsedDice,
        manualHistorySuggestedDice,
        action_rating,
      );
    }
    return null;
  }, [
    historyManual.rollType,
    historyManualParsedDice,
    manualHistorySuggestedDice,
    historyManual.action,
    actionRatings,
  ]);

  const openHistoryManualModal = useCallback(() => {
    if (!canCreateManualHistoryRecord) return;
    const d = defaultPositionEffectFromSessionDetail(
      characterId,
      charCampaign?.active_session_detail,
    );
    setHistoryManualAbilityBoost({});
    setHistoryManualHeritageBoost({});
    setHistoryOutcomeBandGmUnlock(false);
    setHistoryManual((prev) => ({
      ...prev,
      position: d.position,
      effect: d.effect,
      sessionId:
        prev.sessionId ||
        (activeSessionId != null ? String(activeSessionId) : ""),
    }));
    setShowHistoryManualModal(true);
  }, [
    canCreateManualHistoryRecord,
    characterId,
    charCampaign?.active_session_detail,
    activeSessionId,
  ]);

  const hasRippleBreathingAbility = useMemo(
    () => characterHasRippleBreathing(abilities),
    [abilities],
  );

  const rippleBreathingFreePushClaimedThisSession = useMemo(() => {
    const raw =
      charCampaign?.active_session_detail
        ?.ripple_breathing_free_push_claimed_by_character;
    if (!raw || typeof raw !== "object") return false;
    return Boolean(
      raw[String(characterId ?? "")] ?? raw[characterId ?? ""],
    );
  }, [charCampaign?.active_session_detail, characterId]);

  const totalAbilityEffectSteps =
    abilityEffectSteps + heritageEffectSteps;

  const healOtherSelectedTarget = useMemo(
    () =>
      healOtherRecoveryCandidates.find(
        (c) => String(c.id) === String(healOtherRecoveryIntent.targetId),
      ) || null,
    [healOtherRecoveryCandidates, healOtherRecoveryIntent.targetId],
  );

  /** Sheet abilities + selected heritage only; matches heal/recovery or roll mechanics relevant to treatment. */
  const healBolsterAbilityCandidates = useMemo(() => {
    const out = [];
    const seen = new Set();
    const rollAble = new Set(["standard", "spin", "hamon", "custom"]);

    const push = (row) => {
      if (!row.key || seen.has(row.key)) return;
      seen.add(row.key);
      out.push(row);
    };

    const optionsByBoostKey = new Map();
    abilityRollBonusOptions.forEach((ab) => {
      const k = ab.id ?? ab.name;
      optionsByBoostKey.set(String(k), ab);
    });
    const heritageOptionsByBoostKey = new Map();
    heritageRollBonusOptions.forEach((hb) => {
      const k = hb.id ?? hb.name;
      heritageOptionsByBoostKey.set(String(k), hb);
    });

    abilityRollBonusOptions.forEach((ab) => {
      const desc = String(
        ab.rollBonusResolvedDescription || ab.description || "",
      ).toLowerCase();
      const nm = String(ab.name || "").toLowerCase();
      const combined = `${nm} ${desc}`;
      const hasDe = !!(ab.supportsDice || ab.supportsEffect);
      if (healBolsterCandidateMatchesCombinedText(combined, hasDe)) {
        const boostKey = ab.id ?? ab.name;
        push({
          key: `ability:${String(ab.type || "sheet")}:${boostKey}`,
          boostKey,
          rollKind: "ability",
          name: String(ab.name || "").trim(),
          description: String(
            ab.rollBonusResolvedDescription || ab.description || "",
          ).trim(),
        });
      }
    });

    (abilities || []).forEach((ab) => {
      const t = String(ab?.type || "").toLowerCase();
      if (!ab || !rollAble.has(t)) return;
      if (abilityExcludedFromActionRollDicePoolBonuses(ab?.name)) return;
      const boostKey = ab.id ?? ab.name;
      const keyStr = String(boostKey);
      if (optionsByBoostKey.has(keyStr)) return;
      const resolved = String(
        effectiveRollBonusAbilityDescription(ab) || "",
      ).trim();
      const adj = adjustActionRollBonusSupports(ab, {
        supportsDice: supportsAbilityBonusDice(resolved),
        supportsEffect: supportsAbilityBonusEffect(resolved),
      });
      const hasDe = !!(adj.supportsDice || adj.supportsEffect);
      const nm = String(ab.name || "").toLowerCase();
      const combined = `${nm} ${resolved.toLowerCase()}`;
      if (!healBolsterCandidateMatchesCombinedText(combined, hasDe)) return;
      push({
        key: `ability:${String(t)}:${keyStr}`,
        boostKey,
        rollKind: "ability",
        name: String(ab.name || "").trim(),
        description: resolved,
      });
    });

    heritageRollBonusOptions.forEach((hb) => {
      const desc = String(hb.description || "").toLowerCase();
      const nm = String(hb.name || "").toLowerCase();
      const combined = `${nm} ${desc}`;
      const hasDe = !!(hb.supportsDice || hb.supportsEffect);
      if (healBolsterCandidateMatchesCombinedText(combined, hasDe)) {
        const boostKey = hb.id ?? hb.name;
        push({
          key: `heritage-benefit:${boostKey}`,
          boostKey,
          rollKind: "heritage",
          name: String(hb.name || "").trim(),
          description: String(hb.description || "").trim(),
        });
      }
    });

    const hid = charData?.heritage;
    const h =
      hid != null && Array.isArray(heritages) && heritages.length
        ? heritages.find((x) => x.id === hid)
        : null;
    (h?.benefits || []).forEach((b) => {
      if (!b) return;
      const selected =
        Boolean(b.required) ||
        (Array.isArray(selectedBenefits) && selectedBenefits.includes(b.id));
      if (!selected) return;
      const hbKey = b.id ?? b.name;
      if (heritageOptionsByBoostKey.has(String(hbKey))) return;
      const desc = String(b.description || "").toLowerCase();
      const nm = String(b.name || "").toLowerCase();
      const combined = `${nm} ${desc}`;
      if (!healBolsterCandidateMatchesCombinedText(combined, false)) return;
      push({
        key: `heritage-benefit-extra:${hbKey}`,
        boostKey: hbKey,
        rollKind: "heritage",
        name: String(b.name || "").trim(),
        description: String(b.description || "").trim(),
      });
    });

    out.sort((a, b) =>
      `${a.rollKind}:${a.name}`.localeCompare(`${b.rollKind}:${b.name}`, "en"),
    );
    return out;
  }, [
    abilities,
    abilityRollBonusOptions,
    heritageRollBonusOptions,
    charData?.heritage,
    heritages,
    selectedBenefits,
    effectiveRollBonusAbilityDescription,
    supportsAbilityBonusDice,
    supportsAbilityBonusEffect,
  ]);

  const healOtherRecoveryBolsterSources = useMemo(() => {
    const keys = new Set(
      Array.isArray(healOtherRecoveryIntent.selectedBolsterKeys)
        ? healOtherRecoveryIntent.selectedBolsterKeys.map((k) => String(k))
        : [],
    );
    if (keys.size === 0) return [];
    return healBolsterAbilityCandidates
      .filter((c) => keys.has(c.key))
      .map((c) => `${c.name} (${c.rollKind})`);
  }, [
    healBolsterAbilityCandidates,
    healOtherRecoveryIntent.selectedBolsterKeys,
  ]);
  const healAttemptSelectedBoostSummary = useMemo(() => {
    const picked = [...abilityBonusAudit, ...heritageBonusAudit].map((x) =>
      String(x || "").trim(),
    );
    return picked.filter(Boolean);
  }, [abilityBonusAudit, heritageBonusAudit]);

  /**
   * Position / Effect preview only for ordinary action rolls, or heals that are
   * explicitly recover-in-play (not downtime). healAttempt must set usesSessionPositionEffect === true for that path.
   */
  const showDiceRollModalPositionEffect = useMemo(() => {
    const ht = rollPending?.healAttempt;
    const hasHealPayload = ht != null && typeof ht === "object";
    if (hasHealPayload) return ht.usesSessionPositionEffect === true;
    return true;
  }, [rollPending?.healAttempt]);

  /** Healing-clock treatment using downtime cadence — no push-for-effect per SRD frame. */
  const healAttemptIsDowntimeRecovery = useMemo(() => {
    const ht = rollPending?.healAttempt;
    return isDowntimeHealingHealAttempt(ht);
  }, [rollPending?.healAttempt]);

  useLayoutEffect(() => {
    if (!healAttemptIsDowntimeRecovery) return;
    setRollModal((prev) =>
      prev.push_effect ? { ...prev, push_effect: false } : prev,
    );
    setRippleBreathingFreePush(false);
  }, [healAttemptIsDowntimeRecovery]);

  /** Session default + push + ability/heritage steps — matches server roll_action order. */
  const rollModalPreviewEffect = useMemo(() => {
    const base =
      sessionOverridePositionEffect?.effect ||
      charCampaign?.active_session_detail?.default_effect ||
      "standard";
    const pushSteps = rollModal.push_effect ? 1 : 0;
    return bumpEffectTier(base, pushSteps + totalAbilityEffectSteps);
  }, [
    sessionOverridePositionEffect?.effect,
    charCampaign?.active_session_detail?.default_effect,
    rollModal.push_effect,
    totalAbilityEffectSteps,
  ]);

  /** Roll modal: effect-tier step list + preview label for the read-only effect preview (shown below P/E row). */
  const rollModalPositionEffectBreakdown = useMemo(() => {
    if (!showDiceRollModalPositionEffect) return null;
    const effectTierSteps = [];
    if (rollModal.push_effect) {
      effectTierSteps.push({
        key: "push-effect",
        text: "Push yourself — +1 effect tier (costs stress on roll)",
      });
    }
    abilityRollBonusOptions.forEach((ab) => {
      const id = ab.id ?? ab.name;
      const b = rollAbilityBoost[id];
      if (ab.supportsEffect && b?.effect) {
        effectTierSteps.push({
          key: `ab-eff:${id}`,
          text: `${String(ab.name || "Ability").trim()} — +1 effect tier (sheet ability)`,
        });
      }
    });
    heritageRollBonusOptions.forEach((hb) => {
      const id = hb.id ?? hb.name;
      const b = heritageRollBoost[id];
      if (hb.supportsEffect && b?.effect) {
        effectTierSteps.push({
          key: `hb-eff:${id}`,
          text: `${String(hb.name || "Heritage").trim()} — +1 effect tier (heritage benefit)`,
        });
      }
    });
    return {
      effectTierSteps,
      previewTierLabel: String(rollModalPreviewEffect || "").trim() || "—",
    };
  }, [
    showDiceRollModalPositionEffect,
    rollModal.push_effect,
    rollModalPreviewEffect,
    abilityRollBonusOptions,
    heritageRollBonusOptions,
    rollAbilityBoost,
    heritageRollBoost,
  ]);

  const gmDevilBargainText = useMemo(() => {
    const m = charCampaign?.active_session_detail?.devils_bargain_by_character;
    if (!m || characterId == null) return "";
    return String(m[String(characterId)] ?? m[characterId] ?? "").trim();
  }, [
    charCampaign?.active_session_detail?.devils_bargain_by_character,
    characterId,
  ]);

  const assignedRollGoalLabel = useMemo(() => {
    const asd = charCampaign?.active_session_detail;
    const map = asd?.roll_goal_by_character;
    if (map && characterId != null) {
      const perChar = String(map[String(characterId)] ?? map[characterId] ?? "").trim();
      if (perChar) return perChar;
    }
    return String(asd?.roll_goal_label || "").trim();
  }, [
    charCampaign?.active_session_detail,
    characterId,
  ]);

  const rollPushMode = useMemo(() => {
    if (rollModal.devil_bargain_dice) return "devil";
    if (rollModal.push_effect) return "push_effect";
    if (rollModal.push_dice) return "push_dice";
    return "none";
  }, [
    rollModal.devil_bargain_dice,
    rollModal.push_effect,
    rollModal.push_dice,
  ]);

  const assistHelpPending = useMemo(() => {
    const roster = charCampaign?.campaign_characters || [];
    const me = roster.find((c) => String(c.id) === String(characterId));
    return (
      me?.assist_help_pending ?? me?.assistHelpPending ?? null
    );
  }, [charCampaign?.campaign_characters, characterId]);

  const applyRollPushMode = useCallback(
    (mode) => {
      setDevilBargainConfirmed(false);
      if (mode === "none" || mode === "devil") {
        setRippleBreathingFreePush(false);
      }
      if (harmLevel3Used && (mode === "push_effect" || mode === "push_dice")) {
        setRippleBreathingFreePush(false);
        mode = "none";
      }
      setRollModal((prev) => {
        if (mode === "none") {
          return {
            ...prev,
            push_effect: false,
            push_dice: false,
            devil_bargain_dice: false,
            devil_bargain_note: "",
          };
        }
        if (mode === "push_effect") {
          return {
            ...prev,
            push_effect: true,
            push_dice: false,
            devil_bargain_dice: false,
            devil_bargain_note: "",
          };
        }
        if (mode === "push_dice") {
          return {
            ...prev,
            push_effect: false,
            push_dice: true,
            devil_bargain_dice: false,
            devil_bargain_note: "",
          };
        }
        const gm = gmDevilBargainText;
        return {
          ...prev,
          push_effect: false,
          push_dice: false,
          devil_bargain_dice: true,
          devil_bargain_note: gm || prev.devil_bargain_note || "",
        };
      });
    },
    [gmDevilBargainText, harmLevel3Used],
  );

  const rollPoolPreview = useMemo(() => {
    if (!rollPending || !rollActionName) return null;
    let action_rating;
    let basePool;
    if (rollPending.standRoll && rollPending.standStat) {
      basePool = computeStandRollPool(rollPending.standStat, standStats);
      action_rating = basePool;
    } else {
      const bd = computeActionPoolBreakdown(rollActionName, actionRatings);
      action_rating = bd.action_rating;
      basePool = bd.basePool;
    }
    let mod = 0;
    if (rollModal.push_dice) mod += 1;
    if (rollModal.devil_bargain_dice) mod += 1;
    mod += totalBonusDiceFromAbilitiesAndHeritage;
    mod -= heritagePenaltyDiceActive;
    const selectedPushStress =
      (rollModal.push_effect ? 2 : 0) + (rollModal.push_dice ? 2 : 0);
    const rippleWaivesPushStress =
      !rollPending.standRoll &&
      Boolean(activeSessionId) &&
      hasRippleBreathingAbility &&
      rippleBreathingFreePush &&
      !rippleBreathingFreePushClaimedThisSession &&
      (rollModal.push_dice || rollModal.push_effect);
    const waivedPushStress = rippleWaivesPushStress ? 2 : 0;
    const requiredIncapacitatedStress = harmLevel3Used ? 2 : 0;
    const phantomPainStressCost = phantomPainThroughCover ? 1 : 0;
    const pushStress =
      Math.max(0, selectedPushStress - waivedPushStress) +
      requiredIncapacitatedStress +
      phantomPainStressCost;
    return {
      action_rating,
      basePool,
      mod,
      total: basePool + mod,
      pushStress,
    };
  }, [
    rollPending,
    rollActionName,
    actionRatings,
    standStats,
    rollModal.push_dice,
    rollModal.push_effect,
    rollModal.devil_bargain_dice,
    harmLevel3Used,
    totalBonusDiceFromAbilitiesAndHeritage,
    heritagePenaltyDiceActive,
    phantomPainThroughCover,
    activeSessionId,
    hasRippleBreathingAbility,
    rippleBreathingFreePush,
    rippleBreathingFreePushClaimedThisSession,
  ]);

  useEffect(() => {
    if (rollPending && assistHelpPending)
      setIncludePendingAssistDie(true);
  }, [rollPending, assistHelpPending]);

  const actionDiceTotalAtCommit = useMemo(() => {
    if (!rollPoolPreview) return null;
    const inc =
      assistHelpPending && includePendingAssistDie ? 1 : 0;
    return rollPoolPreview.total + inc;
  }, [rollPoolPreview, assistHelpPending, includePendingAssistDie]);

  const pushStressCost = rollPoolPreview?.pushStress || 0;
  const pushWouldCauseTrauma =
    pushStressCost > 0 && stressFilled + pushStressCost > maxStress;

  useEffect(() => {
    setStressOverflowConfirmed(false);
  }, [
    rollPending,
    rollModal.push_effect,
    rollModal.push_dice,
    phantomPainThroughCover,
    harmLevel3Used,
  ]);

  useLayoutEffect(() => {
    if (!rollPending || !characterId) {
      lastScrolledRollPendingKeyRef.current = "";
      return;
    }
    const ht = rollPending.healAttempt;
    const sig = [
      String(rollPending.actionName || ""),
      Number(rollPending.diceCount),
      !!rollPending.isDesperateAction,
      rollPending.group_action_id ?? "",
      ht?.kind ?? "",
      ht?.targetId ?? "",
      ht?.usesSessionPositionEffect === true ? "1pe" : "0pe",
    ].join("|");
    if (lastScrolledRollPendingKeyRef.current === sig) return;
    lastScrolledRollPendingKeyRef.current = sig;
    const el = actionRollDicePoolPreviewElRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  }, [rollPending, characterId]);

  const handleRollWithSession = async () => {
    if (!rollPending || !characterId) return;
    setRollApiError(null);
    const asd = charCampaign?.active_session_detail;
    try {
      const goalFromDraft = (rollGoalDraft || "").trim();
      const standStatForRoll =
        rollPending.standRoll && rollPending.standStat
          ? String(rollPending.standStat).trim().toLowerCase()
          : "";
      const standSlug = standStatForRoll ? `stand_${standStatForRoll}` : "";
      const phantomStress = standSlug
        ? 0
        : phantomPainThroughCover
          ? 1
          : 0;
      const rippleEligibleForWaiver =
        !standSlug &&
        Boolean(activeSessionId) &&
        hasRippleBreathingAbility &&
        rippleBreathingFreePush &&
        !rippleBreathingFreePushClaimedThisSession &&
        (rollModal.push_dice || rollModal.push_effect);
      const feedPenaltyActive = hasNoFeedDetriment && charData.fed_today === false;
      const selectedRollAction =
        rollActionName ||
        String(rollPending.actionName || "")
          .trim()
          .toUpperCase();
      const isRecoveryTreatmentRoll = !!selectedRollAction;
      const targetName = (
        healOtherSelectedTarget?.true_name ||
        healOtherSelectedTarget?.name ||
        ""
      ).trim();
      const healIntentActive =
        isRecoveryTreatmentRoll &&
        healOtherRecoveryIntent.enabled &&
        String(healOtherRecoveryIntent.targetId || "").trim().length > 0 &&
        !!targetName;
      const healIntentIsSelf =
        healIntentActive &&
        String(healOtherRecoveryIntent.targetId) === String(characterId);
      const healIntentActionSummary = healIntentActive
        ? `Recovery action declared: ${selectedRollAction}.`
        : "";
      const healIntentSummary = healIntentActive
        ? `Recovery treatment declared: healer ${
            charData?.true_name || charData?.name || "PC"
          } -> ${targetName}${healIntentIsSelf ? " (self)" : ""}.`
        : "";
      const healIntentBolsterSummary =
        healIntentActive && healOtherRecoveryBolsterSources.length > 0
          ? `Recovery bolsters declared: ${healOtherRecoveryBolsterSources.join("; ")}.`
          : "";
      const healIntentNote = healIntentActive
        ? String(healOtherRecoveryIntent.bolsterNote || "").trim()
        : "";
      const abilityBonusesMerged = [
        ...abilityBonusAudit,
        ...(healIntentActionSummary ? [healIntentActionSummary] : []),
        ...(healIntentSummary ? [healIntentSummary] : []),
        ...(healIntentBolsterSummary ? [healIntentBolsterSummary] : []),
        ...(healIntentNote ? [`Recovery bolster note: ${healIntentNote}`] : []),
        ...(phantomStress > 0
          ? [`Phantom Pain: ${phantomStress} stress (attack through cover)`]
          : []),
        ...(rippleEligibleForWaiver
          ? [
              "Ripple Breathing: waive 2 stress for this push (once per session episode).",
            ]
          : []),
        ...(feedPenaltyActive
          ? ["Loses Max Stress Without Feeding: stress detriment active"]
          : []),
        ...(heritagePenaltyDiceActive > 0
          ? [
              `Alien Understanding: −${heritagePenaltyDiceActive}d (heritage detriment)`,
            ]
          : []),
      ];
      const modifierSources = [
        ...abilityBonusesMerged.map((name) => ({
          kind: "ability",
          name,
          category: "ability",
        })),
      ];
      const healAttemptFromRoll =
        rollPending.healAttempt && typeof rollPending.healAttempt === "object"
          ? rollPending.healAttempt
          : null;
      const bolsterStringsFromRoll =
        healAttemptFromRoll &&
        Array.isArray(healAttemptFromRoll.selectedAbilityBolsters)
          ? healAttemptFromRoll.selectedAbilityBolsters
              .map((x) => String(x || "").trim())
              .filter(Boolean)
          : [];
      const mergedHealBolsterStrings =
        bolsterStringsFromRoll.length > 0
          ? bolsterStringsFromRoll
          : healIntentActive && healOtherRecoveryBolsterSources.length > 0
            ? [...healOtherRecoveryBolsterSources]
            : [];
      const healAttemptMeta =
        healAttemptFromRoll ||
        (healIntentActive
          ? {
              kind: "session_recover_intent",
              targetName,
              bolsterNote: healOtherRecoveryIntent.bolsterNote || "",
              careNote: "",
            }
          : null);
      if (healAttemptMeta) {
        const healMetaTargetDisplay = String(
          healAttemptMeta.targetName || "",
        ).trim();
        const bolsterNote = String(healAttemptMeta.bolsterNote || "").trim();
        const careNote = String(healAttemptMeta.careNote || "").trim();
        modifierSources.push({
          kind: "healing",
          name: healMetaTargetDisplay
            ? `Heal target: ${healMetaTargetDisplay}`
            : "Heal another player",
          category: "intent",
        });
        if (mergedHealBolsterStrings.length > 0) {
          modifierSources.push({
            kind: "healing",
            name: `Ability bolsters: ${mergedHealBolsterStrings.join("; ")}`,
            category: "ability",
          });
        }
        if (bolsterNote) {
          modifierSources.push({
            kind: "healing",
            name: `Bolster note: ${bolsterNote}`,
            category: "ability",
          });
        }
        if (careNote) {
          modifierSources.push({
            kind: "healing",
            name: `Approach note: ${careNote}`,
            category: "intent",
          });
        }
        modifierSources.push({
          kind: "recovery_resolution",
          name: "GM recovery resolution needed",
          category: "recovery",
          timing: "post_roll",
          notes:
            "Apply recovery ticks to linked target per SRD cadence when fiction/time allows.",
        });
      }
      if (bonusDiceFromAbilities > 0 || bonusDiceFromHeritage > 0) {
        modifierSources.push({
          kind: "ability",
          name: "Sheet/heritage bonus dice",
          delta: `+${totalBonusDiceFromAbilitiesAndHeritage}d`,
          category: "ability",
        });
      }
      if (healIntentActive) {
        modifierSources.push({
          kind: "recovery_treatment",
          name: "Heal another player",
          delta: "declared pre-roll",
          category: "recovery",
          timing: "pre_roll",
          notes: `healer=${charData?.true_name || charData?.name || "PC"}; action=${selectedRollAction}; target=${targetName}; target_id=${healOtherRecoveryIntent.targetId}; self=${healIntentIsSelf ? "true" : "false"}`,
        });
      }
      if (healIntentActive && healOtherRecoveryBolsterSources.length > 0) {
        modifierSources.push({
          kind: "recovery_bolster",
          name: "Declared recovery bolsters",
          delta: `${healOtherRecoveryBolsterSources.length} source(s)`,
          category: "ability",
          timing: "pre_roll",
          notes: healOtherRecoveryBolsterSources.join("; "),
        });
      }
      if (healIntentActive && healIntentNote) {
        modifierSources.push({
          kind: "recovery_bolster",
          name: "Recovery bolster note",
          category: "recovery",
          timing: "pre_roll",
          notes: healIntentNote,
        });
      }
      const stressSources = [
        ...(phantomStress > 0
          ? [
              {
                kind: "ability",
                name: "Phantom Pain",
                delta: `+${phantomStress} stress`,
                category: "ability",
              },
            ]
          : []),
        ...(feedPenaltyActive
          ? [
              {
                kind: "feed_penalty",
                name: "Loses Max Stress Without Feeding",
                delta: "stress detriment active",
                category: "heritage",
              },
            ]
          : []),
      ];
      const positionEffectSources = [
        ...(rollModal.push_effect
          ? [
              {
                kind: "push",
                name: "Push for effect",
                delta: "+1 effect",
                category: "system",
              },
            ]
          : []),
        ...(totalAbilityEffectSteps > 0
          ? [
              {
                kind: "ability",
                name: "Ability/heritage effect boosts",
                delta: `+${totalAbilityEffectSteps} effect`,
                category: "ability",
              },
            ]
          : []),
      ];
      const payload = {
        action: (
          standSlug ||
          String(rollPending.actionName || rollActionName || selectedRollAction || "")
            .trim()
            .toLowerCase()
        ),
        push_effect: rollModal.push_effect,
        push_dice: rollModal.push_dice,
        devil_bargain_dice: rollModal.devil_bargain_dice,
        devil_bargain_note: rollModal.devil_bargain_note || undefined,
        devil_bargain_confirmed:
          !rollModal.devil_bargain_dice ||
          !gmDevilBargainText ||
          devilBargainConfirmed,
        bonus_dice: totalBonusDiceFromAbilitiesAndHeritage,
        ability_effect_steps: abilityEffectSteps + heritageEffectSteps,
        heritage_bonuses:
          heritageBonusAudit.length > 0 ? heritageBonusAudit : undefined,
        goal_label:
          goalFromDraft || assignedRollGoalLabel || undefined,
        ability_bonuses:
          abilityBonusesMerged.length > 0 ? abilityBonusesMerged : undefined,
        modifier_sources: modifierSources.length > 0 ? modifierSources : undefined,
        stress_sources: stressSources.length > 0 ? stressSources : undefined,
        position_effect_sources:
          positionEffectSources.length > 0 ? positionEffectSources : undefined,
        description:
          healAttemptMeta != null
            ? [
                "Healing attempt",
                String(healAttemptMeta.targetName || "").trim()
                  ? `target=${String(healAttemptMeta.targetName).trim()}`
                  : null,
                String(healAttemptMeta.bolsterNote || "").trim()
                  ? `bolster=${String(healAttemptMeta.bolsterNote).trim()}`
                  : null,
                mergedHealBolsterStrings.length > 0
                  ? `bolsters=${mergedHealBolsterStrings.join(",")}`
                  : null,
                String(healAttemptMeta.careNote || "").trim()
                  ? `note=${String(healAttemptMeta.careNote).trim()}`
                  : null,
              ]
                .filter(Boolean)
                .join(" | ")
            : undefined,
        ...(phantomStress > 0 ? { extra_roll_stress: phantomStress } : {}),
        ...(rippleEligibleForWaiver
          ? { ripple_breathing_free_push: true }
          : {}),
        ...(pushWouldCauseTrauma && stressOverflowConfirmed
          ? { stress_overflow_accepted: true }
          : {}),
        ...(standSlug
          ? {
              pool_source: "stand_coin",
              stand_stat: standStatForRoll,
            }
          : {}),
        ...(healIntentActive
          ? {
              recovery_target_character_id: Number(
                healOtherRecoveryIntent.targetId,
              ),
              recovery_roll_action: selectedRollAction.toLowerCase(),
              recovery_is_self_treatment: healIntentIsSelf,
            }
          : {}),
        ...(assistHelpPending &&
        includePendingAssistDie &&
        !(rollPending && rollPending.healAttempt)
          ? {
              assist_helper_id: Number(
                assistHelpPending.helper_character_id ??
                  assistHelpPending.helperCharacterId,
              ),
            }
          : {}),
        ...(heritagePenaltyDiceActive > 0
          ? { heritage_penalty_dice: heritagePenaltyDiceActive }
          : {}),
      };
      if (activeSessionId) {
        payload.session_id = activeSessionId;
        const snappedGa = rollPending.group_action_id;
        const rollSlugForGroup = (
          standStatForRoll
            ? `stand_${standStatForRoll}`
            : String(rollPending.actionName || rollActionName || selectedRollAction || "")
        )
          .trim()
          .toLowerCase();
        const gaSlug = String(activeGroupAction?.action_name || "")
          .trim()
          .toLowerCase();
        if (snappedGa) {
          payload.group_action_id = snappedGa;
        } else if (activeGroupAction?.id && rollSlugForGroup && gaSlug === rollSlugForGroup) {
          payload.group_action_id = activeGroupAction.id;
        }
      }
      const res = await characterAPI.rollAction(characterId, payload);
      const downtimeHealCadence = isDowntimeHealingHealAttempt(healAttemptFromRoll);
      const downtimeSelfTreatment =
        downtimeHealCadence &&
        (healIntentIsSelf ||
          Number(healAttemptFromRoll?.targetId) === Number(characterId));
      let recoveryPresentation = null;
      if (downtimeHealCadence) {
        const tickParts = downtimeHealingTicksFromApiRoll(
          res,
          downtimeSelfTreatment,
        );
        recoveryPresentation = {
          cadence: "downtime",
          ticks: tickParts.ticks,
          bandLabel: tickParts.bandLabel,
          critical: tickParts.critical,
          selfTreatment: downtimeSelfTreatment,
          targetName: String(healAttemptFromRoll?.targetName || "").trim() || null,
        };
      }
      // Advance patient healing clock using same tick count as the result UI (no duplicate paths).
      const isDowntimeRecoveryClock =
        downtimeHealCadence &&
        recoveryPresentation &&
        recoveryPresentation.ticks > 0;
      const isMidActionHealOtherClock =
        !downtimeHealCadence &&
        healIntentActive &&
        !healIntentIsSelf;
      if (isDowntimeRecoveryClock || isMidActionHealOtherClock) {
        let patientId = null;
        let segments = 0;
        if (isDowntimeRecoveryClock) {
          segments = recoveryPresentation.ticks;
          if (recoveryPresentation.selfTreatment) {
            patientId = Number(characterId);
          } else {
            const fromRoll = Number(healAttemptFromRoll?.targetId);
            if (Number.isFinite(fromRoll) && fromRoll > 0) {
              patientId = fromRoll;
            } else {
              const fromIntent = Number(healOtherRecoveryIntent.targetId);
              if (Number.isFinite(fromIntent) && fromIntent > 0) {
                patientId = fromIntent;
              }
            }
          }
        } else {
          const rolledDice = Array.isArray(res?.dice_results)
            ? res.dice_results.map((d) => Number(d)).filter(Number.isFinite)
            : [];
          const highest = Number.isFinite(Number(res?.highest))
            ? Number(res.highest)
            : rolledDice.length > 0
              ? Math.max(...rolledDice)
              : 0;
          const isCritical = rolledDice.filter((d) => d === 6).length >= 2;
          segments = isCritical
            ? 5
            : highest >= 6
              ? 3
              : highest >= 4
                ? 2
                : 1;
          patientId = Number(healOtherRecoveryIntent.targetId);
        }
        if (Number.isFinite(patientId) && patientId > 0 && segments > 0) {
          try {
            const targetRaw = await characterAPI.getCharacter(patientId);
            const targetSegCap = Math.min(
              5,
              Math.max(
                4,
                Math.floor(Number(targetRaw?.healing_clock_segments) || 4),
              ),
            );
            const targetClock = Math.max(
              0,
              Math.min(
                targetSegCap,
                Number(targetRaw?.healing_clock_filled) || 0,
              ),
            );
            const targetHarm = extractHarmFromBackendCharacter(targetRaw);
            const targetRecovery = applyRecoverySegmentsToTrack(
              targetClock,
              targetHarm,
              segments,
              targetSegCap,
            );
            await characterAPI.patchCharacter(patientId, {
              healing_clock_filled: targetRecovery.nextClock,
              ...buildHarmPatchPayload(targetRecovery.nextHarm),
            });
            onCampaignRefresh?.();
          } catch {
            setRollApiError(
              "Roll saved, but healing clock update failed. Ask the GM to apply recover ticks manually.",
            );
          }
        } else if (segments > 0) {
          setRollApiError(
            "Roll saved, but could not resolve the heal target for the healing clock. Check the target and try again, or ask the GM to update the clock.",
          );
        }
      }
      // Match roll modal + session GM map: per-PC session override beats API echo (same order as PositionStack preview).
      const effectivePosition =
        sessionOverridePositionEffect?.position ||
        res.position ||
        asd?.default_position ||
        "";
      const effectiveEffect =
        sessionOverridePositionEffect?.effect ||
        res.effect ||
        asd?.default_effect ||
        "";
      if (payload.group_action_id && res.roll_id) {
        setGroupActionRolls((prev) => {
          const withoutMine = (prev || []).filter(
            (r) => String(r.character) !== String(characterId),
          );
          return [
            {
              id: res.roll_id,
              character: characterId,
              action_name: payload.action,
              roll_type: "ACTION",
              results: res.dice_results || [],
              outcome: res.outcome || "",
              timestamp: new Date().toISOString(),
            },
            ...withoutMine,
          ];
        });
        // Source-of-truth refresh to ensure board reflects server state.
        rollAPI
          .getRolls({
            session: activeSessionId,
            group_action: payload.group_action_id,
          })
          .then((rows) =>
            setGroupActionRolls(Array.isArray(rows) ? rows : rows?.results || []),
          )
          .catch(() => {});
        onCampaignRefresh?.();
      }
      setDiceResult({
        action: selectedRollAction,
        dice: res.dice_results || [],
        result: res.highest ?? Math.max(...(res.dice_results || [0])),
        outcome: downtimeHealCadence
          ? ""
          : (res.outcome || "").replace(/_/g, " "),
        special: downtimeHealCadence
          ? ""
          : res.dice_results?.filter((d) => d === 6).length >= 2
            ? `Critical! (${res.dice_results?.filter((d) => d === 6).length} sixes)`
            : "",
        isResistance: false,
        stressCost: res.stress_spent || null,
        zeroDice: (Number(res.total_dice) || 0) === 0,
        isDesperateAction: downtimeHealCadence
          ? false
          : String(effectivePosition || "").toLowerCase() === "desperate",
        isCritical: (res.dice_results || []).filter((d) => d === 6).length >= 2,
        position: downtimeHealCadence ? undefined : effectivePosition,
        effect: downtimeHealCadence ? undefined : effectiveEffect,
        xpGained: res.xp_gained || 0,
        recoveryPresentation,
      });
      if (res.xp_gained > 0 && res.xp_track) {
        setXp((p) => {
          const key = res.xp_track;
          const next = (Number(p[key]) || 0) + Number(res.xp_gained);
          const cap = XP_TRACK_APPLY_CAP[key];
          return {
            ...p,
            [key]: cap != null ? Math.min(next, cap) : next,
          };
        });
      }
      if (res.stress_spent) applyStressCost(res.stress_spent);
      if (activeSessionId && res.roll_id) {
        setHistoryRefreshTick((x) => x + 1);
      }
      setRollPending(null);
      setRollGoalDraft("");
      setDevilBargainConfirmed(false);
      setRollModal((p) => ({
        ...p,
        devil_bargain_dice: false,
        devil_bargain_note: "",
      }));
      setRollAbilityBoost({});
      setHeritageRollBoost({});
      setPhantomPainThroughCover(false);
      setRippleBreathingFreePush(false);
      setHealOtherRecoveryIntent({
        enabled: false,
        actionName: "TINKER",
        targetId: "",
        selectedBolsterKeys: [],
        bolsterNote: "",
      });
    } catch (e) {
      setRollApiError(e.message);
    }
  };

  const hasIronWillAbility = useMemo(
    () => characterHasIronWill(abilities),
    [abilities],
  );

  const resistanceAbilityOptions = useMemo(() => {
    const opts = [];
    if (hasIronWillAbility) {
      opts.push({
        id: "iron-will",
        name: "Iron Will",
        bonusDice: 1,
        appliesTo: "RESOLVE",
        sourceType: "standard",
      });
    }
    const hasSuperiorPhysiology = heritageAutoAbilities.some(
      (a) => normalizeAbilityName(a?.name) === "superior physiology",
    );
    if (hasSuperiorPhysiology) {
      opts.push({
        id: "superior-physiology",
        name: "Superior Physiology",
        bonusDice: 1,
        appliesTo: "PROWESS",
        sourceType: "heritage",
        description: "+1d to resisting physical harm.",
      });
    }
    const stayingPower = combinedAbilitiesForDisplay.find(
      (a) => normalizeAbilityName(a?.name) === "staying power",
    );
    if (stayingPower) {
      opts.push({
        id: "staying-power",
        name: "Staying Power",
        bonusDice: 0,
        appliesTo: "ALL",
        sourceType: stayingPower.type || "standard",
        mitigationOnly: true,
        description:
          String(stayingPower.description || "").trim() ||
          "May help reduce or absorb harm after resistance (table ruling).",
      });
    }
    if (hasRippleBreathingAbility) {
      opts.push({
        id: "ripple-breathing",
        name: "Ripple Breathing",
        bonusDice: 1,
        appliesTo: "ALL",
        sourceType: "hamon",
        description:
          "+1d when resisting poison, fatigue, or fear (fiction must apply — GM/table confirms).",
      });
    }
    return opts;
  }, [
    combinedAbilitiesForDisplay,
    hasIronWillAbility,
    hasRippleBreathingAbility,
    heritageAutoAbilities,
  ]);

  const hasFatalHarm = useMemo(
    () => !!String(harm?.level4?.[0] ?? "").trim(),
    [harm],
  );
  const hasStayingPowerAbility = useMemo(
    () => resistanceAbilityOptions.some((o) => o.id === "staying-power"),
    [resistanceAbilityOptions],
  );

  useEffect(() => {
    if (!hasStayingPowerAbility) return;
    if (hasFatalHarm) {
      setResistanceAbilityBoost((prev) =>
        prev?.["staying-power"]
          ? prev
          : { ...(prev || {}), "staying-power": true },
      );
    } else {
      setResistanceAbilityBoost((prev) => {
        if (!prev?.["staying-power"]) return prev;
        const next = { ...prev };
        delete next["staying-power"];
        return next;
      });
    }
  }, [hasFatalHarm, hasStayingPowerAbility]);

  const resistancePoolPreview = useMemo(() => {
    if (!resistancePending) return null;
    const attr = String(resistancePending.attr || "").toUpperCase();
    const modeStandDur =
      resistancePending.mode === "stand_durability" ? true : false;
    const base = Math.max(0, Number(resistancePending.baseDice) || 0);
    const options = resistanceAbilityOptions.filter((opt) => {
      const appliesTo = String(opt.appliesTo || "").toUpperCase();
      if (modeStandDur) {
        return appliesTo === "ALL";
      }
      return appliesTo === "ALL" || appliesTo === attr;
    });
    const activeBonusOptions = options.filter(
      (opt) =>
        !!resistanceAbilityBoost[opt.id] &&
        Math.max(0, Number(opt.bonusDice) || 0) > 0,
    );
    const bonusDice = activeBonusOptions.reduce(
      (sum, opt) => sum + Math.max(0, Number(opt.bonusDice) || 0),
      0,
    );
    const pushBonusDice = resistancePushDice ? 1 : 0;
    const extraStress = resistancePushDice ? 2 : 0;
    return {
      attr,
      base,
      bonusDice,
      pushBonusDice,
      extraStress,
      total: base + bonusDice + pushBonusDice,
      zeroDice: base + bonusDice + pushBonusDice <= 0,
      options,
      activeBonusNames: activeBonusOptions.map(
        (opt) => `${opt.name} (+${Math.max(0, Number(opt.bonusDice) || 0)}d)`,
      ),
      hasPostRollOptions: options.some((opt) => !!opt.mitigationOnly),
      modeStandDurability: resistancePending.mode === "stand_durability",
    };
  }, [
    resistancePending,
    resistanceAbilityOptions,
    resistanceAbilityBoost,
    resistancePushDice,
  ]);

  const resistanceRollSheetReminderItems = useMemo(() => {
    if (
      !diceResult?.isResistance ||
      !Array.isArray(diceResult.dice)
    ) {
      return [];
    }
    return getResistanceResultSheetAbilityReminders(
      abilities,
      diceResult.dice,
    );
  }, [diceResult, abilities]);

  // FIX 8: Resistance critical → stressCost = -1 (clear 1 stress, pay none)
  /**
   * @param {unknown} [groupActionIdSnap] If set, POST includes this group_action_id even if activeGroupAction is cleared before submit.
   * @param {{ resistanceBonusNote?: string }} [extras] Extra display only (e.g. Iron Will note on resistance).
   */
  const rollDice = async (
    actionName,
    diceCount,
    isResistance = false,
    isDesperateAction = false,
    groupActionIdSnap = undefined,
    extras,
  ) => {
    if (characterId && !isResistance) {
      const rawExtras = extras && typeof extras === "object" ? extras : {};
      const { rollBoostPreset, ...rollPendingExtras } = rawExtras;
      const goalTargetName =
        extras &&
        typeof extras === "object" &&
        extras.healAttempt &&
        String(extras.healAttempt.targetName || "").trim();
      const anLower = String(actionName ?? "").trim().toLowerCase();
      const standM = /^stand_(power|speed|precision)$/.exec(anLower);
      const derivedStandStat = standM ? standM[1] : "";
      setResistancePending(null);
      setRollPending({
        actionName: derivedStandStat ? `stand_${derivedStandStat}` : actionName,
        diceCount: derivedStandStat
          ? computeStandRollPool(derivedStandStat, standStats)
          : diceCount,
        isDesperateAction,
        ...rollPendingExtras,
        ...(derivedStandStat
          ? { standRoll: true, standStat: derivedStandStat }
          : {}),
        ...(groupActionIdSnap != null
          ? { group_action_id: groupActionIdSnap }
          : {}),
      });
      const preset =
        rollBoostPreset && typeof rollBoostPreset === "object"
          ? rollBoostPreset
          : null;
      setRollAbilityBoost(
        preset?.abilities && typeof preset.abilities === "object"
          ? preset.abilities
          : {},
      );
      setHeritageRollBoost(
        preset?.heritage && typeof preset.heritage === "object"
          ? preset.heritage
          : {},
      );
      setPhantomPainThroughCover(false);
      setRippleBreathingFreePush(false);
      setDevilBargainConfirmed(false);
      const asdGoal = (
        assignedRollGoalLabel || ""
      ).trim();
      setRollGoalDraft(
        asdGoal ||
          (goalTargetName ? `Heal ${goalTargetName}'s harm` : ""),
      );
      setRollModal({
        push_effect: false,
        push_dice: false,
        devil_bargain_dice: false,
        devil_bargain_note: "",
      });
      setHealOtherRecoveryIntent({
        enabled: false,
        actionName: "TINKER",
        targetId: "",
        selectedBolsterKeys: [],
        bolsterNote: "",
      });
      setRollApiError(null);
      return;
    }

    if (isResistance) {
      setResistancePending(null);
      setResistancePushDice(false);
      setResistanceMitigationChoice("");
      setPhantomPainThroughCover(false);
      setRippleBreathingFreePush(false);
    }

    const healAttemptOffline =
      extras &&
      typeof extras === "object" &&
      extras.healAttempt &&
      typeof extras.healAttempt === "object"
        ? extras.healAttempt
        : null;
    const offlineDowntimeHeal =
      !isResistance && isDowntimeHealingHealAttempt(healAttemptOffline);

    let dice, highest, sixes, isCritical, outcome;

    if (isResistance) {
      if (diceCount === 0) {
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        highest = Math.min(d1, d2);
        dice = [d1, d2];
      } else {
        dice = Array.from(
          { length: diceCount },
          () => Math.floor(Math.random() * 6) + 1,
        );
        highest = Math.max(...dice);
      }
      sixes = dice.filter((d) => d === 6).length;
      isCritical = sixes >= 2;
      outcome =
        highest >= 6
          ? isCritical
            ? "Critical Success"
            : "Success"
          : highest >= 4
            ? "Partial Success"
            : "Failure";
    } else {
      if (diceCount === 0) {
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        dice = [d1, d2];
      } else {
        dice = Array.from(
          { length: diceCount },
          () => Math.floor(Math.random() * 6) + 1,
        );
      }
      sixes = dice.filter((d) => d === 6).length;
      const an = String(actionName ?? "").trim();
      const standM = /^stand_(power|speed|precision|durability)$/.exec(
        an.toLowerCase(),
      );
      const arForTier = standM
        ? computeStandRollPool(standM[1], standStats)
        : computeActionPoolBreakdown(an, actionRatings).action_rating;
      const apiOut = outcomeFromActionRoll(dice, diceCount, arForTier);
      isCritical = apiOut === "CRITICAL_SUCCESS";
      highest = tierDieFromActionPool(dice, diceCount, arForTier);
      outcome = offlineDowntimeHeal ? "" : outcomeApiToSheetDisplay(apiOut);
    }

    /** Resistance: 6 − highest (a 6 costs 0). Two 6s: pay 0 and clear 1 (−1 sentinel). */
    const stressCost = isResistance
      ? isCritical
        ? -1
        : Math.max(0, 6 - highest)
      : null;
    const resistanceExtraStress =
      isResistance &&
      extras &&
      typeof extras === "object" &&
      Number(extras.resistanceExtraStress) > 0
        ? Number(extras.resistanceExtraStress)
        : 0;
    const resistanceTotalStressCost =
      isResistance ? Math.max(0, Number(stressCost) || 0) + resistanceExtraStress : null;

    const resistanceNote =
      extras &&
      typeof extras === "object" &&
      String(extras.resistanceBonusNote || "").trim();
    const criticalPart = isCritical ? `Critical! (${sixes} sixes)` : "";
    const special =
      resistanceNote && criticalPart
        ? `${criticalPart} · ${resistanceNote}`
        : resistanceNote || criticalPart;

    const offlineDowntimeSelfTreatment =
      offlineDowntimeHeal &&
      Number(healAttemptOffline?.targetId) === Number(characterId);
    const offlineRecoveryPresentation = offlineDowntimeHeal
      ? (() => {
          const tickParts = downtimeHealingTicksFromApiRoll(
            { dice_results: dice, highest },
            offlineDowntimeSelfTreatment,
          );
          return {
            cadence: "downtime",
            ticks: tickParts.ticks,
            bandLabel: tickParts.bandLabel,
            critical: tickParts.critical,
            selfTreatment: offlineDowntimeSelfTreatment,
            targetName:
              String(healAttemptOffline?.targetName || "").trim() || null,
          };
        })()
      : null;

    const durabilityStandResistance =
      isResistance &&
      extras &&
      typeof extras === "object" &&
      extras.durabilityStandResistance;
    const activeResistanceSources = isResistance
      ? resistanceAbilityOptions.filter((opt) => {
          if (
            durabilityStandResistance &&
            String(opt.appliesTo || "").toUpperCase() !== "ALL"
          ) {
            return false;
          }
          if (!resistanceAbilityBoost[opt.id]) return false;
          if (opt.appliesTo === "ALL") return true;
          return String(opt.appliesTo || "").toUpperCase() === String(actionName || "").toUpperCase();
        })
      : [];

    const resistanceSourceRows = activeResistanceSources.map((opt) => ({
      kind: "ability",
      name: opt.name,
      delta: opt.bonusDice > 0 ? `+${opt.bonusDice}d` : "mitigation option",
      category: String(opt.sourceType || "ability"),
      timing: opt.mitigationOnly ? "post_roll" : "pre_roll",
    }));
    if (isResistance && resistanceMitigationChoice) {
      resistanceSourceRows.push({
        kind: "ability",
        name: resistanceMitigationChoice,
        delta: "mitigation used",
        category: "ability",
        timing: "post_roll",
      });
    }
    if (isResistance && resistancePushDice) {
      resistanceSourceRows.push({
        kind: "push",
        name: "Push yourself",
        delta: "+1d",
        category: "system",
        timing: "pre_roll",
      });
    }
    if (isResistance && hasNoFeedDetriment && charData.fed_today === false) {
      resistanceSourceRows.push({
        kind: "feed_penalty",
        name: "Loses Max Stress Without Feeding",
        delta: "stress detriment active",
        category: "heritage",
        timing: "ongoing",
      });
    }

    const asdOffline = charCampaign?.active_session_detail;
    const offlinePosLabel = String(
      sessionOverridePositionEffect?.position ||
        asdOffline?.default_position ||
        "",
    ).toLowerCase();
    const offlineEffLabel = String(
      sessionOverridePositionEffect?.effect ||
        asdOffline?.default_effect ||
        "",
    ).toLowerCase();
    const sessionSaysDesperate =
      !!activeSessionId && offlinePosLabel === "desperate";
    const effectiveDesperateAction =
      !isResistance &&
      !offlineDowntimeHeal &&
      (sessionSaysDesperate || !!isDesperateAction);

    setDiceResult({
      action: actionName,
      dice,
      result: highest,
      outcome: offlineDowntimeHeal ? "" : outcome,
      special: offlineDowntimeHeal ? "" : special,
      isResistance,
      stressCost,
      resistanceExtraStress,
      resistanceTotalStressCost,
      zeroDice: diceCount === 0,
      isDesperateAction: effectiveDesperateAction,
      isCritical,
      resistanceSources: isResistance ? resistanceSourceRows : [],
      ...(!isResistance && activeSessionId && !offlineDowntimeHeal
        ? { position: offlinePosLabel || undefined, effect: offlineEffLabel || undefined }
        : {}),
      ...(offlineRecoveryPresentation
        ? { recoveryPresentation: offlineRecoveryPresentation }
        : {}),
      ...(isResistance
        ? {
            resistanceHarmReductionCount: 0,
            resistanceApplied: false,
          }
        : {}),
    });
    setResistanceApplyErr(null);
    setResistanceHarmTarget("");

    if (effectiveDesperateAction) {
      const attr = ACTION_ATTR[String(actionName || "").toUpperCase()];
      if (attr)
        setXp((p) =>
          (p[attr] ?? 0) >= 5
            ? p
            : { ...p, [attr]: Math.min((p[attr] || 0) + 1, 5) },
        );
    }
    if (isResistance && characterId && activeSessionId) {
      const outcomeApi = isCritical
        ? "CRITICAL_SUCCESS"
        : highest >= 6
          ? "FULL_SUCCESS"
          : highest >= 4
            ? "PARTIAL_SUCCESS"
            : "FAILURE";
      try {
        await rollAPI.createRoll({
          character: characterId,
          session: activeSessionId,
          roll_type: "RESISTANCE",
          action_name:
            extras &&
            typeof extras === "object" &&
            extras.durabilityStandResistance
              ? "stand_durability"
              : String(actionName || "").toLowerCase(),
          dice_pool: diceCount,
          results: dice,
          outcome: outcomeApi,
          description: `Resistance ${String(actionName || "").toLowerCase()} roll`,
          pool_bonus_dice: activeResistanceSources.reduce(
            (sum, opt) => sum + Math.max(0, Number(opt.bonusDice) || 0),
            0,
          ),
          roller_stress_spent: Math.max(
            0,
            Number(resistanceTotalStressCost) || 0,
          ),
          modifier_sources: resistanceSourceRows,
          stress_sources: [
            ...(stressCost > 0
              ? [
                  {
                    kind: "resistance",
                    name: "Resistance stress cost",
                    delta: `+${stressCost} stress`,
                    category: "system",
                  },
                ]
              : []),
            ...(resistanceExtraStress > 0
              ? [
                  {
                    kind: "push",
                    name: "Push yourself",
                    delta: `+${resistanceExtraStress} stress`,
                    category: "system",
                  },
                ]
              : []),
            ...resistanceSourceRows.filter((x) => x.kind === "feed_penalty"),
          ],
          position_effect_sources: [],
        });
        // Server applies resistance stress on create — mirror locally with truth
        // lock, no field touch (autosave must omit stress).
        const spent = Math.max(0, Number(resistanceTotalStressCost) || 0);
        if (spent > 0) {
          setStressFilled((prev) => {
            const next = Math.min(maxStress, (Number(prev) || 0) + spent);
            stressTraumaTruthRef.current = {
              stressFilled: next,
              trauma: stressTraumaTruthRef.current?.trauma || null,
            };
            onCharacterStressTraumaSync?.({ stressFilled: next });
            return next;
          });
        }
        onCampaignRefresh?.();
      } catch (_) {
        // History save failed — still apply stress locally with truth lock (no touch).
        const spent = Math.max(0, Number(resistanceTotalStressCost) || 0);
        if (spent > 0) {
          applyStressCost(spent);
        }
      }
    }
  };

  const openResistanceRollPreview = (attr, actions) => {
    const base = Math.max(0, Number(getAttributeDice(actions)) || 0);
    setRollPending(null);
    setRollApiError(null);
    setResistanceApplyErr(null);
    setResistanceHarmTarget("");
    setResistancePushDice(false);
    setResistancePending({
      attr: String(attr || "").toUpperCase(),
      baseDice: base,
      mode: "attribute",
    });
  };

  const openStandActionRollPreview = useCallback(
    (standStat) => {
      const ss = String(standStat || "").trim().toLowerCase();
      if (!STAND_ROLL_KEYS_ACTIVE.includes(ss)) return;
      setResistancePending(null);
      setResistanceApplyErr(null);
      setResistanceHarmTarget("");
      setResistancePushDice(false);
      setRollApiError(null);
      const n = computeStandRollPool(ss, standStats);
      setRollPending({
        actionName: `stand_${ss}`,
        diceCount: n,
        standRoll: true,
        standStat: ss,
        isDesperateAction: false,
      });
      setRollAbilityBoost({});
      setHeritageRollBoost({});
      setPhantomPainThroughCover(false);
      setRippleBreathingFreePush(false);
      setDevilBargainConfirmed(false);
      setStressOverflowConfirmed(false);
      const asdGoal = (assignedRollGoalLabel || "").trim();
      setRollGoalDraft(asdGoal);
      setRollModal({
        push_effect: false,
        push_dice: false,
        devil_bargain_dice: false,
        devil_bargain_note: "",
      });
      setHealOtherRecoveryIntent({
        enabled: false,
        actionName: "TINKER",
        targetId: "",
        selectedBolsterKeys: [],
        bolsterNote: "",
      });
    },
    [standStats, assignedRollGoalLabel],
  );

  const openStandDurabilityResistancePreview = useCallback(() => {
    setRollPending(null);
    setRollApiError(null);
    setResistanceApplyErr(null);
    setResistanceHarmTarget("");
    setResistancePushDice(false);
    setResistanceMitigationChoice("");
    setResistanceAbilityBoost({});
    const baseDice = computeStandRollPool("durability", standStats);
    setResistancePending({
      attr: "STAND durability",
      baseDice,
      mode: "stand_durability",
    });
  }, [standStats]);

  const addClock = () => {
    const name = String(newClockName || "").trim();
    const segs = Number(newClockSegments);
    if (!name || !Number.isFinite(segs)) return;
    const boundedSegments = clampClockSegments(segs);
    setClocks((p) => [
      ...p,
      {
        id: `pc-clock-${Date.now()}`,
        name,
        segments: boundedSegments,
        max_segments: boundedSegments,
        filled: 0,
        filled_segments: 0,
        visible_to_party: !!newClockShared,
      },
    ]);
    setNewClockName("");
    setNewClockSegments(4);
    setNewClockShared(false);
    setClockEditorOpen(false);
  };

  const resizeClockSegments = useCallback((clockId, rawSegments) => {
    const nextSegs = clampClockSegments(rawSegments);
    let filledForApi = 0;
    setClocks((p) =>
      p.map((c) => {
        if (c.id !== clockId) return c;
        const filled = clampClockFilled(c.filled ?? c.filled_segments, nextSegs);
        filledForApi = filled;
        return {
          ...c,
          segments: nextSegs,
          max_segments: nextSegs,
          filled,
          filled_segments: filled,
        };
      }),
    );
    if (isPersistedProgressClockId(clockId)) {
      progressClockAPI
        .updateProgressClock(clockId, {
          max_segments: nextSegs,
          filled_segments: filledForApi,
        })
        .catch(() => {});
    }
  }, []);

  const addPerfectOrganismEntityClock = useCallback((sizeLabel, segments) => {
    const segs = clampClockSegments(segments);
    const stamp = Date.now();
    setClocks((p) => [
      ...p,
      {
        id: `po-${stamp}-${Math.random().toString(16).slice(2, 8)}`,
        name: `Perfect Organism — ${sizeLabel}`,
        segments: segs,
        filled: 0,
        visible_to_party: false,
      },
    ]);
    setClocksSectionExpandedPersist(true);
  }, [setClocksSectionExpandedPersist]);

  const buildPayload = useCallback(() => {
    const backendId =
      character?.id != null &&
      Number.isInteger(Number(character.id)) &&
      Number(character.id) > 0 &&
      Number(character.id) < 1e10
        ? character.id
        : null;
    return {
      ...charData,
      standStats,
      actionRatings,
      stressFilled,
      trauma,
      standArmorUsed,
      hasPhysicalArmorItem: inventoryHasArmor,
      physicalArmorBonusCharges: inventoryArmorCharges,
      physicalArmorUsed: inventoryHasArmor ? physicalArmorUsed : 0,
      spinArmorUsed,
      hamonArmorUsed,
      specialArmorUsed: inventoryHasSpecial ? specialArmorUsed : 0,
      harm,
      healingClock,
      healingClockSegments,
      coinFilled,
      stash: stashBoxes,
      xp,
      unallocatedXp,
      abilities,
      clocks,
      playbook,
      secondaryPlaybook: "",
      playbookXpArchetypes,
      standType,
      standTypeCustom,
      standForms,
      standConsciousness,
      campaign: campaignId || null,
      image_url: imageUrl,
      ...(removeImageRequested ? { image: null } : {}),
      id: backendId,
      lastModified: new Date().toISOString(),
      selected_benefits: selectedBenefits,
      selected_detriments: selectedDetriments,
      hasXpAllocations: xpAllocationRows.length > 0,
      _fieldTouches: { ...fieldTouchRef.current },
    };
  }, [
    charData,
    standStats,
    actionRatings,
    stressFilled,
    trauma,
    standArmorUsed,
    inventoryHasArmor,
    inventoryArmorCharges,
    physicalArmorUsed,
    spinArmorUsed,
    hamonArmorUsed,
    inventoryHasSpecial,
    specialArmorUsed,
    harm,
    healingClock,
    healingClockSegments,
    coinFilled,
    stashBoxes,
    xp,
    unallocatedXp,
    abilities,
    clocks,
    playbook,
    playbookXpArchetypes,
    standType,
    standTypeCustom,
    standForms,
    standConsciousness,
    campaignId,
    imageUrl,
    removeImageRequested,
    character?.id,
    selectedBenefits,
    selectedDetriments,
    xpAllocationRows,
  ]);

  const buildPayloadRef = useRef(buildPayload);
  buildPayloadRef.current = buildPayload;

  useEffect(() => {
    if (!onDraftMetaChange) return;
    const payload = buildPayload();
    const { lastModified, _fieldTouches, ...rest } = payload;
    const payloadKey = JSON.stringify(rest);
    if (payload.id && lastSavedPayloadRef.current == null) {
      lastSavedPayloadRef.current = payloadKey;
    }
    const isDirty = !payload.id
      ? hasMeaningfulDraftChanges(payload)
      : payloadKey !== (lastSavedPayloadRef.current ?? "");
    // dirtyIntent only covers edit→meta gap (set sync in handlers). After this
    // pass evaluates isDirty, clear unconditionally — protect continues via isDirty.
    dirtyIntentRef.current = false;
    if (dirtyIntentFallbackTimerRef.current) {
      clearTimeout(dirtyIntentFallbackTimerRef.current);
      dirtyIntentFallbackTimerRef.current = null;
    }
    const meta = {
      payload,
      isNewCharacter: !payload.id,
      isDirty,
      isSaving: saveStatus === "saving",
      dirtyIntent: false,
    };
    lastDraftMetaRef.current = meta;
    onDraftMetaChange(meta);
  }, [onDraftMetaChange, buildPayload, saveStatus]);

  // Debounced auto-save (busy-collision queues via pendingResaveRef; drain rebuilds payload fresh)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    draftGenRef.current += 1;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!onSave || !canEditSheet) return;
      if (levelUpInFlightRef.current) return;
      if (markPcAutosaveBusyCollision(savingRef.current, pendingResaveRef)) {
        return;
      }
      if (heritagesLoading || heritages.length === 0) return;
      if (
        typeof charData.heritage !== "number" ||
        !Number.isFinite(charData.heritage)
      )
        return;

      const runSave = async (payloadOverride) => {
        const myGen = draftGenRef.current;
        // Always prefer live builder (drain must not reuse busy-time snapshot).
        const payload =
          payloadOverride ?? buildPayloadRef.current();
        // Never create a new character via autosave when viewing a character that
        // belongs to another user. A null id with a known owner means the character
        // data came from someone else's sheet — creating it would assign ownership
        // to the currently logged-in user (e.g. a GM claiming a player's character).
        if (
          !payload.id &&
          character?.user_id !== null &&
          character?.user_id !== undefined &&
          character.user_id !== user?.id
        )
          return;
        if (!payload.id && !hasMeaningfulDraftChanges(payload)) {
          return;
        }
        // Superseded by a newer draft — do not PUT/PATCH stale abilities (would wipe customs).
        if (myGen !== draftGenRef.current) {
          pendingResaveRef.current = true;
          return;
        }
        // Skip save if payload matches last saved (prevents loop from server response overwriting fields)
        const { lastModified, _fieldTouches, ...rest } = payload;
        const payloadKey = JSON.stringify(rest);
        if (lastSavedPayloadRef.current === payloadKey) {
          return;
        }
        savingRef.current = true;
        setSaveStatus("saving");
        try {
          // Re-check after debounce/busy gaps: another edit may have landed.
          if (myGen !== draftGenRef.current) {
            pendingResaveRef.current = true;
            setSaveStatus(null);
            return;
          }
          // Re-check immediately before network — allocation may have bumped draftGen.
          if (myGen !== draftGenRef.current) {
            pendingResaveRef.current = true;
            setSaveStatus(null);
            savingRef.current = false;
            return;
          }
          if (autosaveAbortRef.current) {
            autosaveAbortRef.current.abort();
          }
          const abortController = new AbortController();
          autosaveAbortRef.current = abortController;
          try {
            await onSave(payload, { signal: abortController.signal });
          } catch (err) {
            if (err?.name === "AbortError") {
              setSaveStatus(null);
              return;
            }
            throw err;
          } finally {
            if (autosaveAbortRef.current === abortController) {
              autosaveAbortRef.current = null;
            }
          }
          // Clear touch flags only for fields this save included.
          // Inventory touch stays until character.inventory catches up (see
          // notes/inventory sync effect) — clearing early lets a stale prop
          // restore deleted kit rows.
          const touches = payload._fieldTouches || {};
          if (touches.stress) fieldTouchRef.current.stress = false;
          if (touches.trauma) fieldTouchRef.current.trauma = false;
          if (touches.xp) fieldTouchRef.current.xp = false;
          if (touches.healingClock) fieldTouchRef.current.healingClock = false;
          // Re-assert only fields this save included. A clock autosave that
          // omitted stress must not push a stale truth-lock count over the
          // server echo (GM unmark / concurrent roll marks).
          if (stressTraumaTruthRef.current && (touches.stress || touches.trauma)) {
            const truth = stressTraumaTruthRef.current;
            onCharacterStressTraumaSync?.({
              ...(touches.stress
                ? { stressFilled: truth.stressFilled }
                : {}),
              ...(touches.trauma && truth.trauma
                ? { trauma: truth.trauma }
                : {}),
            });
          }
          // Ignore stale in-flight saves that finished after newer local edits
          // (e.g. trauma-clear while a max-stress PUT was still running).
          if (myGen === draftGenRef.current) {
            lastSavedPayloadRef.current = payloadKey;
          } else {
            pendingResaveRef.current = true;
          }
          if (removeImageRequested) setRemoveImageRequested(false);
          setSaveStatus("saved");
          setSaveErrorMessage(null);
          setTimeout(
            () => setSaveStatus((s) => (s === "saved" ? null : s)),
            2000,
          );
        } catch (err) {
          setSaveStatus("error");
          setSaveErrorMessage(err?.message || "Save failed");
        } finally {
          savingRef.current = false;
          schedulePcPendingResaveDrain({
            pendingResaveRef,
            savingRef,
            buildPayload: () => buildPayloadRef.current(),
            runSaveWithPayload: (freshPayload) => {
              void runSave(freshPayload);
            },
            onPendingTaken: () => {
              draftGenRef.current += 1;
            },
          });
        }
      };

      await runSave();
    }, 1500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    charData,
    standStats,
    actionRatings,
    stressFilled,
    trauma,
    standArmorUsed,
    inventoryHasArmor,
    inventoryArmorCharges,
    physicalArmorUsed,
    spinArmorUsed,
    hamonArmorUsed,
    inventoryHasSpecial,
    inventorySpecialCount,
    specialArmorUsed,
    harm,
    healingClock,
    healingClockSegments,
    coinFilled,
    stashBoxes,
    xp,
    unallocatedXp,
    abilities,
    clocks,
    playbook,
    playbookXpArchetypes,
    standType,
    standTypeCustom,
    standForms,
    standConsciousness,
    campaignId,
    imageUrl,
    removeImageRequested,
    selectedBenefits,
    selectedDetriments,
    character?.id,
    canEditSheet,
    heritages,
    heritagesLoading,
  ]);

  // ─── Styles ──────────────────────────────────────────────────────────────────

  const S = {
    page: {
      fontFamily: "var(--font-mono, monospace)",
      fontSize: "13px",
      background: "var(--bg-page)",
      color: "var(--text-primary)",
      minHeight: "100vh",
    },
    hdr: {
      background: "var(--bg-header)",
      padding: "8px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: "8px",
      borderBottom: "2px solid var(--border)",
      position: "sticky",
      top: 0,
      zIndex: 10,
    },
    card: {
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: "4px",
      padding: "12px",
      marginBottom: "12px",
    },
    lbl: {
      color: "var(--sheet-label)",
      fontSize: "11px",
      fontWeight: "bold",
      marginBottom: "4px",
      display: "block",
    },
    inp: {
      background: "transparent",
      color: "var(--text-primary)",
      border: "none",
      borderBottom: "1px solid var(--border)",
      padding: "2px 4px",
      width: "100%",
      minWidth: 0,
      maxWidth: "100%",
      fontFamily: "var(--font-mono, monospace)",
      fontSize: "13px",
      outline: "none",
      boxSizing: "border-box",
    },
    sel: {
      background: "var(--hftf-panel)",
      color: "var(--text-primary)",
      border: "1px solid var(--border)",
      padding: "4px 8px",
      fontSize: "12px",
      fontFamily: "var(--font-mono, monospace)",
    },
    select: {
      background: "var(--hftf-deep)",
      color: "var(--text-primary)",
      border: "1px solid var(--border)",
      borderRadius: "4px",
      padding: "4px 8px",
      fontSize: "12px",
      fontFamily: "var(--font-mono, monospace)",
      width: "100%",
    },
    btn: {
      padding: "4px 12px",
      borderRadius: "4px",
      fontSize: "12px",
      cursor: "pointer",
      border: "none",
      fontFamily: "var(--font-mono, monospace)",
    },
    btnPrimary: {
      padding: "6px 14px",
      borderRadius: "4px",
      fontSize: "12px",
      cursor: "pointer",
      border: "none",
      fontFamily: "var(--font-mono, monospace)",
      background: "var(--hftf-purple)",
      color: "#fff",
    },
    btnGhost: {
      padding: "6px 14px",
      borderRadius: "4px",
      fontSize: "12px",
      cursor: "pointer",
      border: "none",
      fontFamily: "var(--font-mono, monospace)",
      background: "var(--hftf-panel)",
      color: "var(--hftf-text-dim)",
    },
    g2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" },
    g3: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" },
    warn: {
      background: "#7f1d1d",
      border: "1px solid #b91c1c",
      borderRadius: "4px",
      padding: "4px 8px",
      fontSize: "11px",
      color: "#fca5a5",
    },
    info: {
      background: "#1e1b4b",
      border: "1px solid #4338ca",
      borderRadius: "4px",
      padding: "4px 8px",
      fontSize: "11px",
      color: "#a5b4fc",
    },
    gold: {
      background: "var(--hftf-deep)",
      border: "1px solid var(--hftf-orange)",
      borderRadius: "4px",
      padding: "6px 10px",
      fontSize: "11px",
      color: "var(--hftf-gold)",
    },
    green: {
      background: "#14532d",
      border: "1px solid #166534",
      borderRadius: "4px",
      padding: "4px 8px",
      fontSize: "11px",
      color: "#86efac",
    },
    planned: {
      border: "1px dashed var(--sheet-ghost)",
      color: "var(--sheet-ghost-text)",
    },
    plannedBlocked: {
      border: "1px dashed #b91c1c",
      color: "#fca5a5",
    },
  };

  const dotColor =
    dotsRemaining === 0
      ? "#f87171"
      : dotsRemaining <= 2
        ? "#eab308"
        : "var(--text-dim)";

  const playerHeaderSubtitle =
    activeMode === "CHARACTER MODE"
      ? "PLAYER — CHARACTER SHEET"
      : "PLAYER — CREW SHEET";

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>
      {xpActionToast?.message ? (
        <div
          role="status"
          style={{
            position: "fixed",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 400,
            maxWidth: "min(560px, 92vw)",
            padding: "10px 14px",
            borderRadius: 8,
            fontFamily: "monospace",
            fontSize: 12,
            lineHeight: 1.35,
            boxShadow: "0 10px 28px rgba(0,0,0,0.55)",
            border:
              xpActionToast.kind === "err"
                ? "1px solid #f87171"
                : "1px solid #818cf8",
            background:
              xpActionToast.kind === "err" ? "#450a0a" : "#1e1b4b",
            color: xpActionToast.kind === "err" ? "#fecaca" : "#e0e7ff",
          }}
        >
          {xpActionToast.message}
        </div>
      ) : null}
      {/* ── Header ── */}
      <div style={S.hdr}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              color: "var(--text-primary)",
            }}
          >
            1(800)BIZARRE
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>◆</span>
          <span
            style={{
              fontSize: "14px",
              color: "var(--text-muted)",
              fontWeight: "bold",
            }}
          >
            {playerHeaderSubtitle}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {characterId && (
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={saveStatus === "saving" || exportPdfStatus === "exporting"}
              style={S.btnGhost}
              title="Download fillable PDF of this character sheet"
            >
              {exportPdfStatus === "exporting" ? "Exporting…" : "Export PDF"}
            </button>
          )}
          {exportPdfStatus === "error" && (
            <span
              style={{ fontSize: "11px", color: "#f87171", maxWidth: "180px" }}
              title={exportPdfError || "Export failed"}
            >
              Export failed
              {exportPdfError
                ? `: ${exportPdfError.slice(0, 40)}${exportPdfError.length > 40 ? "…" : ""}`
                : ""}
            </span>
          )}
          {saveStatus === "saving" && (
            <span style={{ fontSize: "11px", color: "#fbbf24" }}>
              Saving...
            </span>
          )}
          {saveStatus === "saved" && (
            <span style={{ fontSize: "11px", color: "#34d399" }}>Saved</span>
          )}
          {saveStatus === "error" && (
            <span
              style={{ fontSize: "11px", color: "#f87171" }}
              title={saveErrorMessage}
            >
              Error saving
              {saveErrorMessage
                ? `: ${saveErrorMessage.slice(0, 60)}${saveErrorMessage.length > 60 ? "…" : ""}`
                : ""}
            </span>
          )}
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: "18px",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Mode toggle (player sheet: CHARACTER vs CREW) ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 12,
          background: "var(--hftf-deep)",
          borderBottom: "1px solid var(--hftf-border)",
          padding: "6px 0",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveMode("CHARACTER MODE")}
          style={{
            padding: "6px 24px",
            fontSize: "12px",
            fontFamily: "var(--font-mono, monospace)",
            fontWeight: "bold",
            border: "1px solid",
            borderColor:
              activeMode === "CHARACTER MODE" ? "#0f7662" : "var(--hftf-purple)",
            cursor: "pointer",
            letterSpacing: "0.08em",
            background:
              activeMode === "CHARACTER MODE" ? "#0d9488" : "var(--hftf-panel)",
            color:
              activeMode === "CHARACTER MODE" ? "#fff" : "var(--text-muted)",
            borderRadius: "4px 0 0 4px",
          }}
        >
          CHARACTER MODE
        </button>
        <button
          type="button"
          onClick={() => setActiveMode("CREW MODE")}
          style={{
            padding: "6px 24px",
            fontSize: "12px",
            fontFamily: "var(--font-mono, monospace)",
            fontWeight: "bold",
            border: "1px solid",
            borderColor:
              activeMode === "CREW MODE"
                ? "var(--hftf-purple-hover)"
                : "var(--hftf-purple)",
            cursor: "pointer",
            letterSpacing: "0.08em",
            background:
              activeMode === "CREW MODE"
                ? "var(--hftf-purple)"
                : "var(--hftf-panel)",
            color: activeMode === "CREW MODE" ? "#fff" : "var(--text-muted)",
            borderRadius: "0 4px 4px 0",
          }}
        >
          CREW MODE
        </button>
        {activeMode === "CHARACTER MODE" &&
          (() => {
            const hasSession = Boolean(
              xpReqSnapshot.hasActiveSession || activeSessionId,
            );
            const planDisabled =
              !canEditPlan || !isPostChargen || (hasSession && !isGM);
            const planTitle = !canEditPlan
              ? "Only the owner or GM can edit the advancement plan"
              : !isPostChargen
                ? "Plan mode unlocks after chargen (first XP spend)"
                : hasSession && !isGM
                  ? "Plan mode off during an active session"
                  : planMode
                    ? "Turn off plan mode"
                    : "Turn on plan mode — queue coin grades & advances";
            return (
              <button
                type="button"
                disabled={planDisabled}
                title={planTitle}
                onClick={() => {
                  if (planDisabled) return;
                  setPlanMode((v) => !v);
                }}
                style={{
                  padding: "4px 14px",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono, monospace)",
                  fontWeight: "bold",
                  letterSpacing: "0.06em",
                  borderRadius: 999,
                  cursor: planDisabled ? "not-allowed" : "pointer",
                  opacity: planDisabled ? 0.45 : 1,
                  border: planMode
                    ? "1px solid var(--sheet-ghost)"
                    : "1px solid var(--border)",
                  background: planMode ? "transparent" : "var(--bg-header)",
                  color: planMode
                    ? "var(--sheet-ghost-text)"
                    : "var(--text-muted)",
                }}
              >
                Plan{planMode ? " ON" : ""}
              </button>
            );
          })()}
      </div>

      {planSessionHint ? (
        <div
          role="status"
          style={{
            textAlign: "center",
            padding: "6px 12px",
            fontSize: 11,
            fontFamily: "var(--font-mono, monospace)",
            color: "var(--hftf-gold)",
            background: "var(--hftf-deep)",
            borderBottom: "1px solid var(--hftf-orange)",
          }}
        >
          {planSessionHint}
        </div>
      ) : null}

      {(advancementPlan || []).some(
        (i) => i.status === "queued" || !i.status,
      ) ? (
        <AdvancementPlanStrip
          items={advancementPlan}
          xpClocks={xp}
          onOpenPanel={() => setPlanPanelOpen(true)}
        />
      ) : null}

      <AdvancementPlanPanel
        open={planPanelOpen}
        onClose={() => setPlanPanelOpen(false)}
        items={advancementPlan}
        canEdit={canEditPlan}
        busy={planBusy}
        onReorder={handlePlanReorder}
        onDelete={handlePlanDelete}
      />

      <div style={{ padding: "16px", maxWidth: "1400px", margin: "0 auto" }}>
        {/* ══════════════════════════════════ CHARACTER MODE ══════════════════════════════════ */}
        {activeMode === "CHARACTER MODE" && (
          <>
            {!canEditSheet && (
              <div
                style={{
                  ...S.card,
                  marginBottom: "12px",
                  borderColor: "var(--hftf-orange)",
                  color: "var(--hftf-gold)",
                  fontSize: "12px",
                }}
              >
                Read-only: only the character owner or the referee can edit this
                sheet.
              </div>
            )}
            <div
              style={{
                opacity: canEditSheet ? 1 : 0.78,
                pointerEvents: canEditSheet ? "auto" : "none",
                ...(planMode
                  ? {
                      outline: "1px dashed var(--sheet-ghost)",
                      outlineOffset: 4,
                    }
                  : null),
              }}
            >
            {/* Character bar */}
            <div
              style={{
                ...S.card,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <span
                  style={{
                    color: "#9ca3af",
                    fontSize: "11px",
                    fontWeight: "bold",
                  }}
                >
                  CURRENT CHARACTER
                </span>
                <span style={{ fontWeight: "bold" }}>
                  {charData.name || "New Character"}
                </span>
                {charData.standName && (
                  <span style={{ color: "#a78bfa" }}>
                    「{charData.standName}」
                  </span>
                )}
                <span style={{ color: "#9ca3af", fontSize: "11px" }}>
                  {ownerLabel}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 6,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    {characterId && (
                      <button
                        type="button"
                        onClick={() => setShowHistoryPanelPersist((x) => !x)}
                        title={
                          showHistoryPanel
                            ? "Hide history"
                            : "Show character/session history"
                        }
                        style={{
                          background: showHistoryPanel
                            ? "#312e81"
                            : "#1f2937",
                          border: "1px solid #4b5563",
                          borderRadius: 6,
                          padding: "6px 8px",
                          cursor: "pointer",
                          lineHeight: 0,
                        }}
                      >
                        <HistoryBranchIcon />
                      </button>
                    )}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => characterId && setShowXpHistoryModal(true)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && characterId)
                          setShowXpHistoryModal(true);
                      }}
                      title="XP history"
                      style={{
                        background: "#1e1b4b",
                        border: "1px solid #4338ca",
                        borderRadius: "4px",
                        padding: "4px 10px",
                        textAlign: "center",
                        cursor: characterId ? "pointer" : "default",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#818cf8",
                          fontWeight: "bold",
                          letterSpacing: "0.05em",
                        }}
                      >
                        LEVEL
                      </div>
                      <div
                        style={{
                          fontSize: isChargenIncomplete ? "9px" : "20px",
                          fontWeight: "bold",
                          lineHeight: 1.2,
                          color: isChargenIncomplete
                            ? "#818cf8"
                            : pcLevel >= 7
                              ? "#f87171"
                              : pcLevel >= 4
                                ? "#fbbf24"
                                : "#a5b4fc",
                          whiteSpace: isChargenIncomplete ? "normal" : undefined,
                          wordBreak: isChargenIncomplete ? "break-word" : undefined,
                        }}
                      >
                        {isChargenIncomplete ? CHARGEN_LEVEL_PROMPT : pcLevel}
                      </div>
                      {characterId && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 3,
                            marginTop: "2px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 8,
                                color: "#a5b4fc",
                                fontWeight: 700,
                                letterSpacing: "0.04em",
                                lineHeight: 1,
                              }}
                            >
                              XP
                            </span>
                            <div
                              style={{
                                display: "flex",
                                gap: 4,
                                justifyContent: "center",
                              }}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUndoLatestAllocation();
                                }}
                                disabled={
                                  xpAllocationUndoBusy ||
                                  !xpAllocationRows.some(
                                    (a) => !a.undone_at && a.can_undo,
                                  )
                                }
                                title="Undo your most recent XP spend (stand coin / dots). Refunds only that spend; does not remove GM session XP."
                                style={{
                                  background: "#312e81",
                                  border: "1px solid #6366f1",
                                  borderRadius: 6,
                                  padding: "2px 6px",
                                  cursor: xpAllocationUndoBusy
                                    ? "wait"
                                    : "pointer",
                                  color: "#c7d2fe",
                                  fontSize: 12,
                                  lineHeight: 1,
                                  opacity: xpAllocationRows.some(
                                    (a) => !a.undone_at && a.can_undo,
                                  )
                                    ? 1
                                    : 0.45,
                                }}
                              >
                                ↩
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRedoLatestAllocation();
                                }}
                                disabled={
                                  xpAllocationUndoBusy ||
                                  !xpAllocationRows.some(
                                    (a) => a.undone_at && a.can_redo,
                                  )
                                }
                                title="Redo your most recently undone XP spend"
                                style={{
                                  background: "#312e81",
                                  border: "1px solid #6366f1",
                                  borderRadius: 6,
                                  padding: "2px 6px",
                                  cursor: xpAllocationUndoBusy
                                    ? "wait"
                                    : "pointer",
                                  color: "#c7d2fe",
                                  fontSize: 12,
                                  lineHeight: 1,
                                  opacity: xpAllocationRows.some(
                                    (a) => a.undone_at && a.can_redo,
                                  )
                                    ? 1
                                    : 0.45,
                                }}
                              >
                                ↪
                              </button>
                            </div>
                          </div>
                          {isGmViewingPc && (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 8,
                                  color: "#fdba74",
                                  fontWeight: 700,
                                  letterSpacing: "0.04em",
                                  lineHeight: 1,
                                }}
                              >
                                GM XP
                              </span>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 4,
                                  justifyContent: "center",
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUndoLatestGmChange(e);
                                  }}
                                  disabled={
                                    gmUndoBusy || !gmUndoStatus?.available
                                  }
                                  title={
                                    gmUndoStatus?.available
                                      ? `Undo your last GM XP award on this PC${gmUndoStatus.summary ? `: ${gmUndoStatus.summary}` : ""}`
                                      : "No GM XP awards to undo on this character"
                                  }
                                  style={{
                                    background: "#431407",
                                    border: "1px solid #ea580c",
                                    borderRadius: 6,
                                    padding: "2px 6px",
                                    cursor: gmUndoBusy ? "wait" : "pointer",
                                    color: "#fed7aa",
                                    fontSize: 12,
                                    lineHeight: 1,
                                    opacity: gmUndoStatus?.available ? 1 : 0.45,
                                  }}
                                >
                                  {gmUndoBusy ? "…" : "↩"}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRedoLatestGmChange(e);
                                  }}
                                  disabled={
                                    gmRedoBusy || !gmRedoStatus?.available
                                  }
                                  title={
                                    gmRedoStatus?.available
                                      ? `Redo your last undone GM XP award${gmRedoStatus.summary ? `: ${gmRedoStatus.summary}` : ""}`
                                      : "No GM XP awards to redo"
                                  }
                                  style={{
                                    background: "#431407",
                                    border: "1px solid #ea580c",
                                    borderRadius: 6,
                                    padding: "2px 6px",
                                    cursor: gmRedoBusy ? "wait" : "pointer",
                                    color: "#fed7aa",
                                    fontSize: 12,
                                    lineHeight: 1,
                                    opacity: gmRedoStatus?.available ? 1 : 0.45,
                                  }}
                                >
                                  {gmRedoBusy ? "…" : "↪"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {isGmViewingPc && (gmUndoError || gmRedoError) && (
                        <div
                          style={{
                            fontSize: 9,
                            color: "#fca5a5",
                            marginTop: 2,
                            maxWidth: 140,
                            lineHeight: 1.2,
                          }}
                        >
                          {gmUndoError || gmRedoError}
                        </div>
                      )}
                      {!isChargenIncomplete && (
                        <div
                          style={{
                            fontSize: "9px",
                            color: "#4b5563",
                            marginTop: "1px",
                          }}
                        >
                          {totalSpentXP} XP spent
                        </div>
                      )}
                      {characterId && canEditSheet && (
                        <button
                          type="button"
                          onClick={handleResetCharacterSheet}
                          disabled={resetSheetBusy}
                          title="Reset character sheet. Keeps name, crew, look, vice, heritage, and campaign."
                          style={{
                            marginTop: 4,
                            width: "100%",
                            background: "#3f1d1d",
                            border: "1px solid #b91c1c",
                            borderRadius: 4,
                            padding: "3px 4px",
                            cursor: resetSheetBusy ? "wait" : "pointer",
                            color: "#fecaca",
                            fontSize: 8,
                            fontWeight: 700,
                            letterSpacing: "0.03em",
                            lineHeight: 1.15,
                            textTransform: "uppercase",
                          }}
                        >
                          {resetSheetBusy ? "…" : "reset character"}
                        </button>
                      )}
                    </div>
                  </div>
                  {showHistoryPanel && (
                    <div
                      style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.62)",
                        zIndex: 125,
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "center",
                        paddingTop: "80px",
                      }}
                      onClick={() => setShowHistoryPanelPersist(false)}
                    >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        background: "#111827",
                        border: "1px solid #374151",
                        borderRadius: 8,
                        padding: 10,
                        width: "min(680px, 92vw)",
                        maxHeight: "70vh",
                        overflowY: "auto",
                        fontSize: 11,
                        boxShadow: "0 14px 40px rgba(0,0,0,0.55)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ color: "#a78bfa", fontWeight: "bold" }}>
                          History
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <span style={{ fontSize: 10, color: "#9ca3af" }}>
                            Press Esc to exit view
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowHistoryPanelPersist(false)}
                            style={{ ...S.btn, padding: "2px 8px", fontSize: 10 }}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                        <>
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              marginBottom: 8,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => setHistoryMode("sheet")}
                              style={{
                                ...S.btn,
                                fontSize: 10,
                                padding: "4px 8px",
                                background:
                                  historyMode === "sheet" ? "#4338ca" : "#1f2937",
                                color:
                                  historyMode === "sheet" ? "#f9fafb" : "#d1d5db",
                                border:
                                  historyMode === "sheet"
                                    ? "1px solid #818cf8"
                                    : "1px solid #374151",
                              }}
                            >
                              Character Sheet History
                            </button>
                            <button
                              type="button"
                              onClick={() => setHistoryMode("session")}
                              style={{
                                ...S.btn,
                                fontSize: 10,
                                padding: "4px 8px",
                                background:
                                  historyMode === "session" ? "#4338ca" : "#1f2937",
                                color:
                                  historyMode === "session" ? "#f9fafb" : "#d1d5db",
                                border:
                                  historyMode === "session"
                                    ? "1px solid #818cf8"
                                    : "1px solid #374151",
                              }}
                            >
                              Session History
                            </button>
                          </div>
                          <p
                            style={{
                              margin: "0 0 8px",
                              fontSize: 10,
                              color: "#6b7280",
                              lineHeight: 1.45,
                            }}
                          >
                            Sheet tab: field edits and XP notes over time. Session tab:
                            rolls (incl. fortune when revealed to you), clocks, stress
                            changes, session XP — plus{" "}
                            <strong style={{ color: "#9ca3af" }}>Manual record</strong>{" "}
                            for table rolls.
                          </p>
                          {historyMode === "session" && (
                            <>
                              <div
                                style={{
                                  marginBottom: 8,
                                }}
                              >
                                <select
                                  value={
                                    historySessionId == null
                                      ? ""
                                      : String(historySessionId)
                                  }
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === "") setHistorySessionId(null);
                                    else if (v === "all")
                                      setHistorySessionId("all");
                                    else setHistorySessionId(Number(v));
                                  }}
                                  style={{ ...S.sel, fontSize: 10, padding: "2px 6px", width: "100%" }}
                                >
                                  <option value="">No session</option>
                                  <option value="all">All sessions</option>
                                  {(charCampaign?.sessions || []).map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name || `Session ${s.id}`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div
                                style={{
                                  marginBottom: 8,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!canCreateManualHistoryRecord) return;
                                    setHistoryOutcomeBandGmUnlock(false);
                                    if (showHistoryManualModal) {
                                      setShowHistoryManualModal(false);
                                    } else {
                                      openHistoryManualModal();
                                    }
                                  }}
                                  style={{
                                    ...S.btn,
                                    fontSize: 10,
                                    background: "#4338ca",
                                    color: "#fff",
                                    opacity: canCreateManualHistoryRecord ? 1 : 0.45,
                                    cursor: canCreateManualHistoryRecord
                                      ? "pointer"
                                      : "not-allowed",
                                  }}
                                  disabled={!canCreateManualHistoryRecord}
                                  title={
                                    canCreateManualHistoryRecord
                                      ? "Add an offline/manual history entry."
                                      : "Only the GM or this character's owner can add manual records."
                                  }
                                >
                                  Manual record…
                                </button>
                                {showHistoryManualModal && (
                                  <div
                                    style={{
                                      marginTop: 8,
                                      background: "#0d1117",
                                      border: "1px solid #374151",
                                      borderRadius: 8,
                                      padding: 10,
                                    }}
                                  >
                                    <div
                                      style={{
                                        color: "#a78bfa",
                                        fontWeight: "bold",
                                        fontSize: 12,
                                        marginBottom: 8,
                                      }}
                                    >
                                      Manual history, roll, or XP award
                                    </div>
                                    <div
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 6,
                                      }}
                                    >
                                      <select
                                        value={historyManual.sessionId}
                                        onChange={(e) =>
                                          setHistoryManual((p) => ({
                                            ...p,
                                            sessionId: e.target.value,
                                          }))
                                        }
                                        style={{
                                          ...S.sel,
                                          fontSize: 10,
                                          padding: "2px 6px",
                                          width: "100%",
                                          boxSizing: "border-box",
                                        }}
                                      >
                                        <option value="">Session</option>
                                        {(charCampaign?.sessions || []).map((s) => (
                                          <option
                                            key={s.id}
                                            value={String(s.id)}
                                          >
                                            {s.name || `Session ${s.id}`}
                                          </option>
                                        ))}
                                      </select>
                                      <select
                                        value={historyManual.rollType}
                                        onChange={(e) =>
                                          setHistoryManual((p) => ({
                                            ...p,
                                            rollType: e.target.value,
                                            viceOverindulge: "",
                                          }))
                                        }
                                        style={{
                                          ...S.sel,
                                          fontSize: 10,
                                          padding: "2px 6px",
                                          width: "100%",
                                          boxSizing: "border-box",
                                        }}
                                      >
                                        <option value="ACTION">Action</option>
                                        <option value="RESISTANCE">
                                          Resistance
                                        </option>
                                        <option value="VICE">Vice roll</option>
                                        <option value="FORTUNE">Fortune roll</option>
                                        <option value="XP">XP award</option>
                                      </select>
                                      {historyManual.rollType === "XP" ? (
                                        <>
                                          <select
                                            value={historyManual.xpTrack}
                                            onChange={(e) =>
                                              setHistoryManual((p) => ({
                                                ...p,
                                                xpTrack: e.target.value,
                                              }))
                                            }
                                            style={{
                                              ...S.sel,
                                              fontSize: 10,
                                              padding: "2px 6px",
                                              width: "100%",
                                              boxSizing: "border-box",
                                            }}
                                          >
                                            <option value="playbook">Playbook</option>
                                            <option value="insight">Insight</option>
                                            <option value="prowess">Prowess</option>
                                            <option value="resolve">Resolve</option>
                                            <option value="heritage">Heritage</option>
                                            <option value="pool">
                                              Free pool
                                            </option>
                                          </select>
                                          <input
                                            type="number"
                                            min={1}
                                            value={historyManual.xpAmount}
                                            onChange={(e) =>
                                              setHistoryManual((p) => ({
                                                ...p,
                                                xpAmount: e.target.value,
                                              }))
                                            }
                                            style={{
                                              ...S.inp,
                                              fontSize: 10,
                                              padding: "2px 6px",
                                              width: "100%",
                                              boxSizing: "border-box",
                                            }}
                                            title="XP to add"
                                          />
                                          <textarea
                                            value={historyManual.xpReason}
                                            onChange={(e) =>
                                              setHistoryManual((p) => ({
                                                ...p,
                                                xpReason: e.target.value,
                                              }))
                                            }
                                            style={{
                                              ...S.inp,
                                              fontSize: 10,
                                              padding: "6px",
                                              minHeight: 52,
                                              resize: "vertical",
                                              fontFamily: "inherit",
                                              width: "100%",
                                              boxSizing: "border-box",
                                            }}
                                            placeholder="Explain what this XP was for (appears in session history and XP log)."
                                            rows={3}
                                          />
                                        </>
                                      ) : historyManual.rollType === "RESISTANCE" ? (
                                        <select
                                          value={historyManual.action}
                                          onChange={(e) =>
                                            setHistoryManual((p) => ({
                                              ...p,
                                              action: e.target.value,
                                            }))
                                          }
                                          style={{
                                            ...S.sel,
                                            fontSize: 10,
                                            padding: "2px 6px",
                                            width: "100%",
                                            boxSizing: "border-box",
                                          }}
                                        >
                                          {HISTORY_MANUAL_RESISTANCE_ATTR_OPTIONS.map(
                                            (opt) => (
                                              <option
                                                key={opt.value}
                                                value={opt.value}
                                              >
                                                {opt.label}
                                              </option>
                                            ),
                                          )}
                                        </select>
                                      ) : historyManual.rollType === "VICE" ? (
                                        <div
                                          style={{
                                            ...S.inp,
                                            fontSize: 10,
                                            padding: "2px 6px",
                                            color: "#9ca3af",
                                            display: "flex",
                                            alignItems: "center",
                                          }}
                                        >
                                          Vice (downtime indulgence)
                                        </div>
                                      ) : historyManual.rollType === "FORTUNE" ? (
                                        <div
                                          style={{
                                            ...S.inp,
                                            fontSize: 10,
                                            padding: "2px 6px",
                                            color: "#9ca3af",
                                            display: "flex",
                                            alignItems: "center",
                                          }}
                                        >
                                          Fortune (highest die)
                                        </div>
                                      ) : (
                                        <input
                                          value={historyManual.action}
                                          onChange={(e) =>
                                            setHistoryManual((p) => ({
                                              ...p,
                                              action: e.target.value,
                                            }))
                                          }
                                          style={{
                                            ...S.inp,
                                            fontSize: 10,
                                            padding: "2px 6px",
                                            width: "100%",
                                            boxSizing: "border-box",
                                          }}
                                          placeholder="Action"
                                        />
                                      )}
                                      {historyManual.rollType !== "XP" ? (
                                        <input
                                          value={historyManual.dice}
                                          onChange={(e) =>
                                            setHistoryManual((p) => ({
                                              ...p,
                                              dice: e.target.value,
                                            }))
                                          }
                                          style={{
                                            ...S.inp,
                                            fontSize: 10,
                                            padding: "2px 6px",
                                            width: "100%",
                                            boxSizing: "border-box",
                                          }}
                                          placeholder="Dice e.g. 6,4"
                                        />
                                      ) : null}
                                      {historyManual.rollType === "FORTUNE" ? (
                                        <>
                                          <textarea
                                            value={historyManual.fortunePublicLabel}
                                            onChange={(e) =>
                                              setHistoryManual((p) => ({
                                                ...p,
                                                fortunePublicLabel: e.target.value,
                                              }))
                                            }
                                            style={{
                                              ...S.inp,
                                              fontSize: 10,
                                              padding: "6px",
                                              minHeight: 44,
                                              resize: "vertical",
                                              fontFamily: "inherit",
                                              width: "100%",
                                              boxSizing: "border-box",
                                            }}
                                            placeholder="What this fortune resolves (shown in session history)."
                                            rows={2}
                                          />
                                          <label
                                            style={{
                                              fontSize: 10,
                                              color: "#d1d5db",
                                              display: "flex",
                                              gap: 6,
                                              alignItems: "center",
                                            }}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={
                                                !!historyManual.fortuneRevealPlayers
                                              }
                                              onChange={(e) =>
                                                setHistoryManual((p) => ({
                                                  ...p,
                                                  fortuneRevealPlayers:
                                                    e.target.checked,
                                                }))
                                              }
                                            />
                                            Show dice and outcome to players
                                          </label>
                                        </>
                                      ) : null}
                                      {historyManual.rollType === "XP" ? null : historyManual.rollType ===
                                      "RESISTANCE" ? (
                                        <>
                                          <select
                                            value={historyManual.resistanceHarmTarget}
                                            onChange={(e) =>
                                              setHistoryManual((p) => ({
                                                ...p,
                                                resistanceHarmTarget:
                                                  e.target.value,
                                              }))
                                            }
                                            style={{
                                              ...S.sel,
                                              fontSize: 10,
                                              padding: "2px 6px",
                                              width: "100%",
                                              boxSizing: "border-box",
                                            }}
                                          >
                                            <option value="">
                                              Harm to reduce…
                                            </option>
                                            {filledHarmOptions.map((opt) => (
                                              <option
                                                key={opt.value}
                                                value={opt.value}
                                              >
                                                {opt.label}
                                              </option>
                                            ))}
                                          </select>
                                          <div
                                            style={{
                                              ...S.inp,
                                              fontSize: 10,
                                              padding: "2px 6px",
                                              color: "#d1d5db",
                                              display: "flex",
                                              alignItems: "center",
                                            }}
                                          >
                                            Stress = 6 - highest die
                                          </div>
                                        </>
                                      ) : historyManual.rollType === "VICE" ? (
                                        <>
                                          <div
                                            style={{
                                              ...S.inp,
                                              fontSize: 10,
                                              padding: "2px 6px",
                                              color: "#d1d5db",
                                              display: "flex",
                                              alignItems: "center",
                                            }}
                                          >
                                            Pool = lowest Insight / Prowess / Resolve
                                            rating · stress cleared = highest die
                                          </div>
                                        </>
                                      ) : historyManual.rollType === "FORTUNE" ? (
                                          <div
                                            style={{
                                              ...S.inp,
                                              fontSize: 10,
                                              padding: "6px 8px",
                                              color: "#d1d5db",
                                              display: "flex",
                                              flexDirection: "column",
                                              gap: 6,
                                            }}
                                          >
                                          <div>
                                            Outcome:{" "}
                                            <strong style={{ color: "#e5e7eb" }}>
                                              {historyManualDerivedOutcomeApi
                                                ? OUTCOME_BAND_SHORT_LABEL[
                                                    historyManualDerivedOutcomeApi
                                                  ]
                                                : "— enter dice"}
                                            </strong>
                                          </div>
                                          {isGM && historyOutcomeBandGmUnlock ? (
                                            <select
                                              value={historyManual.outcome}
                                              onChange={(e) =>
                                                setHistoryManual((p) => ({
                                                  ...p,
                                                  outcome: e.target.value,
                                                }))
                                              }
                                              style={{
                                                ...S.sel,
                                                fontSize: 10,
                                                padding: "2px 6px",
                                                width: "100%",
                                                boxSizing: "border-box",
                                              }}
                                            >
                                              <option value="CRITICAL_SUCCESS">
                                                Critical
                                              </option>
                                              <option value="FULL_SUCCESS">
                                                Full
                                              </option>
                                              <option value="PARTIAL_SUCCESS">
                                                Partial
                                              </option>
                                              <option value="FAILURE">
                                                Failure
                                              </option>
                                            </select>
                                          ) : null}
                                          {isGM && !historyOutcomeBandGmUnlock ? (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setHistoryOutcomeBandGmUnlock(true);
                                                if (historyManualDerivedOutcomeApi) {
                                                  setHistoryManual((p) => ({
                                                    ...p,
                                                    outcome:
                                                      historyManualDerivedOutcomeApi,
                                                  }));
                                                }
                                              }}
                                              style={{
                                                ...S.btn,
                                                fontSize: 9,
                                                alignSelf: "flex-start",
                                                padding: "2px 8px",
                                              }}
                                            >
                                              Unlock outcome override (GM)
                                            </button>
                                          ) : null}
                                        </div>
                                      ) : (
                                        <>
                                          <div
                                            style={{
                                              ...S.inp,
                                              fontSize: 10,
                                              padding: "6px 8px",
                                              color: "#d1d5db",
                                              display: "flex",
                                              flexDirection: "column",
                                              gap: 6,
                                            }}
                                          >
                                            <div>
                                              Outcome:{" "}
                                              <strong style={{ color: "#e5e7eb" }}>
                                                {historyManualDerivedOutcomeApi
                                                  ? OUTCOME_BAND_SHORT_LABEL[
                                                      historyManualDerivedOutcomeApi
                                                    ]
                                                  : "— enter dice"}
                                              </strong>
                                            </div>
                                            {isGM && historyOutcomeBandGmUnlock ? (
                                              <select
                                                value={historyManual.outcome}
                                                onChange={(e) =>
                                                  setHistoryManual((p) => ({
                                                    ...p,
                                                    outcome: e.target.value,
                                                  }))
                                                }
                                                style={{
                                                  ...S.sel,
                                                  fontSize: 10,
                                                  padding: "2px 6px",
                                                  width: "100%",
                                                  boxSizing: "border-box",
                                                }}
                                              >
                                                <option value="CRITICAL_SUCCESS">
                                                  Critical
                                                </option>
                                                <option value="FULL_SUCCESS">
                                                  Full
                                                </option>
                                                <option value="PARTIAL_SUCCESS">
                                                  Partial
                                                </option>
                                                <option value="FAILURE">
                                                  Failure
                                                </option>
                                              </select>
                                            ) : null}
                                            {isGM && !historyOutcomeBandGmUnlock ? (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setHistoryOutcomeBandGmUnlock(true);
                                                  if (historyManualDerivedOutcomeApi) {
                                                    setHistoryManual((p) => ({
                                                      ...p,
                                                      outcome:
                                                        historyManualDerivedOutcomeApi,
                                                    }));
                                                  }
                                                }}
                                                style={{
                                                  ...S.btn,
                                                  fontSize: 9,
                                                  alignSelf: "flex-start",
                                                  padding: "2px 8px",
                                                }}
                                              >
                                                Unlock outcome override (GM)
                                              </button>
                                            ) : null}
                                          </div>
                                          <div
                                            style={{
                                              display: "flex",
                                              gap: 14,
                                              flexWrap: "wrap",
                                              alignItems: "flex-start",
                                              marginTop: 2,
                                            }}
                                          >
                                            <PositionStack
                                              activePosition={
                                                historyManual.position || "risky"
                                              }
                                              readOnly={false}
                                              onSelect={(value) =>
                                                setHistoryManual((p) => ({
                                                  ...p,
                                                  position: value,
                                                }))
                                              }
                                            />
                                            <EffectShapes
                                              activeEffect={
                                                historyManual.effect || "standard"
                                              }
                                              readOnly={false}
                                              onSelect={(tier) =>
                                                setHistoryManual((p) => ({
                                                  ...p,
                                                  effect: tier,
                                                }))
                                              }
                                            />
                                          </div>
                                          <div
                                            style={{
                                              fontSize: 9,
                                              color: "#6b7280",
                                              lineHeight: 1.35,
                                              marginTop: 2,
                                            }}
                                          >
                                            Click position squares or L/S/E to override this
                                            offline record. Highlighted effect is the chosen base;
                                            stored{" "}
                                            <code style={{ color: "#9ca3af" }}>effect</code> still
                                            adds push / +1 effect (now {manualHistoryEffectPreview}).
                                            Defaults from GM session row (
                                            <code style={{ color: "#9ca3af" }}>
                                              active_session_detail.position_effect_by_character
                                            </code>
                                            ) then{" "}
                                            <code style={{ color: "#9ca3af" }}>
                                              default_position
                                            </code>
                                            /
                                            <code style={{ color: "#9ca3af" }}>
                                              default_effect
                                            </code>
                                            . Online{" "}
                                            <code style={{ color: "#9ca3af" }}>rollAction</code>{" "}
                                            still resolves P/E from the same session map on the server
                                            (no client-sent position override).
                                          </div>
                                          {manualHistorySuggestedDice != null ? (
                                            <div
                                              style={{
                                                fontSize: 9,
                                                color: "#a78bfa",
                                                marginTop: 4,
                                                lineHeight: 1.35,
                                              }}
                                            >
                                              Suggested dice count (action rating + push/devil/help
                                              + toggles below):{" "}
                                              <strong>{manualHistorySuggestedDice}</strong> — enter
                                              the dice you actually rolled.
                                            </div>
                                          ) : null}
                                        </>
                                      )}
                                    </div>
                                    {historyManual.rollType !== "RESISTANCE" &&
                                      historyManual.rollType !== "VICE" &&
                                      historyManual.rollType !== "XP" &&
                                      historyManual.rollType !== "FORTUNE" && (
                                      <div
                                        style={{
                                          marginTop: 6,
                                          display: "flex",
                                          gap: 8,
                                          flexWrap: "wrap",
                                          fontSize: 10,
                                        }}
                                      >
                                        {[
                                          ["pushDice", "Push +1d"],
                                          ["pushEffect", "Push +effect"],
                                          ["devil", "Devil's bargain"],
                                          ["helpDie", "Help +1d"],
                                          ["groupAction", "Group action"],
                                        ].map(([k, label]) => (
                                          <label
                                            key={k}
                                            style={{ display: "flex", gap: 4 }}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={!!historyManual[k]}
                                              onChange={(e) =>
                                                setHistoryManual((p) => ({
                                                  ...p,
                                                  [k]: e.target.checked,
                                                }))
                                              }
                                            />
                                            <span>{label}</span>
                                          </label>
                                        ))}
                                      </div>
                                    )}
                                    {historyManual.rollType !== "RESISTANCE" &&
                                    historyManual.rollType !== "VICE" &&
                                    historyManual.rollType !== "XP" &&
                                    historyManual.rollType !== "FORTUNE" &&
                                    (abilityRollBonusOptions.length > 0 ||
                                      heritageRollBonusOptions.length > 0) ? (
                                      <div
                                        style={{
                                          marginTop: 8,
                                          padding: "8px",
                                          borderRadius: 8,
                                          border: "1px solid #374151",
                                          background: "#0d1117",
                                        }}
                                      >
                                        <div
                                          style={{
                                            fontSize: 10,
                                            color: "#a78bfa",
                                            marginBottom: 6,
                                            fontWeight: "bold",
                                          }}
                                        >
                                          Abilities / heritage (+1d, +1 effect)
                                        </div>
                                        <div
                                          style={{
                                            fontSize: 9,
                                            color: "#6b7280",
                                            marginBottom: 6,
                                            lineHeight: 1.35,
                                          }}
                                        >
                                          Same rules as the action roll modal; tallies feed{" "}
                                          <code style={{ color: "#9ca3af" }}>pool_bonus_dice</code>,{" "}
                                          stored effect tier, and modifier rows on the saved roll.
                                        </div>
                                        {abilityRollBonusOptions.length > 0 ? (
                                          <div
                                            style={{
                                              display: "flex",
                                              flexDirection: "column",
                                              gap: 4,
                                              maxHeight: 100,
                                              overflow: "auto",
                                              marginBottom: 6,
                                            }}
                                          >
                                            {abilityRollBonusOptions.map((ab) => {
                                              const id = ab.id ?? ab.name;
                                              const b = historyManualAbilityBoost[id] || {};
                                              return (
                                                <div
                                                  key={String(id)}
                                                  style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    gap: 6,
                                                    fontSize: 10,
                                                    flexWrap: "wrap",
                                                  }}
                                                >
                                                  <span
                                                    style={{
                                                      color: "#d1d5db",
                                                      flex: "1 1 100px",
                                                    }}
                                                    title={
                                                      ab.rollBonusResolvedDescription
                                                        ? String(
                                                            ab.rollBonusResolvedDescription,
                                                          ).slice(0, 500)
                                                        : undefined
                                                    }
                                                  >
                                                    {ab.name}
                                                  </span>
                                                  {ab.supportsDice ? (
                                                    <label
                                                      style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 3,
                                                        cursor: "pointer",
                                                      }}
                                                    >
                                                      <input
                                                        type="checkbox"
                                                        checked={!!b.dice}
                                                        onChange={(e) =>
                                                          setHistoryManualAbilityBoost(
                                                            (p) => ({
                                                              ...p,
                                                              [id]: {
                                                                ...p[id],
                                                                dice: e.target.checked,
                                                                effect: !!p[id]?.effect,
                                                              },
                                                            }),
                                                          )
                                                        }
                                                      />
                                                      +1d
                                                    </label>
                                                  ) : null}
                                                  {ab.supportsEffect ? (
                                                    <label
                                                      style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 3,
                                                        cursor: "pointer",
                                                      }}
                                                    >
                                                      <input
                                                        type="checkbox"
                                                        checked={!!b.effect}
                                                        onChange={(e) =>
                                                          setHistoryManualAbilityBoost(
                                                            (p) => ({
                                                              ...p,
                                                              [id]: {
                                                                ...p[id],
                                                                effect: e.target.checked,
                                                                dice: !!p[id]?.dice,
                                                              },
                                                            }),
                                                          )
                                                        }
                                                      />
                                                      +1 effect
                                                    </label>
                                                  ) : null}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        ) : null}
                                        {heritageRollBonusOptions.length > 0 ? (
                                          <div
                                            style={{
                                              display: "flex",
                                              flexDirection: "column",
                                              gap: 4,
                                              maxHeight: 80,
                                              overflow: "auto",
                                            }}
                                          >
                                            {heritageRollBonusOptions.map((hb) => {
                                              const id = hb.id ?? hb.name;
                                              const b = historyManualHeritageBoost[id] || {};
                                              return (
                                                <div
                                                  key={String(id)}
                                                  style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    gap: 6,
                                                    fontSize: 10,
                                                    flexWrap: "wrap",
                                                  }}
                                                >
                                                  <span
                                                    style={{ color: "#d1d5db", flex: "1 1 100px" }}
                                                    title={String(hb.description || "").slice(
                                                      0,
                                                      400,
                                                    )}
                                                  >
                                                    {hb.name}{" "}
                                                    <span style={{ color: "#6b7280" }}>
                                                      (heritage)
                                                    </span>
                                                  </span>
                                                  {hb.supportsDice ? (
                                                    <label
                                                      style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 3,
                                                        cursor: "pointer",
                                                      }}
                                                    >
                                                      <input
                                                        type="checkbox"
                                                        checked={!!b.dice}
                                                        onChange={(e) =>
                                                          setHistoryManualHeritageBoost(
                                                            (p) => ({
                                                              ...p,
                                                              [id]: {
                                                                ...p[id],
                                                                dice: e.target.checked,
                                                                effect: !!p[id]?.effect,
                                                              },
                                                            }),
                                                          )
                                                        }
                                                      />
                                                      +1d
                                                    </label>
                                                  ) : null}
                                                  {hb.supportsEffect ? (
                                                    <label
                                                      style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 3,
                                                        cursor: "pointer",
                                                      }}
                                                    >
                                                      <input
                                                        type="checkbox"
                                                        checked={!!b.effect}
                                                        onChange={(e) =>
                                                          setHistoryManualHeritageBoost(
                                                            (p) => ({
                                                              ...p,
                                                              [id]: {
                                                                ...p[id],
                                                                effect: e.target.checked,
                                                                dice: !!p[id]?.dice,
                                                              },
                                                            }),
                                                          )
                                                        }
                                                      />
                                                      +1 effect
                                                    </label>
                                                  ) : null}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : null}
                                    {historyManual.rollType !== "RESISTANCE" &&
                                    historyManual.rollType !== "VICE" &&
                                    historyManual.rollType !== "XP" &&
                                    historyManual.rollType !== "FORTUNE" &&
                                    historyManual.groupAction ? (
                                      <input
                                        value={historyManual.groupActionId}
                                        onChange={(e) =>
                                          setHistoryManual((p) => ({
                                            ...p,
                                            groupActionId: e.target.value,
                                          }))
                                        }
                                        style={{
                                          ...S.inp,
                                          marginTop: 6,
                                          fontSize: 10,
                                          padding: "2px 6px",
                                          width: 120,
                                        }}
                                        placeholder="Group action id"
                                      />
                                    ) : null}
                                    {historyManual.rollType === "VICE" &&
                                    viceManualWouldOverindulge ? (
                                      <div style={{ marginTop: 6 }}>
                                        <div
                                          style={{
                                            fontSize: 10,
                                            color: "#fbbf24",
                                            marginBottom: 4,
                                            fontWeight: "bold",
                                          }}
                                        >
                                          Overindulgence (highest die exceeds stress marked) — pick
                                          consequence:
                                        </div>
                                        <select
                                          value={historyManual.viceOverindulge || ""}
                                          onChange={(e) =>
                                            setHistoryManual((p) => ({
                                              ...p,
                                              viceOverindulge: e.target.value,
                                            }))
                                          }
                                          style={{
                                            ...S.sel,
                                            fontSize: 10,
                                            padding: "2px 6px",
                                            width: "100%",
                                            maxWidth: "100%",
                                          }}
                                        >
                                          {VICE_OVERINDULGE_CHOICES.map((o) => (
                                            <option key={o.value || "none"} value={o.value}>
                                              {o.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    ) : null}
                                    <div
                                      style={{
                                        marginTop: 8,
                                        display: "flex",
                                        gap: 8,
                                        alignItems: "center",
                                      }}
                                    >
                                      <button
                                        type="button"
                                        disabled={historyManualSaving}
                                        onClick={async () => {
                                          if (!canCreateManualHistoryRecord) {
                                            setHistoryWriteError(
                                              "Only the GM or this character's owner can add manual records.",
                                            );
                                            return;
                                          }
                                          try {
                                            setHistoryWriteError(null);
                                            const rt0 = String(
                                              historyManual.rollType || "ACTION",
                                            ).toUpperCase();
                                            if (rt0 === "XP") {
                                              if (!characterId) return;
                                              const sessions =
                                                charCampaign?.sessions || [];
                                              const sidStr = String(
                                                historyManual.sessionId || "",
                                              ).trim();
                                              const trackPreview =
                                                String(
                                                  historyManual.xpTrack ||
                                                    "playbook",
                                                ).toLowerCase();
                                              if (
                                                sessions.length > 0 &&
                                                trackPreview !== "pool" &&
                                                !sidStr
                                              ) {
                                                setHistoryWriteError(
                                                  "Select a session for this XP award.",
                                                );
                                                return;
                                              }
                                              let sessionIdPayload = null;
                                              if (sidStr) {
                                                const sidNum = parseInt(sidStr, 10);
                                                if (
                                                  !Number.isFinite(sidNum) ||
                                                  sidNum < 1
                                                ) {
                                                  setHistoryWriteError(
                                                    "Invalid session.",
                                                  );
                                                  return;
                                                }
                                                sessionIdPayload = sidNum;
                                              }
                                              const amt = parseInt(
                                                String(historyManual.xpAmount || "1"),
                                                10,
                                              );
                                              if (!Number.isFinite(amt) || amt < 1) {
                                                setHistoryWriteError(
                                                  "XP amount must be at least 1.",
                                                );
                                                return;
                                              }
                                              const reason = String(
                                                historyManual.xpReason || "",
                                              ).trim();
                                              if (reason.length < 3) {
                                                setHistoryWriteError(
                                                  "Enter at least 3 characters explaining this XP award.",
                                                );
                                                return;
                                              }
                                              const track = trackPreview;
                                              setHistoryManualSaving(true);
                                              const res = await characterAPI.addXP(
                                                characterId,
                                                {
                                                  xp_type: track,
                                                  amount: amt,
                                                  reason,
                                                  ...(sessionIdPayload != null
                                                    ? {
                                                        session_id:
                                                          sessionIdPayload,
                                                      }
                                                    : {}),
                                                },
                                              );
                                              if (
                                                res?.xp_clocks &&
                                                typeof res.xp_clocks === "object"
                                              ) {
                                                setXp((prev) => ({
                                                  ...prev,
                                                  ...res.xp_clocks,
                                                }));
                                              } else if (
                                                res?.new_total != null &&
                                                track
                                              ) {
                                                setXp((p) => ({
                                                  ...p,
                                                  [track]: res.new_total,
                                                }));
                                              }
                                              if (
                                                track === "pool" &&
                                                typeof res?.unallocated_xp ===
                                                  "number"
                                              ) {
                                                setUnallocatedXp(
                                                  Math.max(
                                                    0,
                                                    Math.floor(res.unallocated_xp),
                                                  ),
                                                );
                                              }
                                              setHistoryRefreshTick((v) => v + 1);
                                              setHistoryOutcomeBandGmUnlock(false);
                                              setShowHistoryManualModal(false);
                                              return;
                                            }
                                            const sid = parseInt(
                                              String(historyManual.sessionId || ""),
                                              10,
                                            );
                                            if (!sid || !characterId) return;
                                            const diceResults = String(
                                              historyManual.dice || "",
                                            )
                                              .split(/[\s,]+/)
                                              .map((n) => parseInt(n.trim(), 10))
                                              .filter(
                                                (n) =>
                                                  Number.isFinite(n) &&
                                                  n >= 1 &&
                                                  n <= 6,
                                              );
                                            if (!diceResults.length) {
                                              setHistoryWriteError(
                                                "Enter at least one die result (1-6).",
                                              );
                                              return;
                                            }
                                            const rt = String(
                                              historyManual.rollType || "ACTION",
                                            ).toUpperCase();
                                            const isResistanceManual =
                                              rt === "RESISTANCE";
                                            const isViceManual = rt === "VICE";
                                            const isFortuneManual = rt === "FORTUNE";
                                            const actionRatingForManual =
                                              !isResistanceManual &&
                                              !isViceManual &&
                                              !isFortuneManual
                                                ? computeActionPoolBreakdown(
                                                    historyManual.action,
                                                    actionRatings,
                                                  ).action_rating
                                                : 0;
                                            const actionPoolBeforeManual =
                                              !isResistanceManual &&
                                              !isViceManual &&
                                              !isFortuneManual
                                                ? Math.max(
                                                    0,
                                                    actionRatingForManual +
                                                      (historyManual.pushDice
                                                        ? 1
                                                        : 0) +
                                                      (historyManual.devil
                                                        ? 1
                                                        : 0) +
                                                      (historyManual.helpDie
                                                        ? 1
                                                        : 0),
                                                  )
                                                : 0;
                                            const mhBon =
                                              computeAbilityHeritageRollBonuses({
                                                abilityRollBonusOptions,
                                                heritageRollBonusOptions,
                                                abilityBoostMap:
                                                  historyManualAbilityBoost,
                                                heritageBoostMap:
                                                  historyManualHeritageBoost,
                                                healingTreatmentBonusContext: false,
                                                standRoll: false,
                                                reflexCtx: {
                                                  rollPending: null,
                                                  healingTreatmentBonusContext: false,
                                                },
                                              });
                                            const abilityBonusDiceManual =
                                              mhBon.bonusDiceFromAbilities +
                                              mhBon.bonusDiceFromHeritage;
                                            const actionPoolForOutcome =
                                              actionPoolBeforeManual +
                                              abilityBonusDiceManual;
                                            const manualStoredEffect =
                                              !isResistanceManual &&
                                              !isViceManual &&
                                              !isFortuneManual
                                                ? bumpEffectTier(
                                                    normalizeEffectTier(
                                                      historyManual.effect,
                                                    ),
                                                    (historyManual.pushEffect
                                                      ? 1
                                                      : 0) +
                                                      mhBon.abilityEffectSteps +
                                                      mhBon.heritageEffectSteps,
                                                  )
                                                : historyManual.effect;
                                            const manualModifierSources = [
                                              ...mhBon.abilityBonusAudit.map(
                                                (t) => ({
                                                  kind: "ability",
                                                  name: String(t).slice(0, 160),
                                                  category: "ability",
                                                }),
                                              ),
                                              ...mhBon.heritageBonusAudit.map(
                                                (t) => ({
                                                  kind: "ability",
                                                  name: String(t).slice(0, 160),
                                                  category: "heritage",
                                                }),
                                              ),
                                            ];
                                            const manualPositionEffectSources = [];
                                            if (
                                              !isResistanceManual &&
                                              !isViceManual &&
                                              !isFortuneManual &&
                                              historyManual.pushEffect
                                            ) {
                                              manualPositionEffectSources.push({
                                                kind: "push",
                                                name: "Push for effect",
                                                delta: "+1 effect",
                                                category: "system",
                                              });
                                            }
                                            if (
                                              !isResistanceManual &&
                                              !isViceManual &&
                                              !isFortuneManual
                                            ) {
                                              [
                                                ...mhBon.abilityBonusAudit,
                                                ...mhBon.heritageBonusAudit,
                                              ].forEach((line) => {
                                                if (!String(line).includes("+1 effect"))
                                                  return;
                                                const name =
                                                  String(line).split(":")[0]?.trim() ||
                                                  "Effect boost";
                                                manualPositionEffectSources.push({
                                                  kind: "ability",
                                                  name: name.slice(0, 120),
                                                  delta: "+1 effect",
                                                  category: "ability",
                                                });
                                              });
                                            }
                                            const resistanceSummary =
                                              computeResistanceSummary(
                                                diceResults,
                                              );
                                            const viceSummary =
                                              computeViceManualSummary(
                                                diceResults,
                                              );
                                            if (
                                              isResistanceManual &&
                                              !historyManual.resistanceHarmTarget
                                            ) {
                                              setHistoryWriteError(
                                                "Choose which harm slot this resistance roll reduces.",
                                              );
                                              return;
                                            }
                                            const viceOverAtSave =
                                              isViceManual &&
                                              viceSummary.highest >
                                                (Number(stressFilled) || 0);
                                            if (
                                              viceOverAtSave &&
                                              !String(
                                                historyManual.viceOverindulge ||
                                                  "",
                                              ).trim()
                                            ) {
                                              setHistoryWriteError(
                                                "Overindulgence: choose which consequence applies (highest die exceeds marked stress).",
                                              );
                                              return;
                                            }
                                            if (isFortuneManual) {
                                              const lbl = String(
                                                historyManual.fortunePublicLabel ||
                                                  "",
                                              ).trim();
                                              if (lbl.length < 3) {
                                                setHistoryWriteError(
                                                  "Enter at least 3 characters describing what this fortune roll was for.",
                                                );
                                                return;
                                              }
                                            }
                                            setHistoryManualSaving(true);
                                            if (isResistanceManual) {
                                              const reduced = clearHarmSlot(
                                                historyManual.resistanceHarmTarget,
                                              );
                                              if (!reduced) {
                                                setHistoryWriteError(
                                                  "Selected harm slot is empty or invalid.",
                                                );
                                                setHistoryManualSaving(false);
                                                return;
                                              }
                                              if (resistanceSummary.stressCost > 0)
                                                applyStressCost(
                                                  resistanceSummary.stressCost,
                                                );
                                            }
                                            if (isViceManual) {
                                              setStressFilled((prev) =>
                                                Math.max(
                                                  0,
                                                  (Number(prev) || 0) -
                                                    viceSummary.highest,
                                                ),
                                              );
                                            }
                                            if (isFortuneManual) {
                                              const lbl = String(
                                                historyManual.fortunePublicLabel ||
                                                  "",
                                              )
                                                .trim()
                                                .slice(0, 120);
                                              await rollAPI.createRoll({
                                                character: characterId,
                                                session: sid,
                                                roll_type: "FORTUNE",
                                                action_name: "fortune",
                                                dice_pool: diceResults.length,
                                                results: diceResults,
                                                outcome:
                                                  historyOutcomeBandGmUnlock &&
                                                  isGM
                                                    ? historyManual.outcome
                                                    : outcomeFromFortuneDiceResults(
                                                        diceResults,
                                                      ),
                                                fortune_public_label: lbl,
                                                fortune_reveal_outcome:
                                                  !!historyManual.fortuneRevealPlayers,
                                                description:
                                                  "Manual fortune record from history panel",
                                              });
                                            } else {
                                              await rollAPI.createRoll({
                                                character: characterId,
                                                session: sid,
                                                roll_type: isResistanceManual
                                                  ? "RESISTANCE"
                                                  : isViceManual
                                                    ? "CLEAR_STRESS"
                                                    : "ACTION",
                                                action_name: isViceManual
                                                  ? "vice"
                                                  : isResistanceManual
                                                    ? historyManualResistanceActionName(
                                                        historyManual.action,
                                                      )
                                                    : String(
                                                        historyManual.action ||
                                                          "action",
                                                      ).toLowerCase(),
                                                ...(isResistanceManual || isViceManual
                                                  ? {}
                                                  : {
                                                      position:
                                                        historyManual.position,
                                                      effect: manualStoredEffect,
                                                    }),
                                                dice_pool:
                                                  isResistanceManual ||
                                                  isViceManual
                                                    ? diceResults.length
                                                    : actionPoolForOutcome,
                                                results: diceResults,
                                                outcome: isResistanceManual
                                                  ? resistanceSummary.outcome
                                                  : isViceManual
                                                    ? viceSummary.outcome
                                                    : historyOutcomeBandGmUnlock &&
                                                        isGM
                                                      ? historyManual.outcome
                                                      : outcomeFromActionRoll(
                                                          diceResults,
                                                          actionPoolForOutcome,
                                                          actionRatingForManual,
                                                        ),
                                                ...(!isResistanceManual &&
                                                !isViceManual &&
                                                !isFortuneManual
                                                  ? {
                                                      pool_action_rating:
                                                        actionRatingForManual,
                                                    }
                                                  : {}),
                                                ...(isResistanceManual
                                                  ? {
                                                      roller_stress_spent:
                                                        resistanceSummary.stressCost >
                                                        0
                                                          ? resistanceSummary.stressCost
                                                          : 0,
                                                    }
                                                  : isViceManual
                                                    ? { roller_stress_spent: 0 }
                                                    : {
                                                        push_for_dice:
                                                          !!historyManual.pushDice,
                                                        push_for_effect:
                                                          !!historyManual.pushEffect,
                                                        uses_devil_bargain:
                                                          !!historyManual.devil,
                                                        pool_assist_dice:
                                                          historyManual.helpDie
                                                            ? 1
                                                            : 0,
                                                        group_action:
                                                          historyManual.groupAction &&
                                                          historyManual.groupActionId
                                                            ? parseInt(
                                                                String(
                                                                  historyManual.groupActionId,
                                                                ),
                                                                10,
                                                              )
                                                            : undefined,
                                                        ...(abilityBonusDiceManual > 0
                                                          ? {
                                                              pool_bonus_dice:
                                                                abilityBonusDiceManual,
                                                            }
                                                          : {}),
                                                        ...(manualModifierSources.length >
                                                        0
                                                          ? {
                                                              modifier_sources:
                                                                manualModifierSources,
                                                            }
                                                          : {}),
                                                        ...(manualPositionEffectSources.length >
                                                        0
                                                          ? {
                                                              position_effect_sources:
                                                                manualPositionEffectSources,
                                                            }
                                                          : {}),
                                                      }),
                                                description:
                                                  isResistanceManual
                                                    ? `Manual resistance record from history panel. Reduced harm slot ${historyManual.resistanceHarmTarget}. Stress marked: ${Math.max(0, resistanceSummary.stressCost)}.`
                                                    : isViceManual
                                                      ? `Manual vice record from history panel. Stress cleared (highest die): ${viceSummary.highest}.${viceOverAtSave && String(historyManual.viceOverindulge || "").trim() ? ` Overindulgence: ${viceOverindulgeLabel(historyManual.viceOverindulge)}` : ""}`
                                                      : "Manual record from history panel",
                                              });
                                            }
                                            setHistoryRefreshTick((v) => v + 1);
                                            setHistoryOutcomeBandGmUnlock(false);
                                            setShowHistoryManualModal(false);
                                          } catch (e) {
                                            setHistoryWriteError(
                                              e.message ||
                                                "Failed to create manual history record.",
                                            );
                                          } finally {
                                            setHistoryManualSaving(false);
                                          }
                                        }}
                                        style={{
                                          ...S.btn,
                                          fontSize: 10,
                                          background: "#4338ca",
                                          color: "#fff",
                                        }}
                                      >
                                        {historyManualSaving
                                          ? "Saving…"
                                          : historyManual.rollType === "XP"
                                            ? "Add XP award"
                                            : historyManual.rollType === "FORTUNE"
                                              ? "Add fortune record"
                                              : "Add manual record"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setHistoryOutcomeBandGmUnlock(false);
                                          setShowHistoryManualModal(false);
                                        }}
                                        style={{ ...S.btn, fontSize: 10 }}
                                      >
                                        Cancel
                                      </button>
                                      {historyWriteError ? (
                                        <span
                                          style={{
                                            color: "#f87171",
                                            fontSize: 10,
                                          }}
                                        >
                                          {historyWriteError}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                          {historyLoading ? (
                            <div style={{ color: "#6b7280" }}>Loading history…</div>
                          ) : historyError ? (
                            <div style={{ color: "#fca5a5" }}>{historyError}</div>
                          ) : historyRows.length === 0 ? (
                            <div style={{ color: "#6b7280", lineHeight: 1.45 }}>
                              {historyMode === "session" && !historySessionId
                                ? "No XP log for this filter. Choose a campaign session for rolls, stress, and session-tied XP, or stay on “No session” for full tracker + ledger + advancement edits (all time)."
                                : "No history entries."}
                            </div>
                          ) : (
                            <>
                              {historyUndoError && (
                                <div
                                  style={{
                                    color: "#fca5a5",
                                    fontSize: 10,
                                    marginBottom: 8,
                                  }}
                                >
                                  {historyUndoError}
                                </div>
                              )}
                              {historyRows.slice(0, 200).map((row) => {
                                const undoBusy = historyUndoBusy === row.key;
                                const showUndo =
                                  historyMode === "sheet" &&
                                  (row.type === "sheet_edit" ||
                                    row.type === "xp_tracker") &&
                                  !row.revertedAt;
                                return (
                              <div
                                key={row.key}
                                style={{
                                  padding: "6px 0",
                                  borderBottom: "1px solid #1f2937",
                                  opacity: row.revertedAt ? 0.55 : 1,
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 8,
                                    alignItems: "flex-start",
                                  }}
                                >
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: "#9ca3af", fontSize: 10 }}>
                                  {row.timestamp
                                    ? new Date(row.timestamp).toLocaleString()
                                    : "No timestamp"}{" "}
                                  · {row.actor || "unknown"}
                                  {row.revertedAt ? " · undone" : ""}
                                </div>
                                {row.text ? (
                                  <div style={{ color: "#d1d5db" }}>{row.text}</div>
                                ) : null}
                                {Array.isArray(row.details) &&
                                  row.details.map((d) => (
                                    <div
                                      key={`${row.key}-${d.key}`}
                                      style={{ fontSize: 10, color: "#d1d5db" }}
                                    >
                                      <strong>{d.label}</strong>:{" "}
                                      <span style={{ color: "#fca5a5" }}>
                                        {d.oldValue || "∅"}
                                      </span>{" "}
                                      →{" "}
                                      <span style={{ color: "#86efac" }}>
                                        {d.newValue || "∅"}
                                      </span>
                                    </div>
                                  ))}
                                {row.modifiers?.length ? (
                                  <div style={{ fontSize: 10, color: "#a78bfa" }}>
                                    {row.modifiers.join(" · ")}
                                  </div>
                                ) : null}
                                  </div>
                                  {showUndo && (
                                    <button
                                      type="button"
                                      onClick={() => handleHistoryRowUndo(row)}
                                      disabled={
                                        undoBusy || row.canUndo === false
                                      }
                                      title={
                                        row.canUndo === false
                                          ? row.undoBlockReason ||
                                            "Cannot undo this entry"
                                          : "Undo this change"
                                      }
                                      style={{
                                        flexShrink: 0,
                                        background: "#312e81",
                                        border: "1px solid #6366f1",
                                        borderRadius: 6,
                                        padding: "2px 6px",
                                        cursor:
                                          undoBusy || row.canUndo === false
                                            ? "not-allowed"
                                            : "pointer",
                                        color: "#c7d2fe",
                                        fontSize: 12,
                                        lineHeight: 1,
                                        opacity:
                                          row.canUndo === false ? 0.45 : 1,
                                      }}
                                    >
                                      {undoBusy ? "…" : "↩"}
                                    </button>
                                  )}
                                </div>
                              </div>
                                );
                              })}
                            </>
                          )}
                        </>
                    </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={S.g2}>
              {/* ══ LEFT COLUMN ══ */}
              <div>
                {/* Identity */}
                <div style={S.card}>
                  <div
                    style={{
                      display: "flex",
                      gap: "16px",
                      alignItems: "start",
                      flexWrap: "wrap",
                    }}
                  >
                    {/* Portrait */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "4px",
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          width: "80px",
                          height: "80px",
                          borderRadius: "50%",
                          border: "2px solid #4b5563",
                          background: "#1f2937",
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {imagePreview ? (
                          <img
                            src={imagePreview}
                            alt=""
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <span style={{ color: "#4b5563", fontSize: "28px" }}>
                            ?
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          type="button"
                          onClick={openPortraitUrlModal}
                          style={{
                            ...S.btn,
                            fontSize: "9px",
                            padding: "2px 6px",
                            background: "#1f2937",
                            color: "#9ca3af",
                          }}
                        >
                          URL
                        </button>
                        <button
                          type="button"
                          onClick={handleRemovePortrait}
                          style={{
                            ...S.btn,
                            fontSize: "9px",
                            padding: "2px 6px",
                            background: "#1f2937",
                            color: "#9ca3af",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    {/* Identity fields */}
                    <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
                          gap: "8px",
                        }}
                      >
                        <div>
                          <span style={S.lbl}>NAME</span>
                          <input
                            style={S.inp}
                            value={charData.name}
                            onChange={(e) => {
                              markDirtyIntent();
                              setCharData((p) => ({
                                ...p,
                                name: e.target.value,
                              }));
                            }}
                            placeholder="Character Name"
                          />
                        </div>
                        <div>
                          <span style={S.lbl}>CREW</span>
                          <input
                            style={S.inp}
                            value={charData.crew}
                            onChange={(e) =>
                              setCharData((p) => ({
                                ...p,
                                crew: e.target.value,
                              }))
                            }
                            onBlur={commitCrewName}
                            placeholder="Crew name (shared in campaign when you are in one)"
                          />
                        </div>
                      </div>
                      <div style={{ marginTop: "8px" }}>
                        <span style={S.lbl}>STAND NAME</span>
                        <input
                          style={S.inp}
                          value={charData.standName}
                          onChange={(e) =>
                            setCharData((p) => ({
                              ...p,
                              standName: e.target.value,
                            }))
                          }
                          placeholder="「Stand Name」"
                        />
                      </div>
                      <div style={{ marginTop: "8px" }}>
                        <span style={S.lbl}>LOOK</span>
                        <input
                          style={S.inp}
                          value={charData.look}
                          onChange={(e) =>
                            setCharData((p) => ({ ...p, look: e.target.value }))
                          }
                          placeholder="Appearance and style"
                        />
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(0, 1fr))",
                          gap: "8px",
                          marginTop: "8px",
                        }}
                      >
                        <div>
                          <span style={S.lbl}>HERITAGE</span>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              flexWrap: "wrap",
                            }}
                          >
                            <select
                              style={{
                                ...S.sel,
                                width: "100%",
                                flex: 1,
                                minWidth: 0,
                              }}
                              disabled={
                                heritagesLoading || heritages.length === 0
                              }
                              value={charData.heritage ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                const newHeritageId = val
                                  ? parseInt(val, 10)
                                  : null;
                                setCharData((p) => ({
                                  ...p,
                                  heritage: newHeritageId,
                                }));
                                if (newHeritageId && heritages.length) {
                                  const h = heritages.find(
                                    (x) => x.id === newHeritageId,
                                  );
                                  if (h) {
                                    const reqB = (h.benefits || [])
                                      .filter((b) => b.required)
                                      .map((b) => b.id);
                                    const reqD = (h.detriments || [])
                                      .filter((d) => d.required)
                                      .map((d) => d.id);
                                    setSelectedBenefits(reqB);
                                    setSelectedDetriments(reqD);
                                  }
                                } else {
                                  setSelectedBenefits([]);
                                  setSelectedDetriments([]);
                                }
                              }}
                            >
                              {heritagesLoading ? (
                                <option value="">Loading heritages…</option>
                              ) : heritagesError && !heritages.length ? (
                                <option value="">
                                  Could not load heritages
                                </option>
                              ) : (
                                heritages.map((h) => (
                                  <option key={h.id} value={h.id}>
                                    {h.name}
                                  </option>
                                ))
                              )}
                            </select>
                            {heritagesError && onRetryHeritages && (
                              <button
                                type="button"
                                onClick={() => onRetryHeritages()}
                                style={{
                                  ...S.btn,
                                  background: "#374151",
                                  color: "#e5e7eb",
                                  fontSize: "11px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Retry
                              </button>
                            )}
                          </div>
                          {heritagesError && (
                            <div
                              style={{
                                fontSize: "10px",
                                color: "#f87171",
                                marginTop: "4px",
                              }}
                            >
                              {heritagesError}
                            </div>
                          )}
                        </div>
                        <div>
                          <span style={S.lbl}>BACKGROUND</span>
                          <input
                            style={S.inp}
                            value={charData.background}
                            onChange={(e) =>
                              setCharData((p) => ({
                                ...p,
                                background: e.target.value,
                              }))
                            }
                            placeholder="Background"
                          />
                        </div>
                        <div>
                          <span style={S.lbl}>CAMPAIGN</span>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <select
                              style={{
                                ...S.sel,
                                width: "100%",
                                flex: 1,
                                minWidth: 0,
                              }}
                              value={campaignId}
                              onChange={(e) =>
                                handleCampaignChange(e.target.value)
                              }
                            >
                              <option value="">No Campaign</option>
                              {campaigns.length === 0 ? (
                                <option value="" disabled>
                                  Create a campaign in Campaign Management first
                                </option>
                              ) : (
                                campaigns.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))
                              )}
                            </select>
                            {campaignAssignStatus === "saving" && (
                              <span
                                style={{ fontSize: "11px", color: "#fbbf24" }}
                              >
                                Assigning…
                              </span>
                            )}
                            {campaignAssignStatus === "saved" && (
                              <span
                                style={{ fontSize: "11px", color: "#34d399" }}
                              >
                                Assigned
                              </span>
                            )}
                            {campaignAssignStatus === "error" && (
                              <span
                                style={{ fontSize: "11px", color: "#f87171" }}
                                title={campaignAssignError}
                              >
                                {campaignAssignError || "Failed"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: "8px" }}>
                        <span style={S.lbl}>VICE / PURVEYOR</span>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                          }}
                        >
                          <select
                            value={charData.vice}
                            onChange={(e) =>
                              setCharData((p) => ({
                                ...p,
                                vice: e.target.value,
                              }))
                            }
                            style={S.sel}
                          >
                            <option value="">Select Vice</option>
                            {VICE_OPTIONS.map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </select>
                          <input
                            style={{ ...S.inp, flex: 1 }}
                            placeholder="Purveyor details"
                            value={charData.viceDetails ?? ""}
                            onChange={(e) =>
                              setCharData((p) => ({
                                ...p,
                                viceDetails: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stress & Trauma */}
                <div style={S.card}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: "6px",
                    }}
                  >
                    <span style={{ ...S.lbl, marginBottom: 0 }}>STRESS</span>
                    <span style={{ fontSize: "11px", color: "#6b7280" }}>
                      {stressFilled}/{maxStress}
                    </span>
                  </div>
                  {stressMaxNeedsTraumaClear ? (
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#f87171",
                        marginBottom: "6px",
                        lineHeight: 1.35,
                      }}
                    >
                      {traumaMarkedCount < 1
                        ? "Stress track is full — mark a trauma below to clear all stress."
                        : "Stress track is full again — mark another trauma below to clear all stress."}
                    </div>
                  ) : null}
                  <div
                    style={{
                      display: "flex",
                      gap: "3px",
                      flexWrap: "wrap",
                      marginBottom: "12px",
                    }}
                    title={
                      stressMaxNeedsTraumaClear
                        ? "Clearing stress blocked until you mark a trauma."
                        : undefined
                    }
                  >
                    {Array.from({ length: maxStress }, (_, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          const next =
                            i < stressFilled ? i : i + 1;
                          const decreases = next < stressFilled;
                          if (
                            decreases &&
                            stressMaxNeedsTraumaClear
                          ) {
                            return;
                          }
                          markFieldTouch("stress");
                          setStressFilled(next);
                        }}
                        style={{
                          width: "22px",
                          height: "22px",
                          border: "1px solid #4b5563",
                          cursor: "pointer",
                          background: i < stressFilled ? "#dc2626" : "#1f2937",
                        }}
                      />
                    ))}
                  </div>
                  <span style={S.lbl}>TRAUMA</span>
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}
                  >
                    {Object.entries(trauma).map(([t, checked]) => (
                      <label
                        key={t}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          cursor: "pointer",
                          fontSize: "11px",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTraumaMark(t)}
                        />
                        {t}
                      </label>
                    ))}
                  </div>

                  {/* Vice roll — stress relief (downtime / table agreement) */}
                  <div
                    style={{
                      marginTop: "12px",
                      paddingTop: "12px",
                      borderTop: "1px solid #374151",
                      background: "#1f2937",
                      borderRadius: "6px",
                      paddingLeft: "10px",
                      paddingRight: "10px",
                      paddingBottom: "10px",
                    }}
                  >
                    <span
                      style={{
                        color: "#f87171",
                        fontSize: "11px",
                        fontWeight: "bold",
                        marginBottom: "6px",
                        display: "block",
                      }}
                    >
                      VICE ROLL
                    </span>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#9ca3af",
                        lineHeight: 1.45,
                        marginBottom: "8px",
                      }}
                    >
                      Roll dice equal to your{" "}
                      <span style={{ color: "#e5e7eb", fontWeight: "bold" }}>
                        lowest attribute
                      </span>{" "}
                      (Insight / Prowess / Resolve). Clear stress equal to the{" "}
                      <span style={{ color: "#e5e7eb", fontWeight: "bold" }}>
                        highest die
                      </span>
                      . If that number is greater than stress you had marked,
                      you{" "}
                      <span style={{ color: "#fbbf24", fontWeight: "bold" }}>
                        overindulge
                      </span>
                      . Skipping vice in downtime: take stress equal to your
                      trauma ({traumaMarkedCount}); no trauma means vice cannot
                      force stress yet.
                    </div>
                    {String(charData.vice || "").trim() ? (
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#a78bfa",
                          marginBottom: "8px",
                        }}
                      >
                        Vice on sheet: {String(charData.vice).trim()}
                      </div>
                    ) : null}
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#d1d5db",
                        marginBottom: "8px",
                      }}
                    >
                      Pool:{" "}
                      <span style={{ color: "#a78bfa", fontWeight: "bold" }}>
                        {viceDicePool}d
                      </span>
                      <span style={{ color: "#6b7280" }}>
                        {" "}
                        (Insight {viceAttributeDice[0]?.dice ?? 0} · Prowess{" "}
                        {viceAttributeDice[1]?.dice ?? 0} · Resolve{" "}
                        {viceAttributeDice[2]?.dice ?? 0})
                        {viceLowestLabels
                          ? ` — lowest: ${viceLowestLabels}`
                          : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDiceResult(null);
                        const pool = viceDicePool;
                        let dice;
                        let highest;
                        const zeroDice = pool === 0;
                        if (zeroDice) {
                          const d1 = Math.floor(Math.random() * 6) + 1;
                          const d2 = Math.floor(Math.random() * 6) + 1;
                          highest = Math.min(d1, d2);
                          dice = [d1, d2];
                        } else {
                          dice = Array.from(
                            { length: pool },
                            () => Math.floor(Math.random() * 6) + 1,
                          );
                          highest = Math.max(...dice);
                        }
                        const stressBefore = Number(stressFilled) || 0;
                        const wouldOverindulge = highest > stressBefore;
                        setViceRollResult({
                          dice,
                          highest,
                          dicePool: pool,
                          zeroDice,
                          wouldOverindulge,
                          stressBefore,
                          applied: false,
                          overindulge: "",
                          wantedApplyErr: null,
                          viceApplyErr: null,
                        });
                      }}
                      style={{
                        ...S.btn,
                        background: "#7c3aed",
                        color: "#fff",
                        fontSize: "11px",
                      }}
                    >
                      Vice roll
                    </button>
                    {viceRollResult ? (
                      <div
                        style={{
                          marginTop: "10px",
                          padding: "8px",
                          borderRadius: "4px",
                          background: "#0d1117",
                          border: "1px solid #374151",
                          fontSize: "11px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: "4px",
                            flexWrap: "wrap",
                            marginBottom: "6px",
                          }}
                        >
                          {viceRollResult.dice.map((die, i) => (
                            <span
                              key={i}
                              style={{
                                display: "inline-flex",
                                width: "24px",
                                height: "24px",
                                borderRadius: "4px",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: "bold",
                                border: "1px solid",
                                background:
                                  die === 6
                                    ? "#166534"
                                    : die >= 4
                                      ? "#1e3a8a"
                                      : "#374151",
                                borderColor:
                                  die === 6
                                    ? "#22c55e"
                                    : die >= 4
                                      ? "#3b82f6"
                                      : "#6b7280",
                              }}
                            >
                              {die}
                            </span>
                          ))}
                        </div>
                        {viceRollResult.zeroDice ? (
                          <div style={{ color: "#f87171", marginBottom: "4px" }}>
                            0 rating — rolled 2d, took lower
                          </div>
                        ) : null}
                        <div style={{ color: "#e5e7eb", marginBottom: "4px" }}>
                          Highest:{" "}
                          <strong style={{ color: "#34d399" }}>
                            {viceRollResult.highest}
                          </strong>{" "}
                          → clear that many stress (cap at what you had:{" "}
                          {viceRollResult.stressBefore} marked).
                        </div>
                        {viceRollResult.wouldOverindulge ? (
                          <div
                            style={{
                              color: "#fbbf24",
                              marginBottom: "6px",
                              fontWeight: "bold",
                            }}
                          >
                            Overindulgence: you cleared more stress than you
                            had marked — bad call from vice. Choose an outcome
                            below with the table/GM.
                          </div>
                        ) : null}
                        {viceRollResult.wouldOverindulge &&
                        !viceRollResult.applied ? (
                          <select
                            value={viceRollResult.overindulge || ""}
                            onChange={(e) =>
                              setViceRollResult((p) =>
                                p
                                  ? {
                                      ...p,
                                      overindulge: e.target.value,
                                      wantedApplyErr: null,
                                      viceApplyErr: null,
                                    }
                                  : p,
                              )
                            }
                            style={{
                              ...S.sel,
                              width: "100%",
                              maxWidth: "100%",
                              fontSize: "11px",
                              marginBottom: "8px",
                            }}
                          >
                            {VICE_OVERINDULGE_CHOICES.map((o) => (
                              <option key={o.value || "none"} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        {viceRollResult.wouldOverindulge &&
                        viceRollResult.applied &&
                        viceRollResult.overindulge ? (
                          <div
                            style={{
                              padding: "6px 8px",
                              marginBottom: "8px",
                              borderRadius: "4px",
                              background: "#422006",
                              border: "1px solid #a16207",
                              color: "#fde68a",
                              fontSize: "11px",
                              lineHeight: 1.4,
                            }}
                          >
                            <strong>Overindulgence:</strong>{" "}
                            {viceOverindulgeLabel(viceRollResult.overindulge)}
                          </div>
                        ) : null}
                        {viceRollResult.wouldOverindulge &&
                        viceRollResult.overindulge === "brag" ? (
                          <div
                            style={{
                              fontSize: "10px",
                              color: "#93c5fd",
                              marginBottom: "8px",
                            }}
                          >
                            Apply will bump this campaign&rsquo;s wanted stars by
                            +2 (caps at 5) before stress clears.
                          </div>
                        ) : null}
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          <button
                            type="button"
                            disabled={!!viceRollResult.applied}
                            onClick={async () => {
                              if (!viceRollResult || viceRollResult.applied)
                                return;
                              if (
                                viceRollResult.wouldOverindulge &&
                                !String(
                                  viceRollResult.overindulge || "",
                                ).trim()
                              ) {
                                setViceRollResult((p) =>
                                  p
                                    ? {
                                        ...p,
                                        viceApplyErr:
                                          "Choose an overindulgence consequence before applying.",
                                      }
                                    : p,
                                );
                                return;
                              }
                              const hi = viceRollResult.highest;
                              const bumpWanted =
                                viceRollResult.wouldOverindulge &&
                                viceRollResult.overindulge === "brag";
                              try {
                                setViceRollResult((p) =>
                                  p ? { ...p, viceApplyErr: null } : p,
                                );
                                if (bumpWanted) {
                                  if (!charCampaign?.id) {
                                    setViceRollResult((p) =>
                                      p
                                        ? {
                                            ...p,
                                            wantedApplyErr:
                                              "No campaign linked; wanted stars not updated.",
                                          }
                                        : p,
                                    );
                                    return;
                                  }
                                  await campaignAPI.incrementCampaignWanted(
                                    charCampaign.id,
                                    { amount: 2, cap: 5 },
                                  );
                                  onCampaignRefresh?.();
                                }
                                markFieldTouch("stress");
                                setStressFilled((prev) =>
                                  Math.max(0, (Number(prev) || 0) - hi),
                                );
                                // Once stress is applied, close the result card.
                                setViceRollResult(null);
                              } catch (e) {
                                setViceRollResult((p) =>
                                  p
                                    ? {
                                        ...p,
                                        wantedApplyErr:
                                          e.message ||
                                          "Could not update campaign wanted stars.",
                                      }
                                    : p,
                                );
                              }
                            }}
                            style={{
                              ...S.btn,
                              background: "#059669",
                              color: "#fff",
                              fontSize: "11px",
                            }}
                          >
                            {viceRollResult.applied
                              ? "Stress cleared"
                              : `Apply −${viceRollResult.highest} stress`}
                          </button>
                          <button
                            type="button"
                            onClick={() => setViceRollResult(null)}
                            style={{ ...S.btn, fontSize: "11px" }}
                          >
                            Dismiss
                          </button>
                        </div>
                        {viceRollResult.viceApplyErr ? (
                          <div
                            style={{
                              marginTop: "8px",
                              color: "#fca5a5",
                              fontSize: "11px",
                            }}
                          >
                            {viceRollResult.viceApplyErr}
                          </div>
                        ) : null}
                        {viceRollResult.wantedApplyErr ? (
                          <div
                            style={{
                              marginTop: "8px",
                              color: "#fca5a5",
                              fontSize: "11px",
                            }}
                          >
                            {viceRollResult.wantedApplyErr}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Harm + Armor */}
                <div style={S.card}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "16px",
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                      <span style={S.lbl}>HARM</span>
                      {(
                        [
                          { key: "level4", label: "FATAL", count: 1 },
                          { key: "level3", label: "NEED HELP", count: 1 },
                        ]
                      ).map(({ key, label, count }) => (
                        <div
                          key={key}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            marginBottom: "4px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "10px",
                              color: "#9ca3af",
                              width: "68px",
                              flexShrink: 0,
                            }}
                          >
                            {label}
                          </span>
                          <input
                            style={{
                              ...S.inp,
                              flex: 1,
                              minWidth: 0,
                              border: "1px solid #374151",
                              background: "#0a0a0a",
                              padding: "2px 6px",
                              fontSize: "11px",
                            }}
                            placeholder={`Lv${key.slice(-1)} harm`}
                            value={harm[key]?.[0] ?? ""}
                            onChange={(e) =>
                              setHarm((p) => {
                                const row = Array.isArray(p[key])
                                  ? [...p[key]]
                                  : Array(count).fill("");
                                const hadValue = String(row[0] || "").trim().length > 0;
                                row[0] = e.target.value;
                                const hasNewValue =
                                  String(e.target.value || "").trim().length > 0;
                                if (!hadValue && hasNewValue) setHealingClock(0);
                                return { ...p, [key]: row };
                              })
                            }
                          />
                        </div>
                      ))}
                      {hasFatalHarm && hasStayingPowerAbility ? (
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#fda4af",
                            lineHeight: 1.35,
                            marginBottom: "8px",
                            padding: "6px 8px",
                            background: "#1c1917",
                            border: "1px solid #9f1239",
                            borderRadius: "4px",
                          }}
                        >
                          <strong>Staying Power:</strong> Fatal (Level 4) harm is
                          marked. If resistance or other effects cannot remove
                          this KO, work with the GM to exercise Staying Power
                          (e.g. limb or severe complication instead) using the
                          post-roll option above— it turns on automatically while
                          this slot is filled.
                        </div>
                      ) : null}
                      {(
                        [
                          { key: "level2", label: "-1D", count: 2 },
                          { key: "level1", label: "LESS EFFECT", count: 2 },
                        ]
                      ).map(({ key, label, count }) => (
                        <div
                          key={key}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            marginBottom: "4px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "10px",
                              color: "#9ca3af",
                              width: "68px",
                              flexShrink: 0,
                            }}
                          >
                            {label}
                          </span>
                          <div
                            style={{
                              display: "flex",
                              flex: 1,
                              minWidth: 0,
                              gap: "6px",
                            }}
                          >
                            {Array.from({ length: count }, (_, idx) => (
                              <input
                                key={`${key}-${idx}`}
                                style={{
                                  ...S.inp,
                                  flex: 1,
                                  minWidth: 0,
                                  border: "1px solid #374151",
                                  background: "#0a0a0a",
                                  padding: "2px 6px",
                                  fontSize: "11px",
                                }}
                                placeholder={`Lv${key.slice(-1)} harm`}
                                value={harm[key]?.[idx] ?? ""}
                                onChange={(e) =>
                                  setHarm((p) => {
                                    const row = Array.isArray(p[key])
                                      ? [...p[key]]
                                      : Array(count).fill("");
                                    const hadValue =
                                      String(row[idx] || "").trim().length > 0;
                                    row[idx] = e.target.value;
                                    const hasNewValue =
                                      String(e.target.value || "").trim().length > 0;
                                    if (!hadValue && hasNewValue) setHealingClock(0);
                                    return { ...p, [key]: row };
                                  })
                                }
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* SRD_DEV: all armor pools — Stand/Spin/Hamon + inventory gear */}
                    <div
                      style={{
                        flex: "1 1 200px",
                        minWidth: 0,
                        maxWidth: "240px",
                      }}
                    >
                      <CharacterSheetArmorPanel
                        showStandArmor={showStandArmor}
                        standArmorMax={standArmorMax}
                        standArmorUsed={standArmorUsed}
                        onStandArmorUsedChange={setStandArmorUsed}
                        showSpinArmor={showSpinArmor}
                        spinArmorUsed={spinArmorUsed}
                        onSpinArmorUsedChange={setSpinArmorUsed}
                        showHamonArmor={showHamonArmor}
                        hamonArmorUsed={hamonArmorUsed}
                        onHamonArmorUsedChange={setHamonArmorUsed}
                        inventory={charData.inventory}
                        physicalArmorUsed={physicalArmorUsed}
                        onPhysicalArmorUsedChange={setPhysicalArmorUsed}
                        specialArmorUsed={specialArmorUsed}
                        onSpecialArmorUsedChange={setSpecialArmorUsed}
                      />
                      {characterHasLegendaryGuard(abilities) ? (
                        <div
                          title={
                            'Standard: Legendary Guard — once per score, completely negate one instance of incoming harm (table tracks when used).'
                          }
                          style={{
                            marginTop: "8px",
                            padding: "5px 6px",
                            fontSize: "9px",
                            lineHeight: 1.3,
                            color: "#86efac",
                            background: "#0f172a",
                            border: "1px solid #166534",
                            borderRadius: "4px",
                            maxWidth: "100%",
                          }}
                        >
                          <span style={{ fontWeight: "bold", color: "#bbf7d0" }}>
                            Legendary Guard
                          </span>
                          <span style={{ display: "block", color: "#a7f3d0" }}>
                            1× / score · negate incoming harm (not armor boxes)
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      paddingTop: "10px",
                      borderTop: "1px solid #2d1f52",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      alignItems: "stretch",
                      boxSizing: "border-box",
                    }}
                  >
                    <span style={S.lbl}>HEALING</span>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "14px",
                        alignItems: "flex-start",
                        width: "100%",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "4px",
                          flexShrink: 0,
                        }}
                      >
                        <ProgressClock
                          size={55}
                          segments={healingClockSegments}
                          filled={healingClock}
                          interactive
                          onClick={handleHealingClockAdjust}
                        />
                      </div>
                      <div
                        style={{
                          flex: "1 1 240px",
                          minWidth: "min(100%, 200px)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "stretch",
                            gap: "4px",
                            width: "100%",
                          }}
                        >
                        <span
                          style={{
                            fontSize: "9px",
                            color: "#6b7280",
                            textAlign: "left",
                          }}
                          title="Dice pool = your dots in the playbook action you pick here (study, survey, tinkering to bind injuries, etc.). Stand Coin stats are not generic healing pools—Precision/Speed (or fiction you agree on with the GM) should apply only through a specific ability, item, or declared treatment method, not via this dropdown. Default Tinker; saved per character in this browser."
                        >
                          Recover roll action (default Tinker)
                        </span>
                        <select
                          aria-label="Healing recover action"
                          disabled={healingRecoverBusy || !canEditSheet}
                          value={selfHealingRecoverAction}
                          onChange={(e) => {
                            const chosen = pickHealClockAction(e.target.value);
                            setSelfHealingRecoverAction(chosen);
                            if (!characterId) return;
                            try {
                              window.localStorage.setItem(
                                `biz:self-healing-recover-action:${characterId}`,
                                chosen,
                              );
                            } catch {
                              /* ignore quota / privacy mode */
                            }
                          }}
                          style={{
                            ...S.sel,
                            width: "100%",
                            fontSize: "11px",
                            paddingBlock: "4px",
                          }}
                        >
                          {healRollActionChoices.map((action) => (
                            <option key={action} value={action}>
                              {action}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "6px",
                          marginTop: "2px",
                          width: "100%",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => performHealingRecover("downtime")}
                          disabled={healingRecoverBusy || !canEditSheet}
                          style={{
                            ...S.btn,
                            flex: "1 1 140px",
                            fontSize: "11px",
                            background: "#0f766e",
                            color: "#f8fafc",
                            opacity:
                              healingRecoverBusy || !canEditSheet ? 0.6 : 1,
                          }}
                          title={`Downtime recover: treat yourself when you have downtime or an equivalent pause—even during a gaming session—when GM/table agrees. SRD stress: 2. Roll ${pickHealClockAction(selfHealingRecoverAction)} for healing clock segments (1-3:+1, 4/5:+2, 6:+3, critical:+5).${
                            selfRecoverInvigoratedDice
                              ? " Pool includes +1d Invigorated when that ability appears on your sheet or heritage."
                              : ""
                          }`}
                        >
                          downtime recover
                        </button>
                        <button
                          type="button"
                          onClick={() => performHealingRecover("mid-action")}
                          disabled={
                            healingRecoverBusy ||
                            !canEditSheet ||
                            !Boolean(activeSessionId)
                          }
                          style={{
                            ...S.btn,
                            flex: "1 1 140px",
                            fontSize: "11px",
                            background: "#4338ca",
                            color: "#ffffff",
                            opacity:
                              healingRecoverBusy ||
                              !canEditSheet ||
                              !Boolean(activeSessionId)
                                ? 0.6
                                : 1,
                          }}
                          title={`Mid-action recover: treat yourself mid-score. Requires time & safety (SRD). SRD stress cost: 2. Roll ${pickHealClockAction(selfHealingRecoverAction)} for healing clock segments (1-3:+1, 4/5:+2, 6:+3, critical:+5).${
                            selfRecoverInvigoratedDice
                              ? " Pool includes +1d Invigorated when that ability appears on your sheet or heritage."
                              : ""
                          }`}
                        >
                          mid-action recover
                        </button>
                      </div>

                      {healingRecoverErr ? (
                        <div
                          style={{
                            marginTop: "6px",
                            fontSize: "11px",
                            color: "#fca5a5",
                            textAlign: "center",
                          }}
                        >
                          {healingRecoverErr}
                        </div>
                      ) : null}
                      {healingRecoverMsg ? (
                        <div
                          style={{
                            marginTop: "6px",
                            fontSize: "11px",
                            color: "#a78bfa",
                            textAlign: "center",
                          }}
                        >
                          {healingRecoverMsg}
                        </div>
                      ) : null}
                      </div>
                    </div>
                    </div>

                </div>
                </div>

                {/* Coin & Stash */}
                <div style={S.card}>
                  <span style={S.lbl}>COIN</span>
                  <div
                    style={{ display: "flex", gap: "4px", marginBottom: "8px" }}
                  >
                    {Array.from({ length: 4 }, (_, i) => (
                      <div
                        key={i}
                        onClick={() =>
                          setCoinFilled(i < coinFilled ? i : i + 1)
                        }
                        style={{
                          width: "24px",
                          height: "24px",
                          border: "1px solid #4b5563",
                          cursor: "pointer",
                          background: i < coinFilled ? "#ca8a04" : "#1f2937",
                        }}
                      />
                    ))}
                  </div>
                  <span style={S.lbl}>STASH</span>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(10, 1fr)",
                      gap: "2px",
                    }}
                  >
                    {stashBoxes.map((f, i) => (
                      <div
                        key={i}
                        onClick={() =>
                          setStashBoxes((p) =>
                            p.map((v, j) => (j === i ? !v : v)),
                          )
                        }
                        style={{
                          width: "16px",
                          height: "16px",
                          border: "1px solid #2d2d2d",
                          cursor: "pointer",
                          background: f ? "#ca8a04" : "#0a0a0a",
                        }}
                      />
                    ))}
                  </div>
                  {/* Inventory — under stash (kit + loadout live near coin/stash) */}
                  <div style={{ marginTop: "12px" }}>
                    <button
                      type="button"
                      onClick={() =>
                        setNotesInventoryExpandedPersist((prev) => ({
                          ...prev,
                          inventory: !prev.inventory,
                        }))
                      }
                      aria-expanded={notesInventoryExpanded.inventory}
                      aria-controls="character-sheet-inventory-panel"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        width: "100%",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        marginBottom: "8px",
                        textAlign: "left",
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          color: "#9ca3af",
                          fontSize: "10px",
                          lineHeight: 1,
                          width: "12px",
                          flexShrink: 0,
                          userSelect: "none",
                        }}
                      >
                        {notesInventoryExpanded.inventory ? "\u25bc" : "\u25ba"}
                      </span>
                      <span
                        style={{
                          color: S.lbl.color,
                          fontSize: S.lbl.fontSize,
                          fontWeight: S.lbl.fontWeight,
                        }}
                      >
                        INVENTORY
                      </span>
                    </button>
                    {notesInventoryExpanded.inventory ? (
                      <CharacterSheetInventoryList
                        panelId="character-sheet-inventory-panel"
                        inventory={charData.inventory}
                        readOnly={!canEditSheet}
                        onChange={(next) => {
                          markDirtyIntent();
                          markFieldTouch("inventory");
                          setCharData((p) => ({ ...p, inventory: next }));
                        }}
                        onInventoryTouch={() => markFieldTouch("inventory")}
                        loadoutEntry={sessionLoadoutEntry}
                        onLoadoutChange={handleLoadoutChange}
                        activeSessionId={activeSessionId}
                        coinFilled={coinFilled}
                        abilities={abilities}
                        campaignId={campaignId}
                        characterId={characterId}
                        isGM={isGM}
                        onPromoteToCampaign={
                          isGM ? handlePromoteItemToCampaign : undefined
                        }
                        onPublishToSite={
                          isGM ? handlePublishItemToSite : undefined
                        }
                      />
                    ) : null}
                  </div>
                </div>

                {/* XP & Advancement — free pool spendable with or without active session */}
                <div style={S.card}>
                  <span style={S.lbl}>EXPERIENCE TRACKS</span>
                  <div
                    style={{
                      marginBottom: "12px",
                      padding: "10px",
                      background: "#1a1025",
                      border: "1px solid rgb(109, 40, 217)",
                      borderRadius: "6px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                        marginBottom: "4px",
                      }}
                    >
                      <div
                        style={{
                          color: "rgb(167, 139, 250)",
                          fontWeight: "bold",
                        }}
                      >
                        Available XP: {unallocatedXp}
                      </div>
                      {sessionDevXP > 0 ? (
                        <span
                          style={{ fontSize: "10px", color: "#9ca3af" }}
                          title="Stand Development grade → free-pool XP at next session end."
                        >
                          Next end-session bank +{sessionDevXP} (DEV{" "}
                          {GRADE[devVal]})
                        </span>
                      ) : null}
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#9ca3af",
                        lineHeight: 1.45,
                        marginBottom: "8px",
                      }}
                    >
                      Free pool (not tied to a live session). Earned from
                      scorecard and Stand Development; bank anytime onto the
                      tracks below. Filling a track mints a pending advance —
                      leftover marks stay. Take advance redeems a pending (no
                      second XP spend). Desperate-roll XP marks attribute tracks
                      automatically and never sits here.
                    </div>
                    {unallocatedXp <= 0 ? (
                      <div style={{ fontSize: "10px", color: "#6b7280" }}>
                        No free-pool XP right now. Scorecard / Dev awards land
                        here after sessions; tick track boxes when you have pool
                        XP to bank.
                      </div>
                    ) : (
                      <div style={{ fontSize: "10px", color: "#6b7280" }}>
                        Click empty boxes on Insight / Prowess / Resolve /
                        Heritage / Playbook below to bank from this pool.
                      </div>
                    )}
                    {poolTickError ? (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: "10px",
                          color: "#f87171",
                        }}
                      >
                        {poolTickError}
                      </div>
                    ) : null}
                  </div>
                  {[
                    { name: "INSIGHT", key: "insight", max: 5 },
                    { name: "PROWESS", key: "prowess", max: 5 },
                    { name: "RESOLVE", key: "resolve", max: 5 },
                    { name: "HERITAGE", key: "heritage", max: 5 },
                    { name: "PLAYBOOK", key: "playbook", max: 10 },
                  ].map(({ name, key, max }) => {
                    const filled = Number(xp[key]) || 0;
                    const pendingCount = Number(
                      pendingAdvanceCounts?.[key] || 0,
                    );
                    const canTakeAdvance = pendingCount > 0;
                    return (
                    <div
                      key={key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "4px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#9ca3af",
                          width: "64px",
                        }}
                      >
                        {name}
                      </span>
                      <div style={{ display: "flex", gap: "2px" }}>
                        {Array.from({ length: max }, (_, i) => {
                          const isFilled = i < filled;
                          const canSpendHere =
                            canEditSheet &&
                            !poolAllocateBusy &&
                            !isFilled &&
                            unallocatedXp >= i + 1 - filled;
                          const boxesInteractive =
                            canEditSheet &&
                            (canSpendHere || isFilled);
                          return (
                            <div
                              key={i}
                              role="button"
                              tabIndex={boxesInteractive ? 0 : -1}
                              title={
                                isFilled
                                  ? canEditSheet
                                    ? `Return ${filled - i} to Available XP`
                                    : "Filled"
                                  : canSpendHere
                                    ? `Bank ${i + 1 - filled} from Available XP`
                                    : unallocatedXp < 1
                                      ? "Need Available XP in the free pool first"
                                      : "Not enough Available XP for this tick"
                              }
                              onClick={() => {
                                toggleXP(key, i);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  toggleXP(key, i);
                                }
                              }}
                              style={{
                                width: "13px",
                                height: "13px",
                                border: "1px solid #4b5563",
                                cursor:
                                  canSpendHere || isFilled
                                    ? poolAllocateBusy
                                      ? "wait"
                                      : "pointer"
                                    : "not-allowed",
                                background: isFilled ? "#7c3aed" : "#111827",
                                opacity:
                                  !isFilled && !canSpendHere ? 0.45 : 1,
                              }}
                            />
                          );
                        })}
                      </div>
                      <span style={{ fontSize: "10px", color: "#6b7280" }}>
                        ({filled}/{max})
                        {pendingCount > 0
                          ? ` · ${pendingCount} pending`
                          : ""}
                      </span>
                      {canTakeAdvance && canEditSheet && character?.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            setMinorAdvanceError(null);
                            setLevelUpError(null);
                            if (key === "playbook") {
                              setLevelUpLockTrack("playbook");
                              setLevelUpSpendTrack("playbook");
                              setLevelUpChoice(
                                playbook === "Spin" || playbook === "Hamon"
                                  ? "playbook_ability"
                                  : "stat",
                              );
                              setShowLevelUp(true);
                              return;
                            }
                            if (key === "heritage") {
                              setShowTrackAdvance({ key, kind: "heritage" });
                              return;
                            }
                            setMinorAdvanceSpendTrack(key);
                            const opts = actionOptionsForXpSpendTrack(
                              actionRatings,
                              key,
                            );
                            if (opts.length)
                              setMinorAdvanceAction(opts[0]);
                            setShowTrackAdvance({ key, kind: "attribute" });
                          }}
                          style={{
                            ...S.btn,
                            fontSize: "10px",
                            padding: "2px 8px",
                            background: "#7c3aed",
                            color: "#fff",
                            fontWeight: "bold",
                          }}
                        >
                          Take advance
                          {pendingCount > 1 ? ` (${pendingCount})` : ""}
                        </button>
                      ) : null}
                    </div>
                    );
                  })}
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#6b7280",
                      marginBottom: "6px",
                      lineHeight: 1.4,
                    }}
                  >
                    Tick empty boxes to bank Available XP onto that track.
                    Filling a track mints a pending advance (leftover stays).
                    Take advance redeems one pending (attribute → +1 action
                    dot; heritage → +1 HP; playbook → coin / ability / acquire
                    Stand).
                  </div>

                  <div
                    style={{
                      marginTop: "10px",
                      padding: "10px",
                      background: "#0d1117",
                      borderRadius: "6px",
                      border: "1px solid #374151",
                      fontSize: "11px",
                      color: "#9ca3af",
                      lineHeight: "1.6",
                    }}
                  >
                    <div style={{ marginBottom: "8px" }}>
                      <span style={S.lbl}>XP REQUIREMENTS (SRD)</span>
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#6b7280",
                          marginTop: "4px",
                          lineHeight: 1.45,
                        }}
                      >
                        Desperate ACTION → +1 on that attribute (group desperate
                        too); 0-dot desperate → +2. Desperate Power / Speed /
                        Precision stand dice → +1 playbook (innate, uncapped; not
                        Range, Durability, or Dev). End-session toggles + Dev
                        bonus → free pool (bank onto tracks later). Downtime
                        training not automated yet. Crew XP: use crew scorecard
                        triggers.
                      </div>
                    </div>
                    {!xpReqSnapshot.hasActiveSession && (
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#9ca3af",
                        }}
                      >
                        No active session — requirement progress and desperate-roll
                        tallies will show once the GM starts a session for this
                        campaign and rolls or XP entries are logged.
                      </div>
                    )}
                    {xpReqSnapshot.hasActiveSession && (
                      <>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "8px",
                            padding: "4px 0",
                            borderBottom: "1px solid #1f2937",
                          }}
                        >
                          <div>
                            <span style={{ color: "#e5e7eb" }}>
                              Desperate action rolls
                            </span>
                            <span
                              style={{
                                marginLeft: "6px",
                                fontSize: "10px",
                                color: "#6b7280",
                              }}
                            >
                              (auto, +1 XP / roll to that attribute)
                            </span>
                            <div
                              style={{ fontSize: "10px", color: "#6b7280", marginTop: "2px" }}
                            >
                              This session: {xpReqSnapshot.desperateRolls.count} —{" "}
                              {xpReqSnapshot.desperateRolls.count === 0
                                ? "no desperate action rolls yet"
                                : formatAttrTally(
                                    xpReqSnapshot.desperateRolls.byAttribute,
                                  )}
                            </div>
                            {xpReqSnapshot.desperateTrackerNote > 0 && (
                              <div
                                style={{ fontSize: "10px", color: "#a78bfa", marginTop: "2px" }}
                              >
                                Logged in tracker: up to +{xpReqSnapshot.desperateTrackerNote}{" "}
                                (desperate rolls; display capped)
                              </div>
                            )}
                            <div
                              style={{ fontSize: "10px", color: "#6b7280", marginTop: "6px" }}
                            >
                              Innate stand dice (Power / Speed / Precision):{" "}
                              {xpReqSnapshot.innateStandDice.count === 0
                                ? "none this session"
                                : `${xpReqSnapshot.innateStandDice.count} — ${formatInnateStandTally(
                                    xpReqSnapshot.innateStandDice.byStat,
                                  )}`}
                              {xpReqSnapshot.innateTrackerNote > 0
                                ? ` · tracker +${xpReqSnapshot.innateTrackerNote} playbook (uncapped)`
                                : ""}
                            </div>
                          </div>
                        </div>
                        {(() => {
                          const playbookRow = {
                            v: xpReqSnapshot.playbook,
                            trigger: "PLAYBOOK_SPECIFIC",
                          };
                          const renderPips = (row) => {
                            const canToggle =
                              xpReqSnapshot.hasActiveSession && canEditSheet;
                            const busy = xpToggleBusyTrigger === row.trigger;
                            return (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  flexShrink: 0,
                                }}
                              >
                                {[0, 1].map((idx) => {
                                  const filled = idx < row.v;
                                  const action = filled ? -1 : 1;
                                  const disabled =
                                    !canToggle ||
                                    busy ||
                                    (filled && idx !== row.v - 1) ||
                                    (!filled && idx !== row.v);
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() =>
                                        handleXpTriggerToggle(
                                          row.trigger,
                                          action,
                                        )
                                      }
                                      disabled={disabled}
                                      aria-label={`${filled ? "Revoke" : "Award"} ${row.trigger} XP`}
                                      title={
                                        !canToggle
                                          ? xpReqSnapshot.hasActiveSession
                                            ? "Only the character owner or GM can toggle"
                                            : "Requires an active session"
                                          : filled
                                            ? "Click to untoggle (-1 XP)"
                                            : "Click to award +1 XP"
                                      }
                                      style={{
                                        width: 16,
                                        height: 16,
                                        padding: 0,
                                        borderRadius: 3,
                                        border: filled
                                          ? "1px solid #a78bfa"
                                          : "1px solid #374151",
                                        background: filled
                                          ? "#7c3aed"
                                          : "transparent",
                                        cursor: disabled
                                          ? "not-allowed"
                                          : "pointer",
                                        opacity: disabled && !filled ? 0.45 : 1,
                                      }}
                                    />
                                  );
                                })}
                                <span
                                  style={{
                                    fontFamily: "monospace",
                                    color: "#e5e7eb",
                                    minWidth: 28,
                                    textAlign: "right",
                                  }}
                                >
                                  {row.v} / 2
                                </span>
                              </span>
                            );
                          };
                          return (
                            <>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  gap: "10px",
                                  padding: "5px 0",
                                  borderBottom: "1px solid #1f2937",
                                }}
                              >
                                <div
                                  style={{
                                    flex: "1 1 0",
                                    minWidth: 0,
                                    color: "#d1d5db",
                                  }}
                                >
                                  <div style={{ fontWeight: 500 }}>
                                    Playbook-specific (end of session, max 2)
                                  </div>
                                  <div
                                    style={{
                                      fontSize: "10px",
                                      color: "#6b7280",
                                      marginTop: "4px",
                                      lineHeight: 1.45,
                                    }}
                                  >
                                    SRD: mark XP when you used your playbook
                                    abilities in the fiction (for example resisting harm,
                                    boosting rolls, or shifting position or effect with
                                    Stand, Hamon, or Spin). Max 2 XP total for this
                                    category.
                                  </div>
                                </div>
                                {renderPips(playbookRow)}
                              </div>
                              {[
                                {
                                  label:
                                    "Beliefs, drives, heritage, or background (end of session, max 2)",
                                  v: xpReqSnapshot.beliefs,
                                  trigger: "BELIEFS",
                                },
                                {
                                  label:
                                    "Struggle: vice, trauma, entanglements (end of session, max 2)",
                                  v: xpReqSnapshot.struggle,
                                  trigger: "STRUGGLE",
                                },
                              ].map((row) => (
                                <div
                                  key={row.label}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "5px 0",
                                    borderBottom: "1px solid #1f2937",
                                  }}
                                >
                                  <span style={{ color: "#d1d5db" }}>
                                    {row.label}
                                  </span>
                                  {renderPips(row)}
                                </div>
                              ))}
                            </>
                          );
                        })()}
                        {xpToggleError && (
                          <div
                            style={{
                              color: "#fca5a5",
                              fontSize: 11,
                              marginTop: 4,
                            }}
                          >
                            {xpToggleError}
                          </div>
                        )}
                        {xpReqActiveSessionEntries.length > 0 && (
                          <div style={{ marginTop: 10 }}>
                            <div
                              style={{
                                fontSize: 10,
                                color: "#9ca3af",
                                marginBottom: 4,
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                              }}
                            >
                              This session's XP records
                            </div>
                            <ul
                              style={{
                                listStyle: "none",
                                margin: 0,
                                padding: 0,
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                              }}
                            >
                              {xpReqActiveSessionEntries.map((entry) => {
                                const trig =
                                  entry.trigger_display || entry.trigger || "XP";
                                const amt = Number(entry.xp_gained) || 0;
                                const desc = String(
                                  entry.description || "",
                                ).trim();
                                const src = (
                                  entry.award_source || "AUTO"
                                ).toUpperCase();
                                const who =
                                  src === "AUTO"
                                    ? "Auto"
                                    : src === "GM"
                                      ? `GM${entry.awarded_by_username ? ` (${entry.awarded_by_username})` : ""}`
                                      : `Self${entry.awarded_by_username ? ` (${entry.awarded_by_username})` : ""}`;
                                const sessLbl = entry.session_name
                                  ? entry.session_name
                                  : entry.session
                                    ? `session ${entry.session}`
                                    : "out of session";
                                const busy = xpEntryDeleteBusy === entry.id;
                                return (
                                  <li
                                    key={`xp-entry-${entry.id}`}
                                    style={{
                                      display: "flex",
                                      alignItems: "flex-start",
                                      justifyContent: "space-between",
                                      gap: 6,
                                      padding: "4px 6px",
                                      background: "#0b1220",
                                      border: "1px solid #1f2937",
                                      borderRadius: 4,
                                      fontSize: 11,
                                    }}
                                  >
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div
                                        style={{
                                          color: "#e5e7eb",
                                          fontWeight: 600,
                                        }}
                                      >
                                        +{amt} {trig}
                                      </div>
                                      <div
                                        style={{
                                          color: "#9ca3af",
                                          fontSize: 10,
                                          marginTop: 1,
                                        }}
                                      >
                                        {who} · {sessLbl}
                                      </div>
                                      {desc && (
                                        <div
                                          style={{
                                            color: "#6b7280",
                                            fontSize: 10,
                                            marginTop: 1,
                                            wordBreak: "break-word",
                                          }}
                                        >
                                          {desc}
                                        </div>
                                      )}
                                    </div>
                                    {canEditSheet &&
                                      entry.can_undo_from_sheet !== false && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteXpEntry(entry)
                                        }
                                        disabled={busy}
                                        aria-label="Delete XP entry"
                                        title={
                                          entry.undo_block_reason ||
                                          "Delete this XP record"
                                        }
                                        style={{
                                          flexShrink: 0,
                                          width: 22,
                                          height: 22,
                                          borderRadius: 4,
                                          border: "1px solid #7f1d1d",
                                          background: busy
                                            ? "#374151"
                                            : "#1f2937",
                                          color: "#fca5a5",
                                          cursor: busy
                                            ? "not-allowed"
                                            : "pointer",
                                          fontSize: 12,
                                          lineHeight: 1,
                                          padding: 0,
                                        }}
                                      >
                                        ×
                                      </button>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                        {xpReqSnapshot.beliefs === 0 &&
                          xpReqSnapshot.struggle === 0 &&
                          xpReqSnapshot.playbook === 0 &&
                          xpReqSnapshot.desperateRolls.count === 0 &&
                          xpReqSnapshot.desperateTrackerNote === 0 && (
                            <div
                              style={{
                                fontSize: "10px",
                                color: "#6b7280",
                                marginTop: "8px",
                              }}
                            >
                              No session XP events yet — keep playing; this fills as
                              your group logs rolls and (at end of session) reviews
                              story beats.
                            </div>
                          )}
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#6b7280",
                            marginTop: "8px",
                          }}
                        >
                          <span style={S.lbl}>MARK XP WHEN YOU…</span> (same
                          SRD) — make a{" "}
                          <strong style={{ color: "#9ca3af" }}>desperate</strong>{" "}
                          action roll; express{" "}
                          <strong style={{ color: "#9ca3af" }}>beliefs, drives, heritage, or background</strong>; struggle with your{" "}
                          <strong style={{ color: "#9ca3af" }}>vice, trauma, or crew</strong>{" "}
                          entanglements; plus playbook-specific marks at end of session.
                        </div>
                        <details
                          style={{ marginTop: "8px", fontSize: "10px", color: "#6b7280" }}
                        >
                          <summary style={{ cursor: "pointer", userSelect: "none" }}>
                            Desperate roll → attribute (+1) · end-of-session (max 2 each)
                          </summary>
                          <p style={{ margin: "6px 0 0" }}>
                            <strong>Desperate rolls:</strong> +1 XP in the roll&apos;s
                            attribute: Insight (Hunt, Study, Survey, Tinker), Prowess
                            (Finesse, Prowl, Skirmish, Wreck), Resolve (Bizarre, Command, Consort, Sway).
                            {" "}
                            <strong>End of session:</strong> table review for
                            beliefs / struggle / playbook, up to 2 XP in each
                            category; you may place that XP on any track when you
                            spend it. Numbers here come from the experience tracker
                            (this session) and your desperate rolls in the dice log.
                          </p>
                        </details>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ══ RIGHT COLUMN ══ */}
              <div>
                <div style={{ ...S.card, border: "1px solid #4b5563" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "14px",
                    }}
                  >
                    <h2
                      style={{
                        margin: 0,
                        fontSize: "18px",
                        color: "#9ca3af",
                        fontWeight: "bold",
                      }}
                    >
                      PLAYBOOK
                    </h2>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "center",
                      }}
                    >
                      <select
                        value={playbook}
                        onChange={(e) => setPlaybook(e.target.value)}
                        style={S.sel}
                        aria-label="Playbook"
                      >
                        {PLAYBOOK_SHEET_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {hasStandPlaybook && (
                    <div
                      style={{
                        marginTop: "10px",
                        marginBottom: "12px",
                        padding: "10px",
                        background: "#111827",
                        borderRadius: "6px",
                        border: "1px solid #374151",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#9ca3af",
                          marginBottom: "8px",
                        }}
                      >
                        Stand identity (flavor)
                      </div>
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#6b7280",
                          marginBottom: "8px",
                          lineHeight: 1.4,
                        }}
                      >
                        Types also drive Playbook-specific end-of-session XP
                        archetypes. Forms and consciousness are personal flavor
                        only (not advancement).
                      </div>
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#9ca3af",
                          marginBottom: "4px",
                        }}
                      >
                        Stand type(s)
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px 12px",
                          marginBottom: "8px",
                        }}
                      >
                        {STAND_ARCHETYPE_ROWS.map((opt) => (
                          <label
                            key={opt.key}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "5px",
                              fontSize: "10px",
                              color: "#d1d5db",
                              cursor: canEditSheet ? "pointer" : "default",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={playbookXpArchetypes.includes(opt.key)}
                              disabled={!canEditSheet || !characterId}
                              onChange={() =>
                                togglePlaybookXpArchetypeKey(opt.key)
                              }
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "10px",
                          color: "#9ca3af",
                          marginBottom: "8px",
                        }}
                      >
                        Custom type label (optional)
                        <input
                          type="text"
                          value={standTypeCustom}
                          disabled={!canEditSheet}
                          onChange={(e) => setStandTypeCustom(e.target.value)}
                          placeholder="Fiction subtype name"
                          style={{
                            ...S.inp,
                            display: "block",
                            width: "100%",
                            marginTop: "4px",
                            fontSize: "11px",
                          }}
                        />
                      </label>
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#9ca3af",
                          marginBottom: "4px",
                        }}
                      >
                        Form(s)
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px 12px",
                          marginBottom: "6px",
                        }}
                      >
                        {STAND_FORM_PRESETS.map((formLabel) => {
                          const checked = standForms.includes(formLabel);
                          return (
                            <label
                              key={formLabel}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "5px",
                                fontSize: "10px",
                                color: "#d1d5db",
                                cursor: canEditSheet ? "pointer" : "default",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!canEditSheet}
                                onChange={() => {
                                  setStandForms((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(formLabel)) next.delete(formLabel);
                                    else next.add(formLabel);
                                    return STAND_FORM_PRESETS.filter((f) =>
                                      next.has(f),
                                    ).concat(
                                      prev.filter(
                                        (f) => !STAND_FORM_PRESETS.includes(f),
                                      ),
                                    );
                                  });
                                }}
                              />
                              {formLabel}
                            </label>
                          );
                        })}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          alignItems: "center",
                          marginBottom: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <input
                          type="text"
                          value={standFormCustomDraft}
                          disabled={!canEditSheet}
                          onChange={(e) =>
                            setStandFormCustomDraft(e.target.value)
                          }
                          placeholder="Custom form…"
                          style={{
                            ...S.inp,
                            flex: "1 1 120px",
                            fontSize: "11px",
                          }}
                        />
                        <button
                          type="button"
                          disabled={!canEditSheet || !standFormCustomDraft.trim()}
                          onClick={() => {
                            const custom = standFormCustomDraft.trim();
                            if (!custom) return;
                            setStandForms((prev) =>
                              normalizeStandFormsList([...prev, custom]),
                            );
                            setStandFormCustomDraft("");
                          }}
                          style={{
                            ...S.btn,
                            fontSize: "10px",
                            padding: "4px 8px",
                          }}
                        >
                          Add
                        </button>
                      </div>
                      {standForms.some((f) => !STAND_FORM_PRESETS.includes(f)) && (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "6px",
                            marginBottom: "8px",
                          }}
                        >
                          {standForms
                            .filter((f) => !STAND_FORM_PRESETS.includes(f))
                            .map((f) => (
                              <button
                                key={f}
                                type="button"
                                disabled={!canEditSheet}
                                onClick={() =>
                                  setStandForms((prev) =>
                                    prev.filter((x) => x !== f),
                                  )
                                }
                                title="Remove custom form"
                                style={{
                                  fontSize: "10px",
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  border: "1px solid #4b5563",
                                  background: "#1f2937",
                                  color: "#d1d5db",
                                  cursor: canEditSheet ? "pointer" : "default",
                                }}
                              >
                                {f} ×
                              </button>
                            ))}
                        </div>
                      )}
                      <label
                        style={{
                          display: "block",
                          fontSize: "10px",
                          color: "#9ca3af",
                        }}
                      >
                        Consciousness (flavor grade)
                        <select
                          value={standConsciousness}
                          disabled={!canEditSheet}
                          onChange={(e) =>
                            setStandConsciousness(e.target.value)
                          }
                          style={{
                            ...S.sel,
                            display: "block",
                            marginTop: "4px",
                            width: "100%",
                            maxWidth: 120,
                          }}
                        >
                          <option value="">—</option>
                          {STAND_CONSCIOUSNESS_GRADES.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                  {((hasStandPlaybook &&
                    standardAbilitiesList.length === 0) ||
                    (isHamonPlaybook && hamonAbilitiesList.length === 0) ||
                    (isSpinPlaybook && spinAbilitiesList.length === 0)) && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#9ca3af",
                        marginBottom: "12px",
                        padding: "8px 10px",
                        background: "#111827",
                        borderRadius: "6px",
                        border: "1px solid #374151",
                      }}
                    >
                      Reference playbook abilities are missing on the server.
                      Run migrations or load reference fixtures, then refresh.
                    </div>
                  )}

                  {/* Heritage Benefits & Detriments — above Stand Coin Stats */}
                  {charData.heritage &&
                    heritages.length > 0 &&
                    (() => {
                      const currentHeritage = heritages.find(
                        (h) => h.id === charData.heritage,
                      );
                      if (!currentHeritage) return null;
                      const benefits = currentHeritage.benefits || [];
                      const detriments = currentHeritage.detriments || [];
                      const baseHp = currentHeritage.base_hp ?? 0;
                      const benefitCost = benefits
                        .filter(
                          (b) =>
                            selectedBenefits.includes(b.id) && !b.required,
                        )
                        .reduce((s, b) => s + (b.hp_cost || 0), 0);
                      const detrimentGain = detriments
                        .filter(
                          (d) =>
                            selectedDetriments.includes(d.id) && !d.required,
                        )
                        .reduce((s, d) => s + (d.hp_value || 0), 0);
                      const hpRemaining = baseHp + detrimentGain - benefitCost;
                      const toggleBenefit = (id) => {
                        const b = benefits.find((x) => x.id === id);
                        if (b?.required) return;
                        setSelectedBenefits((prev) =>
                          prev.includes(id)
                            ? prev.filter((x) => x !== id)
                            : [...prev, id],
                        );
                      };
                      const toggleDetriment = (id) => {
                        const d = detriments.find((x) => x.id === id);
                        if (d?.required) return;
                        setSelectedDetriments((prev) =>
                          prev.includes(id)
                            ? prev.filter((x) => x !== id)
                            : [...prev, id],
                        );
                      };
                      if (benefits.length === 0 && detriments.length === 0) {
                        return (
                          <div
                            style={{
                              marginBottom: "16px",
                              paddingBottom: "16px",
                              borderBottom: "1px solid #374151",
                            }}
                          >
                            <span style={S.lbl}>
                              HERITAGE BENEFITS & DETRIMENTS
                            </span>
                            <div
                              style={{
                                fontSize: "11px",
                                color: "#9ca3af",
                                marginTop: "8px",
                              }}
                            >
                              Reference benefits and detriments are missing on
                              the server. Run migrations or load reference
                              fixtures, then refresh.
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div
                          style={{
                            marginBottom: "16px",
                            paddingBottom: "16px",
                            borderBottom: "1px solid #374151",
                          }}
                        >
                          <span style={S.lbl}>
                            HERITAGE BENEFITS & DETRIMENTS
                          </span>
                          <div
                            style={{
                              marginBottom: "8px",
                              fontSize: "11px",
                              color: hpRemaining >= 0 ? "#86efac" : "#fca5a5",
                            }}
                          >
                            HP budget: {baseHp} base + {detrimentGain}{" "}
                            (optional detriments) − {benefitCost} (optional
                            benefits) = {hpRemaining} remaining
                          </div>
                          {hpRemaining < 0 && (
                            <div style={{ ...S.warn, marginBottom: "8px" }}>
                              HP budget exceeded. Take optional detriments or
                              remove optional benefits.
                            </div>
                          )}
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: "12px",
                            }}
                          >
                            <div>
                              <span
                                style={{
                                  fontSize: "10px",
                                  color: "#9ca3af",
                                  display: "block",
                                  marginBottom: "4px",
                                }}
                              >
                                Benefits
                              </span>
                              {(benefits.length === 0 ? [] : benefits).map(
                                (b) => (
                                  <label
                                    key={b.id}
                                    style={{
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: "6px",
                                      marginBottom: "4px",
                                      cursor: b.required
                                        ? "default"
                                        : "pointer",
                                      fontSize: "11px",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedBenefits.includes(b.id)}
                                      onChange={() => toggleBenefit(b.id)}
                                      disabled={b.required}
                                    />
                                    <span
                                      style={{ flex: 1, position: "relative" }}
                                    >
                                      <span
                                        data-desc-tooltip-trigger
                                        style={{
                                          textDecoration: (
                                            b.description || ""
                                          ).trim()
                                            ? "underline"
                                            : "none",
                                          textDecorationStyle: "dotted",
                                          cursor: (b.description || "").trim()
                                            ? "help"
                                            : "default",
                                        }}
                                        onMouseEnter={() => {
                                          if (
                                            (b.description || "").trim() &&
                                            !descTooltipPinned
                                          )
                                            setDescTooltip({
                                              type: "benefit",
                                              id: b.id,
                                              name: b.name,
                                              description: b.description || "",
                                            });
                                        }}
                                        onMouseLeave={() => {
                                          if (!descTooltipPinned)
                                            setDescTooltip(null);
                                        }}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if ((b.description || "").trim()) {
                                            const isOpen =
                                              descTooltip?.type === "benefit" &&
                                              descTooltip?.id === b.id;
                                            setDescTooltip(
                                              isOpen
                                                ? null
                                                : {
                                                    type: "benefit",
                                                    id: b.id,
                                                    name: b.name,
                                                    description:
                                                      b.description || "",
                                                  },
                                            );
                                            setDescTooltipPinned(!isOpen);
                                          }
                                        }}
                                      >
                                        {b.name}
                                      </span>
                                      {!b.required &&
                                        b.hp_cost != null &&
                                        b.hp_cost > 0 && (
                                        <span style={{ color: "#f59e0b" }}>
                                          {" "}
                                          ({b.hp_cost} HP)
                                        </span>
                                      )}
                                      {b.required && (
                                        <span style={{ color: "#6b7280" }}>
                                          {" "}
                                          (required)
                                        </span>
                                      )}
                                      {descTooltip?.type === "benefit" &&
                                        descTooltip?.id === b.id && (
                                          <div
                                            data-desc-tooltip-trigger
                                            style={{
                                              position: "absolute",
                                              zIndex: 100,
                                              marginTop: "4px",
                                              padding: "8px 10px",
                                              background: "#1f2937",
                                              border: "1px solid #4b5563",
                                              borderRadius: "4px",
                                              fontSize: "11px",
                                              color: "#d1d5db",
                                              maxWidth: "280px",
                                              lineHeight: 1.4,
                                              boxShadow:
                                                "0 4px 12px rgba(0,0,0,0.5)",
                                            }}
                                          >
                                            {descTooltip.description}
                                          </div>
                                        )}
                                    </span>
                                  </label>
                                ),
                              )}
                            </div>
                            <div>
                              <span
                                style={{
                                  fontSize: "10px",
                                  color: "#9ca3af",
                                  display: "block",
                                  marginBottom: "4px",
                                }}
                              >
                                Detriments
                              </span>
                              {(detriments.length === 0 ? [] : detriments).map(
                                (d) => (
                                  <label
                                    key={d.id}
                                    style={{
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: "6px",
                                      marginBottom: "4px",
                                      cursor: d.required
                                        ? "default"
                                        : "pointer",
                                      fontSize: "11px",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedDetriments.includes(
                                        d.id,
                                      )}
                                      onChange={() => toggleDetriment(d.id)}
                                      disabled={d.required}
                                    />
                                    <span
                                      style={{ flex: 1, position: "relative" }}
                                    >
                                      <span
                                        data-desc-tooltip-trigger
                                        style={{
                                          textDecoration: (
                                            d.description || ""
                                          ).trim()
                                            ? "underline"
                                            : "none",
                                          textDecorationStyle: "dotted",
                                          cursor: (d.description || "").trim()
                                            ? "help"
                                            : "default",
                                        }}
                                        onMouseEnter={() => {
                                          if (
                                            (d.description || "").trim() &&
                                            !descTooltipPinned
                                          )
                                            setDescTooltip({
                                              type: "detriment",
                                              id: d.id,
                                              name: d.name,
                                              description: d.description || "",
                                            });
                                        }}
                                        onMouseLeave={() => {
                                          if (!descTooltipPinned)
                                            setDescTooltip(null);
                                        }}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if ((d.description || "").trim()) {
                                            const isOpen =
                                              descTooltip?.type ===
                                                "detriment" &&
                                              descTooltip?.id === d.id;
                                            setDescTooltip(
                                              isOpen
                                                ? null
                                                : {
                                                    type: "detriment",
                                                    id: d.id,
                                                    name: d.name,
                                                    description:
                                                      d.description || "",
                                                  },
                                            );
                                            setDescTooltipPinned(!isOpen);
                                          }
                                        }}
                                      >
                                        {d.name}
                                      </span>
                                      {!d.required &&
                                        d.hp_value != null &&
                                        d.hp_value > 0 && (
                                        <span style={{ color: "#34d399" }}>
                                          {" "}
                                          (+{d.hp_value} HP)
                                        </span>
                                      )}
                                      {d.required && (
                                        <span style={{ color: "#6b7280" }}>
                                          {" "}
                                          (required)
                                        </span>
                                      )}
                                      {descTooltip?.type === "detriment" &&
                                        descTooltip?.id === d.id && (
                                          <div
                                            data-desc-tooltip-trigger
                                            style={{
                                              position: "absolute",
                                              zIndex: 100,
                                              marginTop: "4px",
                                              padding: "8px 10px",
                                              background: "#1f2937",
                                              border: "1px solid #4b5563",
                                              borderRadius: "4px",
                                              fontSize: "11px",
                                              color: "#d1d5db",
                                              maxWidth: "280px",
                                              lineHeight: 1.4,
                                              boxShadow:
                                                "0 4px 12px rgba(0,0,0,0.5)",
                                            }}
                                          >
                                            {descTooltip.description}
                                          </div>
                                        )}
                                    </span>
                                  </label>
                                ),
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                  {/* Stand Coin Stats — only when Stand is in either playbook slot */}
                  {hasStandPlaybook ? (
                  <div style={{ marginBottom: "16px" }}>
                    <div
                      style={{
                        background: "#0d0d1a",
                        border: "1px solid #2d1f52",
                        borderRadius: "4px",
                        padding: "12px",
                        marginBottom: "12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          marginBottom: "10px",
                        }}
                      >
                        <span
                          style={{
                            color: "#a78bfa",
                            fontSize: "11px",
                            fontWeight: "bold",
                            marginBottom: "4px",
                            display: "block",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          Stand Coin Stats
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            color:
                              totalStandPoints > standCoinIndexBudget
                                ? "#f87171"
                                : totalStandPoints === standCoinIndexBudget
                                  ? "#34d399"
                                  : "#6b7280",
                          }}
                          title={`SRD grade-value sum across six stats (${STAND_COIN_CREATION_POINT_SUM} at chargen, +${Number(character?.standCoinPointsGained) || 0} from XP on record).`}
                        >
                          {totalStandPoints}/{standCoinIndexBudget} pts
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#6b7280",
                          marginBottom: "10px",
                          lineHeight: 1.45,
                        }}
                      >
                        <strong>Rolls</strong>: Power / Precision / Speed / Durability
                        — dice when fiction calls for your Stand (
                        fourth column under Action Ratings; grades + XP unlocks via radar).
                        {" "}
                        <strong>Passives</strong> on this chart:{" "}
                        {STAND_PASSIVE_KEYS.join(", ")} (
                        GM distance &amp; Growth — no pool).
                      </div>

                      {totalStandPoints > standCoinIndexBudget ? (
                        <div style={{ ...S.warn, marginBottom: "8px" }}>
                          Over budget by{" "}
                          {totalStandPoints - standCoinIndexBudget} point
                          {totalStandPoints - standCoinIndexBudget > 1
                            ? "s"
                            : ""}{" "}
                          — reduce a stat or reconcile XP / server advances
                        </div>
                      ) : null}

                      <NpcsStandCoin
                        variant="pc"
                        pcMaxGrade={pcStandCoinMaxLetter}
                        grades={standCoinGrades}
                        readouts={pcStandCoinReadouts}
                        onStep={bumpStandCoinGrade}
                        plannedGrades={plannedCoinGrades}
                        readOnly={
                          !(
                            isStandCoinChargenEditable ||
                            (planMode && isPostChargen && canEditPlan)
                          )
                        }
                      />

                      <div
                        style={{
                          fontSize: "10px",
                          color: "#4b5563",
                          marginTop: "8px",
                          lineHeight: 1.45,
                        }}
                      >
                        {isStandCoinChargenEditable
                          ? "Chargen: click a wedge to raise one grade if leftover pts remain (budget 6). Right-click or Shift-click to lower and refund. This is not an advance."
                          : canAffordLevelUp
                            ? "Stand coin is locked here. Redeem a playbook pending via Take advance for +1 Stand Coin grade."
                            : "Stand coin is locked after chargen. Fill playbook (10) to mint a pending, then Take advance for +1 grade."}
                        {" "}
                        {maxStandGradeIndex >= 5
                          ? "S-rank is enabled for this character by the GM."
                          : "Player max is A unless the GM enables S-rank for this character."}
                        {" "}
                        Hover or focus a wedge to see grade rules.
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: "6px",
                        background: "#0d1117",
                        borderRadius: "4px",
                        padding: "6px 8px",
                        fontSize: "11px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ color: "#6b7280" }}>
                        Coin: {totalStandPoints} pts × 10 ={" "}
                        <span style={{ color: "#a78bfa" }}>
                          {totalStandPoints * 10} XP
                        </span>
                      </span>
                      <span style={{ color: "#6b7280" }}>
                        Dots: {totalActionDots} × 5 ={" "}
                        <span style={{ color: "#a78bfa" }}>
                          {totalActionDots * 5} XP
                        </span>
                      </span>
                      <span
                        style={{
                          color: isChargenIncomplete
                            ? "#818cf8"
                            : pcLevel >= 4
                              ? "#fbbf24"
                              : "#34d399",
                          fontWeight: "bold",
                          fontSize: isChargenIncomplete ? "10px" : undefined,
                          lineHeight: isChargenIncomplete ? 1.25 : undefined,
                          maxWidth: isChargenIncomplete ? 220 : undefined,
                          textAlign: isChargenIncomplete ? "right" : undefined,
                        }}
                      >
                        {isChargenIncomplete
                          ? CHARGEN_LEVEL_PROMPT
                          : `Lv ${pcLevel}`}
                      </span>
                    </div>
                  </div>
                  ) : null}

                  {/* Session info the table shares with this sheet (wanted, NPC clocks). */}
                  {charCampaign && activeSessionId && (
                    <div
                      style={{
                        ...S.card,
                        marginBottom: "14px",
                        borderColor: "#4b5563",
                        borderLeftWidth: "3px",
                        borderLeftColor: "#7c3aed",
                      }}
                    >
                      <span style={S.lbl}>SESSION</span>
                      <div
                        style={{
                          display: "flex",
                          gap: "12px",
                          alignItems: "center",
                          marginBottom: "8px",
                        }}
                      >
                        <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                          Wanted:
                        </span>
                        <div style={{ display: "flex", gap: "2px" }}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span
                              key={n}
                              style={{
                                color:
                                  n <= (charCampaign.wanted_stars ?? 0)
                                    ? "#fbbf24"
                                    : "#4b5563",
                              }}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                      </div>
                      {sessionNpcsPartyFacingDisplay.length > 0 && (
                        <div style={{ marginBottom: "8px" }}>
                          <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                            Session NPC Clocks:
                          </span>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "12px",
                              marginTop: "4px",
                            }}
                          >
                            {sessionNpcsPartyFacingDisplay.map((npc) => (
                              <div
                                key={npc.id}
                                style={{
                                  background: "#1f2937",
                                  padding: "8px",
                                  borderRadius: "4px",
                                  border: "1px solid #374151",
                                  minWidth: "120px",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: "bold",
                                    color: "#e5e7eb",
                                    marginBottom: "4px",
                                  }}
                                >
                                  {npc.name || "NPC"}
                                </div>
                                {npc.stand_name && (
                                  <div
                                    style={{
                                      fontSize: "10px",
                                      color: "#9ca3af",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    {npc.stand_name}
                                  </div>
                                )}
                                {npc.stand_coin_stats &&
                                  Object.keys(npc.stand_coin_stats).length > 0 && (
                                    <div
                                      style={{
                                        fontSize: "10px",
                                        color: "#a78bfa",
                                        marginBottom: "4px",
                                      }}
                                    >
                                      Stand{" "}
                                      {Object.entries(npc.stand_coin_stats)
                                        .map(([k, v]) => `${k[0]}:${v}`)
                                        .join(" · ")}
                                    </div>
                                  )}
                                {Array.isArray(npc.abilities) &&
                                  npc.abilities.length > 0 && (
                                    <div
                                      style={{
                                        marginBottom: "6px",
                                        padding: "4px 6px",
                                        border: "1px solid #374151",
                                        borderRadius: "4px",
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontSize: "10px",
                                          color: "#9ca3af",
                                          marginBottom: "2px",
                                        }}
                                      >
                                        Abilities
                                      </div>
                                      {(npc.abilities || []).slice(0, 6).map((ab) => (
                                        <div
                                          key={ab.id || ab.name}
                                          style={{
                                            fontSize: "10px",
                                            color: "#d1d5db",
                                            lineHeight: 1.35,
                                          }}
                                        >
                                          {ab.name || "Ability"}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                {npc.vulnerability_clock_max > 0 && (
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    <ProgressClock
                                      size={36}
                                      segments={npc.vulnerability_clock_max}
                                      filled={npc.vulnerability_clock_current}
                                    />
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        color: "#9ca3af",
                                      }}
                                    >
                                      Vuln {npc.vulnerability_clock_current}/
                                      {npc.vulnerability_clock_max}
                                    </span>
                                  </div>
                                )}
                                {(npc.conflict_clocks || []).length > 0
                                  ? (npc.conflict_clocks || []).map((clk) => (
                                      <div
                                        key={clk.id || clk.name}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "6px",
                                          marginBottom: "2px",
                                        }}
                                      >
                                        <ProgressClock
                                          size={32}
                                          segments={clk.segments || 4}
                                          filled={clk.filled || 0}
                                        />
                                        <span
                                          style={{
                                            fontSize: "10px",
                                            color: "#6b7280",
                                          }}
                                        >
                                          {clk.name || "Conflict"}{" "}
                                          {clk.filled || 0}/{clk.segments || 4}
                                        </span>
                                      </div>
                                    ))
                                  : null}
                                {(npc.alt_clocks || []).length > 0
                                  ? (npc.alt_clocks || []).map((clk) => (
                                      <div
                                        key={clk.id || clk.name}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "6px",
                                          marginBottom: "2px",
                                        }}
                                      >
                                        <ProgressClock
                                          size={32}
                                          segments={clk.segments || 4}
                                          filled={clk.filled || 0}
                                        />
                                        <span
                                          style={{
                                            fontSize: "10px",
                                            color: "#6b7280",
                                          }}
                                        >
                                          {clk.name || "Alt"} {clk.filled || 0}/
                                          {clk.segments || 4}
                                        </span>
                                      </div>
                                    ))
                                  : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {(charCampaign.showcased_npcs || []).filter(
                        (sn) => sn.show_clocks_to_party,
                      ).length > 0 && (
                        <div style={{ marginBottom: "8px" }}>
                          <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                            Showcased NPC Clocks:
                          </span>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "12px",
                              marginTop: "4px",
                            }}
                          >
                            {(charCampaign.showcased_npcs || [])
                              .filter((sn) => sn.show_clocks_to_party)
                              .map((sn) => {
                                const npc = sn.npc || {};
                                return (
                                  <div
                                    key={sn.id}
                                    style={{
                                      background: "#1f2937",
                                      padding: "8px",
                                      borderRadius: "4px",
                                      border: "1px solid #374151",
                                      minWidth: "120px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        fontWeight: "bold",
                                        color: "#e5e7eb",
                                        marginBottom: "4px",
                                      }}
                                    >
                                      {npc.name || "NPC"}
                                    </div>
                                    {npc.stand_name && (
                                      <div
                                        style={{
                                          fontSize: "10px",
                                          color: "#9ca3af",
                                          marginBottom: "4px",
                                        }}
                                      >
                                        {npc.stand_name}
                                      </div>
                                    )}
                                    {npc.stand_coin_stats &&
                                      Object.keys(npc.stand_coin_stats).length > 0 && (
                                        <div
                                          style={{
                                            fontSize: "10px",
                                            color: "#a78bfa",
                                            marginBottom: "4px",
                                          }}
                                        >
                                          Stand{" "}
                                          {Object.entries(npc.stand_coin_stats)
                                            .map(([k, v]) => `${k[0]}:${v}`)
                                            .join(" · ")}
                                        </div>
                                      )}
                                    {Array.isArray(npc.abilities) &&
                                      npc.abilities.length > 0 && (
                                        <div
                                          style={{
                                            marginBottom: "6px",
                                            padding: "4px 6px",
                                            border: "1px solid #374151",
                                            borderRadius: "4px",
                                          }}
                                        >
                                          <div
                                            style={{
                                              fontSize: "10px",
                                              color: "#9ca3af",
                                              marginBottom: "2px",
                                            }}
                                          >
                                            Abilities
                                          </div>
                                          {(npc.abilities || [])
                                            .slice(0, 6)
                                            .map((ab) => (
                                              <div
                                                key={ab.id || ab.name}
                                                style={{
                                                  fontSize: "10px",
                                                  color: "#d1d5db",
                                                  lineHeight: 1.35,
                                                }}
                                              >
                                                {ab.name || "Ability"}
                                              </div>
                                            ))}
                                        </div>
                                      )}
                                    {npc.vulnerability_clock_max > 0 && (
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "6px",
                                          marginBottom: "4px",
                                        }}
                                      >
                                        <ProgressClock
                                          size={36}
                                          segments={npc.vulnerability_clock_max}
                                          filled={
                                            npc.vulnerability_clock_current || 0
                                          }
                                        />
                                        <span
                                          style={{
                                            fontSize: "10px",
                                            color: "#9ca3af",
                                          }}
                                        >
                                          Vuln{" "}
                                          {npc.vulnerability_clock_current || 0}
                                          /{npc.vulnerability_clock_max}
                                        </span>
                                      </div>
                                    )}
                                    {(npc.conflict_clocks || []).map((clk) => (
                                      <div
                                        key={clk.id || clk.name}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "6px",
                                          marginBottom: "2px",
                                        }}
                                      >
                                        <ProgressClock
                                          size={32}
                                          segments={clk.segments || 4}
                                          filled={clk.filled || 0}
                                        />
                                        <span
                                          style={{
                                            fontSize: "10px",
                                            color: "#6b7280",
                                          }}
                                        >
                                          {clk.name || "Conflict"}{" "}
                                          {clk.filled || 0}/{clk.segments || 4}
                                        </span>
                                      </div>
                                    ))}
                                    {(npc.alt_clocks || []).map((clk) => (
                                      <div
                                        key={clk.id || clk.name}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "6px",
                                          marginBottom: "2px",
                                        }}
                                      >
                                        <ProgressClock
                                          size={32}
                                          segments={clk.segments || 4}
                                          filled={clk.filled || 0}
                                        />
                                        <span
                                          style={{
                                            fontSize: "10px",
                                            color: "#6b7280",
                                          }}
                                        >
                                          {clk.name || "Alt"} {clk.filled || 0}/
                                          {clk.segments || 4}
                                        </span>
                                      </div>
                                    ))}
                                    {(npc.progress_clocks || []).map((clk) => (
                                      <div
                                        key={clk.id}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "6px",
                                          marginBottom: "2px",
                                        }}
                                      >
                                        <ProgressClock
                                          size={32}
                                          segments={clk.max_segments || 4}
                                          filled={clk.filled_segments || 0}
                                        />
                                        <span
                                          style={{
                                            fontSize: "10px",
                                            color: "#6b7280",
                                          }}
                                        >
                                          {clk.name || "Clock"}{" "}
                                          {clk.filled_segments || 0}/
                                          {clk.max_segments || 4}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Ratings — chargen baseline plus XP-bought action dots */}
                  <div style={{ marginBottom: "14px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "6px",
                      }}
                    >
                      <span style={S.lbl}>ACTION RATINGS</span>
                      <span
                        style={{
                          fontSize: "11px",
                          color: dotColor,
                          fontWeight: dotsRemaining === 0 ? "bold" : "normal",
                        }}
                        title={`SRD action dots (${MAX_CREATION_DOTS} at chargen, +${actionDotsFromXp} from XP or saved dot total).`}
                      >
                        {totalActionDots}/{maxActionDotsBudget} dots{" "}
                        {dotsRemaining > 0
                          ? `(${dotsRemaining} left)`
                          : "— FULL"}
                      </span>
                    </div>
                    {dotsRemaining < 0 && (
                      <div style={{ ...S.warn, marginBottom: "6px" }}>
                        Over dot budget — remove {Math.abs(dotsRemaining)} dot
                        {Math.abs(dotsRemaining) > 1 ? "s" : ""}
                      </div>
                    )}

                    {resistanceAbilityOptions.some((o) => o.mitigationOnly) ? (
                      <div
                        style={{
                          marginBottom: "10px",
                          padding: "8px 10px",
                          background: "#111827",
                          border: "1px solid #374151",
                          borderRadius: "6px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#9ca3af",
                            marginBottom: "6px",
                          }}
                        >
                          Post-roll resistance (after harm is applied)
                        </div>
                        {resistanceAbilityOptions
                          .filter((o) => o.mitigationOnly)
                          .map((opt) => (
                            <label
                              key={opt.id}
                              style={{
                                fontSize: "10px",
                                color: "#9ca3af",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                marginBottom: "4px",
                                cursor: "pointer",
                              }}
                              title={opt.description || undefined}
                            >
                              <input
                                type="checkbox"
                                checked={!!resistanceAbilityBoost[opt.id]}
                                onChange={(e) =>
                                  setResistanceAbilityBoost((prev) => ({
                                    ...prev,
                                    [opt.id]: e.target.checked,
                                  }))
                                }
                              />
                              {opt.name} (post-roll option)
                            </label>
                          ))}
                      </div>
                    ) : null}

                    <div style={S.g3}>
                      {[
                        {
                          attr: "INSIGHT",
                          actions: ["HUNT", "STUDY", "SURVEY", "TINKER"],
                        },
                        {
                          attr: "PROWESS",
                          actions: ["FINESSE", "PROWL", "SKIRMISH", "WRECK"],
                        },
                        {
                          attr: "RESOLVE",
                          actions: ["BIZARRE", "COMMAND", "CONSORT", "SWAY"],
                        },
                      ].map(({ attr, actions }) => {
                        const baseResistanceDice = getAttributeDice(actions);
                        const prowessPhysiologyBonus =
                          String(attr || "").toUpperCase() === "PROWESS" &&
                          !!resistanceAbilityBoost["superior-physiology"]
                            ? 1
                            : 0;
                        const resistanceDiceWithBonuses =
                          baseResistanceDice + prowessPhysiologyBonus;
                        const resistanceDotSlots = Math.max(
                          4,
                          resistanceDiceWithBonuses,
                        );
                        return (
                        <div key={attr}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "6px",
                            }}
                          >
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <button
                                onClick={() =>
                                  setExpandedActionInfo(
                                    expandedActionInfo === attr ? null : attr,
                                  )
                                }
                                style={{
                                  fontSize: "11px",
                                  fontWeight: "bold",
                                  color: "#e5e7eb",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 0,
                                  textDecoration: "underline",
                                  textUnderlineOffset: "2px",
                                }}
                                title="Show properties"
                              >
                                {attr}
                              </button>
                              <button
                                onClick={() => openResistanceRollPreview(attr, actions)}
                                style={{
                                  fontSize: "14px",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 0,
                                  lineHeight: 1,
                                }}
                                title={
                                  RESISTANCE_ATTR_DESC[attr] ||
                                  "Open resistance dice pool"
                                }
                              >
                                🎲
                              </button>
                            </span>
                            <div style={{ display: "flex", gap: "2px" }}>
                              {Array.from(
                                { length: resistanceDotSlots },
                                (_, idx) => {
                                  const d = idx + 1;
                                  const isBase = d <= baseResistanceDice;
                                  const isBonus =
                                    d > baseResistanceDice &&
                                    d <= resistanceDiceWithBonuses;
                                  return (
                                <div
                                  key={d}
                                  style={{
                                    width: "7px",
                                    height: "7px",
                                    borderRadius: "50%",
                                    border: "1px solid #4b5563",
                                    background: isBase
                                      ? "#3b82f6"
                                      : isBonus
                                        ? "#22c55e"
                                        : "#1f2937",
                                  }}
                                  title={
                                    isBonus
                                      ? "Heritage / ability bonus on this resistance"
                                      : undefined
                                  }
                                />
                                  );
                                },
                              )}
                            </div>
                          </div>
                          {resistanceAbilityOptions
                            .filter(
                              (opt) =>
                                !opt.mitigationOnly &&
                                (String(opt.appliesTo || "").toUpperCase() ===
                                  "ALL" ||
                                  String(opt.appliesTo || "").toUpperCase() ===
                                    String(attr || "").toUpperCase()),
                            )
                            .map((opt) => (
                              <label
                                key={`${attr}-${opt.id}`}
                                style={{
                                  fontSize: "10px",
                                  color: "#9ca3af",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  marginBottom: "6px",
                                  cursor: "pointer",
                                }}
                                title={opt.description || undefined}
                              >
                                <input
                                  type="checkbox"
                                  checked={!!resistanceAbilityBoost[opt.id]}
                                  onChange={(e) =>
                                    setResistanceAbilityBoost((prev) => ({
                                      ...prev,
                                      [opt.id]: e.target.checked,
                                    }))
                                  }
                                />
                                {opt.name}
                                {opt.bonusDice > 0
                                  ? ` (+${opt.bonusDice}d)`
                                  : " (post-roll option)"}
                              </label>
                            ))}
                          {expandedActionInfo === attr && (
                            <div
                              style={{
                                fontSize: "10px",
                                color: "#9ca3af",
                                marginBottom: "6px",
                                padding: "6px",
                                background: "#1f2937",
                                borderRadius: "4px",
                                border: "1px solid #374151",
                              }}
                            >
                              {RESISTANCE_ATTR_DESC[attr] || ""}
                            </div>
                          )}
                          {actions.map((action) => {
                            const rating = actionRatings[action];
                            const plannedExtra =
                              plannedActionDotCounts[action] || 0;
                            const plannedThru = Math.min(
                              4,
                              rating + plannedExtra,
                            );
                            const creationCap = maxDotsPerActionAtCreation({
                              hasSkilledFromBirth,
                              actionRatings,
                              action,
                            });
                            // Chargen (dots still open): L1 cap only. After budget spent / post-chargen: all 4.
                            const showFourDotSlots =
                              isPostChargen || dotsRemaining <= 0;
                            const dotSlots = showFourDotSlots
                              ? [1, 2, 3, 4]
                              : Array.from(
                                  { length: creationCap },
                                  (_, i) => i + 1,
                                );
                            return (
                              <React.Fragment key={action}>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "4px",
                                  }}
                                >
                                  <span
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "4px",
                                    }}
                                  >
                                    <button
                                      onClick={() =>
                                        setExpandedActionInfo(
                                          expandedActionInfo === action
                                            ? null
                                            : action,
                                        )
                                      }
                                      style={{
                                        fontSize: "11px",
                                        color: "#d1d5db",
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        padding: 0,
                                        textDecoration: "underline",
                                        textUnderlineOffset: "2px",
                                      }}
                                      title="Show properties"
                                    >
                                      {action}
                                    </button>
                                    <button
                                      onClick={() => rollDice(action, rating)}
                                      style={{
                                        fontSize: "14px",
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        padding: 0,
                                        lineHeight: 1,
                                      }}
                                      title={
                                        rating === 0
                                          ? "Roll (0 dots — modal uses 2d6, lower)"
                                          : `Roll ${rating}d`
                                      }
                                    >
                                      🎲
                                    </button>
                                  </span>
                                  <div
                                    style={{ display: "flex", gap: "2px" }}
                                    data-dot-edit
                                  >
                                    {dotSlots.map((d) => {
                                      const filled = d <= rating;
                                      const plannedGhost =
                                        !filled && d <= plannedThru;
                                      const isAdvDot = d > creationCap;
                                      const planClickable =
                                        planMode &&
                                        isPostChargen &&
                                        canEditPlan &&
                                        !filled &&
                                        d === rating + plannedExtra + 1 &&
                                        d <= 4;
                                      return (
                                        <div
                                          key={d}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (planClickable) {
                                              queuePlanActionDot(action);
                                              return;
                                            }
                                            if (
                                              planMode &&
                                              isPostChargen
                                            ) {
                                              return;
                                            }
                                            if (isAdvDot) return;
                                            updateActionRating(
                                              action,
                                              d <= rating ? d - 1 : d,
                                            );
                                          }}
                                          title={
                                            planClickable
                                              ? `Plan: queue +1 ${action} (next ${ACTION_ATTR[action] || "attribute"} fill)`
                                              : plannedGhost
                                                ? `Dot ${d} — planned (not owned yet)`
                                                : isAdvDot
                                                  ? filled
                                                    ? `Dot ${d} — gained via advancement`
                                                    : `Dot ${d} — unlock via attribute XP / plan`
                                                  : dotsRemaining === 0 &&
                                                      !filled
                                                    ? "No action dots remaining"
                                                    : ""
                                          }
                                          style={{
                                            width: "12px",
                                            height: "12px",
                                            borderRadius: "50%",
                                            border: plannedGhost
                                              ? "1px dashed var(--sheet-ghost)"
                                              : `1px solid ${
                                                  isAdvDot && !filled
                                                    ? "var(--text-dim)"
                                                    : isAdvDot
                                                      ? "var(--border)"
                                                      : "var(--text-dim)"
                                                }`,
                                            cursor: planClickable
                                              ? "pointer"
                                              : isAdvDot ||
                                                  (planMode && isPostChargen)
                                                ? "default"
                                                : "pointer",
                                            background: filled
                                              ? isAdvDot
                                                ? "var(--sheet-ghost-text)"
                                                : "var(--hftf-purple)"
                                              : plannedGhost
                                                ? "transparent"
                                                : "var(--bg-card)",
                                            opacity: 1,
                                            boxShadow: planClickable
                                              ? "0 0 0 1px var(--sheet-ghost-text)"
                                              : undefined,
                                          }}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                                {expandedActionInfo === action && (
                                  <div
                                    style={{
                                      fontSize: "10px",
                                      color: "#9ca3af",
                                      marginBottom: "6px",
                                      padding: "6px",
                                      background: "#1f2937",
                                      borderRadius: "4px",
                                      border: "1px solid #374151",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontWeight: "bold",
                                        color: "#d1d5db",
                                        marginBottom: "2px",
                                      }}
                                    >
                                      {ACTION_ATTR[action]?.toUpperCase() || ""}
                                    </div>
                                    {ACTION_DESC[action] || ""}
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      );
                      })}
                    {showStandCoinActionColumn ? (
                      <div key="stand-roll-column">
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "6px",
                          }}
                        >
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedActionInfo((cur) =>
                                  cur === "stand:dur-resist"
                                    ? null
                                    : "stand:dur-resist",
                                )
                              }
                              style={{
                                fontSize: "11px",
                                fontWeight: "bold",
                                color: "#e5e7eb",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                                textDecoration: "underline",
                                textUnderlineOffset: "2px",
                              }}
                              title="Resistance when Stand takes harm"
                            >
                              DURABILITY
                            </button>
                            <button
                              type="button"
                              onClick={openStandDurabilityResistancePreview}
                              style={{
                                fontSize: "14px",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                                lineHeight: 1,
                              }}
                              title="Open Stand durability resist pool"
                            >
                              🎲
                            </button>
                          </span>
                          <div style={{ display: "flex", gap: "2px" }}>
                            {(() => {
                              const durPool = computeStandRollPool(
                                "durability",
                                standStats,
                              );
                              return [1, 2, 3, 4].map((d) => (
                                <div
                                  key={d}
                                  style={{
                                    width: "7px",
                                    height: "7px",
                                    borderRadius: "50%",
                                    border: "1px solid #4b5563",
                                    background:
                                      d <= durPool ? "#06b6d4" : "#1f2937",
                                  }}
                                  title="Grade maps to dice (edit wedges — 10 XP per +1 tier)"
                                />
                              ));
                            })()}
                          </div>
                        </div>
                        {expandedActionInfo === "stand:dur-resist" ? (
                          <div
                            style={{
                              fontSize: "10px",
                              color: "#9ca3af",
                              marginBottom: "6px",
                              padding: "6px",
                              background: "#1f2937",
                              borderRadius: "4px",
                              border: "1px solid #374151",
                              lineHeight: 1.4,
                            }}
                          >
                            Rolls when another Stand hurts yours. Separate from
                            Insight / Prowess / Resolve. Spend Stand Coin pts (10 XP
                            per +1 wedge on radar) — same grades as Stand armor (not stress boxes).
                          </div>
                        ) : null}
                        {STAND_COLUMN_ROLL_ORDER.map((st) => {
                          const pool = computeStandRollPool(st, standStats);
                          const k = `stand:${st}`;
                          return (
                            <React.Fragment key={st}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginBottom: "4px",
                                }}
                              >
                                <span
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedActionInfo((cur) =>
                                        cur === k ? null : k,
                                      )
                                    }
                                    style={{
                                      fontSize: "11px",
                                      color: "#06b6d4",
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      padding: 0,
                                      textDecoration: "underline",
                                      textUnderlineOffset: "2px",
                                    }}
                                    title="Stand action roll summary"
                                  >
                                    {String(st).toUpperCase()}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openStandActionRollPreview(st)}
                                    style={{
                                      fontSize: "14px",
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      padding: 0,
                                      lineHeight: 1,
                                    }}
                                    title={
                                      pool === 0
                                        ? "0d — uses 2d6 lower off-session"
                                        : `${pool} dice from Stand Coin grade`
                                    }
                                  >
                                    🎲
                                  </button>
                                </span>
                                <div style={{ display: "flex", gap: "2px" }}>
                                  {[1, 2, 3, 4].map((slot) => (
                                    <div
                                      key={slot}
                                      style={{
                                        width: "12px",
                                        height: "12px",
                                        borderRadius: "50%",
                                        border: "1px solid #0e7490",
                                        background:
                                          slot <= pool ? "#06b6d4" : "#111827",
                                      }}
                                      title="From Stand Coin grade — edit wedges"
                                    />
                                  ))}
                                </div>
                              </div>
                              {expandedActionInfo === k ? (
                                <div
                                  style={{
                                    fontSize: "10px",
                                    color: "#9ca3af",
                                    marginBottom: "6px",
                                    padding: "6px",
                                    background: "#0c1929",
                                    borderRadius: "4px",
                                    border: "1px solid #164e63",
                                    lineHeight: 1.4,
                                  }}
                                >
                                  {pcStandCoinReadouts?.[st] || ""}
                                </div>
                              ) : null}
                            </React.Fragment>
                          );
                        })}
                        <button
                          type="button"
                          disabled={!canEditSheet}
                          onClick={() => applyStressCost(2)}
                          style={{
                            marginTop: "8px",
                            width: "100%",
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "6px 8px",
                            borderRadius: "4px",
                            border: "1px solid #155e75",
                            background: canEditSheet ? "#0e7490" : "#374151",
                            color: "#ecfeff",
                            cursor: canEditSheet ? "pointer" : "not-allowed",
                            opacity: canEditSheet ? 1 : 0.55,
                          }}
                          title="Spend 2 stress (push yourself) to recall your Stand to your position. Marks 2 filled stress on this sheet (same as other stress spends; autosave applies)."
                        >
                          Stand recall (+2 stress)
                        </button>
                      </div>
                    ) : null}
                    </div>
                  </div>

                  {/* Action roll — dice pool preview (session) or roll result; same slot under action ratings */}
                  {rollPending && characterId && (
                    <div
                      ref={actionRollDicePoolPreviewElRef}
                      data-action-roll-dice-preview
                      style={{
                        background: "#1f2937",
                        padding: "12px",
                        borderRadius: "4px",
                        border: "1px solid #7c3aed",
                        marginBottom: "14px",
                        fontSize: "12px",
                        maxHeight: "min(70vh, 520px)",
                        overflow: "auto",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: "bold",
                          marginBottom: "4px",
                          color: "#a78bfa",
                        }}
                      >
                        Dice pool — {rollActionName || rollPending.actionName}
                        {rollPending?.healAttempt?.targetName
                          ? ` — Healing ${rollPending.healAttempt.targetName}`
                          : ""}
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#6b7280",
                          marginBottom: "12px",
                        }}
                      >
                        {rollPending?.healAttempt &&
                        !showDiceRollModalPositionEffect ? (
                          <>
                            Preview your dice pool, then roll. Position and effect
                            are hidden for heals that are not recover-in-play
                            (including downtime cadence). Cancel to pick another
                            action.
                          </>
                        ) : (
                          <>
                            Preview your pool, check position and effect, add push
                            / assist / bargain, then roll. Cancel to pick another
                            action.
                          </>
                        )}
                      </div>
                      {rollPending?.healAttempt && (
                        <div
                          style={{
                            marginBottom: "12px",
                            padding: "8px",
                            borderRadius: "6px",
                            border: "1px solid #0f766e",
                            background: "#0f172a",
                            color: "#99f6e4",
                            fontSize: "11px",
                            lineHeight: 1.35,
                          }}
                        >
                          <div>
                            Declared heal target:{" "}
                            <strong style={{ color: "#e5e7eb" }}>
                              {rollPending.healAttempt.targetName || "teammate"}
                            </strong>
                          </div>
                          {String(rollPending.healAttempt.bolsterNote || "").trim() ? (
                            <div style={{ marginTop: "4px" }}>
                              Bolsters:{" "}
                              {String(rollPending.healAttempt.bolsterNote).trim()}
                            </div>
                          ) : null}
                          {(() => {
                            const ht = rollPending.healAttempt;
                            const fromRoll =
                              ht &&
                              Array.isArray(ht.selectedAbilityBolsters) &&
                              ht.selectedAbilityBolsters.length > 0
                                ? ht.selectedAbilityBolsters
                                : [];
                            const list =
                              fromRoll.length > 0 ? fromRoll : healOtherRecoveryBolsterSources;
                            return list.length > 0 ? (
                              <div style={{ marginTop: "4px" }}>
                                Ability bolsters:&nbsp;
                                <span style={{ color: "#e5e7eb" }}>
                                  {list.join("; ")}
                                </span>
                              </div>
                            ) : null;
                          })()}
                          {String(rollPending.healAttempt.careNote || "").trim() ? (
                            <div style={{ marginTop: "4px" }}>
                              Notes: {String(rollPending.healAttempt.careNote).trim()}
                            </div>
                          ) : null}
                          <div style={{ marginTop: "4px" }}>
                            Boosts selected:{" "}
                            {healAttemptSelectedBoostSummary.length > 0
                              ? healAttemptSelectedBoostSummary.join("; ")
                              : "none selected yet"}
                          </div>
                          <div style={{ marginTop: "4px", color: "#94a3b8" }}>
                            GM follow-up: resolve linked recovery ticks for the
                            target per SRD treatment cadence.
                          </div>
                        </div>
                      )}
                      {harmLevel3Used && (
                          <div
                            style={{
                              background: "#7f1d1d",
                              border: "1px solid #b91c1c",
                              padding: "8px",
                              borderRadius: "4px",
                              marginBottom: "12px",
                              fontSize: "11px",
                              color: "#fca5a5",
                            }}
                          >
                            Incapacitated (Level 3 harm). Acting costs 2 stress.
                            This does not grant +1 effect or +1d.
                          </div>
                        )}
                      {showDiceRollModalPositionEffect ? (
                      <>
                      <div
                        style={{
                          display: "flex",
                          gap: "16px",
                          flexWrap: "wrap",
                          marginBottom: "8px",
                          alignItems: "flex-start",
                        }}
                      >
                        <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "10px",
                              color: "#9ca3af",
                              marginBottom: "4px",
                            }}
                          >
                            Position (this action)
                          </div>
                          <PositionStack
                            activePosition={
                              sessionOverridePositionEffect?.position ||
                              charCampaign?.active_session_detail
                                ?.default_position ||
                              "risky"
                            }
                            readOnly
                          />
                        </div>
                        <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "10px",
                              color: "#9ca3af",
                              marginBottom: "4px",
                            }}
                          >
                            Effect (this action — after bonuses)
                          </div>
                          <EffectShapes
                            activeEffect={rollModalPreviewEffect}
                            readOnly
                          />
                        </div>
                      </div>
                      {rollModalPositionEffectBreakdown ? (
                        <div
                          style={{
                            marginBottom: "12px",
                            padding: "10px 12px",
                            borderRadius: "6px",
                            border: "1px solid #374151",
                            background: "#0d1117",
                            fontSize: "10px",
                            color: "#9ca3af",
                            lineHeight: 1.45,
                          }}
                        >
                          <div style={{ marginBottom: "4px", color: "#a78bfa" }}>
                            Effect tier steps applied in this roll:
                          </div>
                          {rollModalPositionEffectBreakdown.effectTierSteps.length === 0 ? (
                            <div style={{ color: "#6b7280", fontStyle: "italic" }}>
                              None — toggle +1 effect on abilities/heritage below or push for
                              effect to add steps.
                            </div>
                          ) : (
                            <ul
                              style={{
                                margin: "0 0 8px 0",
                                paddingLeft: "18px",
                                color: "#d1d5db",
                              }}
                            >
                              {rollModalPositionEffectBreakdown.effectTierSteps.map((row) => (
                                <li key={row.key} style={{ marginBottom: "2px" }}>
                                  {row.text}
                                </li>
                              ))}
                            </ul>
                          )}
                          <div style={{ fontSize: "9px", color: "#6b7280" }}>
                            Highlighted effect shape (
                            <strong style={{ color: "#c4b5fd" }}>
                              {rollModalPositionEffectBreakdown.previewTierLabel}
                            </strong>
                            ) stacks session default then these steps in the same order as
                            the server roll.
                          </div>
                        </div>
                      ) : null}
                      </>
                      ) : (
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#9ca3af",
                            marginBottom: "12px",
                            lineHeight: 1.35,
                          }}
                        >
                          This heal preview is downtime or otherwise not recover-in-play:
                          dice pool still uses your rating and boosts;{" "}
                          <strong style={{ color: "#d1d5db" }}>
                            omit position / effect preview
                          </strong>{" "}
                          unless you reopen with recover-in-play treatment selected.
                        </div>
                      )}
                      {rollPending?.standRoll &&
                        showStandCoinActionColumn &&
                        String(rollPending?.standStat || "").trim() ? (
                        <div style={{ marginBottom: "12px" }}>
                          <label
                            style={{
                              fontSize: "11px",
                              color: "#9ca3af",
                              display: "block",
                              marginBottom: "4px",
                            }}
                          >
                            Stand coin stat (action roll pool)
                          </label>
                          <select
                            aria-label="Stand coin stat for this action roll"
                            value={String(rollPending.standStat || "").toLowerCase()}
                            onChange={(e) => {
                              const ss = String(e.target.value || "")
                                .trim()
                                .toLowerCase();
                              if (!STAND_ROLL_KEYS_ACTIVE.includes(ss)) return;
                              setRollPending((p) => {
                                if (!p?.standRoll) return p;
                                const n = computeStandRollPool(ss, standStats);
                                return {
                                  ...p,
                                  standStat: ss,
                                  actionName: `stand_${ss}`,
                                  diceCount: n,
                                };
                              });
                            }}
                            style={{
                              ...S.sel,
                              width: "100%",
                              maxWidth: 280,
                              fontSize: "12px",
                            }}
                          >
                            {STAND_COLUMN_ROLL_ORDER.map((st) => (
                              <option key={st} value={st}>
                                {String(st).toUpperCase()} (Stand Coin)
                              </option>
                            ))}
                          </select>
                          <div
                            style={{
                              fontSize: "10px",
                              color: "#6b7280",
                              marginTop: "6px",
                              lineHeight: 1.35,
                            }}
                          >
                            Same pools as the POWER / PRECISION / SPEED rows under
                            Action ratings. Submission uses{" "}
                            <code style={{ color: "#9ca3af" }}>pool_source: stand_coin</code>{" "}
                            and{" "}
                            <code style={{ color: "#9ca3af" }}>stand_stat</code> on roll.
                          </div>
                        </div>
                      ) : null}
                      <div style={{ marginBottom: "12px" }}>
                        <label
                          style={{
                            fontSize: "11px",
                            color: "#9ca3af",
                            display: "block",
                            marginBottom: "4px",
                          }}
                        >
                          Goal (optional)
                        </label>
                        <textarea
                          value={rollGoalDraft}
                          onChange={(e) => setRollGoalDraft(e.target.value)}
                          placeholder={
                            assignedRollGoalLabel ||
                            "What are you trying to achieve on this roll?"
                          }
                          rows={2}
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            background: "#0d1117",
                            color: "#e5e7eb",
                            border: "1px solid #374151",
                            borderRadius: "6px",
                            padding: "8px",
                            fontSize: "12px",
                            resize: "vertical",
                          }}
                        />
                      </div>
                      {rollPoolPreview && (
                        <div
                          style={{
                            marginBottom: "14px",
                            padding: "10px",
                            background: "#0d1117",
                            borderRadius: "8px",
                            border: "1px solid #374151",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#a78bfa",
                              marginBottom: "8px",
                              fontWeight: "bold",
                            }}
                          >
                            Your dice pool
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: "#6b7280",
                              marginBottom: 8,
                              lineHeight: 1.35,
                            }}
                          >
                            Tick what applies to <strong>this</strong> roll (fiction only).
                            Some abilities are hidden here on purpose (counterattack / ally
                            perks); Iron Will uses the checkbox under RESOLVE resistance.
                            See{" "}
                            <code style={{ color: "#9ca3af" }}>
                              docs/codebase/standard-ability-roll-bonus-audit.md
                            </code>
                            . Choices update dice here, are sent on the roll, appear in
                            session dice history, and add{" "}
                            <code style={{ color: "#9ca3af" }}>[Abilities: …]</code> /{" "}
                            <code style={{ color: "#9ca3af" }}>[Heritage: …]</code> on the
                            stored roll (encoded vice/trauma pass + heritage XP hooks read those).
                          </div>
                          <DicePoolStrip
                            label="Action rating (dice in this action only)"
                            count={rollPoolPreview.action_rating}
                          />
                          {abilityRollBonusOptions.length === 0 &&
                          heritageRollBonusOptions.length === 0 ? (
                            <div
                              style={{
                                fontSize: 10,
                                color: "#6b7280",
                                marginTop: 4,
                                marginBottom: 8,
                              }}
                            >
                              No abilities on this sheet or selected heritage benefits match{" "}
                              <code style={{ color: "#9ca3af" }}>+1d</code> or{" "}
                              <code style={{ color: "#9ca3af" }}>+1 effect</code> in their
                              descriptions.
                            </div>
                          ) : null}
                          {abilityRollBonusOptions.length > 0 ? (
                            <div style={{ marginTop: 4, marginBottom: 8 }}>
                              <div
                                style={{
                                  fontSize: 10,
                                  color: "#9ca3af",
                                  marginBottom: 4,
                                }}
                              >
                                Sheet abilities (optional — hover name for full text)
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "6px",
                                  maxHeight: "140px",
                                  overflow: "auto",
                                }}
                              >
                                {abilityRollBonusOptions.map((ab) => {
                                  const id = ab.id ?? ab.name;
                                  const b = rollAbilityBoost[id] || {};
                                  return (
                                    <div
                                      key={id}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: "8px",
                                        fontSize: "11px",
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <span
                                        style={{
                                          color: "#e5e7eb",
                                          flex: "1 1 120px",
                                        }}
                                        title={
                                          ab.rollBonusResolvedDescription
                                            ? String(ab.rollBonusResolvedDescription).slice(0, 800)
                                            : undefined
                                        }
                                      >
                                        {ab.name}
                                      </span>
                                      {ab.supportsDice ? (
                                        <label
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            cursor: "pointer",
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={!!b.dice}
                                            onChange={(e) =>
                                              setRollAbilityBoost((p) => ({
                                                ...p,
                                                [id]: {
                                                  ...p[id],
                                                  dice: e.target.checked,
                                                  effect: !!p[id]?.effect,
                                                },
                                              }))
                                            }
                                          />
                                          +1d
                                        </label>
                                      ) : null}
                                      {ab.supportsEffect ? (
                                        <label
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            cursor: "pointer",
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={!!b.effect}
                                            onChange={(e) =>
                                              setRollAbilityBoost((p) => ({
                                                ...p,
                                                [id]: {
                                                  ...p[id],
                                                  effect: e.target.checked,
                                                  dice: !!p[id]?.dice,
                                                },
                                              }))
                                            }
                                          />
                                          +1 effect
                                        </label>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                          {heritageRollBonusOptions.length > 0 ? (
                            <div style={{ marginBottom: 8 }}>
                              <div
                                style={{
                                  fontSize: 10,
                                  color: "#9ca3af",
                                  marginBottom: 4,
                                }}
                              >
                                Heritage benefits (optional — expression XP when session
                                active)
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "6px",
                                  maxHeight: "140px",
                                  overflow: "auto",
                                }}
                              >
                                {heritageRollBonusOptions
                                  .filter(
                                    (hb) =>
                                      !(
                                        hb.supportsPenaltyDice &&
                                        charData.disguised_as_human === true
                                      ),
                                  )
                                  .map((hb) => {
                                  const hid = hb.id ?? hb.name;
                                  const b = heritageRollBoost[hid] || {};
                                  const alienPenaltyCtx = {
                                    rollPending,
                                    healingTreatmentBonusContext,
                                    rollActionName,
                                    disguisedAsHuman: charData.disguised_as_human,
                                  };
                                  const alienPenaltyInteractive =
                                    alienUnderstandingHeritagePenaltyApplies(
                                      alienPenaltyCtx,
                                    );
                                  return (
                                    <div
                                      key={hid}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: "8px",
                                        fontSize: "11px",
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <span
                                        style={{
                                          color: "#fde68a",
                                          flex: "1 1 120px",
                                        }}
                                        title={
                                          hb.supportsPenaltyDice
                                            ? String(hb.description || "").slice(
                                                0,
                                                800,
                                              )
                                            : undefined
                                        }
                                      >
                                        {hb.name}
                                      </span>
                                      {hb.supportsPenaltyDice ? (
                                        <label
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            cursor: alienPenaltyInteractive
                                              ? "pointer"
                                              : "not-allowed",
                                            opacity: alienPenaltyInteractive
                                              ? 1
                                              : 0.45,
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={!!b.dice}
                                            disabled={!alienPenaltyInteractive}
                                            onChange={(e) =>
                                              setHeritageRollBoost((p) => ({
                                                ...p,
                                                [hid]: {
                                                  ...p[hid],
                                                  dice: e.target.checked,
                                                  effect: !!p[hid]?.effect,
                                                },
                                              }))
                                            }
                                          />
                                          −1d
                                        </label>
                                      ) : null}
                                      {hb.supportsDice ? (
                                        <label
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            cursor: "pointer",
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={!!b.dice}
                                            onChange={(e) =>
                                              setHeritageRollBoost((p) => ({
                                                ...p,
                                                [hid]: {
                                                  ...p[hid],
                                                  dice: e.target.checked,
                                                  effect: !!p[hid]?.effect,
                                                },
                                              }))
                                            }
                                          />
                                          +1d
                                        </label>
                                      ) : null}
                                      {hb.supportsEffect ? (
                                        <label
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            cursor: "pointer",
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={!!b.effect}
                                            onChange={(e) =>
                                              setHeritageRollBoost((p) => ({
                                                ...p,
                                                [hid]: {
                                                  ...p[hid],
                                                  effect: e.target.checked,
                                                  dice: !!p[hid]?.dice,
                                                },
                                              }))
                                            }
                                          />
                                          +1 effect
                                        </label>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                          {characterHasPhantomPain(abilities) ? (
                            <div style={{ marginTop: 4, marginBottom: 8 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: "8px",
                                  fontSize: "11px",
                                  flexWrap: "wrap",
                                }}
                              >
                                <span
                                  style={{
                                    color: "#e5e7eb",
                                    flex: "1 1 120px",
                                  }}
                                  title={
                                    phantomPainRollDescription
                                      ? phantomPainRollDescription.slice(0, 900)
                                      : undefined
                                  }
                                >
                                  Phantom Pain
                                </span>
                                <label
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    cursor: "pointer",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={phantomPainThroughCover}
                                    onChange={(e) =>
                                      setPhantomPainThroughCover(e.target.checked)
                                    }
                                  />
                                  Through cover/barriers (+1 stress)
                                </label>
                              </div>
                            </div>
                          ) : null}
                          {rollModal.push_dice ? (
                            <DicePoolStrip
                              label="Push yourself (+1d, costs 2 stress)"
                              count={1}
                            />
                          ) : null}
                          {rollModal.push_effect ? (
                            <div
                              style={{
                                fontSize: "10px",
                                color: "#fcd34d",
                                marginBottom: "6px",
                              }}
                            >
                              Push for +1 effect tier (costs 2 stress, no extra
                              die)
                            </div>
                          ) : null}
                          {rollModal.devil_bargain_dice ? (
                            <DicePoolStrip
                              label="Devil's bargain (+1d)"
                              count={1}
                            />
                          ) : null}
                          {bonusDiceFromAbilities > 0 ? (
                            <DicePoolStrip
                              label={`Sheet abilities (+${bonusDiceFromAbilities}d)`}
                              count={bonusDiceFromAbilities}
                            />
                          ) : null}
                          {bonusDiceFromHeritage > 0 ? (
                            <DicePoolStrip
                              label={`Heritage benefits (+${bonusDiceFromHeritage}d)`}
                              count={bonusDiceFromHeritage}
                            />
                          ) : null}
                          {heritagePenaltyDiceActive > 0 ? (
                            <div
                              style={{
                                fontSize: 10,
                                color: "#fca5a5",
                                marginBottom: 8,
                              }}
                            >
                              Alien Understanding (−{heritagePenaltyDiceActive}d)
                            </div>
                          ) : null}
                          {totalAbilityEffectSteps > 0 ? (
                            <div
                              style={{
                                fontSize: 10,
                                color: "#a7f3d0",
                                marginBottom: 6,
                              }}
                            >
                              Total +{totalAbilityEffectSteps} effect tier step(s)
                              (abilities / heritage — applied server-side before
                              position).
                            </div>
                          ) : null}
                          {phantomPainThroughCover ? (
                            <div
                              style={{
                                fontSize: 10,
                                color: "#fda4af",
                                marginBottom: 6,
                              }}
                            >
                              Phantom Pain: +1 stress marked on resolve (attacks
                              through cover / barriers this roll).
                            </div>
                          ) : null}
                          {assistHelpPending && !rollPending?.healAttempt ? (
                            <div
                              style={{
                                marginTop: "6px",
                                marginBottom: "8px",
                                paddingTop: "8px",
                                borderTop: "1px solid #1e3a4c",
                              }}
                            >
                              <DicePoolStrip
                                label={`Incoming crew assist from ${String(assistHelpPending.helper_name ?? assistHelpPending.helperName ?? "teammate").trim()} (not counted in subtotal)`}
                                count={1}
                              />
                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: "8px",
                                  fontSize: "11px",
                                  color: "#e5e7eb",
                                  marginTop: "6px",
                                  cursor: "pointer",
                                  lineHeight: 1.35,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={includePendingAssistDie}
                                  onChange={(e) =>
                                    setIncludePendingAssistDie(e.target.checked)
                                  }
                                  style={{ marginTop: "2px" }}
                                />
                                <span>
                                  Include this +1 crew assist die when you Roll
                                  (teammate already marked stress via Assist).
                                  Uncheck if you abandon it for this action — your
                                  next ACTION roll will still clear it server-side if
                                  you roll without claiming it.
                                </span>
                              </label>
                            </div>
                          ) : null}
                          {rollPoolPreview.total === 0 &&
                          !(
                            assistHelpPending &&
                            includePendingAssistDie &&
                            !rollPending?.healAttempt
                          ) ? (
                            <div
                              style={{
                                fontSize: "11px",
                                color: "#f87171",
                                marginTop: "6px",
                                marginBottom: "4px",
                              }}
                            >
                              0 dice in pool — you roll{" "}
                              <strong>2d6</strong> and use the{" "}
                              <strong>lower</strong> result (same as offline).
                            </div>
                          ) : null}
                          {rollPoolPreview.total === 0 &&
                          assistHelpPending &&
                          includePendingAssistDie &&
                          !rollPending?.healAttempt ? (
                            <div
                              style={{
                                fontSize: "11px",
                                color: "#5eead4",
                                marginTop: "6px",
                                marginBottom: "4px",
                              }}
                            >
                              0 dice from your sheet modifiers — crew assist adds{" "}
                              <strong>+1d</strong> only when this roll resolves (shown
                              in &quot;dice rolled&quot; below).
                            </div>
                          ) : null}
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#d1d5db",
                              marginTop: "6px",
                              paddingTop: "8px",
                              borderTop: "1px solid #374151",
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "10px",
                              flexWrap: "wrap",
                            }}
                          >
                            <span>
                              Pool subtotal (your modifiers):{" "}
                              <strong>{rollPoolPreview.total}</strong>
                            </span>
                            {!rollPending?.healAttempt &&
                            assistHelpPending &&
                            typeof actionDiceTotalAtCommit === "number" ? (
                              <span>
                                Dice rolled at commitment:{" "}
                                <strong>{actionDiceTotalAtCommit}</strong>
                                {!includePendingAssistDie
                                  ? " (assist off)"
                                  : " (includes crew assist)"}
                              </span>
                            ) : null}
                            <span>
                              Total stress to mark:{" "}
                              <strong>{rollPoolPreview.pushStress}</strong>
                            </span>
                          </div>
                          {rollPoolPreview.pushStress > 0 ? (
                            <div
                              style={{
                                fontSize: "11px",
                                color: "#fca5a5",
                                marginTop: "8px",
                              }}
                            >
                              You will spend{" "}
                              <strong>{rollPoolPreview.pushStress}</strong>{" "}
                              stress when this roll resolves (push, incap penalty,
                              Phantom Pain — if checked; Ripple Breathing may waive
                              push stress if checked).
                            </div>
                          ) : null}
                        </div>
                      )}
                      <fieldset
                        style={{
                          border: "none",
                          margin: 0,
                          padding: 0,
                          marginBottom: "12px",
                        }}
                      >
                        <legend
                          style={{
                            fontSize: "11px",
                            color: "#9ca3af",
                            marginBottom: "6px",
                            padding: 0,
                          }}
                        >
                          Push / devil&apos;s bargain (choose at most one)
                        </legend>
                        {[
                          ["none", harmLevel3Used ? "None (incapacitated cost still applies)" : "None"],
                          ...(!harmLevel3Used
                            ? [
                                ...(!healAttemptIsDowntimeRecovery
                                  ? [
                                      [
                                        "push_effect",
                                        "Push for +1 effect (2 stress)",
                                      ],
                                    ]
                                  : []),
                                ["push_dice", "Push for +1d (2 stress)"],
                              ]
                            : []),
                          [
                            "devil",
                            "Devil's bargain (+1d, table-determined consequence)",
                          ],
                        ].map(([value, label]) => (
                          <label
                            key={value}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              fontSize: "12px",
                              cursor: "pointer",
                              marginTop: value === "none" ? 0 : "4px",
                            }}
                          >
                            <input
                              type="radio"
                              name="rollPushMode"
                              checked={rollPushMode === value}
                              onChange={() => applyRollPushMode(value)}
                            />
                            {label}
                          </label>
                        ))}
                      </fieldset>
                      {hasRippleBreathingAbility ? (
                        <div
                          style={{
                            marginBottom: "12px",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            border: "1px solid #334155",
                            background: "#0f172a",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "10px",
                              color: "#94a3b8",
                              marginBottom: "6px",
                              lineHeight: 1.35,
                            }}
                          >
                            Ripple Breathing — once per session episode you may push
                            for <strong>+1d</strong> or <strong>+1 effect</strong>{" "}
                            without marking the usual 2 stress (SRD). +1d vs poison /
                            fatigue / fear belongs on{" "}
                            <strong>resistance</strong> rolls only (checkbox there), not
                            in the action pool above.
                          </div>
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              fontSize: "11px",
                              color: "#e5e7eb",
                              cursor:
                                rippleBreathingFreePushClaimedThisSession ||
                                !activeSessionId ||
                                !(rollModal.push_dice || rollModal.push_effect) ||
                                harmLevel3Used
                                  ? "not-allowed"
                                  : "pointer",
                              opacity:
                                rippleBreathingFreePushClaimedThisSession ||
                                !activeSessionId
                                  ? 0.55
                                  : 1,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={rippleBreathingFreePush}
                              disabled={
                                rippleBreathingFreePushClaimedThisSession ||
                                !activeSessionId ||
                                !(rollModal.push_dice || rollModal.push_effect) ||
                                harmLevel3Used
                              }
                              onChange={(e) =>
                                setRippleBreathingFreePush(e.target.checked)
                              }
                            />
                            Use free push (no stress for this push)
                            {rippleBreathingFreePushClaimedThisSession
                              ? " — already used this session"
                              : !activeSessionId
                                ? " — need active session"
                                : ""}
                          </label>
                        </div>
                      ) : null}
                      <div style={{ marginBottom: "12px" }}>
                        <div style={{ marginTop: "10px" }}>
                          {rollModal.devil_bargain_dice &&
                          gmDevilBargainText ? (
                            <div
                              style={{
                                marginTop: "8px",
                                padding: "8px",
                                background: "#1f2937",
                                borderRadius: "6px",
                                border: "1px solid #4b5563",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "10px",
                                  color: "#9ca3af",
                                  marginBottom: "4px",
                                }}
                              >
                                Table consequence (you must confirm)
                              </div>
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "#e5e7eb",
                                  marginBottom: "8px",
                                }}
                              >
                                {gmDevilBargainText}
                              </div>
                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  fontSize: "12px",
                                  cursor: "pointer",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={devilBargainConfirmed}
                                  onChange={(e) =>
                                    setDevilBargainConfirmed(e.target.checked)
                                  }
                                />
                                I accept this consequence for +1d
                              </label>
                            </div>
                          ) : null}
                          {rollModal.devil_bargain_dice &&
                          !gmDevilBargainText ? (
                            <div
                              style={{
                                marginTop: "6px",
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "6px",
                                alignItems: "center",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => setShowDevilsBargainModal(true)}
                                style={{
                                  ...S.btn,
                                  fontSize: "11px",
                                  background: "#4b5563",
                                  color: "#fff",
                                }}
                              >
                                Choose consequence…
                              </button>
                              {rollModal.devil_bargain_note ? (
                                <span
                                  style={{ fontSize: "11px", color: "#d1d5db" }}
                                >
                                  ({rollModal.devil_bargain_note})
                                </span>
                              ) : (
                                <span
                                  style={{ fontSize: "11px", color: "#f87171" }}
                                >
                                  Describe the consequence below, or ask the
                                  referee to set one when you have an active
                                  session.
                                </span>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {(totalBonusDiceFromAbilitiesAndHeritage > 0 ||
                        heritagePenaltyDiceActive > 0 ||
                        abilityEffectSteps + heritageEffectSteps > 0 ||
                        phantomPainThroughCover) && (
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#6b7280",
                            marginBottom: "8px",
                          }}
                        >
                          Pool modifiers: +
                          {totalBonusDiceFromAbilitiesAndHeritage}d (abilities /
                          heritage)
                          {heritagePenaltyDiceActive > 0
                            ? `; −${heritagePenaltyDiceActive}d (Alien Understanding)`
                            : ""}
                          {abilityEffectSteps + heritageEffectSteps > 0
                            ? `; +${abilityEffectSteps + heritageEffectSteps} effect tier step(s) total`
                            : ""}
                          {phantomPainThroughCover
                            ? "; Phantom Pain +1 stress"
                            : ""}
                        </div>
                      )}
                      {rollApiError && (
                        <div
                          style={{
                            color: "#f87171",
                            fontSize: "11px",
                            marginBottom: "8px",
                          }}
                        >
                          {rollApiError}
                        </div>
                      )}
                      {pushWouldCauseTrauma && (
                        <>
                          <div
                            style={{
                              color: "#f59e0b",
                              fontSize: "11px",
                              marginBottom: "8px",
                            }}
                          >
                            Warning: marking stress from this roll (push /
                            incapacity / Phantom Pain / etc.) exceeds your empty
                            stress boxes (SRD: suffer trauma — mark on your sheet
                            with the table now or right after resolving the roll).
                          </div>
                          <label
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "8px",
                              fontSize: "11px",
                              color: "#e5e7eb",
                              marginBottom: "10px",
                              cursor: "pointer",
                              lineHeight: 1.35,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={stressOverflowConfirmed}
                              onChange={(e) =>
                                setStressOverflowConfirmed(e.target.checked)
                              }
                              style={{ marginTop: "2px" }}
                            />
                            <span>
                              I take the trauma consequence and proceed with this roll
                              (required when stress would overflow).
                            </span>
                          </label>
                        </>
                      )}
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          onClick={handleRollWithSession}
                          disabled={
                            (healOtherRecoveryIntent.enabled &&
                              !String(healOtherRecoveryIntent.targetId || "").trim()) ||
                            (rollModal.devil_bargain_dice &&
                              ((gmDevilBargainText && !devilBargainConfirmed) ||
                                (!gmDevilBargainText &&
                                  !(
                                    rollModal.devil_bargain_note || ""
                                  ).trim()))) ||
                            (pushWouldCauseTrauma && !stressOverflowConfirmed)
                          }
                          style={{
                            ...S.btn,
                            background: "#7c3aed",
                            color: "#fff",
                          }}
                        >
                          Roll
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRollPending(null);
                            setRollApiError(null);
                            setRollAbilityBoost({});
                            setHeritageRollBoost({});
                            setPhantomPainThroughCover(false);
                            setRippleBreathingFreePush(false);
                            setIncludePendingAssistDie(true);
                            setStressOverflowConfirmed(false);
                            setRollGoalDraft("");
                            setDevilBargainConfirmed(false);
                            setHealOtherRecoveryIntent({
                              enabled: false,
                              actionName: "TINKER",
                              targetId: "",
                              selectedBolsterKeys: [],
                              bolsterNote: "",
                            });
                            setRollModal({
                              push_effect: false,
                              push_dice: false,
                              devil_bargain_dice: false,
                              devil_bargain_note: "",
                            });
                          }}
                          style={S.btn}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {resistancePending && characterId && (
                    <div
                      style={{
                        background: "#1f2937",
                        padding: "12px",
                        borderRadius: "4px",
                        border: "1px solid #2563eb",
                        marginBottom: "14px",
                        fontSize: "12px",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: "bold",
                          marginBottom: "4px",
                          color: "#93c5fd",
                        }}
                      >
                        Resistance dice pool — {resistancePending.attr}
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#6b7280",
                          marginBottom: "10px",
                          lineHeight: 1.35,
                        }}
                      >
                        {resistancePoolPreview?.modeStandDurability ? (
                          <>
                            When your <strong>Stand</strong> takes a hit, resist with
                            Durability dice (SRD_DEV).                             Stress:{" "}
                            <code style={{ color: "#9ca3af" }}>6 − highest die</code>
                            {" "}(a 6 costs 0;{" "}
                            <strong>two sixes</strong> = resist free and clear 1
                            stress). Apply to the
                            Stand&apos;s consequence; use Stand Armor charges separately
                            if marking armor.
                          </>
                        ) : (
                          <>
                            Review all dice before rolling. After result, apply harm reduction,
                            mark stress from{" "}
                            <code style={{ color: "#9ca3af" }}>6 - highest die</code>,
                            then use any post-roll mitigation/follow-up options.
                          </>
                        )}
                      </div>
                      {resistancePoolPreview ? (
                        <div
                          style={{
                            marginBottom: "12px",
                            padding: "10px",
                            background: "#0d1117",
                            borderRadius: "8px",
                            border: "1px solid #374151",
                          }}
                        >
                          <DicePoolStrip
                            label={
                              resistancePoolPreview.modeStandDurability
                                ? "Durability Stand Coin grade (dice pool)"
                                : "Attribute rating (dots in this attribute)"
                            }
                            count={resistancePoolPreview.base}
                          />
                          {resistancePoolPreview.bonusDice > 0 ? (
                            <DicePoolStrip
                              label={`Resistance bonuses (+${resistancePoolPreview.bonusDice}d)`}
                              count={resistancePoolPreview.bonusDice}
                              color="#22c55e"
                            />
                          ) : null}
                          <div
                            style={{
                              marginTop: 10,
                              fontSize: 11,
                              color: "#9ca3af",
                              lineHeight: 1.4,
                            }}
                          >
                            {resistancePoolPreview.activeBonusNames.length > 0 ? (
                              <div>
                                Active: {resistancePoolPreview.activeBonusNames.join(" · ")}
                              </div>
                            ) : (
                              <div>No pre-roll bonus dice selected for this attribute.</div>
                            )}
                            {resistancePoolPreview.hasPostRollOptions ? (
                              <div style={{ marginTop: 4 }}>
                                Post-roll mitigation options available if selected below.
                              </div>
                            ) : null}
                            {resistancePoolPreview.extraStress > 0 ? (
                              <div style={{ marginTop: 4, color: "#fbbf24" }}>
                                Push stress to mark: +{resistancePoolPreview.extraStress}
                              </div>
                            ) : null}
                          </div>
                          {resistancePoolPreview.zeroDice ? (
                            <div
                              style={{
                                marginTop: "8px",
                                color: "#fca5a5",
                                fontSize: "11px",
                              }}
                            >
                              0 dice in pool — you roll 2d6 and keep the lower die.
                            </div>
                          ) : (
                            <div
                              style={{
                                marginTop: "8px",
                                color: "#d1d5db",
                                fontSize: "11px",
                              }}
                            >
                              Total dice: <strong>{resistancePoolPreview.total}</strong>
                            </div>
                          )}
                        </div>
                      ) : null}
                      {resistancePoolPreview?.options?.length > 0 ? (
                        <div
                          style={{
                            marginBottom: "10px",
                            padding: "8px",
                            background: "#0d1117",
                            border: "1px solid #374151",
                            borderRadius: "6px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "10px",
                              color: "#9ca3af",
                              marginBottom: "6px",
                            }}
                          >
                            Optional resistance bonuses
                          </div>
                          <div style={{ display: "grid", gap: "6px" }}>
                            <label
                              style={{
                                fontSize: "10px",
                                color: "#9ca3af",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={!!resistancePushDice}
                                onChange={(e) => setResistancePushDice(e.target.checked)}
                              />
                              Push yourself (+1d, +2 stress)
                            </label>
                            {resistancePoolPreview.options
                              .filter((opt) => Math.max(0, Number(opt.bonusDice) || 0) > 0)
                              .map((opt) => (
                                <label
                                  key={`res-preview-${opt.id}`}
                                  style={{
                                    fontSize: "10px",
                                    color: "#9ca3af",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    cursor: "pointer",
                                  }}
                                  title={opt.description || undefined}
                                >
                                  <input
                                    type="checkbox"
                                    checked={!!resistanceAbilityBoost[opt.id]}
                                    onChange={(e) =>
                                      setResistanceAbilityBoost((prev) => ({
                                        ...prev,
                                        [opt.id]: e.target.checked,
                                      }))
                                    }
                                  />
                                  {opt.name} (+{Math.max(0, Number(opt.bonusDice) || 0)}d)
                                </label>
                              ))}
                          </div>
                        </div>
                      ) : null}
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => {
                            const attr = String(resistancePending.attr || "").toUpperCase();
                            const modeStandDur =
                              resistancePending.mode === "stand_durability";
                            const base = Math.max(
                              0,
                              Number(resistancePending.baseDice) || 0,
                            );
                            const activeBonusOptions = resistanceAbilityOptions.filter((opt) => {
                              const appliesTo = String(opt.appliesTo || "").toUpperCase();
                              const applies = modeStandDur
                                ? appliesTo === "ALL"
                                : appliesTo === "ALL" || appliesTo === attr;
                              return (
                                applies &&
                                !!resistanceAbilityBoost[opt.id] &&
                                Math.max(0, Number(opt.bonusDice) || 0) > 0
                              );
                            });
                            const bonus = activeBonusOptions.reduce(
                              (sum, opt) => sum + Math.max(0, Number(opt.bonusDice) || 0),
                              0,
                            );
                            const pushBonus = resistancePushDice ? 1 : 0;
                            const extraStress = resistancePushDice ? 2 : 0;
                            const ironWillActive =
                              !modeStandDur &&
                              activeBonusOptions.some(
                                (opt) => opt.id === "iron-will",
                              );
                            rollDice(
                              modeStandDur ? "stand_durability" : attr,
                              base + bonus + pushBonus,
                              true,
                              false,
                              undefined,
                              {
                                resistanceExtraStress: extraStress,
                                ...(modeStandDur
                                  ? {
                                      durabilityStandResistance: true,
                                      resistanceBonusNote:
                                        "Stand durability resistance",
                                    }
                                  : ironWillActive
                                    ? { resistanceBonusNote: "+1d (Iron Will)" }
                                    : {}),
                              },
                            );
                          }}
                          style={{
                            ...S.btn,
                            background: "#2563eb",
                            color: "#fff",
                          }}
                        >
                          Roll resistance
                        </button>
                        <button
                          type="button"
                          onClick={() => setResistancePending(null)}
                          style={S.btn}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Dice result — same slot under action ratings (after pool or resistance / offline roll) */}
                  {diceResult && !rollPending && !resistancePending && (
                    <div
                      style={{
                        background: "#1f2937",
                        padding: "12px",
                        borderRadius: "4px",
                        border: "1px solid #4b5563",
                        marginBottom: "14px",
                        fontSize: "12px",
                      }}
                    >
                      <div
                        style={{
                          color: "#a78bfa",
                          fontWeight: "bold",
                          marginBottom: "6px",
                        }}
                      >
                        {diceResult.recoveryPresentation?.cadence === "downtime" ? (
                          <>
                            <span style={{ color: "#5eead4" }}>
                              Downtime healing clock
                            </span>{" "}
                            <span style={{ color: "#a78bfa" }}>
                              ({diceResult.action} treatment roll)
                            </span>
                            <div
                              style={{
                                marginTop: "4px",
                                fontSize: "10px",
                                color: "#94a3b8",
                                fontWeight: 400,
                                lineHeight: 1.35,
                              }}
                            >
                              No position or effect — not under action-roll pressure. If an
                              NPC is the primary healer, the referee uses a Fortune pool
                              (1d–4d by competence) instead of this PC rating roll; coin can
                              still bump after any care roll.
                            </div>
                          </>
                        ) : (
                          <>
                            {diceResult.action}{" "}
                            {diceResult.isResistance
                              ? "Resistance Roll"
                              : "Action Roll"}
                            {diceResult.zeroDice && (
                              <span style={{ color: "#f87171", marginLeft: "8px" }}>
                                (2d6 — lower counts)
                              </span>
                            )}
                            {diceResult.isDesperateAction && (
                              <span style={{ color: "#f97316", marginLeft: "8px" }}>
                                (Desperate — XP marked)
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          alignItems: "center",
                          flexWrap: "wrap",
                          marginBottom: "8px",
                        }}
                      >
                        <div style={{ display: "flex", gap: "3px" }}>
                          {(diceResult.dice || []).map((die, i) => (
                            <span
                              key={i}
                              style={{
                                display: "inline-flex",
                                width: "24px",
                                height: "24px",
                                borderRadius: "4px",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: "bold",
                                border: "1px solid",
                                background:
                                  die === 6
                                    ? "#166534"
                                    : die >= 4
                                      ? "#1e3a8a"
                                      : "#374151",
                                borderColor:
                                  die === 6
                                    ? "#22c55e"
                                    : die >= 4
                                      ? "#3b82f6"
                                      : "#6b7280",
                              }}
                            >
                              {die}
                            </span>
                          ))}
                        </div>
                        {!diceResult.isResistance &&
                          diceResult.recoveryPresentation?.cadence !== "downtime" && (
                            <span
                              style={{
                                fontWeight: "bold",
                                color: diceResult.outcome.includes("Critical")
                                  ? "#fbbf24"
                                  : diceResult.outcome === "Success"
                                    ? "#22c55e"
                                    : diceResult.outcome.includes("Partial")
                                      ? "#eab308"
                                      : "#ef4444",
                              }}
                            >
                              {diceResult.outcome}
                            </span>
                          )}
                        {diceResult.recoveryPresentation?.cadence !== "downtime" &&
                          diceResult.special && (
                            <span style={{ color: "#fbbf24" }}>{diceResult.special}</span>
                          )}
                        {(diceResult.position || diceResult.effect) &&
                          !diceResult.isResistance &&
                          diceResult.recoveryPresentation?.cadence !== "downtime" && (
                            <span
                              style={{
                                color: "#6b7280",
                                fontSize: "11px",
                                marginLeft: "8px",
                              }}
                            >
                              ({diceResult.position || "—"},{" "}
                              {diceResult.effect || "—"})
                            </span>
                          )}
                        {diceResult.xpGained > 0 && (
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "2px 8px",
                              borderRadius: "9999px",
                              fontWeight: "bold",
                              background: "#16a34a",
                              color: "#fff",
                              marginLeft: "8px",
                            }}
                          >
                            +{diceResult.xpGained} XP
                          </span>
                        )}
                      </div>

                      {diceResult.recoveryPresentation?.cadence === "downtime" ? (
                        <div
                          style={{
                            marginBottom: "10px",
                            padding: "10px 12px",
                            borderRadius: "6px",
                            border: "1px solid #0f766e",
                            background: "#0f172a",
                            fontSize: "11px",
                            color: "#ccfbf1",
                            lineHeight: 1.45,
                          }}
                        >
                          <div style={{ fontWeight: 700, marginBottom: "6px" }}>
                            Healing-clock ticks{" "}
                            <span style={{ fontWeight: 400, color: "#99f6e4" }}>
                              (downtime procedure)
                            </span>
                          </div>
                          <div style={{ color: "#a7f3d0", marginBottom: "6px" }}>
                            <strong>Critical</strong> (two sixes):{" "}
                            <strong>5 ticks</strong> · Single <strong>6</strong>:{" "}
                            <strong>3 ticks</strong> · <strong>4–5</strong>:{" "}
                            <strong>2 ticks</strong> · <strong>1–3</strong>:{" "}
                            <strong>1 tick</strong>
                          </div>
                          {diceResult.recoveryPresentation.selfTreatment ? (
                            <div style={{ marginBottom: "8px", color: "#fcd34d" }}>
                              Self-treatment downtime: <strong>−1 tick</strong> from the
                              raw band is folded into the total below (SRD).
                            </div>
                          ) : null}
                          <div style={{ color: "#ecfdf5" }}>
                            Rolled band (from pool dice):{" "}
                            <strong>{diceResult.recoveryPresentation.bandLabel}</strong> →{" "}
                            <strong style={{ color: "#34d399" }}>
                              +{diceResult.recoveryPresentation.ticks} tick(s)
                            </strong>{" "}
                            toward the healing clock resolution (coin bump to critical can
                            still stack before GM resolves harm steps).
                          </div>
                          <div
                            style={{
                              marginTop: "8px",
                              fontSize: "10px",
                              color: "#94a3b8",
                            }}
                          >
                            Treating someone else here does not consume the healer&apos;s own
                            downtime activity (SRD). Toughing it out with no aid: mark stress
                            and roll with <strong>0 dice</strong>. New harm clears ticking
                            progress on the healing clock.
                          </div>
                        </div>
                      ) : null}

                      {diceResult.isResistance && (
                        <div
                          style={{
                            padding: "8px",
                            borderRadius: "4px",
                            ...(diceResult.isCritical
                              ? {
                                  background: "#451a03",
                                  border: "1px solid #92400e",
                                }
                              : {
                                  background: "#0d1117",
                                  border: "1px solid #374151",
                                }),
                          }}
                        >
                          {hasStayingPowerAbility &&
                          (hasFatalHarm ||
                            diceResult.outcome === "Failure" ||
                            diceResult.outcome === "Partial Success") ? (
                            <div
                              style={{
                                marginBottom: "10px",
                                padding: "6px 8px",
                                background: "#1c1917",
                                border: "1px solid #9f1239",
                                borderRadius: "4px",
                                fontSize: "10px",
                                color: "#fecdd3",
                                lineHeight: 1.35,
                              }}
                            >
                              <strong>Staying Power:</strong>{" "}
                              {hasFatalHarm ? (
                                <>
                                  Level 4 harm is already on your sheet. If you
                                  cannot clear it with this resistance outcome,
                                  negotiate the Staying Power fiction (limb /
                                  severe cost) with the GM— the post-roll option
                                  stays on while fatal harm is marked.
                                </>
                              ) : (
                                <>
                                  If this consequence still lands as Level 4
                                  lethal harm and you cannot eliminate it,
                                  Staying Power may apply (GM/table)— the
                                  post-roll option is under Action Ratings.
                                </>
                              )}
                            </div>
                          ) : null}
                          {diceResult.isCritical ? (
                            <>
                              <div
                                style={{
                                  color: "#fbbf24",
                                  fontWeight: "bold",
                                  marginBottom: "2px",
                                }}
                              >
                                ✦ CRITICAL — 0 Stress cost + Clear 1 stress
                              </div>
                              <div
                                style={{ color: "#fcd34d", fontSize: "11px" }}
                              >
                                Pay no stress AND remove one previously filled
                                stress box.
                              </div>
                              <div
                                style={{
                                  marginTop: "8px",
                                  display: "grid",
                                  gridTemplateColumns: "1fr auto",
                                  gap: "8px",
                                  alignItems: "center",
                                }}
                              >
                                <select
                                  value={resistanceHarmTarget}
                                  onChange={(e) =>
                                    setResistanceHarmTarget(e.target.value)
                                  }
                                  style={{ ...S.sel, fontSize: "11px" }}
                                >
                                  <option value="">Harm to reduce…</option>
                                  {filledHarmOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => {
                                    setResistanceApplyErr(null);
                                    if (!resistanceHarmTarget) {
                                      setResistanceApplyErr(
                                        "Choose a harm level to reduce before resolving resistance.",
                                      );
                                      return;
                                    }
                                    const reduced =
                                      clearHarmSlot(resistanceHarmTarget);
                                    if (!reduced) {
                                      setResistanceApplyErr(
                                        "Selected harm slot is empty.",
                                      );
                                      return;
                                    }
                                    if (!diceResult.resistanceApplied) {
                                      // Critical: clear 1 stress via server PATCH.
                                      // Push (if any) already applied on createRoll — do not re-add.
                                      // Do NOT mark field touch — omit+merge contract.
                                      setStressFilled((prev) => {
                                        const next = Math.max(
                                          0,
                                          (Number(prev) || 0) - 1,
                                        );
                                        stressTraumaTruthRef.current = {
                                          stressFilled: next,
                                          trauma:
                                            stressTraumaTruthRef.current?.trauma ||
                                            null,
                                        };
                                        onCharacterStressTraumaSync?.({
                                          stressFilled: next,
                                        });
                                        if (characterId) {
                                          void characterAPI
                                            .patchCharacter(characterId, {
                                              stress: next,
                                            })
                                            .catch(() => {});
                                        }
                                        return next;
                                      });
                                    }
                                    setDiceResult((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            resistanceApplied: true,
                                            resistanceHarmReductionCount:
                                              (Number(
                                                prev.resistanceHarmReductionCount,
                                              ) || 0) + 1,
                                          }
                                        : prev,
                                    );
                                  }}
                                  style={{
                                    ...S.btn,
                                    background: "#92400e",
                                    color: "#fff",
                                    fontSize: "11px",
                                  }}
                                >
                                  Reduce selected harm
                                </button>
                              </div>
                              {(Number(diceResult.resistanceHarmReductionCount) ||
                                0) >= 2 ? (
                                <div
                                  style={{
                                    marginTop: "6px",
                                    fontSize: "10px",
                                    color: "#fcd34d",
                                  }}
                                >
                                  Stress clear already applied for this roll. You can still
                                  choose another harm slot or use post-roll options.
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <div
                                style={{
                                  color: "#eab308",
                                  fontWeight: "bold",
                                  marginBottom: "2px",
                                }}
                              >
                                Stress Cost:{" "}
                                {diceResult.resistanceTotalStressCost ??
                                  diceResult.stressCost}
                                {(Number(diceResult.resistanceExtraStress) || 0) > 0
                                  ? ` (${Math.max(0, Number(diceResult.stressCost) || 0)} resist + ${Number(diceResult.resistanceExtraStress) || 0} push)`
                                  : ""}
                              </div>
                              <div
                                style={{
                                  color: "#d1d5db",
                                  fontSize: "11px",
                                  marginBottom: "6px",
                                }}
                              >
                                Consequence reduced by 1 level (or fully negated
                                at the table&apos;s discretion).
                              </div>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr auto",
                                  gap: "8px",
                                  alignItems: "center",
                                }}
                              >
                                <select
                                  value={resistanceHarmTarget}
                                  onChange={(e) =>
                                    setResistanceHarmTarget(e.target.value)
                                  }
                                  style={{ ...S.sel, fontSize: "11px" }}
                                >
                                  <option value="">Harm to reduce…</option>
                                  {filledHarmOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => {
                                    setResistanceApplyErr(null);
                                    if (!resistanceHarmTarget) {
                                      setResistanceApplyErr(
                                        "Choose a harm level to reduce before marking stress.",
                                      );
                                      return;
                                    }
                                    const reduced =
                                      clearHarmSlot(resistanceHarmTarget);
                                    if (!reduced) {
                                      setResistanceApplyErr(
                                        "Selected harm slot is empty.",
                                      );
                                      return;
                                    }
                                    if (!diceResult.resistanceApplied) {
                                      // Stress applied server-side on createRoll when session
                                      // present. Offline (no session): apply via truth lock, no touch.
                                      if (!activeSessionId) {
                                        const cost =
                                          diceResult.resistanceTotalStressCost ??
                                          diceResult.stressCost ??
                                          0;
                                        applyStressCost(cost);
                                      }
                                    }
                                    setDiceResult((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            resistanceApplied: true,
                                            mitigationAbility:
                                              resistanceMitigationChoice || "",
                                            resistanceHarmReductionCount:
                                              (Number(
                                                prev.resistanceHarmReductionCount,
                                              ) || 0) + 1,
                                          }
                                        : prev,
                                    );
                                  }}
                                  style={{
                                    ...S.btn,
                                    background: "#b45309",
                                    color: "#fff",
                                    fontSize: "11px",
                                  }}
                                >
                                  Reduce selected harm
                                </button>
                              </div>
                              {(Number(diceResult.resistanceHarmReductionCount) ||
                                0) >= 2 ? (
                                <div
                                  style={{
                                    marginTop: "6px",
                                    fontSize: "10px",
                                    color: "#fcd34d",
                                  }}
                                >
                                  Stress already marked for this roll. You can still pick
                                  another harm slot or use a post-roll ability option.
                                </div>
                              ) : null}
                              {resistanceAbilityOptions.some(
                                (opt) =>
                                  opt.mitigationOnly &&
                                  !!resistanceAbilityBoost[opt.id],
                              ) ? (
                                <div style={{ marginTop: "8px" }}>
                                  <select
                                    value={resistanceMitigationChoice}
                                    onChange={(e) =>
                                      setResistanceMitigationChoice(e.target.value)
                                    }
                                    style={{ ...S.sel, fontSize: "11px", width: "100%" }}
                                  >
                                    <option value="">No mitigation ability selected</option>
                                    {resistanceAbilityOptions
                                      .filter(
                                        (opt) =>
                                          opt.mitigationOnly &&
                                          !!resistanceAbilityBoost[opt.id],
                                      )
                                      .map((opt) => (
                                        <option key={opt.id} value={opt.name}>
                                          {opt.name}
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              ) : null}
                            </>
                          )}
                          {resistanceRollSheetReminderItems.length > 0 ? (
                            <div
                              style={{
                                marginTop: "10px",
                                paddingTop: "10px",
                                borderTop: "1px solid #374151",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "10px",
                                  color: "#9ca3af",
                                  marginBottom: "4px",
                                  fontWeight: "bold",
                                }}
                              >
                                Sheet abilities (optional — hover name for full
                                text)
                              </div>
                              <div
                                style={{
                                  fontSize: "9px",
                                  color: "#6b7280",
                                  marginBottom: "8px",
                                  lineHeight: 1.35,
                                }}
                              >
                                Reminders from your standard / Hamon / Spin picks.
                                Table confirms fiction (same idea as “Sheet
                                abilities” in the dice pool).
                              </div>
                              {resistanceRollSheetReminderItems.map((rem) => (
                                <div
                                  key={rem.key}
                                  title={rem.title}
                                  style={{
                                    marginBottom: "8px",
                                    padding: "8px",
                                    borderRadius: "6px",
                                    background: "#0f172a",
                                    border: "1px solid #14532d",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "flex-start",
                                      justifyContent: "space-between",
                                      gap: "8px",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    <span
                                      style={{
                                        color: "#6ee7b7",
                                        fontWeight: "bold",
                                        fontSize: "11px",
                                      }}
                                    >
                                      {rem.headline}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: "9px",
                                        color: "#86efac",
                                        textTransform: "uppercase",
                                        flexShrink: 0,
                                      }}
                                    >
                                      {rem.abilityName} · {rem.abilityType}
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      fontSize: "10px",
                                      color: "#d1d5db",
                                      lineHeight: 1.35,
                                    }}
                                  >
                                    {rem.body}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {resistanceApplyErr ? (
                            <div
                              style={{
                                marginTop: "6px",
                                color: "#fca5a5",
                                fontSize: "11px",
                              }}
                            >
                              {resistanceApplyErr}
                            </div>
                          ) : null}
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setDiceResult(null);
                        }}
                        style={{
                          display: "block",
                          marginTop: "6px",
                          color: "#6b7280",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "11px",
                        }}
                      >
                        ✕ Clear
                      </button>
                    </div>
                  )}

                  {/* Help & Group Action (session + campaign) */}
                  {charCampaign && activeSessionId && characterId && (
                    <div style={{ ...S.card, marginBottom: "12px" }}>
                      <span style={S.lbl}>CREW ACTIONS</span>
                      {activeGroupAction?.id &&
                      String(activeGroupAction.leader) !== String(characterId) ? (
                        <div
                          style={{
                            marginTop: "8px",
                            marginBottom: "8px",
                            padding: "6px 8px",
                            border: "1px solid #374151",
                            borderRadius: "6px",
                            background: "#0f172a",
                            fontSize: "11px",
                            color: "#93c5fd",
                          }}
                        >
                          Group leader:{" "}
                          <strong style={{ color: "#e5e7eb" }}>
                            {activeGroupLeaderName}
                          </strong>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setCrewAssistExpandedPersist((v) => !v)}
                        style={{
                          display: "flex",
                          width: "100%",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: "10px",
                          marginBottom: crewAssistExpanded ? "8px" : 0,
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "1px solid #374151",
                          background: "#111827",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          textAlign: "left",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#e5e7eb",
                          }}
                        >
                          Assist
                        </span>
                        <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                          {crewAssistExpanded ? "Hide ▾" : "Show ▸"}
                        </span>
                      </button>
                      {crewAssistExpanded && (
                        <>
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#9ca3af",
                              marginBottom: "10px",
                              lineHeight: 1.4,
                            }}
                          >
                            <strong style={{ color: "#d1d5db" }}>Assist:</strong>{" "}
                            choose which teammate spends 1 stress for your +1d on
                            your next ACTION roll this session — at most one pending
                            assist at a time; it applies when you press Roll below.
                          </div>
                          {assistHelpPending ? (
                            <div
                              style={{
                                marginBottom: "10px",
                                padding: "8px 10px",
                                borderRadius: "6px",
                                border: "1px solid #0f766e",
                                background: "#0f172a",
                                fontSize: "11px",
                                color: "#99f6e4",
                              }}
                            >
                              Pending crew assist: +1d from{" "}
                              <strong style={{ color: "#e5e7eb" }}>
                                {String(
                                  assistHelpPending.helper_name ||
                                    assistHelpPending.helperName ||
                                    "",
                                ).trim() || "teammate"}
                              </strong>{" "}
                              (they already marked stress). Resolve it when you Roll
                              an action — or abandon it by rolling once without including
                              the assist die.
                            </div>
                          ) : null}
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "8px",
                              alignItems: "center",
                              marginBottom: "12px",
                            }}
                          >
                            <select
                              style={{ ...S.sel, width: "100%", maxWidth: 260 }}
                              value={assistTargetId}
                              onChange={(e) => setAssistTargetId(e.target.value)}
                            >
                              <option value="">
                                Choose teammate — they spend 1 stress
                              </option>
                              {helpCandidates.map((c) => (
                                <option key={c.id} value={String(c.id)}>
                                  {c.true_name || c.name || `PC ${c.id}`}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={
                                !!assistHelpPending ||
                                !assistTargetId ||
                                assistGrantBusy
                              }
                              onClick={async () => {
                                if (!assistTargetId || !characterId) return;
                                if (!activeSessionId) return;
                                setAssistGrantErr(null);
                                setAssistGrantMsg(null);
                                setAssistGrantBusy(true);
                                try {
                                  await characterAPI.assistHelp(
                                    Number(characterId),
                                    parseInt(assistTargetId, 10),
                                    Number(activeSessionId),
                                  );
                                  const helperPc = helpCandidates.find(
                                    (c) =>
                                      String(c.id) === String(assistTargetId),
                                  );
                                  const hn =
                                    helperPc?.true_name ||
                                    helperPc?.name ||
                                    "Teammate";
                                  setAssistGrantMsg(
                                    `${hn} spends 1 stress — you gain +1d when you roll an action while this session is active (shown in the dice preview).`,
                                  );
                                  setAssistTargetId("");
                                  onCampaignRefresh?.();
                                } catch (e) {
                                  setAssistGrantErr(e.message);
                                } finally {
                                  setAssistGrantBusy(false);
                                }
                              }}
                              style={{
                                ...S.btn,
                                background: "#0f766e",
                                color: "#f8fafc",
                                fontSize: "11px",
                              }}
                            >
                              {assistGrantBusy ? "…" : "Grant +1d assist"}
                            </button>
                          </div>
                          {assistGrantMsg ? (
                            <div
                              style={{
                                fontSize: "11px",
                                color: "#5eead4",
                                marginBottom: "10px",
                              }}
                            >
                              {assistGrantMsg}
                            </div>
                          ) : null}
                          {assistGrantErr ? (
                            <div
                              style={{
                                fontSize: "11px",
                                color: "#f87171",
                                marginBottom: "10px",
                              }}
                            >
                              {assistGrantErr}
                            </div>
                          ) : null}
                        </>
                      )}
                      <div
                        style={{
                          marginTop: "12px",
                          paddingTop: "12px",
                          borderTop: "1px solid #374151",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setCrewGroupExpandedPersist((v) => !v)}
                          style={{
                            display: "flex",
                            width: "100%",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: crewGroupExpanded ? "8px" : 0,
                            padding: "8px 10px",
                            borderRadius: "6px",
                            border: "1px solid #374151",
                            background: "#111827",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            textAlign: "left",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: 700,
                              color: "#e5e7eb",
                            }}
                          >
                            Group action
                          </span>
                          <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                            {crewGroupExpanded ? "Hide ▾" : "Show ▸"}
                          </span>
                        </button>
                        {crewGroupExpanded ? (
                          <>
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "10px",
                                alignItems: "flex-end",
                                marginTop: "4px",
                                fontSize: "12px",
                              }}
                            >
                              <div style={{ flex: "1 1 200px" }}>
                          <span
                            style={{
                              fontSize: "10px",
                              color: "#9ca3af",
                              display: "block",
                              marginBottom: "4px",
                            }}
                          >
                            Group action roll (required)
                          </span>
                          <select
                            style={{ ...S.sel, width: "100%", maxWidth: 320 }}
                            value={groupActionNameDraft}
                            disabled={!canEditGroupActionSetupFields}
                            onChange={(e) =>
                              setGroupActionNameDraft(e.target.value)
                            }
                          >
                            <option value="">Choose action</option>
                            {groupActionChoices.map((action) => (
                              <option key={action} value={action}>
                                {action}
                              </option>
                            ))}
                            {showStandCoinActionColumn ? (
                              <optgroup label="Stand (coin pools)">
                                {STAND_ROLL_KEYS_ACTIVE.map((sk) => {
                                  const slug = `stand_${String(sk || "").trim().toLowerCase()}`;
                                  const label = `${String(sk || "").toUpperCase()} (Stand)`;
                                  return (
                                    <option key={slug} value={slug}>
                                      {label}
                                    </option>
                                  );
                                })}
                              </optgroup>
                            ) : null}
                          </select>
                          <span
                            style={{
                              fontSize: "10px",
                              color: "#9ca3af",
                              display: "block",
                              marginBottom: "4px",
                              marginTop: "8px",
                            }}
                          >
                            Group action goal
                          </span>
                          <input
                            style={{ ...S.inp, width: "100%", maxWidth: 320 }}
                            value={groupGoalDraft}
                            disabled={!canEditGroupActionSetupFields}
                            onChange={(e) => setGroupGoalDraft(e.target.value)}
                            placeholder="Name the group action"
                          />
                          {activeGroupAction?.id && !isOpenGroupLeader ? (
                            <div
                              style={{
                                fontSize: "10px",
                                color: "#9ca3af",
                                marginTop: "6px",
                              }}
                            >
                              Only{" "}
                              {activeGroupLeaderName || "the group leader"} can
                              change the action or goal for this open group.
                            </div>
                          ) : null}
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              marginTop: 6,
                              flexWrap: "wrap",
                              alignItems: "center",
                            }}
                          >
                            <button
                              type="button"
                              disabled={
                                groupBusy ||
                                !groupActionNameDraft ||
                                !!activeGroupAction?.id
                              }
                              onClick={async () => {
                                setGroupBusy(true);
                                try {
                                  setGroupActionErr(null);
                                  const ga = await groupActionAPI.create({
                                    session: activeSessionId,
                                    leader: characterId,
                                    action_name: groupActionNameDraft.toLowerCase(),
                                    goal_label: groupGoalDraft.trim(),
                                  });
                                  setActiveGroupAction(ga);
                                  onCampaignRefresh?.();
                                } catch (e) {
                                  setGroupActionErr(e.message);
                                } finally {
                                  setGroupBusy(false);
                                }
                              }}
                              style={{
                                ...S.btn,
                                background: "#4338ca",
                                color: "#fff",
                                fontSize: "11px",
                              }}
                            >
                              {groupBusy ? "…" : "Start group action"}
                            </button>
                            {activeGroupAction?.id && (
                              <span
                                style={{ fontSize: "10px", color: "#a78bfa" }}
                              >
                                Open group #{activeGroupAction.id} ({String(activeGroupAction.action_name || "").toUpperCase()}) — {groupPendingCount} pending, {groupFailures} fail.
                              </span>
                            )}
                            {activeGroupAction?.id && (
                              <button
                                type="button"
                                onClick={() =>
                                  rollDice(
                                    String(activeGroupAction.action_name || "").toLowerCase(),
                                    0,
                                    false,
                                    false,
                                    activeGroupAction.id,
                                  )
                                }
                                style={{
                                  ...S.btn,
                                  fontSize: "11px",
                                  background: "#0f766e",
                                  color: "#ecfeff",
                                }}
                                title="Roll this group's chosen action"
                              >
                                Roll {String(activeGroupAction.action_name || "").toUpperCase()} 🎲
                              </button>
                            )}
                            {activeGroupAction?.id && isOpenGroupLeader && (
                              <button
                                type="button"
                                disabled={groupBusy}
                                onClick={async () => {
                                  setGroupBusy(true);
                                  try {
                                    setGroupActionErr(null);
                                    await groupActionAPI.cancel(
                                      activeGroupAction.id,
                                    );
                                    setActiveGroupAction(null);
                                    onCampaignRefresh?.();
                                  } catch (e) {
                                    setGroupActionErr(e.message);
                                  } finally {
                                    setGroupBusy(false);
                                  }
                                }}
                                style={{
                                  ...S.btn,
                                  fontSize: "11px",
                                  background: "#1f2937",
                                  color: "#e5e7eb",
                                  border: "1px solid #6b7280",
                                }}
                              >
                                {groupBusy ? "…" : "Cancel group action"}
                              </button>
                            )}
                            {activeGroupAction?.id &&
                              !groupActionLoading &&
                              groupPendingCount === 0 &&
                              (isGM ||
                                String(activeGroupAction.leader) ===
                                  String(characterId)) && (
                              <button
                                type="button"
                                disabled={groupBusy}
                                onClick={async () => {
                                  setGroupBusy(true);
                                  try {
                                    setGroupActionErr(null);
                                    await groupActionAPI.resolve(
                                      activeGroupAction.id,
                                    );
                                    setActiveGroupAction(null);
                                    onCampaignRefresh?.();
                                  } catch (e) {
                                    setGroupActionErr(e.message);
                                  } finally {
                                    setGroupBusy(false);
                                  }
                                }}
                                style={{
                                  ...S.btn,
                                  fontSize: "11px",
                                  background: "#7c3aed",
                                  color: "#fff",
                                }}
                              >
                                {groupBusy ? "…" : "Resolve"}
                              </button>
                            )}
                          </div>
                          {groupActionErr && (
                            <div
                              style={{
                                color: "#f87171",
                                fontSize: "10px",
                                marginTop: 6,
                              }}
                            >
                              {groupActionErr}
                            </div>
                          )}
                              </div>
                            </div>
                            {activeGroupAction?.id && (
                              <div
                                style={{
                                  marginTop: "8px",
                                  background: "#0f172a",
                                  border: "1px solid #334155",
                                  borderRadius: "6px",
                                  padding: "8px",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "11px",
                                    color: "#cbd5e1",
                                    marginBottom: "6px",
                                  }}
                                >
                                  Group roll board ({String(activeGroupAction.action_name || "").toUpperCase()})
                                </div>
                                {groupActionLoading ? (
                                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                                    Loading group rolls…
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      display: "grid",
                                      gap: "6px",
                                    }}
                                  >
                                    {groupRollBoard.map((row) => (
                                      <div
                                        key={row.id}
                                        style={{
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "center",
                                          fontSize: "11px",
                                          background: "#111827",
                                          border: "1px solid #374151",
                                          borderRadius: "4px",
                                          padding: "6px 8px",
                                        }}
                                      >
                                        <span style={{ color: "#e5e7eb" }}>
                                          {row.name}
                                        </span>
                                        {!row.roll ? (
                                          <span style={{ color: "#9ca3af" }}>
                                            Pending
                                          </span>
                                        ) : (
                                          (() => {
                                            const diceStr = (
                                              row.roll.results || []
                                            ).join(", ");
                                            const meta =
                                              GROUP_ROLL_BOARD_BAND[
                                                row.outcomeBand || "fail"
                                              ] || GROUP_ROLL_BOARD_BAND.fail;
                                            return (
                                              <span
                                                style={{
                                                  color: meta.color,
                                                  fontWeight:
                                                    row.outcomeBand === "critical"
                                                      ? 600
                                                      : undefined,
                                                }}
                                              >
                                                {meta.label} ({diceStr})
                                              </span>
                                            );
                                          })()
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div
                                  style={{
                                    marginTop: "8px",
                                    fontSize: "10px",
                                    color: "#93c5fd",
                                  }}
                                >
                                  Leader marks {groupFailures} stress on resolve (1 per non-leader fail).
                                </div>
                              </div>
                            )}
                          </>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => setCrewHealExpandedPersist((v) => !v)}
                        style={{
                          display: "flex",
                          width: "100%",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: "12px",
                          marginBottom: crewHealExpanded ? "8px" : 0,
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "1px solid #374151",
                          background: "#111827",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          textAlign: "left",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#e5e7eb",
                          }}
                        >
                          Heal teammate (session recover-in-play)
                        </span>
                        <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                          {crewHealExpanded ? "Hide ▾" : "Show ▸"}
                        </span>
                      </button>
                      {crewHealExpanded ? (
                        <div
                          style={{
                            marginBottom: "12px",
                            paddingTop: "10px",
                            borderTop: "1px solid #374151",
                          }}
                        >
                        <label
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                            fontSize: "11px",
                            color: "#9ca3af",
                            marginBottom: "10px",
                          }}
                        >
                          Recover-in-play vs downtime — position / effect preview
                          <select
                            style={{
                              ...S.sel,
                              width: "100%",
                              maxWidth: 440,
                              fontSize: "11px",
                            }}
                            value={
                              healOtherDraft.treatmentPhase === "downtime"
                                ? "downtime"
                                : "recover_in_play"
                            }
                            onChange={(e) =>
                              setHealOtherDraft((p) => ({
                                ...p,
                                treatmentPhase:
                                  String(e.target.value) === "downtime"
                                    ? "downtime"
                                    : "recover_in_play",
                              }))
                            }
                          >
                            <option value="recover_in_play">
                              Recover-in-play (show P/E preview)
                            </option>
                            <option value="downtime">
                              Downtime (hide P/E preview)
                            </option>
                          </select>
                        </label>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(160px, 1fr))",
                            gap: "8px",
                            marginBottom: "8px",
                          }}
                        >
                          <select
                            style={{ ...S.sel, width: "100%" }}
                            value={healOtherDraft.targetId}
                            onChange={(e) =>
                              setHealOtherDraft((p) => ({
                                ...p,
                                targetId: e.target.value,
                              }))
                            }
                          >
                            <option value="">Target teammate (not you)</option>
                            {healOtherTargets.map((c) => (
                              <option key={c.id} value={String(c.id)}>
                                {c.true_name || c.name || `PC ${c.id}`}
                              </option>
                            ))}
                          </select>
                          <select
                            style={{ ...S.sel, width: "100%" }}
                            value={healOtherDraft.actionName}
                            onChange={(e) =>
                              setHealOtherDraft((p) => ({
                                ...p,
                                actionName: String(
                                  e.target.value || "",
                                ).toUpperCase(),
                              }))
                            }
                          >
                            {healOtherHealActionChoices.map((action) => (
                              <option key={action} value={action}>
                                {action}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: "8px",
                            marginBottom: "8px",
                          }}
                        >
                          <div
                            style={{
                              border: "1px solid #374151",
                              borderRadius: "6px",
                              padding: "6px 8px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "10px",
                                color: "#9ca3af",
                                marginBottom: "6px",
                              }}
                            >
                              Ability bolsters (matching selected abilities)
                            </div>
                            {healBolsterAbilityCandidates.length === 0 ? (
                              <div
                                style={{ fontSize: "10px", color: "#6b7280" }}
                              >
                                No current ability matches healing/recovery/roll
                                modifiers.
                              </div>
                            ) : (
                              <div style={{ display: "grid", gap: "4px" }}>
                                {healBolsterAbilityCandidates.map((c) => (
                                  <label
                                    key={c.key}
                                    title={c.description || undefined}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      fontSize: "11px",
                                      color: "#d1d5db",
                                      cursor: "pointer",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={
                                        Array.isArray(
                                          healOtherDraft.selectedBolsterKeys,
                                        ) &&
                                        healOtherDraft.selectedBolsterKeys.includes(
                                          c.key,
                                        )
                                      }
                                      onChange={(e) =>
                                        setHealOtherDraft((p) => {
                                          const prev = Array.isArray(
                                            p.selectedBolsterKeys,
                                          )
                                            ? p.selectedBolsterKeys
                                            : [];
                                          const next = e.target.checked
                                            ? prev.includes(c.key)
                                              ? prev
                                              : [...prev, c.key]
                                            : prev.filter((k) => k !== c.key);
                                          return {
                                            ...p,
                                            selectedBolsterKeys: next,
                                          };
                                        })
                                      }
                                    />
                                    <span>{c.name}</span>
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        color: "#6b7280",
                                      }}
                                    >
                                      ({c.rollKind})
                                    </span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          <button
                            type="button"
                            style={{
                              ...S.btn,
                              background: "#0f766e",
                              color: "#f8fafc",
                              fontSize: "11px",
                            }}
                            disabled={!healOtherDraft.targetId}
                            onClick={() => {
                              const actionUpper = String(
                                healOtherDraft.actionName || "TINKER",
                              )
                                .trim()
                                .toUpperCase();
                              const standStatHeal =
                                showStandCoinActionColumn &&
                                STAND_HEAL_ACTION_EXTRA_CHOICES.includes(
                                  actionUpper,
                                )
                                  ? actionUpper.toLowerCase()
                                  : "";
                              const rating =
                                standStatHeal !== ""
                                  ? computeStandRollPool(
                                      standStatHeal,
                                      standStats,
                                    )
                                  : Math.max(
                                      0,
                                      Number(actionRatings[actionUpper] || 0),
                                    );
                              const rollSlug =
                                standStatHeal !== ""
                                  ? `stand_${standStatHeal}`
                                  : actionUpper;
                              const target = healOtherTargets.find(
                                (c) =>
                                  String(c.id) ===
                                  String(healOtherDraft.targetId),
                              );
                              const healRecoverInPlay =
                                String(
                                  healOtherDraft.treatmentPhase ??
                                    "recover_in_play",
                                ) !== "downtime";
                              const selKeys = Array.isArray(
                                healOtherDraft.selectedBolsterKeys,
                              )
                                ? healOtherDraft.selectedBolsterKeys
                                : [];
                              const bolsterLabels =
                                healBolsterAbilityCandidates
                                  .filter((c) => selKeys.includes(c.key))
                                  .map((c) => `${c.name} (${c.rollKind})`);
                              const rollBoostPreset =
                                buildHealRollBoostPresetFromSelections(
                                  selKeys,
                                  healBolsterAbilityCandidates,
                                  abilityRollBonusOptions,
                                  heritageRollBonusOptions,
                                );
                              rollDice(
                                rollSlug,
                                rating,
                                false,
                                false,
                                undefined,
                                {
                                  rollBoostPreset,
                                  ...(standStatHeal !== ""
                                    ? {
                                        standRoll: true,
                                        standStat: standStatHeal,
                                      }
                                    : {}),
                                  healAttempt: {
                                    kind: "heal_other",
                                    treatmentCadence: healRecoverInPlay
                                      ? "mid_action"
                                      : "downtime",
                                    recoverInPlayTreatment: healRecoverInPlay,
                                    usesSessionPositionEffect:
                                      healRecoverInPlay,
                                    targetId: Number(healOtherDraft.targetId),
                                    targetName:
                                      target?.true_name ||
                                      target?.name ||
                                      `PC ${healOtherDraft.targetId}`,
                                    selectedAbilityBolsters: bolsterLabels,
                                    abilityBolsterDeclared:
                                      bolsterLabels.length > 0,
                                    bolsterNote: "",
                                    careNote: "",
                                    actionName: actionUpper,
                                  },
                                },
                              );
                            }}
                            title="Open dice pool preview for this healing attempt"
                          >
                            Open healing roll preview
                          </button>
                          <span
                            style={{
                              fontSize: "10px",
                              color: "#9ca3af",
                            }}
                          >
                            Active-session only. Uses action roll dice pool +
                            ability toggles; downtime recover remains separate.
                          </span>
                        </div>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {showXpHistoryModal && (
                    <div
                      style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.75)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 120,
                      }}
                    >
                      <div
                        style={{
                          background: "#111827",
                          border: "1px solid #374151",
                          borderRadius: 8,
                          padding: 16,
                          maxWidth: 420,
                          width: "92%",
                          maxHeight: "80vh",
                          overflow: "auto",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 10,
                          }}
                        >
                          <span
                            style={{ fontWeight: "bold", color: "#a78bfa" }}
                          >
                            XP history
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowXpHistoryModal(false)}
                            style={{ ...S.btn, fontSize: "11px" }}
                          >
                            Close
                          </button>
                        </div>
                        {xpTimelineLoading && (
                          <div style={{ color: "#9ca3af", fontSize: "12px" }}>
                            Loading…
                          </div>
                        )}
                        {xpTimelineError && (
                          <div style={{ color: "#f87171", fontSize: "12px" }}>
                            {xpTimelineError}
                          </div>
                        )}
                        {xpAllocationActionError && (
                          <div
                            style={{ color: "#f87171", fontSize: "12px", marginBottom: 8 }}
                          >
                            {xpAllocationActionError}
                          </div>
                        )}
                        {!xpTimelineLoading &&
                          !xpTimelineError &&
                          xpTimelineRows.length === 0 && (
                            <div style={{ color: "#6b7280", fontSize: "12px" }}>
                              No XP entries yet.
                            </div>
                          )}
                        {xpAllocationRows.some((a) => !a.undone_at && a.can_undo) && (
                          <button
                            type="button"
                            disabled={xpAllocationUndoBusy}
                            onClick={handleUndoLatestAllocation}
                            style={{
                              ...S.btn,
                              width: "100%",
                              marginBottom: 10,
                              background: "#4338ca",
                              color: "#fff",
                              fontSize: "11px",
                            }}
                          >
                            {xpAllocationUndoBusy
                              ? "Undoing…"
                              : "↩ Undo your most recent XP spend"}
                          </button>
                        )}
                        <ul
                          style={{
                            margin: 0,
                            padding: "0 0 0 16px",
                            fontSize: "12px",
                            color: "#d1d5db",
                          }}
                        >
                          {xpTimelineRows.map((row) => (
                            <li key={row.key} style={{ marginBottom: 8 }}>
                              <span
                                style={{ color: "#6b7280", fontSize: "10px" }}
                              >
                                {row.when
                                  ? new Date(row.when).toLocaleString()
                                  : "—"}
                              </span>
                              <div>{row.text}</div>
                              {row.kind === "spend" &&
                                row.allocation &&
                                !row.allocation.undone_at &&
                                row.allocation.can_undo && (
                                  <button
                                    type="button"
                                    disabled={xpAllocationUndoBusy}
                                    onClick={() =>
                                      handleUndoAllocationById(row.allocation.id)
                                    }
                                    style={{
                                      ...S.btn,
                                      marginTop: 4,
                                      fontSize: "10px",
                                      padding: "2px 8px",
                                      background: "#374151",
                                      color: "#e5e7eb",
                                    }}
                                  >
                                    Undo this spend
                                  </button>
                                )}
                              {row.kind === "spend" && row.allocation?.undone_at && (
                                <div
                                  style={{
                                    fontSize: "10px",
                                    color: "#6b7280",
                                    marginTop: 2,
                                  }}
                                >
                                  Undone
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Abilities */}
                  <div style={{ marginBottom: "14px" }}>
                    <button
                      type="button"
                      id="character-sheet-abilities-heading"
                      onClick={() =>
                        setAbilitiesSectionExpandedPersist((prev) => {
                          if (prev) {
                            setCustomAbilityModal(null);
                            setStandardAbilityPickerOpen(false);
                            setStandardAbilitySelected(null);
                            setStandardAbilitySearch("");
                            setSpinAbilityPickerOpen(false);
                            setSpinAbilitySelected(null);
                            setSpinAbilitySearch("");
                            setHamonAbilityPickerOpen(false);
                            setHamonAbilitySelected(null);
                            setHamonAbilitySearch("");
                          }
                          return !prev;
                        })
                      }
                      aria-expanded={abilitiesSectionExpanded}
                      aria-controls="character-sheet-abilities-panel"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        width: "100%",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        marginBottom: "8px",
                        textAlign: "left",
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          color: "#9ca3af",
                          fontSize: "10px",
                          lineHeight: 1,
                          width: "12px",
                          flexShrink: 0,
                          userSelect: "none",
                        }}
                      >
                        {abilitiesSectionExpanded ? "\u25bc" : "\u25ba"}
                      </span>
                      <span
                        style={{
                          color: S.lbl.color,
                          fontSize: S.lbl.fontSize,
                          fontWeight: S.lbl.fontWeight,
                        }}
                      >
                        ABILITIES
                      </span>
                    </button>
                    {abilitiesSectionExpanded ? (
                      <div id="character-sheet-abilities-panel">
                    {hasNoFeedDetriment ? (
                      <div
                        style={{
                          marginBottom: "8px",
                          display: "flex",
                          gap: "6px",
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setCharData((p) => ({ ...p, fed_today: true }))
                          }
                          style={{
                            ...S.btn,
                            fontSize: "11px",
                            padding: "4px 8px",
                            background: charData.fed_today === true ? "#15803d" : "#1f2937",
                            color: "#fff",
                          }}
                        >
                          You fed today
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCharData((p) => ({ ...p, fed_today: false }))
                          }
                          style={{
                            ...S.btn,
                            fontSize: "11px",
                            padding: "4px 8px",
                            background: charData.fed_today === false ? "#b45309" : "#1f2937",
                            color: "#fff",
                          }}
                        >
                          You did not feed today
                        </button>
                      </div>
                    ) : null}
                    {hasAlienUnderstandingDetriment ? (
                      <div
                        style={{
                          marginBottom: "8px",
                          display: "flex",
                          gap: "6px",
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#9ca3af",
                            width: "100%",
                          }}
                        >
                          Alien Understanding (disguise)
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCharData((p) => ({
                              ...p,
                              disguised_as_human: true,
                            }))
                          }
                          style={{
                            ...S.btn,
                            fontSize: "11px",
                            padding: "4px 8px",
                            background:
                              charData.disguised_as_human === true
                                ? "#15803d"
                                : "#1f2937",
                            color: "#fff",
                          }}
                        >
                          Disguised as human
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCharData((p) => ({
                              ...p,
                              disguised_as_human: false,
                            }))
                          }
                          style={{
                            ...S.btn,
                            fontSize: "11px",
                            padding: "4px 8px",
                            background:
                              charData.disguised_as_human === false
                                ? "#b45309"
                                : "#1f2937",
                            color: "#fff",
                          }}
                        >
                          Not disguised
                        </button>
                      </div>
                    ) : null}
                    {combinedAbilitiesForDisplay.map((ab, abIndex) => {
                      const abKey = ab.id || ab.name || `ability-${abIndex}`;
                      const isExpanded = expandedAbilityId === abKey;
                      const isPerfectOrganism =
                        normalizeAbilityName(ab?.name) === "perfect organism";
                      const standardRef =
                        ab.type === "standard" &&
                        standardAbilitiesList.find((a) => a.id === ab.id);
                      const spinRef =
                        ab.type === "spin" &&
                        spinAbilitiesList.find((a) => a.id === ab.id);
                      const hamonRef =
                        ab.type === "hamon" &&
                        hamonAbilitiesList.find((a) => a.id === ab.id);
                      const description =
                        standardRef?.description ||
                        spinRef?.description ||
                        hamonRef?.description ||
                        ab.description;
                      const hasDescription = !!(
                        description ||
                        (ab._uses && ab._uses.filter(Boolean).length > 0)
                      );
                      return (
                        <div
                          key={abKey}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            background: "#374151",
                            padding: "5px 8px",
                            borderRadius: "4px",
                            marginBottom: "3px",
                            fontSize: "12px",
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <span
                              style={{
                                fontWeight: "bold",
                                cursor: hasDescription ? "pointer" : "default",
                                textDecoration: hasDescription
                                  ? "underline"
                                  : "none",
                                textUnderlineOffset: "2px",
                              }}
                              onClick={() =>
                                hasDescription &&
                                setExpandedAbilityId((prev) =>
                                  prev === abKey ? null : abKey,
                                )
                              }
                            >
                              {ab.name}
                            </span>
                            <span
                              style={{
                                marginLeft: "6px",
                                padding: "1px 5px",
                                background:
                                  ab.type === "heritage"
                                    ? "#b45309"
                                    : ab.type === "hamon"
                                      ? "#b91c1c"
                                      : ab.type === "stand"
                                        ? "#0e7490"
                                        : "#7c3aed",
                                borderRadius: "10px",
                                fontSize: "10px",
                              }}
                            >
                              {ab.type}
                            </span>
                            {isExpanded && description && (
                              <div
                                style={{
                                  marginTop: "6px",
                                  fontSize: "11px",
                                  color: "#9ca3af",
                                  lineHeight: "1.4",
                                }}
                              >
                                {description}
                              </div>
                            )}
                            {isExpanded &&
                              ab._uses &&
                              ab._uses.filter(Boolean).length > 0 && (
                                <ul
                                  style={{
                                    margin: "4px 0 0 16px",
                                    padding: 0,
                                    fontSize: "11px",
                                    color: "#d1d5db",
                                  }}
                                >
                                  {ab._uses.filter(Boolean).map((u, i) => (
                                    <li key={i}>{u}</li>
                                  ))}
                                </ul>
                              )}
                            {isExpanded && isPerfectOrganism ? (
                              <div
                                style={{
                                  marginTop: "8px",
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "6px",
                                  alignItems: "center",
                                }}
                              >
                                <span style={{ fontSize: "10px", color: "#9ca3af" }}>
                                  Create entity clock:
                                </span>
                                {[
                                  ["Small", 4],
                                  ["Medium", 6],
                                  ["Large", 8],
                                  ["Huge", 10],
                                ].map(([label, ticks]) => (
                                  <button
                                    key={`${abKey}-${label}`}
                                    type="button"
                                    onClick={() =>
                                      addPerfectOrganismEntityClock(
                                        `${label} entity`,
                                        ticks,
                                      )
                                    }
                                    style={{
                                      ...S.btn,
                                      fontSize: "10px",
                                      padding: "2px 8px",
                                      background: "#1d4ed8",
                                      color: "#fff",
                                    }}
                                    title={`Create ${ticks}-tick ${label.toLowerCase()} entity clock`}
                                  >
                                    {label} ({ticks})
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          {ab.type === "custom" && ab._uiOrigin === "sheet" && (
                            <button
                              type="button"
                              aria-label={`Edit ${ab.name || "ability"}`}
                              onClick={() => {
                                const customs = abilities.filter(
                                  (a) => a.type === "custom",
                                );
                                setCustomAbilityModal(
                                  customAbilityModalFromSheetCustoms(customs),
                                );
                              }}
                              style={{
                                color: "#60a5fa",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "13px",
                                marginRight: "2px",
                              }}
                            >
                              ✏
                            </button>
                          )}
                          {ab._uiOrigin === "sheet" &&
                          !isPlaybookFoundationAbility(ab) ? (
                            <button
                              type="button"
                              aria-label={`Remove ${ab.name || "ability"}`}
                              onClick={() => {
                                markDirtyIntent();
                                setAbilities((p) =>
                                  p.filter((_, i) => i !== ab._uiIndex),
                                );
                              }}
                              style={{
                                color: "#f87171",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "15px",
                              }}
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                    <div
                      style={{
                        display: "flex",
                        gap: "5px",
                        marginTop: "6px",
                        flexWrap: "wrap",
                        alignItems: "flex-start",
                      }}
                    >
                      {/* Standard: button opens popover (search + list + preview) */}
                      {showAddStandardButton ? (
                      <div
                        style={{ position: "relative" }}
                        ref={standardAbilityPickerRef}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSpinAbilityPickerOpen(false);
                            setSpinAbilitySelected(null);
                            setSpinAbilitySearch("");
                            setHamonAbilityPickerOpen(false);
                            setHamonAbilitySelected(null);
                            setHamonAbilitySearch("");
                            if (standardAbilityPickerOpen) {
                              setStandardAbilityPickerOpen(false);
                              setStandardAbilitySelected(null);
                              setStandardAbilitySearch("");
                            } else {
                              setStandardAbilityPickerOpen(true);
                            }
                          }}
                          style={{
                            ...S.btn,
                            background: "#16a34a",
                            color: "#fff",
                            fontSize: "11px",
                          }}
                        >
                          + Standard
                        </button>
                        {standardAbilityPickerOpen && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              marginTop: "4px",
                              zIndex: 101,
                              minWidth: "280px",
                              maxWidth: "min(92vw, 320px)",
                              padding: "8px",
                              background: "#111827",
                              border: "1px solid #374151",
                              borderRadius: "4px",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                            }}
                          >
                            <input
                              style={{
                                ...S.inp,
                                border: "1px solid #374151",
                                padding: "6px 10px",
                                fontSize: "12px",
                                width: "100%",
                                boxSizing: "border-box",
                              }}
                              placeholder="Search standard abilities…"
                              value={standardAbilitySearch}
                              onChange={(e) => {
                                setStandardAbilitySearch(e.target.value);
                                setStandardAbilitySelected(null);
                              }}
                              autoFocus
                            />
                            <div
                              style={{
                                marginTop: "6px",
                                maxHeight: "180px",
                                overflowY: "auto",
                                background: "#0f1419",
                                border: "1px solid #1f2937",
                                borderRadius: "4px",
                              }}
                            >
                              {(() => {
                                const available = standardAbilitiesList
                                  .filter(
                                    (a) =>
                                      (a.type || "").toLowerCase() ===
                                        "standard" || !a.type,
                                  )
                                  .filter(
                                    (a) =>
                                      !abilities.some(
                                        (ab) =>
                                          ab.type === "standard" &&
                                          ab.id === a.id,
                                      ),
                                  );
                                const q = standardAbilitySearch
                                  .trim()
                                  .toLowerCase();
                                const filtered = q
                                  ? available.filter(
                                      (a) =>
                                        (a.name || "")
                                          .toLowerCase()
                                          .includes(q) ||
                                        (a.description || "")
                                          .toLowerCase()
                                          .includes(q) ||
                                        (CATEGORY_LABELS[a.category] || "")
                                          .toLowerCase()
                                          .includes(q),
                                    )
                                  : available;
                                return filtered.length === 0 ? (
                                  <div
                                    style={{
                                      padding: "12px",
                                      fontSize: "11px",
                                      color: "#6b7280",
                                    }}
                                  >
                                    No matching abilities
                                  </div>
                                ) : (
                                  filtered.map((a) => (
                                    <div
                                      key={a.id}
                                      onClick={() =>
                                        setStandardAbilitySelected(a)
                                      }
                                      style={{
                                        padding: "8px 10px",
                                        cursor: "pointer",
                                        fontSize: "12px",
                                        borderBottom: "1px solid #1f2937",
                                        background:
                                          standardAbilitySelected?.id === a.id
                                            ? "#374151"
                                            : "transparent",
                                      }}
                                    >
                                      {a.name}
                                      {a.category && (
                                        <span
                                          style={{
                                            fontSize: "10px",
                                            color: "#6b7280",
                                            marginLeft: "6px",
                                          }}
                                        >
                                          {CATEGORY_LABELS[a.category] ||
                                            a.category}
                                        </span>
                                      )}
                                    </div>
                                  ))
                                );
                              })()}
                            </div>
                            {standardAbilitySelected && (
                              <div
                                style={{
                                  marginTop: "8px",
                                  padding: "10px",
                                  background: "#1f2937",
                                  borderRadius: "4px",
                                  border: "1px solid #374151",
                                  fontSize: "11px",
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: "bold",
                                    marginBottom: "4px",
                                  }}
                                >
                                  {standardAbilitySelected.name}
                                </div>
                                {standardAbilitySelected.category && (
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "1px 6px",
                                      background: "#374151",
                                      borderRadius: "4px",
                                      fontSize: "10px",
                                      marginBottom: "6px",
                                    }}
                                  >
                                    {CATEGORY_LABELS[
                                      standardAbilitySelected.category
                                    ] || standardAbilitySelected.category}
                                  </span>
                                )}
                                {standardAbilitySelected.description && (
                                  <div
                                    style={{
                                      color: "#9ca3af",
                                      lineHeight: "1.4",
                                      marginTop: "4px",
                                    }}
                                  >
                                    {standardAbilitySelected.description}
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Standards are not playbook-fill picks. Extra slots
                                    // only via B→A A-grant (plan draft / Take advance).
                                    if (
                                      sheetStandardCount >=
                                      maxFreeStandardAbilities
                                    ) {
                                      setXpActionToast({
                                        kind: "err",
                                        message:
                                          playbook === "Stand"
                                            ? "Stand users get 2 standards at L1; more only from B→A (2 standards or 2 unique + 1 standard)."
                                            : "Standard ability quota full.",
                                      });
                                      return;
                                    }
                                    if (
                                      !abilities.some(
                                        (a) =>
                                          a.type === "standard" &&
                                          a.id === standardAbilitySelected.id,
                                      )
                                    ) {
                                      markDirtyIntent();
                                      setAbilities((p) => [
                                        ...p,
                                        {
                                          id: standardAbilitySelected.id,
                                          name: standardAbilitySelected.name,
                                          type: "standard",
                                        },
                                      ]);
                                    }
                                    setStandardAbilitySelected(null);
                                    setStandardAbilitySearch("");
                                    setStandardAbilityPickerOpen(false);
                                  }}
                                  style={{
                                    ...S.btn,
                                    background: "#16a34a",
                                    color: "#fff",
                                    fontSize: "11px",
                                    marginTop: "8px",
                                  }}
                                >
                                  Add to sheet
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      ) : null}
                      {isSpinPlaybook && (
                        <div
                          style={{ position: "relative" }}
                          ref={spinAbilityPickerRef}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setStandardAbilityPickerOpen(false);
                              setStandardAbilitySelected(null);
                              setStandardAbilitySearch("");
                              setHamonAbilityPickerOpen(false);
                              setHamonAbilitySelected(null);
                              setHamonAbilitySearch("");
                              if (spinAbilityPickerOpen) {
                                setSpinAbilityPickerOpen(false);
                                setSpinAbilitySelected(null);
                                setSpinAbilitySearch("");
                              } else {
                                setSpinAbilityPickerOpen(true);
                              }
                            }}
                            style={{
                              ...S.btn,
                              background: "#7c3aed",
                              color: "#fff",
                              fontSize: "11px",
                            }}
                          >
                            + Spin ability
                          </button>
                          {spinAbilityPickerOpen && (
                            <div
                              style={{
                                position: "absolute",
                                top: "100%",
                                left: 0,
                                marginTop: "4px",
                                zIndex: 101,
                                minWidth: "280px",
                                maxWidth: "min(92vw, 320px)",
                                padding: "8px",
                                background: "#111827",
                                border: "1px solid #6d28d9",
                                borderRadius: "4px",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                              }}
                            >
                              <input
                                style={{
                                  ...S.inp,
                                  border: "1px solid #6d28d9",
                                  padding: "6px 10px",
                                  fontSize: "12px",
                                  width: "100%",
                                  boxSizing: "border-box",
                                }}
                                placeholder="Search Spin abilities…"
                                value={spinAbilitySearch}
                                onChange={(e) => {
                                  setSpinAbilitySearch(e.target.value);
                                  setSpinAbilitySelected(null);
                                }}
                                autoFocus
                              />
                              <div
                                style={{
                                  marginTop: "6px",
                                  maxHeight: "180px",
                                  overflowY: "auto",
                                  background: "#0f1419",
                                  border: "1px solid #4c1d95",
                                  borderRadius: "4px",
                                }}
                              >
                                {(() => {
                                  const available = spinAbilitiesList.filter(
                                    (a) =>
                                      !isPlaybookFoundationAbility({
                                        ...a,
                                        type: "spin",
                                      }) &&
                                      !abilities.some(
                                        (ab) =>
                                          ab.type === "spin" && ab.id === a.id,
                                      ),
                                  );
                                  const q = spinAbilitySearch
                                    .trim()
                                    .toLowerCase();
                                  const filtered = q
                                    ? available.filter(
                                        (a) =>
                                          (a.name || "")
                                            .toLowerCase()
                                            .includes(q) ||
                                          (a.description || "")
                                            .toLowerCase()
                                            .includes(q) ||
                                          (a.spin_type || "")
                                            .toLowerCase()
                                            .includes(q),
                                      )
                                    : available;
                                  return filtered.length === 0 ? (
                                    <div
                                      style={{
                                        padding: "12px",
                                        fontSize: "11px",
                                        color: "#6b7280",
                                      }}
                                    >
                                      No matching abilities
                                    </div>
                                  ) : (
                                    filtered.map((a) => {
                                      const quotaMet =
                                        canAddNonFoundationPlaybookAbility({
                                          abilities,
                                          ability: a,
                                          kind: "spin",
                                          xpAllocationRows,
                                        });
                                      const met = quotaMet;
                                      const reqLabel =
                                        playbookAbilityRequirementLabel(
                                          a,
                                          pcLevel,
                                        );
                                      const quotaLabel = !quotaMet
                                          ? `Playbook advance required (${nonFoundationPlaybookUsed}/${playbookAbilitySlots})`
                                          : reqLabel;
                                      return (
                                        <div
                                          key={a.id}
                                          onClick={() =>
                                            met && setSpinAbilitySelected(a)
                                          }
                                          style={{
                                            padding: "8px 10px",
                                            fontSize: "12px",
                                            borderBottom: "1px solid #1f2937",
                                            background:
                                              spinAbilitySelected?.id === a.id
                                                ? "#4c1d95"
                                                : "transparent",
                                            cursor: met
                                              ? "pointer"
                                              : "not-allowed",
                                            opacity: met ? 1 : 0.55,
                                          }}
                                        >
                                          {a.name}
                                          <span
                                            style={{
                                              fontSize: "10px",
                                              color: met
                                                ? "#a78bfa"
                                                : "#f87171",
                                              marginLeft: "6px",
                                            }}
                                          >
                                            {quotaLabel}
                                          </span>
                                        </div>
                                      );
                                    })
                                  );
                                })()}
                              </div>
                              {spinAbilitySelected && (
                                <div
                                  style={{
                                    marginTop: "8px",
                                    padding: "10px",
                                    background: "#1f2937",
                                    borderRadius: "4px",
                                    border: "1px solid #6d28d9",
                                    fontSize: "11px",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontWeight: "bold",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    {spinAbilitySelected.name}
                                  </div>
                                  {spinAbilitySelected.spin_type && (
                                    <span
                                      style={{
                                        display: "inline-block",
                                        padding: "1px 6px",
                                        background: "#4c1d95",
                                        borderRadius: "4px",
                                        fontSize: "10px",
                                        marginBottom: "6px",
                                      }}
                                    >
                                      {spinAbilitySelected.spin_type.replace(
                                        /_/g,
                                        " ",
                                      )}
                                    </span>
                                  )}
                                  {spinAbilitySelected.description && (
                                    <div
                                      style={{
                                        color: "#9ca3af",
                                        lineHeight: "1.4",
                                        marginTop: "4px",
                                      }}
                                    >
                                      {spinAbilitySelected.description}
                                    </div>
                                  )}
                                  {(() => {
                                    const quotaMet =
                                      canAddNonFoundationPlaybookAbility({
                                        abilities,
                                        ability: spinAbilitySelected,
                                        kind: "spin",
                                        xpAllocationRows,
                                      });
                                    const canAdd = quotaMet;
                                    return (
                                      <>
                                        {!quotaMet && (
                                          <div
                                            style={{
                                              color: "#f87171",
                                              marginTop: "8px",
                                              fontSize: "11px",
                                            }}
                                          >
                                            Playbook advance required (
                                            {nonFoundationPlaybookUsed}/
                                            {playbookAbilitySlots} slots used).
                                            Fill the playbook track and Take
                                            advance for +1 playbook ability.
                                          </div>
                                        )}
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (
                                              planMode &&
                                              isPostChargen &&
                                              canEditPlan
                                            ) {
                                              await queuePlanAbility({
                                                abilityId: spinAbilitySelected.id,
                                                abilitySource: "spin",
                                                abilityName:
                                                  spinAbilitySelected.name,
                                              });
                                              setSpinAbilitySelected(null);
                                              setSpinAbilitySearch("");
                                              setSpinAbilityPickerOpen(false);
                                              return;
                                            }
                                            if (!canAdd) return;
                                            if (
                                              !abilities.some(
                                                (x) =>
                                                  x.type === "spin" &&
                                                  x.id ===
                                                    spinAbilitySelected.id,
                                              )
                                            ) {
                                              markDirtyIntent();
                                              setAbilities((p) => [
                                                ...p,
                                                {
                                                  id: spinAbilitySelected.id,
                                                  name: spinAbilitySelected.name,
                                                  type: "spin",
                                                  description:
                                                    spinAbilitySelected.description,
                                                  spin_type:
                                                    spinAbilitySelected.spin_type,
                                                  required_a_count:
                                                    spinAbilitySelected.required_a_count,
                                                },
                                              ]);
                                            }
                                            setSpinAbilitySelected(null);
                                            setSpinAbilitySearch("");
                                            setSpinAbilityPickerOpen(false);
                                          }}
                                          disabled={
                                            planMode && isPostChargen
                                              ? false
                                              : !canAdd
                                          }
                                          style={{
                                            ...S.btn,
                                            background:
                                              planMode && isPostChargen
                                                ? "var(--hftf-purple)"
                                                : canAdd
                                                  ? "var(--hftf-purple)"
                                                  : "var(--hftf-panel)",
                                            color: "#fff",
                                            fontSize: "11px",
                                            marginTop: "8px",
                                            cursor:
                                              planMode && isPostChargen
                                                ? "pointer"
                                                : canAdd
                                                  ? "pointer"
                                                  : "not-allowed",
                                          }}
                                        >
                                          {planMode && isPostChargen
                                            ? "Queue for playbook fill"
                                            : "Add to sheet"}
                                        </button>
                                      </>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {isHamonPlaybook && (
                        <div
                          style={{ position: "relative" }}
                          ref={hamonAbilityPickerRef}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setStandardAbilityPickerOpen(false);
                              setStandardAbilitySelected(null);
                              setStandardAbilitySearch("");
                              setSpinAbilityPickerOpen(false);
                              setSpinAbilitySelected(null);
                              setSpinAbilitySearch("");
                              if (hamonAbilityPickerOpen) {
                                setHamonAbilityPickerOpen(false);
                                setHamonAbilitySelected(null);
                                setHamonAbilitySearch("");
                              } else {
                                setHamonAbilityPickerOpen(true);
                              }
                            }}
                            style={{
                              ...S.btn,
                              background: "#b45309",
                              color: "#fff",
                              fontSize: "11px",
                            }}
                          >
                            + Hamon ability
                          </button>
                          {hamonAbilityPickerOpen && (
                            <div
                              style={{
                                position: "absolute",
                                top: "100%",
                                left: 0,
                                marginTop: "4px",
                                zIndex: 101,
                                minWidth: "280px",
                                maxWidth: "min(92vw, 320px)",
                                padding: "8px",
                                background: "#111827",
                                border: "1px solid #b45309",
                                borderRadius: "4px",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                              }}
                            >
                              <input
                                style={{
                                  ...S.inp,
                                  border: "1px solid #b45309",
                                  padding: "6px 10px",
                                  fontSize: "12px",
                                  width: "100%",
                                  boxSizing: "border-box",
                                }}
                                placeholder="Search Hamon abilities…"
                                value={hamonAbilitySearch}
                                onChange={(e) => {
                                  setHamonAbilitySearch(e.target.value);
                                  setHamonAbilitySelected(null);
                                }}
                                autoFocus
                              />
                              <div
                                style={{
                                  marginTop: "6px",
                                  maxHeight: "180px",
                                  overflowY: "auto",
                                  background: "#0f1419",
                                  border: "1px solid #78350f",
                                  borderRadius: "4px",
                                }}
                              >
                                {(() => {
                                  const available = hamonAbilitiesList.filter(
                                    (a) =>
                                      !isPlaybookFoundationAbility({
                                        ...a,
                                        type: "hamon",
                                      }) &&
                                      !abilities.some(
                                        (ab) =>
                                          ab.type === "hamon" && ab.id === a.id,
                                      ),
                                  );
                                  const q = hamonAbilitySearch
                                    .trim()
                                    .toLowerCase();
                                  const filtered = q
                                    ? available.filter(
                                        (a) =>
                                          (a.name || "")
                                            .toLowerCase()
                                            .includes(q) ||
                                          (a.description || "")
                                            .toLowerCase()
                                            .includes(q) ||
                                          (a.hamon_type || "")
                                            .toLowerCase()
                                            .includes(q),
                                      )
                                    : available;
                                  return filtered.length === 0 ? (
                                    <div
                                      style={{
                                        padding: "12px",
                                        fontSize: "11px",
                                        color: "#6b7280",
                                      }}
                                    >
                                      No matching abilities
                                    </div>
                                  ) : (
                                    filtered.map((a) => {
                                      const quotaMet =
                                        canAddNonFoundationPlaybookAbility({
                                          abilities,
                                          ability: a,
                                          kind: "hamon",
                                          xpAllocationRows,
                                        });
                                      const met = quotaMet;
                                      const reqLabel =
                                        playbookAbilityRequirementLabel(
                                          a,
                                          pcLevel,
                                        );
                                      const quotaLabel = !quotaMet
                                          ? `Playbook advance required (${nonFoundationPlaybookUsed}/${playbookAbilitySlots})`
                                          : reqLabel;
                                      return (
                                        <div
                                          key={a.id}
                                          onClick={() =>
                                            met && setHamonAbilitySelected(a)
                                          }
                                          style={{
                                            padding: "8px 10px",
                                            fontSize: "12px",
                                            borderBottom: "1px solid #1f2937",
                                            background:
                                              hamonAbilitySelected?.id === a.id
                                                ? "#78350f"
                                                : "transparent",
                                            cursor: met
                                              ? "pointer"
                                              : "not-allowed",
                                            opacity: met ? 1 : 0.55,
                                          }}
                                        >
                                          {a.name}
                                          <span
                                            style={{
                                              fontSize: "10px",
                                              color: met
                                                ? "#fdba74"
                                                : "#f87171",
                                              marginLeft: "6px",
                                            }}
                                          >
                                            {quotaLabel}
                                          </span>
                                        </div>
                                      );
                                    })
                                  );
                                })()}
                              </div>
                              {hamonAbilitySelected && (
                                <div
                                  style={{
                                    marginTop: "8px",
                                    padding: "10px",
                                    background: "#1f2937",
                                    borderRadius: "4px",
                                    border: "1px solid #b45309",
                                    fontSize: "11px",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontWeight: "bold",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    {hamonAbilitySelected.name}
                                  </div>
                                  {hamonAbilitySelected.hamon_type && (
                                    <span
                                      style={{
                                        display: "inline-block",
                                        padding: "1px 6px",
                                        background: "#78350f",
                                        borderRadius: "4px",
                                        fontSize: "10px",
                                        marginBottom: "6px",
                                      }}
                                    >
                                      {String(
                                        hamonAbilitySelected.hamon_type,
                                      ).replace(/_/g, " ")}
                                    </span>
                                  )}
                                  {hamonAbilitySelected.description && (
                                    <div
                                      style={{
                                        color: "#9ca3af",
                                        lineHeight: "1.4",
                                        marginTop: "4px",
                                      }}
                                    >
                                      {hamonAbilitySelected.description}
                                    </div>
                                  )}
                                  {(() => {
                                    const quotaMet =
                                      canAddNonFoundationPlaybookAbility({
                                        abilities,
                                        ability: hamonAbilitySelected,
                                        kind: "hamon",
                                        xpAllocationRows,
                                      });
                                    const canAdd = quotaMet;
                                    return (
                                      <>
                                        {!quotaMet && (
                                          <div
                                            style={{
                                              color: "#f87171",
                                              marginTop: "8px",
                                              fontSize: "11px",
                                            }}
                                          >
                                            Playbook advance required (
                                            {nonFoundationPlaybookUsed}/
                                            {playbookAbilitySlots} slots used).
                                            Fill the playbook track and Take
                                            advance for +1 playbook ability.
                                          </div>
                                        )}
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (
                                              planMode &&
                                              isPostChargen &&
                                              canEditPlan
                                            ) {
                                              await queuePlanAbility({
                                                abilityId:
                                                  hamonAbilitySelected.id,
                                                abilitySource: "hamon",
                                                abilityName:
                                                  hamonAbilitySelected.name,
                                              });
                                              setHamonAbilitySelected(null);
                                              setHamonAbilitySearch("");
                                              setHamonAbilityPickerOpen(false);
                                              return;
                                            }
                                            if (!canAdd) return;
                                            if (
                                              !abilities.some(
                                                (x) =>
                                                  x.type === "hamon" &&
                                                  x.id ===
                                                    hamonAbilitySelected.id,
                                              )
                                            ) {
                                              markDirtyIntent();
                                              setAbilities((p) => [
                                                ...p,
                                                {
                                                  id: hamonAbilitySelected.id,
                                                  name: hamonAbilitySelected.name,
                                                  type: "hamon",
                                                  description:
                                                    hamonAbilitySelected.description,
                                                  hamon_type:
                                                    hamonAbilitySelected.hamon_type,
                                                  required_a_count:
                                                    hamonAbilitySelected.required_a_count,
                                                },
                                              ]);
                                            }
                                            setHamonAbilitySelected(null);
                                            setHamonAbilitySearch("");
                                            setHamonAbilityPickerOpen(false);
                                          }}
                                          disabled={
                                            planMode && isPostChargen
                                              ? false
                                              : !canAdd
                                          }
                                          style={{
                                            ...S.btn,
                                            background:
                                              planMode && isPostChargen
                                                ? "var(--hftf-purple)"
                                                : canAdd
                                                  ? "#b45309"
                                                  : "var(--hftf-panel)",
                                            color: "#fff",
                                            fontSize: "11px",
                                            marginTop: "8px",
                                            cursor:
                                              planMode && isPostChargen
                                                ? "pointer"
                                                : canAdd
                                                  ? "pointer"
                                                  : "not-allowed",
                                          }}
                                        >
                                          {planMode && isPostChargen
                                            ? "Queue for playbook fill"
                                            : "Add to sheet"}
                                        </button>
                                      </>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {showAddCustomButton ? (
                      <button
                        type="button"
                        onClick={() => setCustomAbilityModal(newCustomAbilityModalDraft())}
                        style={{
                          ...S.btn,
                          background: "#16a34a",
                          color: "#fff",
                          fontSize: "11px",
                        }}
                      >
                        + Custom
                      </button>
                      ) : null}
                      {showPlanBAGrantUI ? (
                        <>
                          {planLegalBAStats.length > 1
                            ? planLegalBAStats.map((statKey) => (
                                <button
                                  key={`ba-stat-${statKey}`}
                                  type="button"
                                  onClick={() => {
                                    setPlanBASuppressed(false);
                                    setPlanBADraft({ stat: statKey });
                                    setPlanBAError(null);
                                  }}
                                  style={{
                                    ...S.btn,
                                    background:
                                      planBADraft?.stat === statKey
                                        ? "var(--hftf-purple)"
                                        : "var(--hftf-deep)",
                                    color: "#fff",
                                    fontSize: "11px",
                                    border:
                                      planBADraft?.stat === statKey
                                        ? "1px solid var(--sheet-ghost)"
                                        : "1px solid transparent",
                                  }}
                                >
                                  {String(statKey).toUpperCase()} B→A
                                </button>
                              ))
                            : null}
                          <button
                            type="button"
                            onClick={() => {
                              setPlanBASuppressed(false);
                              if (
                                !planBADraft?.stat &&
                                planLegalBAStats.length
                              ) {
                                setPlanBADraft({
                                  stat: planLegalBAStats[0],
                                });
                              }
                              setPlanBABranch("two_standard");
                              setPlanBAError(null);
                            }}
                            style={{
                              ...S.btn,
                              background:
                                planBABranch === "two_standard" &&
                                planBADraft?.stat
                                  ? "var(--hftf-purple)"
                                  : "var(--hftf-panel)",
                              color: "#fff",
                              fontSize: "11px",
                              border:
                                planBABranch === "two_standard" &&
                                planBADraft?.stat
                                  ? "1px solid var(--sheet-ghost)"
                                  : "1px solid transparent",
                            }}
                          >
                            + 2 Standards (B→A)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPlanBASuppressed(false);
                              if (
                                !planBADraft?.stat &&
                                planLegalBAStats.length
                              ) {
                                setPlanBADraft({
                                  stat: planLegalBAStats[0],
                                });
                              }
                              setPlanBABranch(
                                "two_unique_plus_one_standard",
                              );
                              setPlanBAError(null);
                            }}
                            style={{
                              ...S.btn,
                              background:
                                planBABranch ===
                                  "two_unique_plus_one_standard" &&
                                planBADraft?.stat
                                  ? "var(--hftf-purple)"
                                  : "var(--hftf-panel)",
                              color: "#fff",
                              fontSize: "11px",
                              border:
                                planBABranch ===
                                  "two_unique_plus_one_standard" &&
                                planBADraft?.stat
                                  ? "1px solid var(--sheet-ghost)"
                                  : "1px solid transparent",
                            }}
                          >
                            + 2 Unique + Standard (B→A)
                          </button>
                        </>
                      ) : null}
                      </div>
                      {showPlanBAGrantUI && planBADraft?.stat ? (
                        <div
                          style={{
                            ...S.card,
                            marginTop: 8,
                            borderColor: "var(--sheet-ghost)",
                            background: "var(--hftf-deep)",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: "bold",
                              color: "var(--sheet-ghost-text)",
                              marginBottom: 6,
                              fontSize: 12,
                            }}
                          >
                            Plan queue —{" "}
                            {String(planBADraft.stat).toUpperCase()} B→A
                            A-grant
                          </div>
                          <p
                            style={{
                              fontSize: 11,
                              color: "var(--hftf-text-dim)",
                              marginBottom: 8,
                            }}
                          >
                            Legal in plan mode when that Coin is at B (owned
                            or queued). Pick branch, then abilities — one
                            playbook fill (Coin bump + grant).
                          </p>
                          {planBABranch ===
                          "two_unique_plus_one_standard" ? (
                            <>
                              {[0, 1].map((i) => (
                                <React.Fragment key={i}>
                                  <input
                                    style={{ ...S.inp, marginBottom: 6 }}
                                    value={planBAUniques[i]?.name || ""}
                                    onChange={(e) => {
                                      const next = [...planBAUniques];
                                      next[i] = {
                                        ...next[i],
                                        name: e.target.value,
                                      };
                                      setPlanBAUniques(next);
                                    }}
                                    placeholder={`Unique ${i + 1} name`}
                                  />
                                  <input
                                    style={{ ...S.inp, marginBottom: 6 }}
                                    value={planBAUniques[i]?.use || ""}
                                    onChange={(e) => {
                                      const next = [...planBAUniques];
                                      next[i] = {
                                        ...next[i],
                                        use: e.target.value,
                                      };
                                      setPlanBAUniques(next);
                                    }}
                                    placeholder={`Unique ${i + 1} function`}
                                  />
                                </React.Fragment>
                              ))}
                              <select
                                style={{
                                  ...S.sel,
                                  width: "100%",
                                  marginBottom: 8,
                                }}
                                value={planBAStdId}
                                onChange={(e) =>
                                  setPlanBAStdId(e.target.value)
                                }
                              >
                                <option value="">- pick standard -</option>
                                {standardAbilitiesList.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.name}
                                  </option>
                                ))}
                              </select>
                            </>
                          ) : (
                            [0, 1].map((i) => (
                              <select
                                key={i}
                                style={{
                                  ...S.sel,
                                  width: "100%",
                                  marginBottom: 6,
                                }}
                                value={planBAStdIds[i] || ""}
                                onChange={(e) => {
                                  const next = [...planBAStdIds];
                                  next[i] = e.target.value;
                                  setPlanBAStdIds(next);
                                }}
                              >
                                <option value="">
                                  {`- pick standard ${i + 1} -`}
                                </option>
                                {standardAbilitiesList.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.name}
                                  </option>
                                ))}
                              </select>
                            ))
                          )}
                          {planBAError ? (
                            <div
                              style={{
                                color: "#f87171",
                                fontSize: 11,
                                marginBottom: 8,
                              }}
                            >
                              {planBAError}
                            </div>
                          ) : null}
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              justifyContent: "flex-end",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setPlanBADraft(null);
                                setPlanBAError(null);
                                setPlanBASuppressed(true);
                              }}
                              style={{
                                ...S.btn,
                                background: "#374151",
                                color: "#fff",
                                fontSize: 11,
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={planBusy || !characterId}
                              onClick={() => void confirmPlanBAGrant()}
                              style={{
                                ...S.btn,
                                background: planBusy
                                  ? "#4b5563"
                                  : "#7c3aed",
                                color: "#fff",
                                fontWeight: "bold",
                                fontSize: 11,
                              }}
                            >
                              {planBusy
                                ? "Queuing…"
                                : "Add B→A to plan"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {customAbilityModal && (
                        <div
                          style={{
                            position: "fixed",
                            inset: 0,
                            background: "rgba(0,0,0,0.8)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 200,
                          }}
                          onClick={() => setCustomAbilityModal(null)}
                        >
                          <div
                            style={{
                              background: "#111827",
                              border: "1px solid #374151",
                              borderRadius: "8px",
                              padding: "20px",
                              maxWidth: "420px",
                              width: "90%",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span
                              style={{
                                ...S.lbl,
                                display: "block",
                                marginBottom: "12px",
                              }}
                            >
                              Custom abilities
                            </span>
                            <div
                              style={{
                                fontSize: "11px",
                                color: "#9ca3af",
                                marginBottom: "12px",
                              }}
                            >
                              Add three custom abilities (one use each). Name
                              and description required for each.
                            </div>
                            {[0, 1, 2].map((i) => (
                              <div
                                key={i}
                                style={{
                                  marginBottom: "12px",
                                  padding: "8px",
                                  background: "#1f2937",
                                  borderRadius: "4px",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "11px",
                                    color: "#9ca3af",
                                  }}
                                >
                                  Ability {i + 1} (name + description
                                  required)
                                </span>
                                <input
                                  style={S.inp}
                                  value={
                                    customAbilityModal.items?.[i]?.name || ""
                                  }
                                  onChange={(e) => {
                                    const it = [
                                      ...(customAbilityModal.items || []),
                                    ];
                                    while (it.length <= i)
                                      it.push({
                                        name: "",
                                        description: "",
                                      });
                                    it[i] = {
                                      ...it[i],
                                      name: e.target.value,
                                    };
                                    setCustomAbilityModal((p) => ({
                                      ...p,
                                      items: it,
                                    }));
                                  }}
                                  placeholder="Name"
                                />
                                <input
                                  style={{ ...S.inp, marginTop: "4px" }}
                                  value={
                                    customAbilityModal.items?.[i]
                                      ?.description || ""
                                  }
                                  onChange={(e) => {
                                    const it = [
                                      ...(customAbilityModal.items || []),
                                    ];
                                    while (it.length <= i)
                                      it.push({
                                        name: "",
                                        description: "",
                                      });
                                    it[i] = {
                                      ...it[i],
                                      description: e.target.value,
                                    };
                                    setCustomAbilityModal((p) => ({
                                      ...p,
                                      items: it,
                                    }));
                                  }}
                                  placeholder="Description"
                                />
                              </div>
                            ))}
                            {(() => {
                              const prev = customAbilityModal;
                              const canSave = (prev.items || []).every(
                                (item) =>
                                  (item?.name || "").trim() &&
                                  (item?.description || "").trim(),
                              );
                              return (
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "8px",
                                    marginTop: "16px",
                                  }}
                                >
                                  <button
                                    onClick={() => {
                                      if (!canSave) return;
                                      markDirtyIntent();
                                      setAbilities((p) => [
                                        // Keep advancement grants; only replace sheet custom package
                                        ...p.filter(
                                          (a) =>
                                            a.type !== "custom" ||
                                            a._fromAdvancement,
                                        ),
                                        ...(prev.items || [])
                                          .filter(
                                            (item) =>
                                              (item?.name || "").trim() &&
                                              (item?.description || "").trim(),
                                          )
                                          .map((it, idx) => ({
                                            id: `custom-${idx}`,
                                            name: (it.name || "").trim(),
                                            description: (
                                              it.description || ""
                                            ).trim(),
                                            type: "custom",
                                          })),
                                      ]);
                                      setCustomAbilityModal(null);
                                    }}
                                    disabled={!canSave}
                                    style={{
                                      ...S.btnPrimary,
                                      opacity: canSave ? 1 : 0.5,
                                      cursor: canSave
                                        ? "pointer"
                                        : "not-allowed",
                                    }}
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setCustomAbilityModal(null)}
                                    style={S.btnGhost}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                    ) : null}
                  </div>

                  {/* Clocks */}
                  <div style={{ marginBottom: "14px" }}>
                    <button
                      type="button"
                      onClick={() =>
                        setClocksSectionExpandedPersist((prev) => {
                          if (prev) {
                            setClockEditorOpen(false);
                            setNewClockName("");
                            setNewClockSegments(4);
                            setNewClockShared(false);
                          }
                          return !prev;
                        })
                      }
                      aria-expanded={clocksSectionExpanded}
                      aria-controls="character-sheet-clocks-panel"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        width: "100%",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        marginBottom: "8px",
                        textAlign: "left",
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          color: "#9ca3af",
                          fontSize: "10px",
                          lineHeight: 1,
                          width: "12px",
                          flexShrink: 0,
                          userSelect: "none",
                        }}
                      >
                        {clocksSectionExpanded ? "\u25bc" : "\u25ba"}
                      </span>
                      <span
                        style={{
                          color: S.lbl.color,
                          fontSize: S.lbl.fontSize,
                          fontWeight: S.lbl.fontWeight,
                        }}
                      >
                        CLOCKS
                      </span>
                    </button>
                    {clocksSectionExpanded ? (
                      <div id="character-sheet-clocks-panel">
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "10px",
                        marginBottom: "8px",
                      }}
                    >
                      {clocks.map((clk) => {
                        const gmManaged = isGmManagedProgressClock(
                          clk,
                          charCampaign?.gm,
                        );
                        const gmShared =
                          gmManaged &&
                          (!!clk.visible_to_players || !!clk.visible_to_party);
                        const segs = clockWedgeCount(clk.segments);
                        const fill = clampClockFilled(clk.filled, segs);
                        const canResizeClock =
                          canEditSheet && (!gmManaged || isGM);
                        return (
                        <div
                          key={clk.id}
                          style={{
                            background: "#374151",
                            padding: "8px",
                            borderRadius: "4px",
                            textAlign: "center",
                          }}
                        >
                          <input
                            value={clk.name}
                            onChange={(e) =>
                              setClocks((p) =>
                                p.map((c) =>
                                  c.id === clk.id
                                    ? { ...c, name: e.target.value }
                                    : c,
                                ),
                              )
                            }
                            style={{
                              ...S.inp,
                              textAlign: "center",
                              fontSize: "11px",
                              width: "80px",
                              marginBottom: "4px",
                            }}
                          />
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "center",
                            }}
                          >
                            <ProgressClock
                              size={50}
                              segments={segs}
                              filled={fill}
                              interactive={canEditSheet}
                              onClick={(f) =>
                                setClocks((p) =>
                                  p.map((c) =>
                                    c.id === clk.id
                                      ? {
                                          ...c,
                                          filled: clampClockFilled(f, segs),
                                          filled_segments: clampClockFilled(
                                            f,
                                            segs,
                                          ),
                                        }
                                      : c,
                                  ),
                                )
                              }
                            />
                          </div>
                          <div style={{ fontSize: "10px", color: "#6b7280" }}>
                            {fill}/{segs}
                          </div>
                          {canResizeClock ? (
                            <label
                              style={{
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "10px",
                                color: "#9ca3af",
                                marginTop: "4px",
                              }}
                            >
                              Size
                              <input
                                type="number"
                                min={1}
                                max={12}
                                title="Clock segments (1–12). −/+ ticks fill, not size."
                                value={segs}
                                onChange={(e) =>
                                  resizeClockSegments(clk.id, e.target.value)
                                }
                                style={{
                                  ...S.inp,
                                  width: "48px",
                                  fontSize: "11px",
                                  textAlign: "center",
                                  padding: "2px 4px",
                                }}
                              />
                            </label>
                          ) : null}
                          {gmManaged ? (
                            <div
                              title={
                                gmShared
                                  ? "The GM shared this clock with everyone at the table."
                                  : "GM clock — not shown to players until the GM marks it visible."
                              }
                              style={{
                                fontSize: "10px",
                                color: gmShared ? "#6ee7b7" : "#9ca3af",
                                marginTop: "2px",
                                lineHeight: 1.3,
                              }}
                            >
                              {gmShared
                                ? "Shared by the GM"
                                : "GM clock (private)"}
                            </div>
                          ) : (
                          <label
                            style={{
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "10px",
                              color: "#9ca3af",
                              marginTop: "2px",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={!!clk.visible_to_party}
                              onChange={(e) =>
                                setClocks((p) =>
                                  p.map((c) =>
                                    c.id === clk.id
                                      ? {
                                          ...c,
                                          visible_to_party: e.target.checked,
                                        }
                                      : c,
                                  ),
                                )
                              }
                            />
                            Shared party
                          </label>
                          )}
                          <button
                            onClick={() =>
                              setClocks((p) => p.filter((c) => c.id !== clk.id))
                            }
                            style={{
                              color: "#f87171",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "11px",
                            }}
                          >
                            ✕
                          </button>
                        </div>
                        );
                      })}
                    </div>
                    {!clockEditorOpen ? (
                      <button
                        onClick={() => setClockEditorOpen(true)}
                        style={{
                          ...S.btn,
                          border: "2px dashed #374151",
                          background: "transparent",
                          color: "#6b7280",
                          width: "100%",
                          padding: "6px",
                        }}
                      >
                        + Add Clock
                      </button>
                    ) : (
                      <div
                        style={{
                          border: "1px solid #374151",
                          borderRadius: "6px",
                          padding: "10px",
                          background: "#0b1220",
                          display: "grid",
                          gap: "8px",
                        }}
                      >
                        <div>
                          <span style={S.lbl}>Clock name</span>
                          <input
                            style={S.inp}
                            value={newClockName}
                            onChange={(e) => setNewClockName(e.target.value)}
                            placeholder="e.g. Infiltrate estate"
                            maxLength={64}
                          />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                          <div>
                            <span style={S.lbl}>Segments</span>
                            <input
                              type="number"
                              min={1}
                              max={12}
                              style={S.inp}
                              value={newClockSegments}
                              onChange={(e) =>
                                setNewClockSegments(
                                  Math.max(1, Math.min(12, Number(e.target.value) || 1)),
                                )
                              }
                            />
                          </div>
                          <div style={{ display: "flex", alignItems: "end" }}>
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                fontSize: "12px",
                                color: "#9ca3af",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={newClockShared}
                                onChange={(e) => setNewClockShared(e.target.checked)}
                              />
                              Shared party
                            </label>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                          <button
                            onClick={() => {
                              setClockEditorOpen(false);
                              setNewClockName("");
                              setNewClockSegments(4);
                              setNewClockShared(false);
                            }}
                            style={S.btnGhost}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={addClock}
                            disabled={!String(newClockName || "").trim()}
                            style={{
                              ...S.btnPrimary,
                              opacity: String(newClockName || "").trim() ? 1 : 0.5,
                              cursor: String(newClockName || "").trim()
                                ? "pointer"
                                : "not-allowed",
                            }}
                          >
                            Create clock
                          </button>
                        </div>
                      </div>
                    )}

                  {/* Shared party clocks: other players' shared clocks only.
                      Own clocks stay in the list above; GM/session clocks live under SESSION. */}
                  {charCampaign?.progress_clocks?.length > 0 &&
                    (() => {
                      const gmId = normalizeCampaignGmId(charCampaign?.gm);
                      const ownIds = new Set(
                        (clocks || [])
                          .map((c) => Number(c?.id))
                          .filter((n) => Number.isFinite(n)),
                      );
                      const partyClocks = (charCampaign.progress_clocks || [])
                        .filter(
                          (clk) => !isGmManagedProgressClock(clk, gmId),
                        )
                        .filter((clk) => {
                          const id = Number(clk?.id);
                          if (Number.isFinite(id) && ownIds.has(id)) {
                            return false;
                          }
                          // Own clocks (with Shared party checkbox) live above.
                          if (Number(clk.created_by) === Number(user?.id)) {
                            return false;
                          }
                          return !!clk.visible_to_party;
                        });
                      if (partyClocks.length === 0) return null;
                      return (
                        <div style={{ marginBottom: "14px" }}>
                          <span style={S.lbl}>Shared party clocks</span>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "10px",
                              marginTop: "6px",
                            }}
                          >
                            {partyClocks.map((clk) => {
                              const canEdit =
                                isGM || Number(clk.created_by) === Number(user?.id);
                              return (
                                <div
                                  key={clk.id}
                                  style={{
                                    background: "#374151",
                                    padding: "8px",
                                    borderRadius: "4px",
                                    textAlign: "center",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: "11px",
                                      fontWeight: "bold",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    {clk.name}
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "center",
                                    }}
                                  >
                                    <ProgressClock
                                      size={50}
                                      segments={clk.max_segments}
                                      filled={clk.filled_segments}
                                      interactive={canEdit}
                                      onClick={
                                        canEdit
                                          ? (f) => {
                                              progressClockAPI
                                                .updateProgressClock(clk.id, {
                                                  filled_segments: f,
                                                })
                                                .then(() =>
                                                  onCampaignRefresh?.(),
                                                )
                                                .catch(() => {});
                                            }
                                          : undefined
                                      }
                                    />
                                  </div>
                                  <div
                                    style={{
                                      fontSize: "10px",
                                      color: "#6b7280",
                                    }}
                                  >
                                    {clk.filled_segments}/{clk.max_segments}
                                  </div>
                                  <label
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: 4,
                                      marginTop: 4,
                                      fontSize: "10px",
                                      color: "#9ca3af",
                                      cursor: canEdit ? "pointer" : "default",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={!!clk.visible_to_party}
                                      disabled={!canEdit}
                                      onChange={(e) => {
                                        progressClockAPI
                                          .updateProgressClock(clk.id, {
                                            visible_to_party: e.target.checked,
                                          })
                                          .then(() => onCampaignRefresh?.())
                                          .catch(() => {});
                                      }}
                                    />
                                    Shared party
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                      </div>
                    ) : null}
                  </div>

                  {/* Devil's Bargain modal (above dice pool overlay when both open) */}
                  {showDevilsBargainModal && (
                    <div
                      style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.7)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 110,
                      }}
                    >
                      <div
                        style={{
                          background: "#111827",
                          border: "1px solid #374151",
                          borderRadius: "8px",
                          padding: "20px",
                          maxWidth: "360px",
                          width: "90%",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: "bold",
                            marginBottom: "12px",
                            color: "#a78bfa",
                          }}
                        >
                          Devil's Bargain — +1d in exchange for a detriment
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#9ca3af",
                            marginBottom: "12px",
                          }}
                        >
                          Choose a detriment for +1 die on your next roll:
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "6px",
                            marginBottom: "12px",
                          }}
                        >
                          {DEVILS_BARGAIN_DETRIMENTS.map((detriment) => (
                            <button
                              key={detriment}
                              type="button"
                              onClick={() => {
                                if (rollPending) {
                                  setRollModal((p) => ({
                                    ...p,
                                    devil_bargain_note: detriment,
                                    devil_bargain_dice: true,
                                  }));
                                }
                                setShowDevilsBargainModal(false);
                              }}
                              style={{
                                ...S.btn,
                                padding: "6px 10px",
                                fontSize: "11px",
                                background: "#374151",
                              }}
                            >
                              {detriment}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const c = prompt("Custom detriment:");
                              if (c?.trim()) {
                                const t = c.trim();
                                if (rollPending) {
                                  setRollModal((p) => ({
                                    ...p,
                                    devil_bargain_note: t,
                                    devil_bargain_dice: true,
                                  }));
                                }
                                setShowDevilsBargainModal(false);
                              }
                            }}
                            style={{
                              ...S.btn,
                              padding: "6px 10px",
                              fontSize: "11px",
                              background: "#4b5563",
                              borderStyle: "dashed",
                            }}
                          >
                            Custom…
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowDevilsBargainModal(false)}
                          style={S.btn}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div style={{ marginBottom: "14px" }}>
                    <button
                      type="button"
                      onClick={() =>
                        setNotesInventoryExpandedPersist((prev) => ({
                          ...prev,
                          notes: !prev.notes,
                        }))
                      }
                      aria-expanded={notesInventoryExpanded.notes}
                      aria-controls="character-sheet-notes-panel"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        width: "100%",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        marginBottom: "8px",
                        textAlign: "left",
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          color: "#9ca3af",
                          fontSize: "10px",
                          lineHeight: 1,
                          width: "12px",
                          flexShrink: 0,
                          userSelect: "none",
                        }}
                      >
                        {notesInventoryExpanded.notes ? "\u25bc" : "\u25ba"}
                      </span>
                      <span
                        style={{
                          color: S.lbl.color,
                          fontSize: S.lbl.fontSize,
                          fontWeight: S.lbl.fontWeight,
                        }}
                      >
                        NOTES
                      </span>
                    </button>
                    {notesInventoryExpanded.notes ? (
                      <textarea
                        id="character-sheet-notes-panel"
                        placeholder="Notes…"
                        value={charData.sheetNotes ?? ""}
                        onChange={(e) => {
                          markDirtyIntent();
                          setCharData((p) => ({
                            ...p,
                            sheetNotes: e.target.value,
                          }));
                        }}
                        style={{
                          width: "100%",
                          height: "80px",
                          background: "#0d1117",
                          color: "#fff",
                          border: "1px solid #374151",
                          padding: "8px",
                          fontFamily: "monospace",
                          fontSize: "12px",
                          resize: "vertical",
                          boxSizing: "border-box",
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom row */}
            <div style={{ ...S.g3, marginTop: "16px" }} />
            </div>
            {portraitUrlModalOpen && canEditSheet && (
              <div
                role="presentation"
                onClick={() => setPortraitUrlModalOpen(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.65)",
                  zIndex: 200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "16px",
                }}
              >
                <div
                  role="dialog"
                  aria-label="Portrait image URL"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: "#111827",
                    border: "1px solid #374151",
                    borderRadius: 8,
                    padding: 14,
                    maxWidth: 420,
                    width: "100%",
                    boxShadow: "0 14px 40px rgba(0,0,0,0.55)",
                  }}
                >
                  <div
                    style={{
                      fontWeight: "bold",
                      color: "#a78bfa",
                      marginBottom: 8,
                      fontSize: 13,
                    }}
                  >
                    Portrait URL
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#9ca3af",
                      marginBottom: 8,
                      lineHeight: 1.45,
                    }}
                  >
                    Paste a direct image link. It updates preview and saves with your
                    sheet (same as other edits).
                  </div>
                  <input
                    type="text"
                    inputMode="url"
                    value={portraitUrlDraft}
                    onChange={(e) => setPortraitUrlDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        savePortraitUrlFromModal();
                      }
                    }}
                    placeholder="https://example.com/portrait.jpg"
                    style={{
                      ...S.inp,
                      width: "100%",
                      boxSizing: "border-box",
                      marginBottom: 10,
                      fontSize: 12,
                    }}
                    autoComplete="off"
                    autoFocus
                  />
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "flex-end",
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 10, color: "#6b7280", marginRight: "auto" }}>
                      Esc to close
                    </span>
                    <button
                      type="button"
                      onClick={() => setPortraitUrlModalOpen(false)}
                      style={{ ...S.btn, fontSize: 11 }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!String(portraitUrlDraft || "").trim()}
                      onClick={savePortraitUrlFromModal}
                      style={{
                        ...S.btn,
                        fontSize: 11,
                        background: "#7c3aed",
                        color: "#fff",
                      }}
                    >
                      Save URL
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════ CREW MODE ══════════════════════════════════ */}
        {activeMode === "CREW MODE" && (
          <div>
            <div style={S.card}>
              <div style={S.g2}>
                <div>
                  <span style={S.lbl}>CREW NAME</span>
                  <input
                    style={S.inp}
                    value={charData.crew}
                    onChange={(e) =>
                      setCharData((p) => ({ ...p, crew: e.target.value }))
                    }
                    onBlur={commitCrewName}
                    placeholder="Crew Name"
                  />
                </div>
              </div>
              <div
                style={{
                  marginTop: "12px",
                  paddingTop: "12px",
                  borderTop: "1px solid #374151",
                }}
              >
                <span style={S.lbl}>FACTION REPUTATION</span>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#9ca3af",
                    marginTop: "4px",
                    marginBottom: "8px",
                  }}
                >
                  Standing with campaign factions (-3 hostile, 0 neutral, +3
                  allied). Hidden factions are GM-only until revealed.
                </div>
                {charData.crewId && canEditSheet ? (
                  <div
                    style={{
                      marginBottom: 10,
                      padding: 10,
                      borderRadius: 6,
                      border: "1px solid #374151",
                      background: "#0d1117",
                    }}
                  >
                    <span style={{ ...S.lbl, fontSize: "10px" }}>
                      Crew portrait (HTTPS URL)
                    </span>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 10,
                        alignItems: "center",
                        marginTop: 8,
                      }}
                    >
                      {crewPortraitSrc ? (
                        <img
                          src={crewPortraitSrc}
                          alt=""
                          style={{
                            width: 44,
                            height: 44,
                            objectFit: "cover",
                            borderRadius: 6,
                            border: "1px solid #4b5563",
                            flexShrink: 0,
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : null}
                      <input
                        type="url"
                        style={{
                          ...S.inp,
                          flex: "1 1 200px",
                          minWidth: 0,
                          fontSize: 11,
                        }}
                        value={crewPortraitUrlDraft}
                        onChange={(e) => {
                          setCrewPortraitUrlDraft(e.target.value);
                          setCrewPortraitMsg(null);
                        }}
                        placeholder="https://example.com/crew-photo.jpg"
                      />
                      <button
                        type="button"
                        style={{ ...S.btn, fontSize: 11 }}
                        disabled={crewPortraitSaving}
                        onClick={async () => {
                          if (!charData.crewId) return;
                          setCrewPortraitSaving(true);
                          setCrewPortraitMsg(null);
                          try {
                            await crewAPI.patchCrew(charData.crewId, {
                              image_url: String(
                                crewPortraitUrlDraft || "",
                              ).trim(),
                            });
                            const d = await crewAPI.getCrew(charData.crewId);
                            setCrewData((p) => ({
                              ...p,
                              image: d.image ?? "",
                              image_url: d.image_url ?? "",
                            }));
                            setCrewPortraitUrlDraft(
                              String(d.image_url || "").trim(),
                            );
                            setCrewPortraitMsg({
                              ok: true,
                              text: "Portrait URL saved.",
                            });
                          } catch (err) {
                            setCrewPortraitMsg({
                              ok: false,
                              text:
                                err?.message ||
                                "Could not save (HTTPS URL required).",
                            });
                          } finally {
                            setCrewPortraitSaving(false);
                          }
                        }}
                      >
                        {crewPortraitSaving ? "Saving…" : "Save URL"}
                      </button>
                    </div>
                    {crewPortraitMsg ? (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 10,
                          color: crewPortraitMsg.ok ? "#34d399" : "#f87171",
                        }}
                      >
                        {crewPortraitMsg.text}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {crewFactionLinksForDisplay.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>
                    {crewFactionLinks.length === 0 ? (
                      <>
                        No linked factions yet.
                        {isGM && campaignId
                          ? " Create a faction for the campaign, then link it to this crew."
                          : ""}
                      </>
                    ) : (
                      <>
                        No crew–faction standings are revealed to players yet. Your
                        GM can reveal them from the crew block when the table is meant
                        to see them.
                      </>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {crewFactionLinksForDisplay.map((row) => (
                      <div
                        key={row.id}
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: "10px",
                          fontSize: "12px",
                          background: "#111827",
                          padding: "8px",
                          borderRadius: "6px",
                          border: "1px solid #374151",
                        }}
                      >
                        {crewPortraitSrc ? (
                          <img
                            src={crewPortraitSrc}
                            alt=""
                            title="Crew portrait"
                            style={{
                              width: 36,
                              height: 36,
                              objectFit: "cover",
                              borderRadius: 6,
                              border: "1px solid #4b5563",
                              flexShrink: 0,
                            }}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : null}
                        <span style={{ fontWeight: 600, color: "#e5e7eb" }}>
                          {row.faction_name}
                        </span>
                        <span style={{ color: "#9ca3af" }}>
                          {row.reputation_value}{" "}
                          <span style={{ color: "#6b7280" }}>
                            ({reputationTierLabel(row.reputation_value)})
                          </span>
                        </span>
                        {isGM && charData.crewId ? (
                          <>
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "11px",
                              }}
                            >
                              Rep
                              <input
                                type="number"
                                min={-3}
                                max={3}
                                defaultValue={row.reputation_value}
                                key={`${row.id}-${row.reputation_value}`}
                                style={{
                                  width: "52px",
                                  background: "#0d1117",
                                  color: "#fff",
                                  border: "1px solid #4b5563",
                                  borderRadius: "4px",
                                  padding: "2px 4px",
                                }}
                                onBlur={(e) => {
                                  const v = Math.min(
                                    3,
                                    Math.max(
                                      -3,
                                      parseInt(e.target.value, 10) || 0,
                                    ),
                                  );
                                  crewAPI
                                    .patchCrew(charData.crewId, {
                                      faction_relationships: [
                                        {
                                          faction_id: row.faction_id,
                                          reputation_value: v,
                                        },
                                      ],
                                    })
                                    .then(() =>
                                      crewAPI.getCrew(charData.crewId).then((d) => {
                                        setCrewFactionLinks(
                                          d.faction_relationships || [],
                                        );
                                      }),
                                    )
                                    .catch(() => {});
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              style={{
                                ...S.btn,
                                fontSize: "10px",
                                padding: "2px 8px",
                              }}
                              onClick={() => {
                                factionAPI
                                  .patchFaction(row.faction_id, {
                                    visible_to_players: !row.visible_to_players,
                                  })
                                  .then(() =>
                                    crewAPI.getCrew(charData.crewId).then((d) => {
                                      setCrewFactionLinks(
                                        d.faction_relationships || [],
                                      );
                                      onCampaignRefresh?.();
                                    }),
                                  )
                                  .catch(() => {});
                              }}
                            >
                              {row.visible_to_players
                                ? "Hide from players"
                                : "Reveal to players"}
                            </button>
                          </>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
                {isGM && campaignId && charData.crewId ? (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "10px",
                      borderRadius: "6px",
                      border: "1px solid #374151",
                      background: "#111827",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <span style={{ ...S.lbl, fontSize: "10px" }}>
                      Add faction link
                    </span>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#6b7280",
                        lineHeight: 1.4,
                      }}
                    >
                      Create a GM-only faction by name, or link one already in this
                      campaign. Set starting reputation (−3 to +3), then add link.
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px",
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="text"
                        style={{
                          ...S.inp,
                          flex: "1 1 160px",
                          minWidth: "140px",
                          fontSize: "11px",
                        }}
                        placeholder="New faction name (hidden until revealed)"
                        value={crewFactionAddName}
                        onChange={(e) => {
                          setCrewFactionAddName(e.target.value);
                          setCrewFactionAddErr(null);
                          if (e.target.value.trim())
                            setCrewFactionAddExistingId("");
                        }}
                        disabled={crewFactionAddBusy}
                      />
                      <span style={{ fontSize: "10px", color: "#6b7280" }}>or</span>
                      <select
                        style={{
                          ...S.sel,
                          flex: "1 1 160px",
                          minWidth: "140px",
                          fontSize: "11px",
                        }}
                        value={crewFactionAddExistingId}
                        onChange={(e) => {
                          setCrewFactionAddExistingId(e.target.value);
                          setCrewFactionAddErr(null);
                          if (e.target.value) setCrewFactionAddName("");
                        }}
                        disabled={crewFactionAddBusy}
                      >
                        <option value="">— Existing campaign faction —</option>
                        {crewLinkableFactions.map((f) => (
                          <option key={f.id} value={String(f.id)}>
                            {f.name || `Faction ${f.id}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "10px",
                        alignItems: "center",
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "11px",
                          color: "#9ca3af",
                        }}
                      >
                        Starting rep
                        <input
                          type="number"
                          min={-3}
                          max={3}
                          style={{
                            width: "52px",
                            background: "#0d1117",
                            color: "#fff",
                            border: "1px solid #4b5563",
                            borderRadius: "4px",
                            padding: "2px 4px",
                            fontSize: "11px",
                          }}
                          value={crewFactionAddRep}
                          onChange={(e) => {
                            setCrewFactionAddRep(
                              Math.min(
                                3,
                                Math.max(
                                  -3,
                                  parseInt(e.target.value, 10) || 0,
                                ),
                              ),
                            );
                            setCrewFactionAddErr(null);
                          }}
                          disabled={crewFactionAddBusy}
                        />
                      </label>
                      <button
                        type="button"
                        style={{
                          ...S.btn,
                          fontSize: "11px",
                          padding: "4px 12px",
                          opacity: crewFactionAddBusy ? 0.6 : 1,
                        }}
                        disabled={crewFactionAddBusy}
                        onClick={() => void handleAddCrewFactionLink()}
                      >
                        {crewFactionAddBusy ? "Saving…" : "Add link"}
                      </button>
                    </div>
                    {crewFactionAddErr ? (
                      <div style={{ fontSize: "11px", color: "#f87171" }}>
                        {crewFactionAddErr}
                      </div>
                    ) : null}
                    {crewLinkableFactions.length === 0 &&
                    !(campaignForCrewFactionAdd?.factions || []).length ? (
                      <div style={{ fontSize: "10px", color: "#6b7280" }}>
                        No factions on this campaign yet — use the name field to
                        create the first one.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5,1fr)",
                  gap: "12px",
                  marginTop: "12px",
                }}
              >
                {[
                  ["REP", "rep", 6, "#16a34a"],
                  ["TURF", "turf", 6, "#1d4ed8"],
                  ["TIER", "tier", 4, "#7c3aed"],
                  ["WANTED", "wanted", 5, "#ca8a04"],
                  ["COIN", "coin", 4, "#ca8a04"],
                ].map(([label, key, max, color]) => (
                  <div key={key}>
                    <span style={S.lbl}>{label}</span>
                    <div
                      style={{ display: "flex", gap: "2px", flexWrap: "wrap" }}
                    >
                      {Array.from({ length: max }, (_, i) => (
                        <div
                          key={i}
                          onClick={() =>
                            setCrewData((p) => ({
                              ...p,
                              [key]: i < p[key] ? i : i + 1,
                            }))
                          }
                          style={{
                            width: "16px",
                            height: "16px",
                            border: "1px solid #4b5563",
                            cursor: "pointer",
                            background: i < crewData[key] ? color : "#111827",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: "12px",
                  display: "flex",
                  gap: "16px",
                  alignItems: "center",
                }}
              >
                <span style={S.lbl}>HOLD</span>
                {["weak", "strong"].map((h) => (
                  <label
                    key={h}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    <input
                      type="radio"
                      name="hold"
                      value={h}
                      checked={crewData.hold === h}
                      onChange={(e) =>
                        setCrewData((p) => ({ ...p, hold: e.target.value }))
                      }
                    />
                    <span style={{ textTransform: "uppercase" }}>{h}</span>
                  </label>
                ))}
              </div>
              <div
                style={{
                  marginTop: "12px",
                  paddingTop: "12px",
                  borderTop: "1px solid #374151",
                }}
              >
                <span style={S.lbl}>CREW XP TRIGGERS</span>
                {(() => {
                  const triggerOptions = [
                    {
                      key: "challenge",
                      label: "Contend with challenges above your station",
                    },
                    {
                      key: "reputation",
                      label: "Bolster your crew's reputation",
                    },
                    {
                      key: "goals",
                      label: "Express goals, drives, or nature of the crew",
                    },
                  ];
                  const row = activeSessionCrewXpRow || {};
                  const credited = !!row.credited;
                  const playerGate =
                    !isGM && !crewData.activeSessionCrewXpAvailable;
                  const disabled =
                    !canEditSheet ||
                    !activeSessionId ||
                    crewXpTriggerSaving ||
                    playerGate ||
                    credited;
                  const lockReason = !canEditSheet
                    ? "Read-only: edit crew toggles on your own character sheet."
                    : !activeSessionId
                      ? "No active session — toggles unlock when the GM starts a session."
                      : credited
                        ? "Already banked into crew XP for this session."
                        : playerGate
                          ? "Locked until a crew PC earns XP this session (any member)."
                          : "";
                  let helpText = lockReason || null;
                  if (!helpText && crewXpTriggerSaving) {
                    helpText = "Saving…";
                  }
                  return (
                    <>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#d1d5db",
                          lineHeight: "1.7",
                          marginTop: "6px",
                        }}
                      >
                        {triggerOptions.map((opt) => (
                          <label
                            key={opt.key}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "6px",
                              cursor: disabled ? "not-allowed" : "pointer",
                              opacity: disabled ? 0.55 : 1,
                            }}
                          >
                            <input
                              type="checkbox"
                              title={
                                disabled
                                  ? lockReason || "Saving…"
                                  : opt.label
                              }
                              checked={!!row[opt.key]}
                              disabled={disabled}
                              onChange={() =>
                                void handleCrewXpTriggerToggle(opt.key)
                              }
                              style={{ marginTop: "3px" }}
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                      {activeSessionRepContribLines.length > 0 ? (
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#9ca3af",
                            marginTop: "6px",
                          }}
                        >
                          <span style={{ color: "#a7f3d0" }}>
                            Bolster rep (this session, toward crew rep on settle):
                          </span>{" "}
                          {activeSessionRepContribLines
                            .map((x) => `${x.label} +${x.n}`)
                            .join(" · ")}
                        </div>
                      ) : null}
                      {helpText ? (
                        <div
                          style={{
                            fontSize: "10px",
                            color: credited ? "#86efac" : "#9ca3af",
                            marginTop: "4px",
                          }}
                        >
                          {helpText}
                        </div>
                      ) : null}
                      {crewXpTriggerError ? (
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#f87171",
                            marginTop: "4px",
                          }}
                        >
                          {crewXpTriggerError}
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            </div>
            {charData.crewId ? (
              <div
                style={{
                  ...S.card,
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    marginBottom: crewHistoryOpen ? "6px" : 0,
                  }}
                >
                  <span style={S.lbl}>CREW MODIFICATION HISTORY</span>
                  <button
                    type="button"
                    onClick={() => setCrewHistoryOpenPersist((v) => !v)}
                    style={{
                      ...S.btn,
                      fontSize: "10px",
                      padding: "2px 8px",
                      background: "#111827",
                      color: "#c4b5fd",
                    }}
                  >
                    {crewHistoryOpen ? "Collapse" : "Expand"}
                  </button>
                </div>
                {crewHistoryOpen ? (
                  <>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#6b7280",
                        marginTop: "4px",
                        marginBottom: "8px",
                      }}
                    >
                      Saved changes to this crew (name, rep, turf, tier, wanted,
                      coin, notes, upgrades, etc.).
                    </div>
                    <div style={{ maxHeight: "220px", overflow: "auto" }}>
                      {crewHistoryEntries.length === 0 ? (
                        <div style={{ fontSize: "12px", color: "#6b7280" }}>
                          No history entries yet.
                        </div>
                      ) : (
                        <ul
                          style={{
                            margin: 0,
                            paddingLeft: "18px",
                            fontSize: "11px",
                            color: "#d1d5db",
                            lineHeight: 1.5,
                          }}
                        >
                          {crewHistoryEntries.map((entry) => {
                            const cf = entry.changed_fields || {};
                            const keys = Object.keys(cf).filter((k) =>
                              CREW_HISTORY_FIELD_KEYS.has(k),
                            );
                            if (!keys.length) return null;
                            const when = entry.timestamp
                              ? new Date(entry.timestamp).toLocaleString()
                              : "";
                            return (
                              <li key={entry.id} style={{ marginBottom: "8px" }}>
                                <div style={{ color: "#9ca3af" }}>
                                  {when}
                                  {entry.editor_username
                                    ? ` · ${entry.editor_username}`
                                    : ""}
                                </div>
                                {keys.map((k) => {
                                  const ch = cf[k] || {};
                                  return (
                                    <div key={k}>
                                      <strong>{k}</strong>:{" "}
                                      <span style={{ color: "#fca5a5" }}>
                                        {String(ch.old ?? "")}
                                      </span>{" "}
                                      →{" "}
                                      <span style={{ color: "#86efac" }}>
                                        {String(ch.new ?? "")}
                                      </span>
                                    </div>
                                  );
                                })}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: "10px", color: "#6b7280" }}>
                    Hidden. Expand to view crew edit history.
                  </div>
                )}
              </div>
            ) : null}
            <div style={S.g3}>
              <div style={S.card}>
                <span style={S.lbl}>SPECIAL ABILITIES</span>
                {crewData.specialAbilities.map((ab, i) => (
                  <div
                    key={i}
                    style={{ fontSize: "12px", marginBottom: "6px" }}
                  >
                    <div style={{ fontWeight: "bold" }}>{ab.name}</div>
                    <div style={{ color: "#9ca3af" }}>{ab.description}</div>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const n = prompt("Ability name:");
                    const d = prompt("Description:");
                    if (n && d)
                      setCrewData((p) => ({
                        ...p,
                        specialAbilities: [
                          ...p.specialAbilities,
                          { name: n, description: d },
                        ],
                      }));
                  }}
                  style={{
                    ...S.btn,
                    background: "#1d4ed8",
                    color: "#fff",
                    fontSize: "11px",
                    marginTop: "6px",
                  }}
                >
                  + Add Ability
                </button>
              </div>
              <div style={S.card}>
                <span style={S.lbl}>DESCRIPTION</span>
                <textarea
                  value={crewData.description}
                  onChange={(e) =>
                    setCrewData((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="A short crew description…"
                  style={{
                    width: "100%",
                    height: "80px",
                    background: "#0d1117",
                    color: "#fff",
                    border: "1px solid #374151",
                    padding: "8px",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    resize: "none",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ marginTop: "12px" }}>
                  <span style={S.lbl}>UPGRADES — LAIR</span>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "4px",
                    }}
                  >
                    {Object.entries(crewData.upgrades.lair).map(
                      ([key, val]) => (
                        <label
                          key={key}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11px",
                            cursor: "pointer",
                            textTransform: "capitalize",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={val}
                            onChange={(e) =>
                              setCrewData((p) => ({
                                ...p,
                                upgrades: {
                                  ...p.upgrades,
                                  lair: {
                                    ...p.upgrades.lair,
                                    [key]: e.target.checked,
                                  },
                                },
                              }))
                            }
                          />
                          {key}
                        </label>
                      ),
                    )}
                  </div>
                </div>
                <div style={{ marginTop: "12px" }}>
                  <span style={S.lbl}>UPGRADES — TRAINING</span>
                  {Object.entries(crewData.upgrades.training).map(
                    ([key, val]) => (
                      <label
                        key={key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "11px",
                          cursor: "pointer",
                          textTransform: "capitalize",
                          marginBottom: "2px",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={val}
                          onChange={(e) =>
                            setCrewData((p) => ({
                              ...p,
                              upgrades: {
                                ...p.upgrades,
                                training: {
                                  ...p.upgrades.training,
                                  [key]: e.target.checked,
                                },
                              },
                            }))
                          }
                        />
                        {key}
                      </label>
                    ),
                  )}
                </div>
              </div>
              <div style={S.card}>
                <span style={S.lbl}>NOTES</span>
                <textarea
                  value={crewData.notes}
                  onChange={(e) =>
                    setCrewData((p) => ({ ...p, notes: e.target.value }))
                  }
                  placeholder="Notes…"
                  style={{
                    width: "100%",
                    height: "200px",
                    background: "#0d1117",
                    color: "#fff",
                    border: "1px solid #374151",
                    padding: "8px",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    resize: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── FIX 6: Level-Up Modal ── */}
      {showLevelUp && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
          }}
        >
          <div
            style={{
              background: "#111827",
              border: "2px solid #7c3aed",
              borderRadius: "8px",
              padding: "24px",
              width: "420px",
              maxWidth: "90vw",
            }}
          >
            <div
              style={{
                fontSize: "16px",
                fontWeight: "bold",
                color: "#a78bfa",
                marginBottom: "4px",
              }}
            >
              ⬆ LEVEL UP
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "#9ca3af",
                marginBottom: "16px",
              }}
            >
              Choose ONE path.
              {levelUpIsBtoA && (
                <div style={{ ...S.green, marginTop: "6px" }}>
                  ★ B→A on {levelUpStat.toUpperCase()} — pick your reward below.
                </div>
              )}
              {levelUpChoice === "stat" &&
                !levelUpIsBtoA &&
                standStats[levelUpStat] === maxStandGradeIndex - 1 && (
                  <div style={{ ...S.green, marginTop: "6px" }}>
                    ★ This stat will hit {GRADE[maxStandGradeIndex]}-rank.
                  </div>
                )}
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
              {(
                primaryIsSpinOrHamon
                  ? [
                      ["playbook_ability", "+1 Playbook Ability"],
                      ...(!hasAcquiredStand
                        ? [["acquire_stand", "Acquire Stand"]]
                        : [["stat", "+1 Stand Coin"]]),
                    ]
                  : [["stat", "+1 Stand Coin"]]
              ).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setLevelUpChoice(val)}
                  style={{
                    ...S.btn,
                    flex: 1,
                    minWidth: "110px",
                    color: "#fff",
                    background: levelUpChoice === val ? "#7c3aed" : "#374151",
                    border: `2px solid ${levelUpChoice === val ? "#a78bfa" : "transparent"}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {levelUpChoice === "playbook_ability" && (
              <div
                style={{
                  marginBottom: "16px",
                  fontSize: "12px",
                  color: "#9ca3af",
                  lineHeight: 1.45,
                }}
              >
                Redeem one playbook pending for another non-foundation
                Spin/Hamon ability pick (slot budget = 1 chargen + advances;
                depth is owned non-foundation count, not character level).
              </div>
            )}
            {levelUpChoice === "acquire_stand" && (
              <div
                style={{
                  marginBottom: "16px",
                  fontSize: "12px",
                  color: "#9ca3af",
                  lineHeight: 1.45,
                }}
              >
                Redeem one playbook pending to gain a Stand. Coin starts at D
                across all six stats (6 points — redistribute on the sheet).
                Add 3 unique + 2 standard abilities on the sheet after.
              </div>
            )}

            {levelUpChoice === "stat" && (
              <div style={{ marginBottom: "16px" }}>
                <span style={S.lbl}>Which stat to advance?</span>
                <select
                  value={levelUpStat}
                  onChange={(e) => setLevelUpStat(e.target.value)}
                  style={{ ...S.sel, width: "100%" }}
                >
                  {Object.entries(standStats).map(([stat, val]) => (
                    <option
                      key={stat}
                      value={stat}
                      disabled={val >= maxStandGradeIndex}
                    >
                      {stat.toUpperCase()} — {GRADE[val]}
                      {val < maxStandGradeIndex
                        ? ` → ${GRADE[val + 1]}`
                        : ` (MAX — ${GRADE[maxStandGradeIndex]})`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {levelUpIsBtoA && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 10,
                  background: "#1f2937",
                  borderRadius: 6,
                  border: "1px solid #4b5563",
                }}
              >
                <span style={S.lbl}>B→A reward (required)</span>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  {[
                    [
                      "two_unique_plus_one_standard",
                      "2 Unique (1 function each) + Standard",
                    ],
                    ["two_standard", "2 Standard abilities"],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setLevelUpBtoARewardBranch(val)}
                      style={{
                        ...S.btn,
                        flex: 1,
                        fontSize: "10px",
                        color: "#fff",
                        background:
                          levelUpBtoARewardBranch === val
                            ? "#7c3aed"
                            : "#374151",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {levelUpBtoARewardBranch === "two_unique_plus_one_standard" ? (
                  <>
                    {[0, 1].map((i) => (
                      <React.Fragment key={i}>
                        <input
                          style={{ ...S.inp, marginBottom: 6 }}
                          value={levelUpRewardUniques[i]?.name || ""}
                          onChange={(e) => {
                            const next = [...levelUpRewardUniques];
                            next[i] = { ...next[i], name: e.target.value };
                            setLevelUpRewardUniques(next);
                          }}
                          placeholder={`Unique ability ${i + 1} name`}
                        />
                        <input
                          style={{ ...S.inp, marginBottom: 6 }}
                          value={levelUpRewardUniques[i]?.use || ""}
                          onChange={(e) => {
                            const next = [...levelUpRewardUniques];
                            next[i] = { ...next[i], use: e.target.value };
                            setLevelUpRewardUniques(next);
                          }}
                          placeholder={`Unique ability ${i + 1} function`}
                        />
                      </React.Fragment>
                    ))}
                    <select
                      style={{ ...S.sel, width: "100%" }}
                      value={levelUpRewardStandardId}
                      onChange={(e) => setLevelUpRewardStandardId(e.target.value)}
                    >
                      <option value="">Pick standard ability…</option>
                      {standardAbilitiesList.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  [0, 1].map((i) => (
                    <select
                      key={i}
                      style={{ ...S.sel, width: "100%", marginBottom: 6 }}
                      value={levelUpRewardStandardIds[i] || ""}
                      onChange={(e) => {
                        const next = [...levelUpRewardStandardIds];
                        next[i] = e.target.value;
                        setLevelUpRewardStandardIds(next);
                      }}
                    >
                      <option value="">Standard ability {i + 1}…</option>
                      {standardAbilitiesList.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  ))
                )}
              </div>
            )}

            <div style={{ marginBottom: "16px" }}>
              <span style={S.lbl}>Redeem playbook pending</span>
              <div
                style={{
                  marginTop: "6px",
                  fontSize: "12px",
                  color: "#c4b5fd",
                }}
              >
                Playbook track ({Number(xp.playbook) || 0}/10) ·{" "}
                {Number(pendingAdvanceCounts?.playbook || 0)} open pending
                {Number(pendingAdvanceCounts?.playbook || 0) === 1 ? "" : "s"}
              </div>
            </div>

            {levelUpError && (
              <div style={{ ...S.warn, marginBottom: 10, fontSize: "11px" }}>
                {levelUpError}
              </div>
            )}

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={confirmLevelUp}
                disabled={
                  levelUpBusy ||
                  !characterId ||
                  Number(pendingAdvanceCounts?.playbook || 0) < 1
                }
                style={{
                  ...S.btn,
                  background:
                    !levelUpBusy &&
                    characterId &&
                    Number(pendingAdvanceCounts?.playbook || 0) >= 1
                      ? "#7c3aed"
                      : "#374151",
                  color:
                    !levelUpBusy &&
                    characterId &&
                    Number(pendingAdvanceCounts?.playbook || 0) >= 1
                      ? "#fff"
                      : "#6b7280",
                  flex: 1,
                  fontWeight: "bold",
                }}
              >
                {levelUpBusy ? "Applying…" : "Confirm (redeem pending)"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLevelUp(false);
                  setLevelUpLockTrack(null);
                }}
                style={{ ...S.btn, background: "#374151", color: "#fff" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showTrackAdvance && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
          }}
        >
          <div
            style={{
              background: "#111827",
              border: "2px solid #7c3aed",
              borderRadius: "8px",
              padding: "24px",
              width: "400px",
              maxWidth: "90vw",
            }}
          >
            <div
              style={{
                fontSize: "16px",
                fontWeight: "bold",
                color: "#a78bfa",
                marginBottom: "8px",
              }}
            >
              Take advance —{" "}
              {(XP_TRACK_SPEND_LABELS[showTrackAdvance.key] ||
                showTrackAdvance.key
              ).toUpperCase()}
            </div>
            {showTrackAdvance.kind === "heritage" ? (
              <>
                <p style={{ fontSize: 12, color: "#d1d5db", marginBottom: 16 }}>
                  Redeem one heritage pending for +1 HP (heritage option, no
                  extra detriments).
                </p>
                {minorAdvanceError && (
                  <div style={{ ...S.warn, marginBottom: 10, fontSize: 11 }}>
                    {minorAdvanceError}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    disabled={minorAdvanceBusy || !characterId}
                    onClick={async () => {
                      if (!characterId) return;
                      setMinorAdvanceBusy(true);
                      setMinorAdvanceError(null);
                      try {
                        const res = await characterAPI.buyHpWithXp(characterId, {
                          xp_track: "heritage",
                          from_pool: false,
                        });
                        if (res?.character)
                          applyAllocationBackendCharacter(res.character);
                        if (Array.isArray(res?.allocations))
                          setXpAllocationRows(res.allocations);
                        setShowTrackAdvance(null);
                      } catch (err) {
                        setMinorAdvanceError(
                          err?.message || "Could not buy HP",
                        );
                      } finally {
                        setMinorAdvanceBusy(false);
                      }
                    }}
                    style={{
                      ...S.btn,
                      flex: 1,
                      background: "#0e7490",
                      color: "#fff",
                      fontWeight: "bold",
                    }}
                  >
                    {minorAdvanceBusy ? "…" : "Confirm (redeem → +1 HP)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTrackAdvance(null)}
                    style={{ ...S.btn, background: "#374151", color: "#fff" }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 12, color: "#d1d5db", marginBottom: 12 }}>
                  Redeem one attribute pending for +1 action dot under that
                  attribute.
                </p>
                <span style={S.lbl}>Action</span>
                <select
                  value={minorAdvanceAction}
                  onChange={(e) => setMinorAdvanceAction(e.target.value)}
                  style={{ ...S.sel, width: "100%", marginBottom: 12 }}
                >
                  {minorAdvanceActions.map((a) => (
                    <option
                      key={a}
                      value={a}
                      disabled={actionRatings[a] >= 4}
                    >
                      {a} ({actionRatings[a]}/4)
                      {actionRatings[a] >= 4 ? " — MAX" : ""}
                    </option>
                  ))}
                </select>
                {minorAdvanceError && (
                  <div style={{ ...S.warn, marginBottom: 10, fontSize: 11 }}>
                    {minorAdvanceError}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={spendXPForDot}
                    disabled={
                      minorAdvanceBusy ||
                      !characterId ||
                      !minorAdvanceActions.includes(minorAdvanceAction) ||
                      actionRatings[minorAdvanceAction] >= 4
                    }
                    style={{
                      ...S.btn,
                      flex: 1,
                      background: "#7c3aed",
                      color: "#fff",
                      fontWeight: "bold",
                    }}
                  >
                    {minorAdvanceBusy ? "…" : "Confirm (redeem → +1 dot)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTrackAdvance(null)}
                    style={{ ...S.btn, background: "#374151", color: "#fff" }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {pendingStandAReward && canEditSheet ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#111827",
              border: "1px solid #7c3aed",
              borderRadius: 4,
              padding: 16,
              maxWidth: 460,
              width: "100%",
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: "bold",
                color: "#fff",
                marginBottom: 8,
              }}
            >
              B→A Stand Coin reward
              {pendingStandAReward.stand_stat
                ? ` — ${String(pendingStandAReward.stand_stat).toUpperCase()}`
                : ""}
            </div>
            <p style={{ fontSize: 12, color: "#d1d5db", marginBottom: 12 }}>
              Raising a Stand Coin stat to A applies a playbook advance (10 XP).
              Choose 2 standard abilities or 2 unique abilities (one function
              each) + 1 standard.
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {[
                ["two_standard", "2 standards"],
                [
                  "two_unique_plus_one_standard",
                  "2 Unique (1 function each) + Standard",
                ],
              ].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setPendingStandABranch(val)}
                  style={{
                    ...S.btn,
                    flex: 1,
                    fontSize: 11,
                    color: "#fff",
                    background:
                      pendingStandABranch === val ? "#7c3aed" : "#374151",
                    border:
                      pendingStandABranch === val
                        ? "1px solid #a78bfa"
                        : "1px solid transparent",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {pendingStandABranch === "two_unique_plus_one_standard" ? (
              <>
                {[0, 1].map((i) => (
                  <React.Fragment key={i}>
                    <input
                      style={{ ...S.inp, marginBottom: 6 }}
                      value={pendingStandAUniques[i]?.name || ""}
                      onChange={(e) => {
                        const next = [...pendingStandAUniques];
                        next[i] = { ...next[i], name: e.target.value };
                        setPendingStandAUniques(next);
                      }}
                      placeholder={`Unique ability ${i + 1} name`}
                    />
                    <input
                      style={{ ...S.inp, marginBottom: 6 }}
                      value={pendingStandAUniques[i]?.use || ""}
                      onChange={(e) => {
                        const next = [...pendingStandAUniques];
                        next[i] = { ...next[i], use: e.target.value };
                        setPendingStandAUniques(next);
                      }}
                      placeholder={`Unique ability ${i + 1} function`}
                    />
                  </React.Fragment>
                ))}
                <select
                  style={{ ...S.sel, width: "100%", marginBottom: 8 }}
                  value={pendingStandAStdId}
                  onChange={(e) => setPendingStandAStdId(e.target.value)}
                >
                  <option value="">- pick standard -</option>
                  {standardAbilitiesList.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              [0, 1].map((i) => (
                <select
                  key={i}
                  style={{ ...S.sel, width: "100%", marginBottom: 6 }}
                  value={pendingStandAStdIds[i] || ""}
                  onChange={(e) => {
                    const next = [...pendingStandAStdIds];
                    next[i] = e.target.value;
                    setPendingStandAStdIds(next);
                  }}
                >
                  <option value="">{`- pick standard ${i + 1} -`}</option>
                  {standardAbilitiesList.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              ))
            )}
            {pendingStandAError ? (
              <div style={{ color: "#f87171", fontSize: 11, marginBottom: 8 }}>
                {pendingStandAError}
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                disabled={pendingStandABusy || !characterId}
                onClick={() => void claimPendingStandAReward()}
                style={{
                  ...S.btn,
                  background:
                    pendingStandABusy || !characterId ? "#4b5563" : "#7c3aed",
                  color: "#fff",
                  fontWeight: "bold",
                }}
              >
                {pendingStandABusy ? "Applying…" : "Apply advance"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export { CharacterSheetWrapper };

// ─── App Wrapper (standalone demo) ────────────────────────────────────────────

export default function App() {
  const [current] = useState({
    id: 1,
    name: "Josuke Higashikata",
    standName: "Crazy Diamond",
    heritage: "Japanese",
    background: "Student",
    vice: "Obsession",
    crew: "Morioh Crew",
    standStats: {
      power: 2,
      speed: 2,
      range: 0,
      durability: 1,
      precision: 1,
      development: 0,
    },
    actionRatings: {
      HUNT: 1,
      STUDY: 0,
      SURVEY: 1,
      TINKER: 2,
      FINESSE: 0,
      PROWL: 0,
      SKIRMISH: 2,
      WRECK: 0,
      BIZARRE: 0,
      COMMAND: 1,
      CONSORT: 0,
      SWAY: 0,
    },
  });

  const handleSave = async (data) => {
    console.log("Demo save:", data);
    return data;
  };

  return (
    <CharacterSheetWrapper
      character={current}
      allCharacters={[current]}
      campaigns={[]}
      onSave={handleSave}
    />
  );
}

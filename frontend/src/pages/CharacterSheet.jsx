import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  GRADE,
  INDEX_TO_GRADE,
  MAX_CREATION_DOTS,
  MAX_DOTS_PER_ACTION_CREATION,
  PC_STAT_DESC,
  STAND_STAT_KEYS,
  DUR_TABLE,
  DEV_SESSION_XP,
  ACTION_ATTR,
  ACTION_DESC,
  RESISTANCE_ATTR_DESC,
  VICE_OPTIONS,
  DEFAULT_TRAUMA,
  DEVILS_BARGAIN_DETRIMENTS,
} from "../features/character-sheet/constants/srd";
import NpcsStandCoin from "../components/NpcsStandCoin";
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
  normalizeHarmObject,
} from "../features/character-sheet";
import { useAuth } from "../features/auth";
import {
  PositionStack,
  EffectShapes,
  HistoryBranchIcon,
} from "../components/position-effect/PositionEffectIndicators";
import { computeActionPoolBreakdown } from "../features/character-sheet/utils/actionDicePool";

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
  harm_clock_current: "Healing clock",
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
  const r = size / 2 - 4,
    cx = size / 2,
    cy = size / 2;
  const sa = 360 / segments;
  const showArrows = interactive && onClick;
  const svg = (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      {Array.from({ length: segments }, (_, i) => {
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
            fill={i < filled ? "#dc2626" : "transparent"}
            stroke="#6b7280"
            strokeWidth="1"
            style={{ cursor: interactive ? "pointer" : "default" }}
            onClick={
              interactive && onClick
                ? () => onClick(i < filled ? i : i + 1)
                : undefined
            }
          />
        );
      })}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="transparent"
        stroke="#6b7280"
        strokeWidth="2"
      />
    </svg>
  );
  if (showArrows) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <button
          type="button"
          style={arrowBtnStyle}
          onClick={() => onClick(Math.max(0, filled - 1))}
          title="Decrease"
        >
          −
        </button>
        {svg}
        <button
          type="button"
          style={arrowBtnStyle}
          onClick={() => onClick(Math.min(segments, filled + 1))}
          title="Increase"
        >
          +
        </button>
      </div>
    );
  }
  return svg;
};

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
  if (payload.imageFile) return true;
  if (payload.campaign != null && payload.campaign !== "") return true;
  if ((payload.playbook || "Stand") !== "Stand") return true;
  if ((payload.stressFilled || 0) > 0) return true;
  if ((payload.regularArmorUsed || 0) > 0) return true;
  if (Boolean(payload.specialArmorUsed)) return true;
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
  return false;
}

const CharacterSheetWrapper = ({
  character,
  onClose,
  onSave,
  onCreateNew,
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
  /** Incremented when CharacterPage finishes a remote sync (poll, SSE, visibility) so session rolls refetch. */
  sessionDataPollTick = 0,
}) => {
  const { user } = useAuth();
  const ownerUsername =
    character?.creator_username || character?.user_username || character?.username || "";
  const ownerLabel = ownerUsername
    ? `Created by ${ownerUsername}`
    : character?.user_id
      ? `Created by user #${character.user_id}`
      : "Created by unknown";
  const canEditSheet = !character?.id || isGM || character?.user_id === user?.id;
  const [activeMode, setActiveMode] = useState("CHARACTER MODE");
  const charCampaign = campaigns?.find((c) => c.id === character?.campaign);
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
  const [charData, setCharData] = useState({
    // Unsaved drafts should start truly blank even if upstream placeholders exist.
    name: character?.id ? (character?.name || "") : "",
    standName: character?.standName || "",
    heritage: resolveHeritageId(character?.heritage),
    background: character?.background || "",
    look: character?.look || "",
    vice: character?.vice || "",
    viceDetails: character?.viceDetails ?? character?.vice_details ?? "",
    crew: character?.crew || "",
    crewId: character?.crewId ?? null,
  });

  // Campaign assignment (normalize: backend may send campaign as object or ID)
  const [campaignId, setCampaignId] = useState(() => {
    const c = character?.campaign;
    return (typeof c === "object" ? c?.id : c) ?? "";
  });

  // Portrait state
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(character?.image_url || "");
  const [imagePreview, setImagePreview] = useState(
    character?.image || character?.image_url || "",
  );
  const fileInputRef = useRef(null);

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState(null);
  const debounceRef = useRef(null);
  const mountedRef = useRef(false);
  const savingRef = useRef(false);
  const lastSavedPayloadRef = useRef(null);

  useEffect(() => {
    lastSavedPayloadRef.current = null;
  }, [character?.id]);

  useEffect(() => {
    lastSavedPayloadRef.current = null;
  }, [sessionDataPollTick]);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }, []);

  const handleImageUrlPrompt = useCallback(() => {
    const url = prompt("Paste image URL:");
    if (url) {
      setImageUrl(url);
      setImagePreview(url);
      setImageFile(null);
    }
  }, []);

  // Sync crew/crewId when character changes (e.g. from parent after crew name update)
  useEffect(() => {
    const newCrew = character?.crew ?? "";
    const newCrewId = character?.crewId ?? null;
    setCharData((prev) =>
      prev.crew !== newCrew || prev.crewId !== newCrewId
        ? { ...prev, crew: newCrew, crewId: newCrewId }
        : prev,
    );
  }, [character?.crew, character?.crewId]);

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

  // When parent merges id before full GET/list row arrives, fill empty identity from server (avoid PUT wiping true_name, etc.)
  useEffect(() => {
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
  ]);

  // Portrait: sync from server/merged character; do not clobber while a file upload is pending
  useEffect(() => {
    if (imageFile) return;
    setImageUrl(character?.image_url || "");
    setImagePreview(character?.image || character?.image_url || "");
  }, [character?.id, character?.image, character?.image_url, imageFile]);

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
  }, [character?.id, character?.standStats]);

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
    const next = character?.actionRatings;
    if (!next || typeof next !== "object") return;
    setActionRatings((prev) => {
      const keys = [...new Set([...Object.keys(prev), ...Object.keys(next)])];
      const changed = keys.some(
        (k) => (Number(prev[k]) || 0) !== (Number(next[k]) || 0),
      );
      return changed ? { ...prev, ...next } : prev;
    });
  }, [character?.id, character?.actionRatings]);

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

  // FIX 4: Armor charges derived from Durability grade
  const [regularArmorUsed, setRegularArmorUsed] = useState(
    character?.regularArmorUsed || 0,
  );
  const [specialArmorUsed, setSpecialArmorUsed] = useState(
    character?.specialArmorUsed || false,
  );

  // Harm (API can send harm or harmEntries; always keep L1/L2×2, L3, L4)
  const [harm, setHarm] = useState(() =>
    normalizeHarmObject(character?.harm || character?.harmEntries),
  );
  const [healingClock, setHealingClock] = useState(
    character?.healingClock ?? 0,
  );

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

  // Hydrate sheet from server when character payload arrives after first paint (same class of bug as actionRatings)
  useEffect(() => {
    const v = character?.stressFilled;
    if (typeof v === "number") setStressFilled((p) => (p !== v ? v : p));
  }, [character?.id, character?.stressFilled]);

  useEffect(() => {
    const t = character?.trauma;
    if (!t || typeof t !== "object" || Array.isArray(t)) return;
    setTrauma((prev) => {
      const merged = { ...DEFAULT_TRAUMA, ...t };
      return Object.keys(merged).every((k) => merged[k] === prev[k])
        ? prev
        : merged;
    });
  }, [character?.id, character?.trauma]);

  useEffect(() => {
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
  }, [character?.id, character?.harm, character?.harmEntries]);

  useEffect(() => {
    const h = character?.healingClock;
    if (typeof h !== "number") return;
    setHealingClock((p) => (p !== h ? h : p));
  }, [character?.id, character?.healingClock]);

  useEffect(() => {
    const nx = character?.xp;
    if (!nx || typeof nx !== "object") return;
    setXp((prev) => {
      const keys = [...new Set([...Object.keys(prev), ...Object.keys(nx)])];
      const changed = keys.some((k) => (prev[k] ?? 0) !== (nx[k] ?? 0));
      return changed ? { ...prev, ...nx } : prev;
    });
  }, [character?.id, character?.xp]);

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
  const [levelUpChoice, setLevelUpChoice] = useState("stat");
  const [levelUpStat, setLevelUpStat] = useState("power");
  const [levelUpDot1, setLevelUpDot1] = useState("HUNT");
  const [levelUpDot2, setLevelUpDot2] = useState("HUNT");

  // FIX 7: Minor advance action selector
  const [minorAdvanceAction, setMinorAdvanceAction] = useState("HUNT");

  // Abilities & Clocks
  const [abilities, setAbilities] = useState(character?.abilities || []);
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

  // Load abilities when switching character only — do not re-sync on every `character.abilities`
  // reference change or removals are overwritten by stale server data before autosave completes.
  useEffect(() => {
    setAbilities(character?.abilities || []);
  }, [character?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- only reset on sheet identity

  // Sync playbook label when character changes (API uses STAND/HAMON/SPIN; sheet uses Stand/Hamon/Spin)
  useEffect(() => {
    if (character?.playbook != null && character.playbook !== "") {
      setPlaybook(character.playbook);
    }
  }, [character?.id, character?.playbook]);

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
    [characterId, character?.campaign, campaignId, onCampaignRefresh],
  );

  const [clocks, setClocks] = useState(character?.clocks || []);
  const [customAbilityModal, setCustomAbilityModal] = useState(null); // { type, name, uses, items } or null
  const [playbook, setPlaybook] = useState(character?.playbook || "Stand");
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
  });
  const [crewFactionLinks, setCrewFactionLinks] = useState([]);
  const [crewHistoryEntries, setCrewHistoryEntries] = useState([]);
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
          upgrades: progressToUpgrades(d.upgrade_progress),
          specialAbilities: (d.special_abilities || []).map((a) => ({
            name: a.name,
            description: a.description || "",
          })),
        }));
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

  useEffect(() => {
    if (!crewHydratedRef.current || !charData.crewId) return undefined;
    const t = setTimeout(() => {
      crewAPI
        .patchCrew(charData.crewId, buildCrewPatchPayload())
        .catch(() => {});
    }, 900);
    return () => clearTimeout(t);
  }, [
    charData.crewId,
    buildCrewPatchPayload,
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

  const durVal = Math.min(5, Math.max(0, Number(standStats.durability) || 1));
  const devVal = Math.min(5, Math.max(0, Number(standStats.development) || 1));
  const maxStress = 9 + (DUR_TABLE[durVal]?.stressBonus ?? 0);
  const maxArmorCharges = DUR_TABLE[durVal]?.armorCharges ?? 1;
  const sessionDevXP = DEV_SESSION_XP[devVal] ?? 0;

  const totalActionDots = Object.values(actionRatings).reduce(
    (s, v) => s + v,
    0,
  );
  const totalStandPoints = Object.values(standStats).reduce((s, v) => s + v, 0);
  const aRankCount = Object.values(standStats).reduce(
    (n, idx) => n + (INDEX_TO_GRADE(idx) === "A" ? 1 : 0),
    0,
  );
  const isSpinPlaybook = playbook === "Spin";
  const isHamonPlaybook = playbook === "Hamon";
  const totalXP = Object.values(xp).reduce((s, v) => s + v, 0);
  const dotsRemaining = MAX_CREATION_DOTS - totalActionDots;

  // XP expenditure accounting
  // Each stand coin grade = 10 XP (cost of one level-up stat advance)
  // Each action dot = 5 XP (cost of one minor advance)
  // Level 1 baseline = 95 XP (6 coin pts × 10 + 7 dots × 5)
  const totalSpentXP = totalStandPoints * 10 + totalActionDots * 5;
  const pcLevel = 1 + Math.floor((totalSpentXP - 95) / 10);

  // PC

  const getAttributeDice = (actions) =>
    actions.filter((a) => actionRatings[a] > 0).length;

  // ─── Handlers ────────────────────────────────────────────────────────────────

  // FIX 1: Creation-mode dot clicks — hard cap 7 total / max 2 per action
  const updateActionRating = (action, newVal) => {
    if (newVal < 0 || newVal > MAX_DOTS_PER_ACTION_CREATION) return;
    const delta = newVal - actionRatings[action];
    if (delta > 0 && totalActionDots + delta > MAX_CREATION_DOTS) return;
    setActionRatings((p) => ({ ...p, [action]: newVal }));
  };

  // Advancement path can go beyond 2, up to 4
  const advanceActionDot = (action) => {
    if (actionRatings[action] >= 4) return;
    setActionRatings((p) => ({ ...p, [action]: p[action] + 1 }));
  };

  // FIX 2: Hard cap at A by default; S only when gm_can_have_s_rank_stand_stats
  const incrementStat = useCallback(
    (stat) => {
      setStandStats((p) => {
        if (p[stat] >= maxStandGradeIndex) return p;
        return { ...p, [stat]: p[stat] + 1 };
      });
    },
    [maxStandGradeIndex],
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

  const bumpStandCoinGrade = useCallback(
    (key, delta) => {
      if (delta === 1) incrementStat(key);
      else if (delta === -1) decrementStat(key);
    },
    [incrementStat, decrementStat],
  );

  const toggleXP = (track, idx) => {
    const maxVals = {
      insight: 5,
      prowess: 5,
      resolve: 5,
      heritage: 5,
      playbook: 10,
    };
    setXp((p) => ({
      ...p,
      [track]: Math.min(idx < p[track] ? idx : idx + 1, maxVals[track]),
    }));
  };

  // Spend XP from pools in priority order
  const deductXP = (amount) => {
    let rem = amount;
    const next = { ...xp };
    for (const key of [
      "playbook",
      "insight",
      "prowess",
      "resolve",
      "heritage",
    ]) {
      const take = Math.min(rem, next[key]);
      next[key] -= take;
      rem -= take;
      if (rem === 0) break;
    }
    setXp(next);
  };

  // FIX 6: Confirm level-up (binary choice)
  const confirmLevelUp = () => {
    if (totalXP < 10) return;
    deductXP(10);
    if (levelUpChoice === "stat") {
      incrementStat(levelUpStat);
    } else {
      advanceActionDot(levelUpDot1);
      advanceActionDot(levelUpDot2);
    }
    setShowLevelUp(false);
  };

  // FIX 7: Minor advance — 5 XP for +1 action dot (outside level-up)
  const spendXPForDot = () => {
    if (totalXP < 5 || actionRatings[minorAdvanceAction] >= 4) return;
    deductXP(5);
    advanceActionDot(minorAdvanceAction);
  };

  // Roll modal for campaign/session context (position, effect, push)
  const [rollPending, setRollPending] = useState(null);
  const [rollModal, setRollModal] = useState({
    push_effect: false,
    push_dice: false,
    devil_bargain_dice: false,
    devil_bargain_note: "",
  });
  const [rollAbilityBoost, setRollAbilityBoost] = useState({});
  const [rollApiError, setRollApiError] = useState(null);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [historyMode, setHistoryMode] = useState("session");
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historySessionId, setHistorySessionId] = useState(null);
  const [historyCharacterFilter, setHistoryCharacterFilter] = useState("all");
  const [showXpHistoryModal, setShowXpHistoryModal] = useState(false);
  const [xpTimelineLoading, setXpTimelineLoading] = useState(false);
  const [xpTimelineError, setXpTimelineError] = useState(null);
  const [xpTimelineRows, setXpTimelineRows] = useState([]);
  const [activeGroupAction, setActiveGroupAction] = useState(null);
  const [groupGoalDraft, setGroupGoalDraft] = useState("");
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupActionErr, setGroupActionErr] = useState(null);
  const [rollGoalDraft, setRollGoalDraft] = useState("");
  const [assistHelperId, setAssistHelperId] = useState("");
  const [showDevilsBargainModal, setShowDevilsBargainModal] = useState(false);
  const [devilBargainConfirmed, setDevilBargainConfirmed] = useState(false);
  const [expandedActionInfo, setExpandedActionInfo] = useState(null);
  const [campaignAssignStatus, setCampaignAssignStatus] = useState(null);
  const [campaignAssignError, setCampaignAssignError] = useState(null);
  const harmLevel3Used =
    ((harm?.level3?.[0] ?? "")?.toString?.()?.trim?.() ?? "") !== "";

  useEffect(() => {
    setHistorySessionId(activeSessionId || null);
  }, [activeSessionId]);

  useEffect(() => {
    if (!showXpHistoryModal || !characterId) return;
    setXpTimelineLoading(true);
    setXpTimelineError(null);
    const asArray = (res) => (Array.isArray(res) ? res : res?.results || []);
    Promise.all([
      experienceTrackerAPI.list({ character: characterId }).catch(() => []),
      xpHistoryAPI.list({ character: characterId }).catch(() => []),
    ])
      .then(([et, xh]) => {
        const rows = [
          ...asArray(et).map((e) => ({
            key: `t-${e.id}`,
            when: e.session_date,
            text: `${e.trigger_display || e.trigger || "XP"}: ${e.description || ""} (+${e.xp_gained ?? 0} XP)`,
          })),
          ...asArray(xh).map((x) => ({
            key: `h-${x.id}`,
            when: x.timestamp,
            text: `${x.reason || "XP"} (+${x.amount ?? 0})`,
          })),
        ];
        rows.sort((a, b) => new Date(b.when) - new Date(a.when));
        setXpTimelineRows(rows);
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
      characterHistoryAPI
        .list({
          character: characterId,
          ...(charCampaign?.id ? { campaign: charCampaign.id } : {}),
        })
        .then((res) => {
          const rows = asArray(res)
            .map((entry) => {
              const changed = entry.changed_fields || {};
              const details = Object.keys(changed).map((k) => ({
                key: k,
                label: historyFieldLabel(k),
                oldValue: stringifyValue(changed[k]?.old),
                newValue: stringifyValue(changed[k]?.new),
              }));
              return {
                key: `sheet-${entry.id}`,
                timestamp: entry.timestamp,
                actor: entry.editor_username || "system",
                type: "sheet_edit",
                sessionTag: "Out of session",
                details,
              };
            })
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setHistoryRows(rows);
        })
        .catch((e) => setHistoryError(e.message))
        .finally(() => setHistoryLoading(false));
      return;
    }

    if (!historySessionId) {
      setHistoryRows([]);
      setHistoryLoading(false);
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
          rows.push({
            key: `roll-${r.id}`,
            timestamp: r.timestamp,
            actor: r.rolled_by_username || r.character_name || "unknown",
            characterId: r.character,
            type: "roll",
            rollType: r.roll_type,
            text:
              (r.roll_type || "").toUpperCase() === "FORTUNE" &&
              !r.fortune_reveal_outcome
                ? `${r.action_name || "Fortune"} (redacted)`
                : `${r.action_name || "Roll"} · ${[]
                    .concat(r.results || [])
                    .join(", ")} → ${r.outcome || ""}`,
            modifiers: [
              r.position ? `Pos ${r.position}` : null,
              r.effect ? `Eff ${r.effect}` : null,
              r.push_for_dice ? "Push(+1d)" : null,
              r.push_for_effect ? "Push(+effect)" : null,
              r.uses_devil_bargain ? "Devil's bargain" : null,
              r.roller_stress_spent ? `Stress ${r.roller_stress_spent}` : null,
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

        const xpRows = (sessionRes?.xp_entries || []).map((x) => ({
          key: `xp-${x.id}`,
          timestamp: x.session_date || sessionRes?.session_date,
          actor: "xp",
          characterId: x.character || null,
          type: "xp",
          text: `XP +${x.xp_gained} (${x.trigger_display || x.trigger || "trigger"})`,
          modifiers: [],
        }));
        rows.push(...xpRows);

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
                (r) => String(r.characterId || "") === String(historyCharacterFilter),
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

  const { bonusDiceFromAbilities, abilityEffectSteps, abilityBonusAudit } =
    useMemo(() => {
      let d = 0;
      let e = 0;
      const audit = [];
      (abilities || [])
        .filter((a) => a.type === "standard")
        .forEach((ab) => {
          const id = ab.id ?? ab.name;
          const b = rollAbilityBoost[id];
          if (!b) return;
          if (b.dice) {
            d += 1;
            audit.push(`${ab.name}: +1d`);
          }
          if (b.effect) {
            e += 1;
            audit.push(`${ab.name}: +1 effect`);
          }
        });
      return {
        bonusDiceFromAbilities: d,
        abilityEffectSteps: e,
        abilityBonusAudit: audit,
      };
    }, [abilities, rollAbilityBoost]);

  const gmDevilBargainText = useMemo(() => {
    const m = charCampaign?.active_session_detail?.devils_bargain_by_character;
    if (!m || characterId == null) return "";
    return String(m[String(characterId)] ?? m[characterId] ?? "").trim();
  }, [
    charCampaign?.active_session_detail?.devils_bargain_by_character,
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

  const applyRollPushMode = useCallback(
    (mode) => {
      setDevilBargainConfirmed(false);
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
    [gmDevilBargainText],
  );

  const rollPoolPreview = useMemo(() => {
    if (!rollPending) return null;
    const { action_rating, basePool } = computeActionPoolBreakdown(
      rollPending.actionName,
      actionRatings,
    );
    let mod = 0;
    if (rollModal.push_dice) mod += 1;
    if (rollModal.devil_bargain_dice) mod += 1;
    if (assistHelperId) mod += 1;
    mod += bonusDiceFromAbilities;
    const pushStress =
      (rollModal.push_effect ? 2 : 0) + (rollModal.push_dice ? 2 : 0);
    return {
      action_rating,
      basePool,
      mod,
      total: basePool + mod,
      pushStress,
    };
  }, [
    rollPending,
    actionRatings,
    rollModal.push_dice,
    rollModal.push_effect,
    rollModal.devil_bargain_dice,
    assistHelperId,
    bonusDiceFromAbilities,
  ]);

  const handleRollWithSession = async () => {
    if (!rollPending || !characterId) return;
    setRollApiError(null);
    const asd = charCampaign?.active_session_detail;
    try {
      const goalFromDraft = (rollGoalDraft || "").trim();
      const payload = {
        action: rollPending.actionName.toLowerCase(),
        push_effect: rollModal.push_effect,
        push_dice: rollModal.push_dice,
        devil_bargain_dice: rollModal.devil_bargain_dice,
        devil_bargain_note: rollModal.devil_bargain_note || undefined,
        devil_bargain_confirmed:
          !rollModal.devil_bargain_dice ||
          !gmDevilBargainText ||
          devilBargainConfirmed,
        bonus_dice: bonusDiceFromAbilities,
        ability_effect_steps: abilityEffectSteps,
        goal_label:
          goalFromDraft || (asd?.roll_goal_label || "").trim() || undefined,
        ability_bonuses: abilityBonusAudit.length
          ? abilityBonusAudit
          : undefined,
        assist_helper_id: assistHelperId
          ? parseInt(assistHelperId, 10)
          : undefined,
      };
      if (activeSessionId) {
        payload.session_id = activeSessionId;
        if (activeGroupAction?.id) {
          payload.group_action_id = activeGroupAction.id;
        }
      }
      const res = await characterAPI.rollAction(characterId, payload);
      setDiceResult({
        action: rollPending.actionName,
        dice: res.dice_results || [],
        result: res.highest ?? Math.max(...(res.dice_results || [0])),
        outcome: (res.outcome || "").replace(/_/g, " "),
        special:
          res.dice_results?.filter((d) => d === 6).length >= 2
            ? `Critical! (${res.dice_results?.filter((d) => d === 6).length} sixes)`
            : "",
        isResistance: false,
        stressCost: res.stress_spent || null,
        zeroDice: (res.dice_results || []).length === 0,
        isDesperateAction:
          (
            res.position ||
            sessionOverridePositionEffect?.position ||
            asd?.default_position ||
            ""
          ).toLowerCase() === "desperate",
        isCritical: (res.dice_results || []).filter((d) => d === 6).length >= 2,
        position:
          res.position ||
          sessionOverridePositionEffect?.position ||
          asd?.default_position,
        effect:
          res.effect ||
          sessionOverridePositionEffect?.effect ||
          asd?.default_effect,
        xpGained: res.xp_gained || 0,
      });
      if (res.xp_gained > 0 && res.xp_track) {
        setXp((p) => ({
          ...p,
          [res.xp_track]: Math.min((p[res.xp_track] || 0) + res.xp_gained, 5),
        }));
      }
      if (res.stress_spent)
        setStressFilled((p) => Math.max(0, (p ?? 0) - res.stress_spent));
      if (res.assist_helper_id) onCampaignRefresh?.();
      setRollPending(null);
      setRollGoalDraft("");
      setAssistHelperId("");
      setDevilBargainConfirmed(false);
      setRollModal((p) => ({
        ...p,
        devil_bargain_dice: false,
        devil_bargain_note: "",
      }));
      setRollAbilityBoost({});
    } catch (e) {
      setRollApiError(e.message);
    }
  };

  // FIX 8: Resistance critical → stressCost = -1 (clear 1 stress, pay none)
  const rollDice = (
    actionName,
    diceCount,
    isResistance = false,
    isDesperateAction = false,
  ) => {
    if (characterId && !isResistance) {
      setRollPending({ actionName, diceCount, isDesperateAction });
      setRollAbilityBoost({});
      setDevilBargainConfirmed(false);
      const asdGoal = (
        charCampaign?.active_session_detail?.roll_goal_label || ""
      ).trim();
      setRollGoalDraft(asdGoal);
      setAssistHelperId("");
      setRollModal({
        push_effect: false,
        push_dice: false,
        devil_bargain_dice: false,
        devil_bargain_note: "",
      });
      setRollApiError(null);
      return;
    }
    let dice, highest, sixes, isCritical, outcome;

    if (diceCount === 0) {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      highest = Math.min(d1, d2);
      dice = [d1, d2];
      sixes = 0;
      isCritical = false;
      outcome =
        highest >= 6 ? "Success" : highest >= 4 ? "Partial Success" : "Failure";
    } else {
      dice = Array.from(
        { length: diceCount },
        () => Math.floor(Math.random() * 6) + 1,
      );
      highest = Math.max(...dice);
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
    }

    // FIX 8: Critical resistance = 0 stress cost AND clear 1 stress; represented as -1
    const stressCost = isResistance
      ? isCritical
        ? -1
        : Math.max(0, 6 - highest)
      : null;

    setDiceResult({
      action: actionName,
      dice,
      result: highest,
      outcome,
      special: isCritical ? `Critical! (${sixes} sixes)` : "",
      isResistance,
      stressCost,
      zeroDice: diceCount === 0,
      isDesperateAction,
      isCritical,
    });

    if (isDesperateAction && !isResistance) {
      const attr = ACTION_ATTR[actionName];
      if (attr) setXp((p) => ({ ...p, [attr]: Math.min(p[attr] + 1, 5) }));
    }
  };

  const addClock = () => {
    const name = prompt("Clock name:");
    const segs = parseInt(prompt("Segments (1-12):") || "4", 10);
    if (name && !isNaN(segs) && segs >= 1 && segs <= 12)
      setClocks((p) => [
        ...p,
        { id: Date.now(), name, segments: segs, filled: 0, visible_to_party: false },
      ]);
  };

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
      regularArmorUsed,
      specialArmorUsed,
      harm,
      healingClock,
      coinFilled,
      stash: stashBoxes,
      xp,
      abilities,
      clocks,
      playbook,
      campaign: campaignId || null,
      image_url: imageUrl,
      ...(imageFile ? { imageFile } : {}),
      id: backendId,
      lastModified: new Date().toISOString(),
      selected_benefits: selectedBenefits,
      selected_detriments: selectedDetriments,
    };
  }, [
    charData,
    standStats,
    actionRatings,
    stressFilled,
    trauma,
    regularArmorUsed,
    specialArmorUsed,
    harm,
    healingClock,
    coinFilled,
    stashBoxes,
    xp,
    abilities,
    clocks,
    playbook,
    campaignId,
    imageUrl,
    imageFile,
    character?.id,
    selectedBenefits,
    selectedDetriments,
  ]);

  useEffect(() => {
    if (!onDraftMetaChange) return;
    const payload = buildPayload();
    const { lastModified, imageFile: _if, ...rest } = payload;
    const payloadKey = JSON.stringify(rest);
    if (payload.id && lastSavedPayloadRef.current == null) {
      lastSavedPayloadRef.current = payloadKey;
    }
    const isDirty = !payload.id
      ? hasMeaningfulDraftChanges(payload)
      : payloadKey !== (lastSavedPayloadRef.current ?? "");
    onDraftMetaChange({
      payload,
      isNewCharacter: !payload.id,
      isDirty,
    });
  }, [onDraftMetaChange, buildPayload]);

  // Debounced auto-save
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (savingRef.current || !onSave || !canEditSheet) return;
      if (heritagesLoading || heritages.length === 0) return;
      if (
        typeof charData.heritage !== "number" ||
        !Number.isFinite(charData.heritage)
      )
        return;
      const payload = buildPayload();
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
      // Skip save if payload matches last saved (prevents loop from server response overwriting fields)
      const { lastModified, imageFile: _img, ...rest } = payload;
      const payloadKey = JSON.stringify(rest);
      if (lastSavedPayloadRef.current === payloadKey) {
        return;
      }
      savingRef.current = true;
      setSaveStatus("saving");
      try {
        await onSave(payload);
        lastSavedPayloadRef.current = payloadKey;
        if (payload.imageFile) {
          setImageFile(null);
        }
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
      }
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
    regularArmorUsed,
    specialArmorUsed,
    harm,
    healingClock,
    coinFilled,
    stashBoxes,
    xp,
    abilities,
    clocks,
    playbook,
    campaignId,
    imageUrl,
    imageFile,
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
      fontFamily: "monospace",
      fontSize: "13px",
      background: "#000",
      color: "#fff",
      minHeight: "100vh",
    },
    hdr: {
      background: "#1f2937",
      padding: "8px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: "8px",
      borderBottom: "2px solid #6b7280",
      position: "sticky",
      top: 0,
      zIndex: 10,
    },
    card: {
      background: "#111827",
      border: "1px solid #374151",
      borderRadius: "4px",
      padding: "12px",
      marginBottom: "12px",
    },
    lbl: {
      color: "#f87171",
      fontSize: "11px",
      fontWeight: "bold",
      marginBottom: "4px",
      display: "block",
    },
    inp: {
      background: "transparent",
      color: "#fff",
      border: "none",
      borderBottom: "1px solid #4b5563",
      padding: "2px 4px",
      width: "100%",
      fontFamily: "monospace",
      fontSize: "13px",
      outline: "none",
      boxSizing: "border-box",
    },
    sel: {
      background: "#374151",
      color: "#fff",
      border: "1px solid #4b5563",
      padding: "4px 8px",
      fontSize: "12px",
      fontFamily: "monospace",
    },
    select: {
      background: "#0d1117",
      color: "#fff",
      border: "1px solid #374151",
      borderRadius: "4px",
      padding: "4px 8px",
      fontSize: "12px",
      fontFamily: "monospace",
      width: "100%",
    },
    btn: {
      padding: "4px 12px",
      borderRadius: "4px",
      fontSize: "12px",
      cursor: "pointer",
      border: "none",
      fontFamily: "monospace",
    },
    btnPrimary: {
      padding: "6px 14px",
      borderRadius: "4px",
      fontSize: "12px",
      cursor: "pointer",
      border: "none",
      fontFamily: "monospace",
      background: "#7c3aed",
      color: "#fff",
    },
    btnGhost: {
      padding: "6px 14px",
      borderRadius: "4px",
      fontSize: "12px",
      cursor: "pointer",
      border: "none",
      fontFamily: "monospace",
      background: "#374151",
      color: "#d1d5db",
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
      background: "#451a03",
      border: "1px solid #92400e",
      borderRadius: "4px",
      padding: "6px 10px",
      fontSize: "11px",
      color: "#fcd34d",
    },
    green: {
      background: "#14532d",
      border: "1px solid #166534",
      borderRadius: "4px",
      padding: "4px 8px",
      fontSize: "11px",
      color: "#86efac",
    },
  };

  const dotColor =
    dotsRemaining === 0
      ? "#f87171"
      : dotsRemaining <= 2
        ? "#eab308"
        : "#6b7280";

  const playerHeaderSubtitle =
    activeMode === "CHARACTER MODE"
      ? "PLAYER — CHARACTER SHEET"
      : "PLAYER — CREW SHEET";

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>
      {/* ── Header ── */}
      <div style={S.hdr}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{ fontSize: "18px", fontWeight: "bold", color: "#e5e7eb" }}
          >
            1(800)BIZARRE
          </span>
          <span style={{ color: "#9ca3af", fontSize: "14px" }}>◆</span>
          <span
            style={{ fontSize: "14px", color: "#9ca3af", fontWeight: "bold" }}
          >
            {playerHeaderSubtitle}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
                color: "#9ca3af",
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
          gap: 0,
          background: "#0d0d1a",
          borderBottom: "1px solid #2d1f52",
          padding: "6px 0",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveMode("CHARACTER MODE")}
          style={{
            padding: "6px 24px",
            fontSize: "12px",
            fontFamily: "monospace",
            fontWeight: "bold",
            border: "1px solid",
            borderColor:
              activeMode === "CHARACTER MODE" ? "#0f7662" : "#4b2d8f",
            cursor: "pointer",
            letterSpacing: "0.08em",
            background:
              activeMode === "CHARACTER MODE" ? "#0d9488" : "#1a0533",
            color: activeMode === "CHARACTER MODE" ? "#fff" : "#9ca3af",
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
            fontFamily: "monospace",
            fontWeight: "bold",
            border: "1px solid",
            borderColor:
              activeMode === "CREW MODE" ? "#5b21b6" : "#4b2d8f",
            cursor: "pointer",
            letterSpacing: "0.08em",
            background:
              activeMode === "CREW MODE" ? "#7c3aed" : "#1a0533",
            color: activeMode === "CREW MODE" ? "#fff" : "#9ca3af",
            borderRadius: "0 4px 4px 0",
          }}
        >
          CREW MODE
        </button>
      </div>

      <div style={{ padding: "16px", maxWidth: "1400px", margin: "0 auto" }}>
        {/* ══════════════════════════════════ CHARACTER MODE ══════════════════════════════════ */}
        {activeMode === "CHARACTER MODE" && (
          <>
            {!canEditSheet && (
              <div
                style={{
                  ...S.card,
                  marginBottom: "12px",
                  borderColor: "#92400e",
                  color: "#fcd34d",
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
                        onClick={() => setShowHistoryPanel((x) => !x)}
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
                          fontSize: "20px",
                          fontWeight: "bold",
                          lineHeight: 1,
                          color:
                            pcLevel >= 7
                              ? "#f87171"
                              : pcLevel >= 4
                                ? "#fbbf24"
                                : "#a5b4fc",
                        }}
                      >
                        {pcLevel}
                      </div>
                      <div
                        style={{
                          fontSize: "9px",
                          color: "#4b5563",
                          marginTop: "1px",
                        }}
                      >
                        {totalSpentXP} XP spent
                      </div>
                    </div>
                  </div>
                  {showHistoryPanel && (
                    <div
                      style={{
                        background: "#111827",
                        border: "1px solid #374151",
                        borderRadius: 8,
                        padding: 10,
                        minWidth: 260,
                        maxWidth: 520,
                        maxHeight: 320,
                        overflowY: "auto",
                        fontSize: 11,
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
                        <button
                          type="button"
                          onClick={() => setHistoryCollapsed((v) => !v)}
                          style={{
                            ...S.btn,
                            padding: "2px 8px",
                            fontSize: 10,
                            background: "#1f2937",
                          }}
                        >
                          {historyCollapsed ? "Expand" : "Collapse"}
                        </button>
                      </div>
                      {!historyCollapsed && (
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
                                  historyMode === "sheet" ? "#312e81" : "#1f2937",
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
                                  historyMode === "session" ? "#312e81" : "#1f2937",
                              }}
                            >
                              Session History
                            </button>
                          </div>
                          {historyMode === "session" && (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 6,
                                marginBottom: 8,
                              }}
                            >
                              <select
                                value={historySessionId || ""}
                                onChange={(e) =>
                                  setHistorySessionId(
                                    e.target.value ? Number(e.target.value) : null,
                                  )
                                }
                                style={{ ...S.sel, fontSize: 10, padding: "2px 6px" }}
                              >
                                <option value="">No session</option>
                                {(charCampaign?.sessions || []).map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name || `Session ${s.id}`}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={historyCharacterFilter}
                                onChange={(e) =>
                                  setHistoryCharacterFilter(e.target.value)
                                }
                                style={{ ...S.sel, fontSize: 10, padding: "2px 6px" }}
                              >
                                <option value="all">All players</option>
                                {(charCampaign?.campaign_characters || []).map((pc) => (
                                  <option key={pc.id} value={pc.id}>
                                    {pc.true_name || pc.name || `PC ${pc.id}`}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          {historyLoading ? (
                            <div style={{ color: "#6b7280" }}>Loading history…</div>
                          ) : historyError ? (
                            <div style={{ color: "#fca5a5" }}>{historyError}</div>
                          ) : historyRows.length === 0 ? (
                            <div style={{ color: "#6b7280" }}>
                              No history entries.
                            </div>
                          ) : (
                            historyRows.slice(0, 120).map((row) => (
                              <div
                                key={row.key}
                                style={{
                                  padding: "6px 0",
                                  borderBottom: "1px solid #1f2937",
                                }}
                              >
                                <div style={{ color: "#9ca3af", fontSize: 10 }}>
                                  {row.timestamp
                                    ? new Date(row.timestamp).toLocaleString()
                                    : "No timestamp"}{" "}
                                  · {row.actor || "unknown"}
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
                            ))
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
                {onCreateNew && (
                  <button
                    onClick={onCreateNew}
                    style={{ ...S.btn, background: "#16a34a", color: "#fff" }}
                  >
                    + New Character
                  </button>
                )}
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
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          style={{ display: "none" }}
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          style={{
                            ...S.btn,
                            fontSize: "9px",
                            padding: "2px 6px",
                            background: "#1f2937",
                            color: "#9ca3af",
                          }}
                        >
                          Upload
                        </button>
                        <button
                          onClick={handleImageUrlPrompt}
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
                      </div>
                    </div>
                    {/* Identity fields */}
                    <div style={{ flex: 1 }}>
                      <div style={S.g2}>
                        <div>
                          <span style={S.lbl}>NAME</span>
                          <input
                            style={S.inp}
                            value={charData.name}
                            onChange={(e) =>
                              setCharData((p) => ({
                                ...p,
                                name: e.target.value,
                              }))
                            }
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
                          gridTemplateColumns: "1fr 1fr 1fr",
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
                  {/* FIX 4: stress max labeled with durability contribution */}
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
                      {DUR_TABLE[durVal].stressBonus !== 0 && (
                        <span
                          style={{
                            color:
                              DUR_TABLE[durVal].stressBonus > 0
                                ? "#34d399"
                                : "#f87171",
                          }}
                        >
                          {" "}
                          ({DUR_TABLE[durVal].stressBonus > 0 ? "+" : ""}
                          {DUR_TABLE[durVal].stressBonus} DUR)
                        </span>
                      )}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "3px",
                      flexWrap: "wrap",
                      marginBottom: "12px",
                    }}
                  >
                    {Array.from({ length: maxStress }, (_, i) => (
                      <div
                        key={i}
                        onClick={() =>
                          setStressFilled(i < stressFilled ? i : i + 1)
                        }
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
                          onChange={() =>
                            setTrauma((p) => ({ ...p, [t]: !p[t] }))
                          }
                        />
                        {t}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Harm + Armor */}
                <div style={S.card}>
                  <div style={{ display: "flex", gap: "16px" }}>
                    <div style={{ flex: 1 }}>
                      <span style={S.lbl}>HARM</span>
                      {[
                        { key: "level4", label: "FATAL", count: 1 },
                        { key: "level3", label: "NEED HELP", count: 1 },
                        { key: "level2", label: "-1D", count: 2 },
                        { key: "level1", label: "LESS EFFECT", count: 2 },
                      ].map(({ key, label, count }) =>
                        Array.from({ length: count }, (_, idx) => (
                          <div
                            key={`${key}-${idx}`}
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
                                  row[idx] = e.target.value;
                                  return { ...p, [key]: row };
                                })
                              }
                            />
                          </div>
                        )),
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span style={{ fontSize: "10px", color: "#9ca3af" }}>
                        HEALING
                      </span>
                      <ProgressClock
                        size={55}
                        segments={4}
                        filled={healingClock}
                        interactive
                        onClick={setHealingClock}
                      />
                    </div>

                    {/* FIX 4: Armor charges derived from Durability */}
                    <div style={{ minWidth: "90px" }}>
                      <span
                        style={{
                          fontSize: "10px",
                          color: "#9ca3af",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        ARMOR
                        <span style={{ color: "#f59e0b", marginLeft: "4px" }}>
                          ({maxArmorCharges} chg)
                        </span>
                      </span>
                      {maxArmorCharges === 0 ? (
                        <div style={{ fontSize: "10px", color: "#6b7280" }}>
                          F-DUR: no armor
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            gap: "3px",
                            marginBottom: "6px",
                          }}
                        >
                          {Array.from({ length: maxArmorCharges }, (_, i) => (
                            <div
                              key={i}
                              onClick={() =>
                                setRegularArmorUsed(
                                  i < regularArmorUsed ? i : i + 1,
                                )
                              }
                              title={
                                i < regularArmorUsed
                                  ? "Used — click to restore"
                                  : "Click to spend"
                              }
                              style={{
                                width: "20px",
                                height: "20px",
                                border: "1px solid #4b5563",
                                cursor: "pointer",
                                background:
                                  i < regularArmorUsed ? "#b45309" : "#1f2937",
                              }}
                            />
                          ))}
                        </div>
                      )}
                      <label
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
                          checked={specialArmorUsed}
                          onChange={(e) =>
                            setSpecialArmorUsed(e.target.checked)
                          }
                        />
                        SPECIAL
                      </label>
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
                </div>

                {/* XP & Advancement */}
                <div style={S.card}>
                  <span style={S.lbl}>EXPERIENCE TRACKS</span>
                  {[
                    { name: "INSIGHT", key: "insight", max: 5 },
                    { name: "PROWESS", key: "prowess", max: 5 },
                    { name: "RESOLVE", key: "resolve", max: 5 },
                    { name: "HERITAGE", key: "heritage", max: 5 },
                    { name: "PLAYBOOK", key: "playbook", max: 10 },
                  ].map(({ name, key, max }) => (
                    <div
                      key={key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "4px",
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
                        {Array.from({ length: max }, (_, i) => (
                          <div
                            key={i}
                            onClick={() => toggleXP(key, i)}
                            style={{
                              width: "13px",
                              height: "13px",
                              border: "1px solid #4b5563",
                              cursor: "pointer",
                              background: i < xp[key] ? "#7c3aed" : "#111827",
                            }}
                          />
                        ))}
                      </div>
                      <span style={{ fontSize: "10px", color: "#6b7280" }}>
                        ({xp[key]}/{max})
                      </span>
                    </div>
                  ))}

                  {/* Advancement panel */}
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "10px",
                      background: "#0d1117",
                      borderRadius: "4px",
                      border: "1px solid #30363d",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "8px",
                      }}
                    >
                      <span style={{ color: "#a78bfa", fontWeight: "bold" }}>
                        Total XP: {totalXP}
                      </span>
                      {/* FIX 5: Development session XP display */}
                      {sessionDevXP > 0 ? (
                        <span style={{ ...S.info, padding: "2px 6px" }}>
                          +{sessionDevXP} XP/session (DEV {GRADE[devVal]})
                        </span>
                      ) : (
                        <span style={{ fontSize: "10px", color: "#4b5563" }}>
                          DEV F — standard XP only
                        </span>
                      )}
                    </div>

                    {/* FIX 6: Corrected level-up description */}
                    <div
                      style={{
                        fontSize: "11px",
                        padding: "8px",
                        background: "#111827",
                        borderRadius: "4px",
                        border: "1px solid #374151",
                        marginBottom: "8px",
                      }}
                    >
                      <div
                        style={{
                          color: "#d1d5db",
                          fontWeight: "bold",
                          marginBottom: "3px",
                        }}
                      >
                        LEVEL UP — 10 XP
                      </div>
                      <div style={{ color: "#9ca3af", marginBottom: "2px" }}>
                        Choose ONE option:
                      </div>
                      <div style={{ color: "#c4b5fd" }}>
                        A — +1 Stand Coin grade (any stat)
                      </div>
                      <div style={{ color: "#c4b5fd", marginBottom: "4px" }}>
                        B — +2 Action dots (any 2 actions; can exceed 2)
                      </div>
                      <div style={{ color: "#6b7280", fontSize: "10px" }}>
                        ★ A new ability is always included free. If the stat
                        just reached A-rank, your ability is automatically
                        unlocked.
                      </div>
                    </div>

                    {totalXP >= 10 ? (
                      <button
                        onClick={() => setShowLevelUp(true)}
                        style={{
                          ...S.btn,
                          background: "#7c3aed",
                          color: "#fff",
                          width: "100%",
                          marginBottom: "10px",
                          fontWeight: "bold",
                        }}
                      >
                        ⬆ LEVEL UP AVAILABLE
                      </button>
                    ) : (
                      <div
                        style={{
                          ...S.warn,
                          marginBottom: "10px",
                          textAlign: "center",
                        }}
                      >
                        {10 - totalXP} more XP needed to level up
                      </div>
                    )}

                    {/* FIX 7: Minor advance — 5 XP → +1 action dot */}
                    <div
                      style={{
                        borderTop: "1px solid #1f2937",
                        paddingTop: "8px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#d1d5db",
                          fontWeight: "bold",
                          marginBottom: "2px",
                        }}
                      >
                        MINOR ADVANCE — 5 XP
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#6b7280",
                          marginBottom: "6px",
                        }}
                      >
                        +1 Action dot, outside level-up (max 4 per action)
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <select
                          value={minorAdvanceAction}
                          onChange={(e) =>
                            setMinorAdvanceAction(e.target.value)
                          }
                          style={{ ...S.sel, flex: 1, fontSize: "11px" }}
                        >
                          {Object.keys(actionRatings).map((a) => (
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
                        <button
                          onClick={spendXPForDot}
                          disabled={
                            totalXP < 5 ||
                            actionRatings[minorAdvanceAction] >= 4
                          }
                          style={{
                            ...S.btn,
                            fontSize: "11px",
                            background:
                              totalXP >= 5 &&
                              actionRatings[minorAdvanceAction] < 4
                                ? "#4338ca"
                                : "#374151",
                            color:
                              totalXP >= 5 &&
                              actionRatings[minorAdvanceAction] < 4
                                ? "#fff"
                                : "#6b7280",
                          }}
                        >
                          −5 XP
                        </button>
                      </div>
                      {totalXP < 5 && (
                        <div style={{ ...S.warn, marginTop: "4px" }}>
                          {5 - totalXP} more XP needed
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "10px",
                      fontSize: "11px",
                      color: "#9ca3af",
                      lineHeight: "1.7",
                    }}
                  >
                    <span style={S.lbl}>MARK XP WHEN YOU…</span>
                    🔷 Make a desperate action roll — +1 XP in that attribute
                    <br />
                    🔷 Express beliefs, drives, heritage, or background
                    <br />
                    🔷 Struggle with your vice, trauma, or crew entanglements
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
                    <select
                      value={playbook}
                      onChange={(e) => setPlaybook(e.target.value)}
                      style={S.sel}
                    >
                      <option>Stand</option>
                      <option>Hamon</option>
                      <option>Spin</option>
                    </select>
                  </div>
                  {((playbook === "Stand" &&
                    standardAbilitiesList.length === 0) ||
                    (playbook === "Hamon" && hamonAbilitiesList.length === 0) ||
                    (playbook === "Spin" &&
                      spinAbilitiesList.length === 0)) && (
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

                  {/* Stand Coin Stats — FIX 2 + 3 + 4 + 5 */}
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
                              totalStandPoints > 6
                                ? "#f87171"
                                : totalStandPoints === 6
                                  ? "#34d399"
                                  : "#6b7280",
                          }}
                        >
                          {totalStandPoints}/6 pts
                        </span>
                      </div>

                      {totalStandPoints > 6 && (
                        <div style={{ ...S.warn, marginBottom: "8px" }}>
                          Over budget by {totalStandPoints - 6} point
                          {totalStandPoints - 6 > 1 ? "s" : ""} — reduce a stat
                        </div>
                      )}

                      <NpcsStandCoin
                        variant="pc"
                        pcMaxGrade={pcStandCoinMaxLetter}
                        grades={standCoinGrades}
                        readouts={pcStandCoinReadouts}
                        onStep={bumpStandCoinGrade}
                      />

                      <div
                        style={{
                          fontSize: "10px",
                          color: "#4b5563",
                          marginTop: "8px",
                          lineHeight: 1.45,
                        }}
                      >
                        {maxStandGradeIndex >= 5
                          ? "S-rank is enabled for this character by the GM. Hover or focus a wedge to see grade rules."
                          : "Player max is A unless the GM enables S-rank for this character. Hover or focus a wedge to see grade rules."}
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
                          color: pcLevel >= 4 ? "#fbbf24" : "#34d399",
                          fontWeight: "bold",
                        }}
                      >
                        Lv {pcLevel}
                      </span>
                    </div>
                  </div>

                  {/* Session info the table shares with this sheet (wanted, clocks, position/effect when enabled). */}
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
                      {(
                        charCampaign?.active_session_detail
                          ?.session_npcs_with_clocks || []
                      ).length > 0 && (
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
                            {(
                              charCampaign?.active_session_detail
                                ?.session_npcs_with_clocks || []
                            ).map((npc) => (
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
                                {npc.harm_clock_max > 0 && (
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
                                      segments={npc.harm_clock_max}
                                      filled={npc.harm_clock_current}
                                    />
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        color: "#9ca3af",
                                      }}
                                    >
                                      Harm {npc.harm_clock_current}/
                                      {npc.harm_clock_max}
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
                                    {npc.harm_clock_max > 0 && (
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
                                          segments={npc.harm_clock_max}
                                          filled={npc.harm_clock_current || 0}
                                        />
                                        <span
                                          style={{
                                            fontSize: "10px",
                                            color: "#9ca3af",
                                          }}
                                        >
                                          Harm {npc.harm_clock_current || 0}/
                                          {npc.harm_clock_max}
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
                      <div style={{ marginBottom: "8px" }}>
                        <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                          Clocks:{" "}
                        </span>
                        {(charCampaign.progress_clocks || []).filter((clk) => {
                          const creator = Number(clk.created_by);
                          const gmId = Number(charCampaign?.gm);
                          return creator && creator === gmId;
                        }).length > 0 ? (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "12px",
                              alignItems: "center",
                              marginTop: "4px",
                            }}
                          >
                            {(charCampaign.progress_clocks || [])
                              .filter((clk) => {
                                const creator = Number(clk.created_by);
                                const gmId = Number(charCampaign?.gm);
                                return creator && creator === gmId;
                              })
                              .map((clk) => {
                              const canEdit =
                                isGM || clk.created_by === user?.id;
                              return (
                                <div
                                  key={clk.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                  }}
                                >
                                  <div style={{ textAlign: "center" }}>
                                    <ProgressClock
                                      size={44}
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
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        color: "#6b7280",
                                        display: "block",
                                      }}
                                    >
                                      {clk.name}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        color: "#9ca3af",
                                      }}
                                    >
                                      {clk.filled_segments}/{clk.max_segments}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span style={{ fontSize: "12px", color: "#6b7280" }}>
                            None
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* FIX 1: Action Ratings — creation dot budget */}
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
                      >
                        {totalActionDots}/{MAX_CREATION_DOTS} dots{" "}
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
                      ].map(({ attr, actions }) => (
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
                                onClick={() =>
                                  rollDice(
                                    attr,
                                    getAttributeDice(actions),
                                    true,
                                  )
                                }
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
                                  "Resistance Roll"
                                }
                              >
                                🎲
                              </button>
                            </span>
                            <div style={{ display: "flex", gap: "2px" }}>
                              {[1, 2, 3, 4].map((d) => (
                                <div
                                  key={d}
                                  style={{
                                    width: "7px",
                                    height: "7px",
                                    borderRadius: "50%",
                                    border: "1px solid #4b5563",
                                    background:
                                      d <= getAttributeDice(actions)
                                        ? "#3b82f6"
                                        : "#1f2937",
                                  }}
                                />
                              ))}
                            </div>
                          </div>
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
                                      title={`Roll ${rating}d`}
                                    >
                                      🎲
                                    </button>
                                  </span>
                                  <div
                                    style={{ display: "flex", gap: "2px" }}
                                    data-dot-edit
                                  >
                                    {[1, 2, 3, 4].map((d) => {
                                      const filled = d <= rating;
                                      const isAdvDot =
                                        d > MAX_DOTS_PER_ACTION_CREATION; // dots 3-4 require advancement
                                      return (
                                        <div
                                          key={d}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (isAdvDot) return; // not clickable during creation
                                            updateActionRating(
                                              action,
                                              d <= rating ? d - 1 : d,
                                            );
                                          }}
                                          title={
                                            isAdvDot
                                              ? filled
                                                ? `Dot ${d} — gained via advancement`
                                                : `Dot ${d} — unlock via advancement`
                                              : dotsRemaining === 0 && !filled
                                                ? "No creation dots remaining"
                                                : ""
                                          }
                                          style={{
                                            width: "12px",
                                            height: "12px",
                                            borderRadius: "50%",
                                            border: `1px solid ${isAdvDot ? "#374151" : "#6b7280"}`,
                                            cursor: isAdvDot
                                              ? "default"
                                              : "pointer",
                                            background: filled
                                              ? isAdvDot
                                                ? "#a78bfa"
                                                : "#7c3aed"
                                              : "#111827",
                                            opacity:
                                              isAdvDot && !filled ? 0.2 : 1,
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
                      ))}
                    </div>
                  </div>

                  {/* Action roll — dice pool preview (session) or roll result; same slot under action ratings */}
                  {rollPending && characterId && (
                    <div
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
                        Dice pool — {rollPending.actionName}
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#6b7280",
                          marginBottom: "12px",
                        }}
                      >
                        Preview your pool, check position and effect, add push /
                        assist / bargain, then roll. Cancel to pick another
                        action.
                      </div>
                      {harmLevel3Used &&
                        !rollModal.push_effect &&
                        !rollModal.push_dice && (
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
                            Incapacitated (Level 3 harm). You must push yourself
                            to act (2 stress for +1 effect or +1d).
                          </div>
                        )}
                      {charCampaign?.active_session_detail
                        ?.show_position_effect_to_players !== false ? (
                        <div
                          style={{
                            display: "flex",
                            gap: "16px",
                            flexWrap: "wrap",
                            marginBottom: "12px",
                            alignItems: "flex-end",
                          }}
                        >
                          <div>
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
                          <div>
                            <div
                              style={{
                                fontSize: "10px",
                                color: "#9ca3af",
                                marginBottom: "4px",
                              }}
                            >
                              Effect (this action)
                            </div>
                            <EffectShapes
                              activeEffect={
                                sessionOverridePositionEffect?.effect ||
                                charCampaign?.active_session_detail
                                  ?.default_effect ||
                                "standard"
                              }
                              readOnly
                            />
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#9ca3af",
                            marginBottom: "12px",
                          }}
                        >
                          Position and effect are hidden for this session — check
                          with the table before rolling.
                        </div>
                      )}
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
                            (
                              charCampaign?.active_session_detail
                                ?.roll_goal_label || ""
                            ).trim() ||
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
                          <DicePoolStrip
                            label="Action rating (dice in this action only)"
                            count={rollPoolPreview.action_rating}
                          />
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
                          {assistHelperId ? (
                            <DicePoolStrip
                              label="Assist (+1d, helper spends 1 stress)"
                              count={1}
                            />
                          ) : null}
                          {bonusDiceFromAbilities > 0 ? (
                            <DicePoolStrip
                              label={`Standard abilities (+${bonusDiceFromAbilities}d)`}
                              count={bonusDiceFromAbilities}
                            />
                          ) : null}
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#d1d5db",
                              marginTop: "6px",
                              paddingTop: "8px",
                              borderTop: "1px solid #374151",
                            }}
                          >
                            Total dice: <strong>{rollPoolPreview.total}</strong>
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
                              stress when this roll resolves (push).
                            </div>
                          ) : null}
                        </div>
                      )}
                      {(abilities || []).filter((a) => a.type === "standard")
                        .length > 0 && (
                        <div style={{ marginBottom: "12px" }}>
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#9ca3af",
                              marginBottom: "6px",
                            }}
                          >
                            Standard abilities (optional)
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
                            {(abilities || [])
                              .filter((a) => a.type === "standard")
                              .slice(0, 16)
                              .map((ab) => {
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
                                    >
                                      {ab.name}
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
                                  </div>
                                );
                              })}
                          </div>
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
                          ["none", "None"],
                          ["push_effect", "Push for +1 effect (2 stress)"],
                          ["push_dice", "Push for +1d (2 stress)"],
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
                      <div style={{ marginBottom: "12px" }}>
                        <div style={{ marginTop: "8px" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              color: "#9ca3af",
                              display: "block",
                              marginBottom: "4px",
                            }}
                          >
                            Assist (one teammate, +1d, helper pays 1 stress)
                          </span>
                          <select
                            style={{ ...S.sel, width: "100%", maxWidth: 320 }}
                            value={assistHelperId}
                            onChange={(e) => setAssistHelperId(e.target.value)}
                          >
                            <option value="">No assist</option>
                            {helpCandidates.map((c) => (
                              <option key={c.id} value={String(c.id)}>
                                {c.true_name || c.name || `PC ${c.id}`}
                              </option>
                            ))}
                          </select>
                        </div>
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
                      {(bonusDiceFromAbilities > 0 ||
                        abilityEffectSteps > 0) && (
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#6b7280",
                            marginBottom: "8px",
                          }}
                        >
                          Pool: +{bonusDiceFromAbilities}d from abilities
                          {abilityEffectSteps > 0
                            ? `, +${abilityEffectSteps} effect tier step(s)`
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
                            (harmLevel3Used &&
                              !rollModal.push_effect &&
                              !rollModal.push_dice) ||
                            (rollModal.devil_bargain_dice &&
                              ((gmDevilBargainText && !devilBargainConfirmed) ||
                                (!gmDevilBargainText &&
                                  !(
                                    rollModal.devil_bargain_note || ""
                                  ).trim())))
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
                            setRollGoalDraft("");
                            setAssistHelperId("");
                            setDevilBargainConfirmed(false);
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

                  {/* Dice result — same slot under action ratings (after pool or resistance / offline roll) */}
                  {diceResult && !rollPending && (
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
                        {diceResult.action}{" "}
                        {diceResult.isResistance
                          ? "Resistance Roll"
                          : "Action Roll"}
                        {diceResult.zeroDice && (
                          <span style={{ color: "#f87171", marginLeft: "8px" }}>
                            (0 Dice — take lower)
                          </span>
                        )}
                        {diceResult.isDesperateAction && (
                          <span style={{ color: "#f97316", marginLeft: "8px" }}>
                            (Desperate — XP marked)
                          </span>
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
                          {diceResult.dice.map((die, i) => (
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
                        {diceResult.special && (
                          <span style={{ color: "#fbbf24" }}>
                            {diceResult.special}
                          </span>
                        )}
                        {(diceResult.position || diceResult.effect) &&
                          !diceResult.isResistance && (
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
                                Stress Cost: {diceResult.stressCost}
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
                              <button
                                onClick={() => {
                                  const cost = diceResult.stressCost ?? 0;
                                  setStressFilled((prev) =>
                                    Math.min(maxStress, prev + cost),
                                  );
                                }}
                                style={{
                                  ...S.btn,
                                  background: "#b45309",
                                  color: "#fff",
                                  fontSize: "11px",
                                }}
                              >
                                Apply {diceResult.stressCost} stress
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {!diceResult.isResistance &&
                        !diceResult.isDesperateAction && (
                          <button
                            onClick={() => {
                              const attr = ACTION_ATTR[diceResult.action];
                              if (attr)
                                setXp((p) => ({
                                  ...p,
                                  [attr]: Math.min(p[attr] + 1, 5),
                                }));
                              setDiceResult((p) => ({
                                ...p,
                                isDesperateAction: true,
                              }));
                            }}
                            style={{
                              ...S.btn,
                              background: "#c2410c",
                              color: "#fff",
                              marginTop: "6px",
                              fontSize: "11px",
                            }}
                          >
                            Mark as Desperate (+1 XP)
                          </button>
                        )}
                      <button
                        onClick={() => setDiceResult(null)}
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
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#9ca3af",
                          marginTop: "8px",
                          marginBottom: "10px",
                          lineHeight: 1.4,
                        }}
                      >
                        <strong style={{ color: "#d1d5db" }}>Assist:</strong>{" "}
                        when you roll an action (dice pool), pick a teammate
                        there — they spend 1 stress and add +1d to your pool.
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "10px",
                          alignItems: "flex-end",
                          marginTop: "8px",
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
                            Group action goal
                          </span>
                          <input
                            style={{ ...S.inp, width: "100%", maxWidth: 320 }}
                            value={groupGoalDraft}
                            onChange={(e) => setGroupGoalDraft(e.target.value)}
                            placeholder="Name the group action"
                          />
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
                              disabled={groupBusy}
                              onClick={async () => {
                                setGroupBusy(true);
                                try {
                                  setGroupActionErr(null);
                                  const ga = await groupActionAPI.create({
                                    session: activeSessionId,
                                    leader: characterId,
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
                                Open group #{activeGroupAction.id} — rolls
                                attach until resolved.
                              </span>
                            )}
                            {activeGroupAction?.id && isGM && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await groupActionAPI.resolve(
                                      activeGroupAction.id,
                                    );
                                    setActiveGroupAction(null);
                                    onCampaignRefresh?.();
                                  } catch (e) {
                                    setGroupActionErr(e.message);
                                  }
                                }}
                                style={{
                                  ...S.btn,
                                  fontSize: "11px",
                                  background: "#7c3aed",
                                  color: "#fff",
                                }}
                              >
                                Resolve
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
                        {!xpTimelineLoading &&
                          !xpTimelineError &&
                          xpTimelineRows.length === 0 && (
                            <div style={{ color: "#6b7280", fontSize: "12px" }}>
                              No XP entries yet.
                            </div>
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
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Abilities */}
                  <div style={{ marginBottom: "14px" }}>
                    <span style={S.lbl}>ABILITIES</span>
                    {abilities.map((ab, abIndex) => {
                      const abKey = ab.id || ab.name || `ability-${abIndex}`;
                      const isExpanded = expandedAbilityId === abKey;
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
                                background: "#7c3aed",
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
                          </div>
                          {ab.type === "custom" && (
                            <button
                              type="button"
                              aria-label={`Edit ${ab.name || "ability"}`}
                              onClick={() => {
                                const customs = abilities.filter(
                                  (a) => a.type === "custom",
                                );
                                const single = customs.find(
                                  (a) => a.id === "custom-single" || a._uses,
                                );
                                if (single && single._uses) {
                                  setCustomAbilityModal({
                                    type: "single_with_3_uses",
                                    name: single.name || "",
                                    uses: [
                                      ...(single._uses || []),
                                      "",
                                      "",
                                      "",
                                    ].slice(0, 3),
                                    items: [
                                      { name: "", description: "" },
                                      { name: "", description: "" },
                                      { name: "", description: "" },
                                    ],
                                  });
                                } else {
                                  const three = customs.filter((a) => !a._uses);
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
                                  while (items.length < 3)
                                    items.push({ name: "", description: "" });
                                  setCustomAbilityModal({
                                    type: "three_separate_uses",
                                    name: "",
                                    uses: ["", "", ""],
                                    items: items.slice(0, 3),
                                  });
                                }
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
                          <button
                            type="button"
                            aria-label={`Remove ${ab.name || "ability"}`}
                            onClick={() =>
                              setAbilities((p) =>
                                p.filter((_, i) => i !== abIndex),
                              )
                            }
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
                                    if (
                                      !abilities.some(
                                        (a) =>
                                          a.type === "standard" &&
                                          a.id === standardAbilitySelected.id,
                                      )
                                    ) {
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
                            + Spin abilities
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
                                  const need = (a) =>
                                    typeof a.required_a_count === "number"
                                      ? a.required_a_count
                                      : 0;
                                  const available = spinAbilitiesList.filter(
                                    (a) =>
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
                                      const req = need(a);
                                      const met = aRankCount >= req;
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
                                            {req === 0
                                              ? "Foundation"
                                              : `${req} A-rank coin stat${req === 1 ? "" : "s"} (${aRankCount} have)`}
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
                                    const req =
                                      typeof spinAbilitySelected.required_a_count ===
                                      "number"
                                        ? spinAbilitySelected.required_a_count
                                        : 0;
                                    const canAdd = aRankCount >= req;
                                    return (
                                      <>
                                        {!canAdd && (
                                          <div
                                            style={{
                                              color: "#f87171",
                                              marginTop: "8px",
                                              fontSize: "11px",
                                            }}
                                          >
                                            Needs {req} A-rank coin stat
                                            {req === 1 ? "" : "s"} (you have{" "}
                                            {aRankCount}).
                                          </div>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (!canAdd) return;
                                            if (
                                              !abilities.some(
                                                (x) =>
                                                  x.type === "spin" &&
                                                  x.id ===
                                                    spinAbilitySelected.id,
                                              )
                                            ) {
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
                                          disabled={!canAdd}
                                          style={{
                                            ...S.btn,
                                            background: canAdd
                                              ? "#7c3aed"
                                              : "#374151",
                                            color: "#fff",
                                            fontSize: "11px",
                                            marginTop: "8px",
                                            cursor: canAdd
                                              ? "pointer"
                                              : "not-allowed",
                                          }}
                                        >
                                          Add to sheet
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
                            + Hamon abilities
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
                                  const need = (a) =>
                                    typeof a.required_a_count === "number"
                                      ? a.required_a_count
                                      : 0;
                                  const available = hamonAbilitiesList.filter(
                                    (a) =>
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
                                      const req = need(a);
                                      const met = aRankCount >= req;
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
                                            {req === 0
                                              ? "Foundation"
                                              : `${req} A-rank coin stat${req === 1 ? "" : "s"} (${aRankCount} have)`}
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
                                    const req =
                                      typeof hamonAbilitySelected.required_a_count ===
                                      "number"
                                        ? hamonAbilitySelected.required_a_count
                                        : 0;
                                    const canAdd = aRankCount >= req;
                                    return (
                                      <>
                                        {!canAdd && (
                                          <div
                                            style={{
                                              color: "#f87171",
                                              marginTop: "8px",
                                              fontSize: "11px",
                                            }}
                                          >
                                            Needs {req} A-rank coin stat
                                            {req === 1 ? "" : "s"} (you have{" "}
                                            {aRankCount}).
                                          </div>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (!canAdd) return;
                                            if (
                                              !abilities.some(
                                                (x) =>
                                                  x.type === "hamon" &&
                                                  x.id ===
                                                    hamonAbilitySelected.id,
                                              )
                                            ) {
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
                                          disabled={!canAdd}
                                          style={{
                                            ...S.btn,
                                            background: canAdd
                                              ? "#b45309"
                                              : "#374151",
                                            color: "#fff",
                                            fontSize: "11px",
                                            marginTop: "8px",
                                            cursor: canAdd
                                              ? "pointer"
                                              : "not-allowed",
                                          }}
                                        >
                                          Add to sheet
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
                      <button
                        onClick={() => {
                          const customs = abilities.filter(
                            (a) => a.type === "custom",
                          );
                          const single = customs.find(
                            (a) => a.id === "custom-single" || a._uses,
                          );
                          if (single && single._uses) {
                            setCustomAbilityModal({
                              type: "single_with_3_uses",
                              name: single.name || "",
                              uses: [...(single._uses || []), "", "", ""].slice(
                                0,
                                3,
                              ),
                              items: [
                                { name: "", description: "" },
                                { name: "", description: "" },
                                { name: "", description: "" },
                              ],
                            });
                          } else if (customs.length > 0) {
                            const three = customs.filter((a) => !a._uses);
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
                            while (items.length < 3)
                              items.push({ name: "", description: "" });
                            setCustomAbilityModal({
                              type: "three_separate_uses",
                              name: "",
                              uses: ["", "", ""],
                              items: items.slice(0, 3),
                            });
                          } else {
                            setCustomAbilityModal({
                              type: "single_with_3_uses",
                              name: "",
                              uses: ["", "", ""],
                              items: [
                                { name: "", description: "" },
                                { name: "", description: "" },
                                { name: "", description: "" },
                              ],
                            });
                          }
                        }}
                        style={{
                          ...S.btn,
                          background: "#16a34a",
                          color: "#fff",
                          fontSize: "11px",
                        }}
                      >
                        + Custom
                      </button>
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
                              Custom Ability (SRD: 3x1 or 1x3)
                            </span>
                            <div
                              style={{
                                fontSize: "11px",
                                color: "#9ca3af",
                                marginBottom: "12px",
                              }}
                            >
                              Give a custom name and list either 3 individual
                              abilities or 1 ability that does 3 things.
                            </div>
                            <div style={{ marginBottom: "12px" }}>
                              <span
                                style={{ fontSize: "11px", color: "#9ca3af" }}
                              >
                                Type
                              </span>
                              <select
                                style={S.select}
                                value={customAbilityModal.type}
                                onChange={(e) =>
                                  setCustomAbilityModal((p) => ({
                                    ...p,
                                    type: e.target.value,
                                  }))
                                }
                              >
                                <option value="single_with_3_uses">
                                  1 ability with 3 uses
                                </option>
                                <option value="three_separate_uses">
                                  3 abilities, 1 use each
                                </option>
                              </select>
                            </div>
                            {customAbilityModal.type ===
                            "single_with_3_uses" ? (
                              <>
                                <div style={{ marginBottom: "8px" }}>
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      color: "#9ca3af",
                                    }}
                                  >
                                    Custom ability name (required)
                                  </span>
                                  <input
                                    style={S.inp}
                                    value={customAbilityModal.name}
                                    onChange={(e) =>
                                      setCustomAbilityModal((p) => ({
                                        ...p,
                                        name: e.target.value,
                                      }))
                                    }
                                    placeholder="Ability name"
                                  />
                                </div>
                                {[0, 1, 2].map((i) => (
                                  <div key={i} style={{ marginBottom: "8px" }}>
                                    <span
                                      style={{
                                        fontSize: "11px",
                                        color: "#9ca3af",
                                      }}
                                    >
                                      Use {i + 1} (required)
                                    </span>
                                    <input
                                      style={S.inp}
                                      value={customAbilityModal.uses?.[i] || ""}
                                      onChange={(e) => {
                                        const u = [
                                          ...(customAbilityModal.uses || [
                                            "",
                                            "",
                                            "",
                                          ]),
                                        ];
                                        u[i] = e.target.value;
                                        setCustomAbilityModal((p) => ({
                                          ...p,
                                          uses: u,
                                        }));
                                      }}
                                      placeholder={`Use ${i + 1} description`}
                                    />
                                  </div>
                                ))}
                              </>
                            ) : (
                              <>
                                <div style={{ marginBottom: "8px" }}>
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      color: "#9ca3af",
                                    }}
                                  >
                                    Custom ability set name (optional)
                                  </span>
                                  <input
                                    style={S.inp}
                                    value={customAbilityModal.groupName || ""}
                                    onChange={(e) =>
                                      setCustomAbilityModal((p) => ({
                                        ...p,
                                        groupName: e.target.value,
                                      }))
                                    }
                                    placeholder="e.g. My Stand's Tricks"
                                  />
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
                                        customAbilityModal.items?.[i]?.name ||
                                        ""
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
                              </>
                            )}
                            {(() => {
                              const prev = customAbilityModal;
                              const validSingle =
                                prev.type === "single_with_3_uses" &&
                                (prev.name || "").trim() &&
                                (prev.uses || []).every((u) =>
                                  (u || "").trim(),
                                );
                              const validThree =
                                prev.type === "three_separate_uses" &&
                                (prev.items || []).every(
                                  (i) =>
                                    (i?.name || "").trim() &&
                                    (i?.description || "").trim(),
                                );
                              const canSave =
                                prev.type === "single_with_3_uses"
                                  ? validSingle
                                  : validThree;
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
                                      setAbilities((p) => [
                                        ...p.filter((a) => a.type !== "custom"),
                                        ...(prev.type === "single_with_3_uses"
                                          ? [
                                              {
                                                id: "custom-single",
                                                name: (prev.name || "").trim(),
                                                type: "custom",
                                                _uses: prev.uses || [
                                                  "",
                                                  "",
                                                  "",
                                                ],
                                              },
                                            ]
                                          : prev.items
                                              .filter(
                                                (i) =>
                                                  (i?.name || "").trim() &&
                                                  (i?.description || "").trim(),
                                              )
                                              .map((it, i) => ({
                                                id: `custom-${i}`,
                                                name: (it.name || "").trim(),
                                                description: (
                                                  it.description || ""
                                                ).trim(),
                                                type: "custom",
                                              }))),
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
                  </div>

                  {/* Clocks */}
                  <div style={{ marginBottom: "14px" }}>
                    <span style={S.lbl}>CLOCKS</span>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "10px",
                        marginBottom: "8px",
                      }}
                    >
                      {clocks.map((clk) => (
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
                              segments={clk.segments}
                              filled={clk.filled}
                              interactive
                              onClick={(f) =>
                                setClocks((p) =>
                                  p.map((c) =>
                                    c.id === clk.id ? { ...c, filled: f } : c,
                                  ),
                                )
                              }
                            />
                          </div>
                          <div style={{ fontSize: "10px", color: "#6b7280" }}>
                            {clk.filled}/{clk.segments}
                          </div>
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
                      ))}
                    </div>
                    <button
                      onClick={addClock}
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
                  </div>

                  {/* Shared party clocks (player/crew-authored clocks; GM-created clocks live in SESSION > Clocks). */}
                  {charCampaign?.progress_clocks?.length > 0 &&
                    (() => {
                      const gmId = Number(charCampaign?.gm);
                      const partyClocks = (charCampaign.progress_clocks || [])
                        .filter((clk) => {
                          const creator = Number(clk.created_by);
                          return creator && creator !== gmId;
                        })
                        .filter((clk) => {
                          if (isGM) return true;
                          return (
                            Number(clk.created_by) === Number(user?.id) ||
                            !!clk.visible_to_party
                          );
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
                  <div>
                    <span style={S.lbl}>NOTES</span>
                    <textarea
                      placeholder="Notes…"
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
                  </div>
                  {/* Inventory */}
                  <div>
                    <span style={S.lbl}>INVENTORY</span>
                    <textarea
                      placeholder="Inventory…"
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
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom row */}
            <div style={{ ...S.g3, marginTop: "16px" }}>
              <div style={S.card}>
                <span style={S.lbl}>TEAMWORK</span>
                {[
                  "Assist a teammate (+1d, costs 1 Stress)",
                  "Lead a group action",
                  "Protect a teammate",
                  "Set up a teammate",
                ].map((t) => (
                  <div
                    key={t}
                    style={{
                      background: "#374151",
                      padding: "4px 8px",
                      marginBottom: "3px",
                      fontSize: "12px",
                    }}
                  >
                    {t}
                  </div>
                ))}
              </div>
              <div style={S.card}>
                <span style={S.lbl}>PLANNING & LOAD</span>
                <div style={{ fontSize: "12px", color: "#d1d5db" }}>
                  {[
                    ["Assault", "Point of attack"],
                    ["Occult", "Arcane power"],
                    ["Deception", "Method"],
                    ["Social", "Connection"],
                    ["Stealth", "Entry point"],
                    ["Transport", "Route"],
                  ].map(([p, d]) => (
                    <div key={p}>
                      <strong>{p}:</strong> <em>{d}</em>
                    </div>
                  ))}
                </div>
              </div>
              <div style={S.card}>
                <span style={S.lbl}>GATHER INFORMATION</span>
                <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                  {[
                    "What do they intend to do?",
                    "How can I get them to [X]?",
                    "What are they really feeling?",
                    "What should I look out for?",
                    "Where's the weakness here?",
                    "What's really going on here?",
                  ].map((q) => (
                    <div key={q}>🔷 {q}</div>
                  ))}
                </div>
              </div>
            </div>
            </div>
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
                {crewFactionLinks.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>
                    No linked factions yet.
                    {isGM && campaignId
                      ? " Create a faction for the campaign, then link it to this crew."
                      : ""}
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {crewFactionLinks.map((row) => (
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
                      marginTop: "10px",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                      alignItems: "center",
                    }}
                  >
                    <button
                      type="button"
                      style={{ ...S.btn, fontSize: "11px" }}
                      onClick={() => {
                        const name = prompt("New faction name?");
                        if (!name?.trim()) return;
                        factionAPI
                          .createFaction({
                            campaign: parseInt(String(campaignId), 10),
                            name: name.trim(),
                            visible_to_players: false,
                          })
                              .then((created) => {
                            const fid = created?.id ?? created?.pk;
                            if (!fid) return;
                            return crewAPI
                              .patchCrew(charData.crewId, {
                                faction_relationships: [
                                  {
                                    faction_id: fid,
                                    reputation_value: 0,
                                  },
                                ],
                              })
                              .then(() =>
                                crewAPI
                                  .getCrew(charData.crewId)
                                  .then((crewRes) => {
                                    setCrewFactionLinks(
                                      crewRes.faction_relationships || [],
                                    );
                                  }),
                              );
                          })
                          .catch(() => {});
                      }}
                    >
                      + Create hidden faction and link
                    </button>
                    <button
                      type="button"
                      style={{ ...S.btn, fontSize: "11px" }}
                      onClick={() => {
                        const raw = prompt(
                          "Link existing faction: enter faction ID",
                        );
                        if (!raw?.trim()) return;
                        const fid = parseInt(raw.trim(), 10);
                        if (!Number.isFinite(fid)) return;
                        crewAPI
                          .patchCrew(charData.crewId, {
                            faction_relationships: [
                              { faction_id: fid, reputation_value: 0 },
                            ],
                          })
                          .then(() =>
                            crewAPI.getCrew(charData.crewId).then((d) => {
                              setCrewFactionLinks(d.faction_relationships || []);
                            }),
                          )
                          .catch(() => {});
                      }}
                    >
                      Link faction by ID
                    </button>
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
            </div>
            {charData.crewId ? (
              <div
                style={{
                  ...S.card,
                  marginBottom: "12px",
                  maxHeight: "220px",
                  overflow: "auto",
                }}
              >
                <span style={S.lbl}>CREW MODIFICATION HISTORY</span>
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
                <div style={{ marginTop: "12px" }}>
                  <span style={S.lbl}>CREW XP TRIGGERS</span>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#d1d5db",
                      lineHeight: "1.7",
                    }}
                  >
                    🔷 Contend with challenges above your station
                    <br />
                    🔷 Bolster your crew's reputation
                    <br />
                    🔷 Express goals, drives, or nature of the crew
                  </div>
                </div>
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
              Choose ONE path. A new Stand ability is automatically included
              either way.
              {levelUpChoice === "stat" &&
                standStats[levelUpStat] === maxStandGradeIndex - 1 && (
                  <div style={{ ...S.green, marginTop: "6px" }}>
                    ★ This stat will hit {GRADE[maxStandGradeIndex]}-rank —
                    ability auto-unlocked!
                  </div>
                )}
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              {[
                ["stat", "+1 Stand Coin Grade"],
                ["dots", "+2 Action Dots"],
              ].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setLevelUpChoice(val)}
                  style={{
                    ...S.btn,
                    flex: 1,
                    color: "#fff",
                    background: levelUpChoice === val ? "#7c3aed" : "#374151",
                    border: `2px solid ${levelUpChoice === val ? "#a78bfa" : "transparent"}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

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

            {levelUpChoice === "dots" && (
              <div style={{ marginBottom: "16px" }}>
                <span style={S.lbl}>
                  Choose 2 actions (+1 dot each — can pick same action twice)
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  {[levelUpDot1, levelUpDot2].map((val, i) => (
                    <select
                      key={i}
                      value={val}
                      onChange={(e) =>
                        i === 0
                          ? setLevelUpDot1(e.target.value)
                          : setLevelUpDot2(e.target.value)
                      }
                      style={{ ...S.sel, flex: 1 }}
                    >
                      {Object.keys(actionRatings).map((a) => (
                        <option
                          key={a}
                          value={a}
                          disabled={actionRatings[a] >= 4}
                        >
                          {a} ({actionRatings[a]}/4)
                          {actionRatings[a] >= 4 ? " MAX" : ""}
                        </option>
                      ))}
                    </select>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={confirmLevelUp}
                style={{
                  ...S.btn,
                  background: "#7c3aed",
                  color: "#fff",
                  flex: 1,
                  fontWeight: "bold",
                }}
              >
                Confirm (−10 XP)
              </button>
              <button
                onClick={() => setShowLevelUp(false)}
                style={{ ...S.btn, background: "#374151", color: "#fff" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
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

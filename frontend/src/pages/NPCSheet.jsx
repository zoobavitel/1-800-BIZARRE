import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  referenceAPI,
  factionAPI,
  sessionAPI,
  rollAPI,
  characterHistoryAPI,
  experienceTrackerAPI,
  xpHistoryAPI,
  npcAPI,
} from "../features/character-sheet";
import {
  markNpcAutosaveBusyCollision,
  takeNpcAutosavePending,
} from "../features/character-sheet/utils/npcAutosaveGate";
import { HistoryBranchIcon } from "../components/position-effect/PositionEffectIndicators";
import NpcsStandCoin from "../components/NpcsStandCoin";

// ─── SRD Data Tables ──────────────────────────────────────────────────────────

// NOTE: SRD has two level formulas — one doc says -9, another says -10.
// Change this constant to whichever is confirmed correct.
const LEVEL_OFFSET = 9;

const GRADES = ["F", "D", "C", "B", "A", "S"];
const GRADE_PTS = { F: 0, D: 1, C: 2, B: 3, A: 4, S: 5 };

// Durability → Vulnerability Clock segments
const DUR_VULN_CLOCK = { F: 4, D: 6, C: 8, B: 10, A: 12, S: 0 };

// Durability → Regular armor charges (SRD: F=0, D=1, C=1, B=2, A=3, S=3)
const DUR_REGULAR_ARMOR = { F: 0, D: 1, C: 1, B: 2, A: 3, S: 3 };

// Durability → Special armor charges (negate harm)
const DUR_SPECIAL_ARMOR = { F: 0, D: 0, C: 1, B: 1, A: 2, S: 2 };

// Durability → Stand armor charges (path / Stand soak; separate from physical reduce & special negate)
/** SRD Stand Armor Charges (same table as PC sheet / NPC `stand_armor_charges`). */
const DUR_STAND_ARMOR = { F: 0, D: 1, C: 2, B: 3, A: 4, S: 5 };

// Power → base harm level + position note
/** Session involvement rows use `npc` FK from JSON — may be number or string */
function npcInvMatches(invNpcId, sheetNpcId) {
  if (sheetNpcId == null || invNpcId == null) return false;
  return Number(invNpcId) === Number(sheetNpcId);
}

/** JSONField clocks from API vs local edits — normalize once for state + merges */
function normalizeNpcClockEntry(c) {
  if (!c || typeof c !== "object") return null;
  const segsRaw = Number(c.segments);
  const segments = [4, 6, 8, 12].includes(segsRaw) ? segsRaw : 8;
  const filledRaw = Number(c.filled);
  const filled =
    Number.isFinite(filledRaw) && filledRaw >= 0
      ? Math.min(segments, filledRaw)
      : 0;
  const rawShow = c.show_to_players ?? c.visible_to_players;
  const show_to_players =
    rawShow === true ||
    rawShow === 1 ||
    (typeof rawShow === "string" &&
      ["1", "true", "yes", "on"].includes(String(rawShow).toLowerCase()));
  return {
    id: c.id,
    name: String(c.name ?? ""),
    segments,
    filled,
    show_to_players,
  };
}

function normalizeClockList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeNpcClockEntry).filter((x) => x != null);
}

/** True when normalized clock rows match (avoid save→setState(ref churn)→autosave loops). */
function npcClockListsSemanticallyEqual(rawA, rawB) {
  const a = normalizeClockList(rawA);
  const b = normalizeClockList(rawB);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (String(x.id ?? "") !== String(y.id ?? "")) return false;
    if (x.name !== y.name) return false;
    if (x.segments !== y.segments) return false;
    if (x.filled !== y.filled) return false;
    if (x.show_to_players !== y.show_to_players) return false;
  }
  return true;
}

function npcClockIdsMatch(a, b) {
  return a === b || (a != null && b != null && Number(a) === Number(b));
}

/** Session rolls where a PC spent coin on NPC heal fortune — match healer to this NPC by display name. */
function rollIsNpcHealFortuneForThisNpc(roll, npcDisplayName) {
  const ctx = String(
    roll.recovery_context ?? roll.recoveryContext ?? "",
  ).toLowerCase();
  if (ctx !== "npc_heal_fortune") return false;
  const name = String(npcDisplayName || "").trim();
  if (!name) return false;
  const mod = Array.isArray(roll.modifier_sources)
    ? roll.modifier_sources
    : Array.isArray(roll.modifierSources)
      ? roll.modifierSources
      : [];
  const healer = mod.find((m) => m && m.kind === "npc_healer");
  if (healer && String(healer.name || "").includes(name)) return true;
  const goal = String(roll.goal_label ?? roll.goalLabel ?? "");
  const desc = String(roll.description ?? "");
  const fort = String(
    roll.fortune_public_label ?? roll.fortunePublicLabel ?? "",
  );
  return [goal, desc, fort].some((x) => x.includes(name));
}

function historyFieldLabel(key) {
  return String(key || "").replace(/_/g, " ");
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

/**
 * NPC sheet: playbook copy is GM-facing narration only — strip PC-facing dice
 * and stress spends from blurbs loaded from Hamon/Spin reference data.
 */
function sanitizeNpcPlaybookAbilityDescription(raw) {
  if (raw == null || typeof raw !== "string") return "";
  let s = raw.normalize("NFKC");

  const passes = [
    /\bCosts?\s+\d+\s+stress\.?\s*/gi,
    /\bSpend(?:ing)?\s+\d+\s+stress[^.!?]*(?:[.!?]|$)/gi,
    /\bPay\s+\d+\s+stress[^.!?]*(?:[.!?]|$)/gi,
    // Clause starting with dice pool (+1d … through end of clause)
    /\+?\d+\s*d[^.!?]*(?:[.!?]|$)/gi,
    // Roll Finesse or Wreck; on a 6 / on a crit, …
    /\bRoll\s+[A-Za-z][A-Za-z\s,]+\s*[;,]\s*on\s+(?:a\s+)?(?:crit|\d+)\+?\s*,\s*/gi,
    /\bOn\s+a\s+(?:crit|\d+)\+?\s*,\s*/gi,
  ];

  passes.forEach((re) => {
    for (let i = 0; i < 6; i += 1) {
      const next = s.replace(re, "");
      if (next === s) break;
      s = next;
    }
  });

  s = s
    .replace(/\s+[,.;:]/g, (chunk) => chunk.trim())
    .replace(/\s*,\s*\./g, ".")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[.,;\s:]+/, "")
    .trim();

  if (/^[a-z]/.test(s)) {
    s = s.charAt(0).toUpperCase() + s.slice(1);
  }
  return s;
}

/** Legacy rows linked standard-catalog abilities; NPC sheet uses freeform rows only now. */
function normalizeNpcSheetAbilitiesNoStandard(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((ab) => {
    if (!ab || typeof ab !== "object") {
      return { id: Date.now(), name: "", description: "", type: "unique" };
    }
    const out = { ...ab };
    delete out.standardId;
    if (String(out.type || "").toLowerCase() === "standard") {
      out.type = "unique";
    }
    return out;
  });
}

const POWER_TABLE = {
  S: { harm: 4, pos: "Forces position worse by 1 step (always)" },
  A: { harm: 4, pos: "Forces position worse by 1 step" },
  B: { harm: 3, pos: "Standard scaling" },
  C: { harm: 2, pos: "Standard scaling" },
  D: { harm: 1, pos: "Standard scaling" },
  F: { harm: 0, pos: "Minimal threat" },
};

// Speed → movement table
const SPEED_TABLE = {
  S: {
    base: "200 ft",
    greater: "—",
    lesser: "—",
    note: "Higher Speed usually starts Risky or better; GM adjusts by fiction",
  },
  A: { base: "60 ft", greater: "120 ft", lesser: "30 ft", note: "" },
  B: { base: "40 ft", greater: "80 ft", lesser: "20 ft", note: "" },
  C: { base: "35 ft", greater: "70 ft", lesser: "15 ft", note: "" },
  D: { base: "30 ft", greater: "60 ft", lesser: "15 ft", note: "" },
  F: { base: "25 ft", greater: "50 ft", lesser: "10 ft", note: "" },
};

// Range → operational distance table
const RANGE_TABLE = {
  S: { base: "Unlimited", greater: "No penalty", lesser: "No penalty" },
  A: { base: "100 ft", greater: "200 ft", lesser: "50 ft" },
  B: { base: "50 ft", greater: "100 ft", lesser: "25 ft" },
  C: { base: "40 ft", greater: "80 ft", lesser: "20 ft" },
  D: { base: "20 ft", greater: "40 ft", lesser: "10 ft" },
  F: { base: "10 ft", greater: "20 ft", lesser: "5 ft" },
};

// Precision → reactive counter-effects
const PRECISION_TABLE = {
  S: {
    partial: "Greater Effect on next action",
    failure: "🔴 NPC gets a Critical",
  },
  A: {
    partial: "Greater Effect on next action",
    failure: "Greater Effect on next action",
  },
  B: {
    partial: "Standard Effect on next action",
    failure: "Greater Effect on next action",
  },
  C: {
    partial: "Standard Effect on next action",
    failure: "Standard Effect on next action",
  },
  D: {
    partial: "Lesser Effect on next action",
    failure: "Standard Effect on next action",
  },
  F: {
    partial: "🟢 NPC critically fails next action",
    failure: "Lesser Effect on next action",
  },
};

// Development → tactical adaptability
const DEV_TABLE = {
  S: "Real-time evolution — can gain entirely new abilities mid-fight. Completely unpredictable.",
  A: "Adaptive combat — once per combat, mutate one existing ability to do something different.",
  B: "Learns from defeat — in rematches, returns with 1 new ability based on what defeated them.",
  C: "Fixed script — predictable once understood. No surprises. Easy to counter.",
  D: "Limited moveset — PCs get +1d against it after witnessing its abilities twice.",
  F: "Unstable — loses abilities during prolonged combat. Reduce by 1 armor charge each scene.",
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
  segments,
  filled,
  onClick,
  label,
  sublabel,
  color = "#dc2626",
}) => {
  if (segments === 0) return null;
  const r = size / 2 - 4,
    cx = size / 2,
    cy = size / 2;
  const sa = 360 / segments;
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
            fill={i < filled ? color : "transparent"}
            stroke="#4b5563"
            strokeWidth="1.5"
            style={{ cursor: onClick ? "pointer" : "default" }}
            onClick={
              onClick ? () => onClick(i < filled ? i : i + 1) : undefined
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
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fontSize: Math.max(8, size / 6),
          fill: "#fff",
          fontFamily: "monospace",
          fontWeight: "bold",
          transform: `rotate(90deg)`,
          transformOrigin: `${cx}px ${cy}px`,
        }}
      >
        {filled}/{segments}
      </text>
    </svg>
  );
  const clockContent = onClick ? (
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
  ) : (
    svg
  );
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
      }}
    >
      {clockContent}
      {label && (
        <div
          style={{
            fontSize: "11px",
            fontWeight: "bold",
            color: "#d1d5db",
            textAlign: "center",
            maxWidth: `${size}px`,
          }}
        >
          {label}
        </div>
      )}
      {sublabel && (
        <div
          style={{
            fontSize: "10px",
            color: "#6b7280",
            textAlign: "center",
            maxWidth: `${size}px`,
          }}
        >
          {sublabel}
        </div>
      )}
    </div>
  );
};

const npcClockAddCardInputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "6px 8px",
  borderRadius: "4px",
  border: "1px solid #4b5563",
  background: "#0a0a14",
  color: "#e5e7eb",
  fontFamily: "monospace",
  fontSize: "12px",
};

/** Inline add-clock form (avoids browser prompt / modal feel). */
function NpcClockAddCard({
  draft,
  error,
  onFieldChange,
  onCommit,
  onCancel,
  namePlaceholder,
  borderColor,
  createBg,
  createColor,
  createLabel,
}) {
  if (!draft) return null;
  return (
    <div
      style={{
        marginBottom: "12px",
        padding: "10px 12px",
        background: "#111827",
        border: `1px solid ${borderColor}`,
        borderRadius: "6px",
      }}
    >
      <div style={{ fontSize: "10px", color: "#9ca3af", marginBottom: "8px" }}>
        New clock
      </div>
      <input
        type="text"
        value={draft.name}
        onChange={(e) => onFieldChange({ name: e.target.value })}
        placeholder={namePlaceholder}
        style={npcClockAddCardInputStyle}
        autoFocus
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginTop: "8px",
          flexWrap: "wrap",
        }}
      >
        <label
          style={{
            fontSize: "11px",
            color: "#9ca3af",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          Segments
          <select
            value={draft.segments}
            onChange={(e) =>
              onFieldChange({ segments: Number(e.target.value) })
            }
            style={{
              ...npcClockAddCardInputStyle,
              width: "auto",
              cursor: "pointer",
            }}
          >
            {[4, 6, 8, 12].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <div style={{ fontSize: "10px", color: "#f87171", marginTop: "6px" }}>
          {error}
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginTop: "10px",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "4px 10px",
            fontSize: "11px",
            cursor: "pointer",
            borderRadius: "4px",
            border: "1px solid #4b5563",
            background: "transparent",
            color: "#9ca3af",
            fontFamily: "monospace",
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onCommit}
          style={{
            padding: "4px 10px",
            fontSize: "11px",
            cursor: "pointer",
            borderRadius: "4px",
            border: "none",
            background: createBg,
            color: createColor,
            fontFamily: "monospace",
            fontWeight: "bold",
          }}
        >
          {createLabel}
        </button>
      </div>
    </div>
  );
}

// ─── ArmorTracker ─────────────────────────────────────────────────────────────

const ArmorTracker = ({ label, max, used, onChange, color }) => {
  if (max === 0)
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "10px", color: "#4b5563", fontWeight: "bold" }}>
          {label}
        </div>
        <div style={{ fontSize: "10px", color: "#6b7280" }}>0 charges</div>
      </div>
    );
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontSize: "10px",
          color: "#9ca3af",
          fontWeight: "bold",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          gap: "3px",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        {Array.from({ length: max }, (_, i) => (
          <div
            key={i}
            onClick={() => onChange(i < used ? i : i + 1)}
            title={i < used ? "Spent — click to restore" : "Click to spend"}
            style={{
              width: "18px",
              height: "18px",
              border: `1px solid ${color}`,
              cursor: "pointer",
              background: i < used ? color : "transparent",
              borderRadius: "2px",
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: "10px", color: "#6b7280", marginTop: "2px" }}>
        {max - used} left
      </div>
    </div>
  );
};

/** Physical armor only when fiction includes gear; bonus = GM-added charges beyond Durability tier. */
function NpcPhysicalArmorBlock({
  shortLabel,
  hasItem,
  onHasItemChange,
  bonusCharges,
  onBonusChargesChange,
  regArmorMax,
  regularUsed,
  onRegularUsed,
}) {
  return (
    <div
      style={{
        textAlign: "left",
        padding: "8px",
        background: "#0a0a14",
        borderRadius: "4px",
        border: "1px solid #374151",
      }}
    >
      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "8px",
          fontSize: "10px",
          color: "#d1d5db",
          cursor: "pointer",
          marginBottom: "8px",
          lineHeight: 1.45,
        }}
      >
        <input
          type="checkbox"
          checked={hasItem}
          onChange={(e) => onHasItemChange(e.target.checked)}
          style={{ marginTop: "2px" }}
        />
        <span>
          <strong style={{ color: "#fbbf24" }}>Physical armor item</strong> — worn or
          carried gear that grants −1 harm charges. Leave off when this NPC has no
          such item.
        </span>
      </label>
      {hasItem ? (
        <>
          <ArmorTracker
            label={shortLabel ? "PHYSICAL" : "PHYSICAL ARMOR"}
            max={regArmorMax}
            used={regularUsed}
            onChange={onRegularUsed}
            color="#f59e0b"
          />
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              marginTop: "8px",
              fontSize: "10px",
              color: "#9ca3af",
            }}
          >
            Extra physical charges (GM, 0–6)
            <span
              style={{
                fontSize: "9px",
                color: "#6b7280",
                fontWeight: "normal",
                lineHeight: 1.4,
              }}
            >
              On top of the Durability baseline — better gear, improvised plating, or
              a table grant.
            </span>
            <input
              type="number"
              min={0}
              max={6}
              step={1}
              value={bonusCharges}
              onChange={(e) => {
                const v = Math.floor(Number(e.target.value));
                if (!Number.isFinite(v)) return;
                onBonusChargesChange(Math.max(0, Math.min(6, v)));
              }}
              style={{
                width: "64px",
                padding: "4px 6px",
                borderRadius: "4px",
                border: "1px solid #4b5563",
                background: "#111827",
                color: "#e5e7eb",
                fontFamily: "monospace",
                fontSize: "12px",
              }}
            />
          </label>
        </>
      ) : (
        <div style={{ fontSize: "10px", color: "#57534e", textAlign: "center" }}>
          Physical armor tracker hidden until the item box is checked.
        </div>
      )}
    </div>
  );
}

// ─── NPCSheet ─────────────────────────────────────────────────────────────────

const NPCSheet = ({
  npc,
  onSave,
  onClose,
  campaigns = [],
  allNpcs = [],
  isGM = false,
  onFactionChange,
  onCampaignRefresh,
}) => {
  const [activeMode, setActiveMode] = useState("NPC");

  const [name, setName] = useState(npc?.name || "");
  const [standName, setStandName] = useState(
    npc?.standName ?? npc?.stand_name ?? "",
  );

  // After first save, parent passes API result with default name; keep local field in sync when still empty.
  useEffect(() => {
    const server = String(npc?.name ?? "").trim();
    if (!server) return;
    setName((prev) => (String(prev).trim() === "" ? npc.name : prev));
  }, [npc?.id, npc?.name]);
  const [role, setRole] = useState(npc?.role || "");
  const [notes, setNotes] = useState(npc?.notes || "");
  const [inventoryNotes, setInventoryNotes] = useState(
    npc?.inventory_notes ?? "",
  );
  const [campaign, setCampaign] = useState(npc?.campaign || "");
  const [faction, setFaction] = useState(npc?.faction ?? npc?.faction_id ?? "");

  useEffect(() => {
    setFaction(npc?.faction ?? npc?.faction_id ?? "");
  }, [npc?.id, npc?.faction, npc?.faction_id]);

  useEffect(() => {
    setNotes(npc?.notes || "");
    setInventoryNotes(npc?.inventory_notes ?? "");
  }, [npc?.id, npc?.notes, npc?.inventory_notes]);

  const campaignId = typeof campaign === "object" ? campaign?.id : campaign;
  const activeCampaign = useMemo(
    () =>
      campaignId != null
        ? campaigns?.find((c) => c.id === campaignId) ?? null
        : null,
    [campaigns, campaignId],
  );

  const currentFactionId = useMemo(() => {
    if (faction === "" || faction == null) return null;
    if (typeof faction === "object") return faction?.id ?? null;
    const n = Number(faction);
    return Number.isFinite(n) ? n : null;
  }, [faction]);

  const factionNpcPeers = useMemo(() => {
    if (currentFactionId == null) return [];
    return (allNpcs || []).filter((n) => {
      if (n?.id == null) return false;
      if (Number(n.id) === Number(npc?.id)) return false;
      const raw = n.faction ?? n.faction_id;
      const fid =
        raw != null && typeof raw === "object" ? raw.id ?? null : raw;
      if (fid === "" || fid == null) return false;
      return Number(fid) === Number(currentFactionId);
    });
  }, [allNpcs, currentFactionId, npc?.id]);

  const campaignPlayerCharacters = useMemo(
    () =>
      Array.isArray(activeCampaign?.campaign_characters)
        ? activeCampaign.campaign_characters
        : [],
    [activeCampaign?.campaign_characters],
  );

  const activeSessionId = useMemo(() => {
    const raw = activeCampaign?.active_session;
    if (raw == null) return null;
    return typeof raw === "object" ? raw.id : raw;
  }, [activeCampaign]);
  const baseCampaignFactions = useMemo(
    () =>
      (campaignId != null && campaigns?.find((c) => c.id === campaignId))
        ?.factions || [],
    [campaignId, campaigns],
  );

  const [activeSessionDetail, setActiveSessionDetail] = useState(null);
  const [activeSessionLoading, setActiveSessionLoading] = useState(false);
  const [vulnRevealSaving, setVulnRevealSaving] = useState(false);
  /** Invalidate in-flight GET /sessions/:id after PATCH so stale responses cannot revert UI */
  const activeSessionDetailNonceRef = useRef(0);

  useEffect(() => {
    if (!isGM || activeSessionId == null) {
      setActiveSessionDetail(null);
      setActiveSessionLoading(false);
      return;
    }
    let cancelled = false;
    activeSessionDetailNonceRef.current += 1;
    const ticket = activeSessionDetailNonceRef.current;
    setActiveSessionLoading(true);
    sessionAPI
      .getSession(activeSessionId)
      .then((data) => {
        if (
          cancelled ||
          ticket !== activeSessionDetailNonceRef.current
        ) {
          return;
        }
        setActiveSessionDetail(data);
      })
      .catch(() => {
        if (cancelled) return;
        if (ticket !== activeSessionDetailNonceRef.current) return;
        setActiveSessionDetail(null);
      })
      .finally(() => {
        if (!cancelled) setActiveSessionLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Include `campaigns`: session NPC involvements change when GM edits session elsewhere;
    // nonce drops stale GETs started before our own PATCH completes.
  }, [isGM, activeSessionId, campaigns]);

  const sessionInvolvementForNpc = useMemo(() => {
    const id = npc?.id;
    if (id == null || !activeSessionDetail?.npc_involvements) return null;
    return (
      activeSessionDetail.npc_involvements.find((i) =>
        npcInvMatches(i.npc, id),
      ) ?? null
    );
  }, [npc?.id, activeSessionDetail]);

  const patchNpcInvolvementFlags = useCallback(
    async (nextInvolvements) => {
      if (activeSessionId == null) return;
      setVulnRevealSaving(true);
      try {
        const normalized = (nextInvolvements || []).map((i) => {
          const showAll = !!i.show_clocks_to_players;
          const rawVuln = !!(i.show_vulnerability_clock_to_players ?? false);
          return {
            ...i,
            show_clocks_to_players: showAll,
            // Match serializers._normalize_npc_involvement_clock_flags: full clocks ⇒ vuln visible.
            show_vulnerability_clock_to_players: showAll || rawVuln,
          };
        });
        const updated = await sessionAPI.patchSession(activeSessionId, {
          npc_involvements: normalized,
        });
        activeSessionDetailNonceRef.current += 1;
        setActiveSessionDetail(updated);
        if (typeof onCampaignRefresh === "function") {
          onCampaignRefresh();
        }
      } catch (e) {
        console.error(e);
      } finally {
        setVulnRevealSaving(false);
      }
    },
    [activeSessionId, onCampaignRefresh],
  );

  const toggleVulnerabilityVisibleToPlayers = useCallback(async () => {
    if (!sessionInvolvementForNpc || !activeSessionDetail?.npc_involvements) {
      return;
    }
    if (sessionInvolvementForNpc.show_clocks_to_players) {
      return;
    }
    const id = npc?.id;
    const next = activeSessionDetail.npc_involvements.map((i) =>
      npcInvMatches(i.npc, id)
        ? {
            ...i,
            show_vulnerability_clock_to_players: !(
              i.show_vulnerability_clock_to_players ?? false
            ),
          }
        : i,
    );
    await patchNpcInvolvementFlags(next);
  }, [
    sessionInvolvementForNpc,
    activeSessionDetail,
    npc?.id,
    patchNpcInvolvementFlags,
  ]);

  // Optimistically track factions created inline (not yet in the campaigns prop)
  const [localExtraFactions, setLocalExtraFactions] = useState([]);
  const campaignFactions = useMemo(() => [
    ...baseCampaignFactions,
    ...localExtraFactions.filter(
      (lf) => !baseCampaignFactions.some((bf) => bf.id === lf.id),
    ),
  ], [baseCampaignFactions, localExtraFactions]);

  // Inline "New Faction" form state
  const [showNewFactionForm, setShowNewFactionForm] = useState(false);
  const [newFactionName, setNewFactionName] = useState("");
  const [creatingFaction, setCreatingFaction] = useState(false);
  const [factionCreateError, setFactionCreateError] = useState("");

  /** Heal ally: PC picker + in-play/downtime scratch notes are local; fortune dice + recover-in-play P/E persist on NPC. */
  /** 1–4 d6 for fortune when this NPC provides healing / recovery (persisted on NPC). */
  const [healQualityFortuneDice, setHealQualityFortuneDice] = useState(() => {
    const raw = Number(npc?.heal_quality_fortune_dice ?? npc?.healQualityFortuneDice);
    return Number.isFinite(raw) && raw >= 1 && raw <= 4 ? raw : 2;
  });
  /** Latest GM-side preview roll for heal fortune (not persisted). */
  const [healFortuneRollPreview, setHealFortuneRollPreview] = useState(null);

  const [healAllyPcId, setHealAllyPcId] = useState("");
  const [healAllyPosition, setHealAllyPosition] = useState(() => {
    const p = String(npc?.heal_recover_in_play_position || "risky").toLowerCase();
    return ["controlled", "risky", "desperate"].includes(p) ? p : "risky";
  });
  const [healAllyEffect, setHealAllyEffect] = useState(() => {
    const e = String(npc?.heal_recover_in_play_effect || "standard").toLowerCase();
    return ["limited", "standard", "extreme"].includes(e) ? e : "standard";
  });
  const [healAllyRecoveryNote, setHealAllyRecoveryNote] = useState("");
  const [healAllyDowntimeNote, setHealAllyDowntimeNote] = useState("");

  useEffect(() => {
    setHealAllyPcId("");
    setHealAllyRecoveryNote("");
    setHealAllyDowntimeNote("");
    setHealFortuneRollPreview(null);
  }, [npc?.id]);

  const rollHealQualityFortune = useCallback((kind) => {
    const n = Math.max(
      1,
      Math.min(4, Math.floor(Number(healQualityFortuneDice)) || 2),
    );
    const results = Array.from(
      { length: n },
      () => Math.floor(Math.random() * 6) + 1,
    );
    const highest = Math.max(...results);
    const sixes = results.filter((d) => d === 6).length;
    const critical = sixes >= 2;
    setHealFortuneRollPreview({ results, highest, critical, kind });
  }, [healQualityFortuneDice]);

  // Faction detail — loaded from server when a faction is selected
  const [factionDetailLoading, setFactionDetailLoading] = useState(false);

  // Faction-level editable fields (shared across all NPCs in the faction)
  const [factionName, setFactionName] = useState("");
  const [factionType, setFactionType] = useState("");
  const [factionLevel, setFactionLevel] = useState(0);
  const [factionHold, setFactionHold] = useState("weak");
  const [factionReputation, setFactionReputation] = useState(0);
  const [factionContacts, setFactionContacts] = useState([]);
  const [factionInventory, setFactionInventory] = useState([]);
  const [factionStatusData, setFactionStatusData] = useState({});
  const [factionCrewNotes, setFactionCrewNotes] = useState("");

  // Load faction detail whenever the selected faction changes
  useEffect(() => {
    if (!faction) {
      return;
    }
    setFactionDetailLoading(true);
    factionAPI
      .getFaction(faction)
      .then((f) => {
        setFactionName(f.name || "");
        setFactionType(f.faction_type || "");
        setFactionLevel(typeof f.level === "number" ? f.level : 0);
        setFactionHold(f.hold || "weak");
        setFactionReputation(typeof f.reputation === "number" ? f.reputation : 0);
        setFactionContacts(Array.isArray(f.contacts) ? f.contacts : []);
        setFactionInventory(Array.isArray(f.inventory) ? f.inventory : []);
        setFactionStatusData(f.faction_status && typeof f.faction_status === "object" ? f.faction_status : {});
        setFactionCrewNotes(f.crew_notes || "");
      })
      .catch(() => {})
      .finally(() => setFactionDetailLoading(false));
  }, [faction]);

  // Debounce ref for faction auto-save
  const factionDebounceRef = useRef(null);
  const factionSavingRef = useRef(false);
  const factionMountedRef = useRef(false);

  // Debounced faction auto-save
  useEffect(() => {
    if (!factionMountedRef.current) {
      factionMountedRef.current = true;
      return;
    }
    if (!faction || !isGM) return;
    if (factionDebounceRef.current) clearTimeout(factionDebounceRef.current);
    factionDebounceRef.current = setTimeout(async () => {
      if (factionSavingRef.current) return;
      factionSavingRef.current = true;
      try {
        const updated = await factionAPI.patchFaction(faction, {
          name: factionName,
          faction_type: factionType,
          level: factionLevel,
          hold: factionHold,
          reputation: factionReputation,
          contacts: factionContacts,
          inventory: factionInventory,
          faction_status: factionStatusData,
          crew_notes: factionCrewNotes,
        });
        if (onFactionChange) onFactionChange(updated);
      } catch {
        // silently ignore faction save errors
      } finally {
        factionSavingRef.current = false;
      }
    }, 1500);
    return () => {
      if (factionDebounceRef.current) clearTimeout(factionDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    faction,
    factionName,
    factionType,
    factionLevel,
    factionHold,
    factionReputation,
    factionContacts,
    factionInventory,
    factionStatusData,
    factionCrewNotes,
  ]);

  // Reset faction-mounted flag when faction changes so first load doesn't trigger a spurious save
  useEffect(() => {
    factionMountedRef.current = false;
  }, [faction]);

  const handleCreateFaction = useCallback(async () => {
    const trimmed = newFactionName.trim();
    if (!trimmed || !campaignId) return;
    const duplicate = campaignFactions.some(
      (f) => f.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      setFactionCreateError(`A faction named "${trimmed}" already exists in this campaign.`);
      return;
    }
    setFactionCreateError("");
    setCreatingFaction(true);
    try {
      const created = await factionAPI.createFaction({ name: trimmed, campaign: campaignId });
      setLocalExtraFactions((prev) => [...prev, created]);
      setFaction(created.id);
      setShowNewFactionForm(false);
      setNewFactionName("");
      if (onFactionChange) onFactionChange(created);
    } catch (err) {
      const msg =
        err?.detail ||
        err?.name?.[0] ||
        err?.non_field_errors?.[0] ||
        "Failed to create faction.";
      setFactionCreateError(typeof msg === "string" ? msg : "Failed to create faction.");
    } finally {
      setCreatingFaction(false);
    }
  }, [newFactionName, campaignId, campaignFactions, onFactionChange]);

  // Crew / faction management fields
  const [contacts, setContacts] = useState(npc?.contacts || []);
  const [factionStatus, setFactionStatus] = useState(
    npc?.faction_status || npc?.factionStatus || {},
  );
  const [inventory, setInventory] = useState(npc?.inventory || []);

  const [stats, setStats] = useState(() => {
    const scs = npc?.stand_coin_stats ?? npc?.stats;
    if (scs && typeof scs === "object") {
      return {
        power: scs.POWER ?? scs.power ?? "D",
        speed: scs.SPEED ?? scs.speed ?? "D",
        range: scs.RANGE ?? scs.range ?? "D",
        durability: scs.DURABILITY ?? scs.durability ?? "D",
        precision: scs.PRECISION ?? scs.precision ?? "D",
        development: scs.DEVELOPMENT ?? scs.development ?? "D",
      };
    }
    return {
      power: "D",
      speed: "D",
      range: "D",
      durability: "D",
      precision: "D",
      development: "D",
    };
  });

  const [conflictClocks, setConflictClocks] = useState(() =>
    normalizeClockList(npc?.conflict_clocks ?? npc?.conflictClocks ?? []),
  );

  const [altClocks, setAltClocks] = useState(() =>
    normalizeClockList(npc?.alt_clocks ?? npc?.altClocks ?? []),
  );

  /** Inline add form for conflict / alt clocks (replaces window.prompt). */
  const [clockDraftCard, setClockDraftCard] = useState(null);
  const [clockDraftError, setClockDraftError] = useState("");

  const npcConflictClocksSnap = useMemo(() => {
    if (npc?.id == null) return "";
    return JSON.stringify(npc?.conflict_clocks ?? npc?.conflictClocks ?? []);
  }, [npc?.id, npc?.conflict_clocks, npc?.conflictClocks]);

  const npcAltClocksSnap = useMemo(() => {
    if (npc?.id == null) return "";
    return JSON.stringify(npc?.alt_clocks ?? npc?.altClocks ?? []);
  }, [npc?.id, npc?.alt_clocks, npc?.altClocks]);

  useEffect(() => {
    if (npc?.id == null || npcConflictClocksSnap === "") return;
    const next = normalizeClockList(
      JSON.parse(npcConflictClocksSnap || "[]"),
    );
    setConflictClocks((prev) =>
      npcClockListsSemanticallyEqual(prev, next) ? prev : next,
    );
  }, [npc?.id, npcConflictClocksSnap]);

  useEffect(() => {
    if (npc?.id == null || npcAltClocksSnap === "") return;
    const next = normalizeClockList(JSON.parse(npcAltClocksSnap || "[]"));
    setAltClocks((prev) =>
      npcClockListsSemanticallyEqual(prev, next) ? prev : next,
    );
  }, [npc?.id, npcAltClocksSnap]);

  const [vulnFilled, setVulnFilled] = useState(
    npc?.vulnerability_clock_current ?? 0,
  );

  const [regularUsed, setRegularUsed] = useState(
    npc?.regular_armor_used ?? npc?.regularUsed ?? 0,
  );
  const [specialUsed, setSpecialUsed] = useState(
    npc?.special_armor_used ?? npc?.specialUsed ?? 0,
  );
  const [standUsed, setStandUsed] = useState(npc?.stand_armor_used ?? 0);

  const [hasPhysicalArmorItem, setHasPhysicalArmorItem] = useState(
    () => !!npc?.has_physical_armor_item,
  );
  const [physicalArmorBonusCharges, setPhysicalArmorBonusCharges] = useState(
    () => {
      const b = Number(npc?.physical_armor_bonus_charges);
      return Number.isFinite(b)
        ? Math.max(0, Math.min(6, Math.floor(b)))
        : 0;
    },
  );

  const [abilities, setAbilities] = useState(() =>
    normalizeNpcSheetAbilitiesNoStandard(npc?.abilities ?? []),
  );

  // Heritage and NPC type
  const [heritage, setHeritage] = useState(
    npc?.heritage ?? npc?.heritage_id ?? null,
  );
  const [heritagesList, setHeritagesList] = useState([]);
  const [playbook, setPlaybook] = useState(npc?.playbook ?? "STAND");

  useEffect(() => {
    referenceAPI
      .getHeritages()
      .then((list) => setHeritagesList(list || []))
      .catch(() => setHeritagesList([]));
  }, []);

  const resolvedHeritageDetails = useMemo(() => {
    const d = npc?.heritage_details;
    if (d && typeof d === "object" && (d.name || d.description)) {
      return d;
    }
    const hid = heritage;
    if (hid == null || hid === "") return null;
    return (
      heritagesList.find(
        (h) => h.id === hid || String(h.id) === String(hid),
      ) || null
    );
  }, [npc?.heritage_details, heritage, heritagesList]);

  // Sync heritage/playbook when NPC identity changes
  useEffect(() => {
    setHeritage(npc?.heritage ?? npc?.heritage_id ?? null);
    setPlaybook(npc?.playbook ?? "STAND");
    setSelectedHamonIds(npc?.selected_hamon_abilities ?? []);
    setSelectedSpinIds(npc?.selected_spin_abilities ?? []);
    setAbilities(normalizeNpcSheetAbilitiesNoStandard(npc?.abilities ?? []));
    setHasPhysicalArmorItem(!!npc?.has_physical_armor_item);
    const bonusArm = Number(npc?.physical_armor_bonus_charges);
    setPhysicalArmorBonusCharges(
      Number.isFinite(bonusArm)
        ? Math.max(0, Math.min(6, Math.floor(bonusArm)))
        : 0,
    );
    const hq = Number(npc?.heal_quality_fortune_dice ?? npc?.healQualityFortuneDice);
    setHealQualityFortuneDice(
      Number.isFinite(hq) && hq >= 1 && hq <= 4 ? hq : 2,
    );
    const rp = String(npc?.heal_recover_in_play_position || "risky").toLowerCase();
    setHealAllyPosition(
      ["controlled", "risky", "desperate"].includes(rp) ? rp : "risky",
    );
    const re = String(npc?.heal_recover_in_play_effect || "standard").toLowerCase();
    setHealAllyEffect(
      ["limited", "standard", "extreme"].includes(re) ? re : "standard",
    );
    setClockDraftCard(null);
    setClockDraftError("");
  }, [npc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hamon / Spin playbook abilities
  const [hamonAbilitiesList, setHamonAbilitiesList] = useState([]);
  const [spinAbilitiesList, setSpinAbilitiesList] = useState([]);
  const [selectedHamonIds, setSelectedHamonIds] = useState(
    npc?.selected_hamon_abilities ?? [],
  );
  const [selectedSpinIds, setSelectedSpinIds] = useState(
    npc?.selected_spin_abilities ?? [],
  );

  useEffect(() => {
    referenceAPI
      .getHamonAbilities()
      .then((list) => setHamonAbilitiesList(list || []))
      .catch(() => setHamonAbilitiesList([]));
    referenceAPI
      .getSpinAbilities()
      .then((list) => setSpinAbilitiesList(list || []))
      .catch(() => setSpinAbilitiesList([]));
  }, []);

  const toggleHamonAbility = (id) =>
    setSelectedHamonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const toggleSpinAbility = (id) =>
    setSelectedSpinIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  // Portrait state
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(npc?.image_url || "");
  const [imagePreview, setImagePreview] = useState(
    npc?.image || npc?.image_url || "",
  );
  const fileInputRef = useRef(null);

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState(null);
  /** Last autosave failure (API message); cleared on next successful save attempt. */
  const [saveErrorDetail, setSaveErrorDetail] = useState(null);
  const [exportPdfStatus, setExportPdfStatus] = useState(null);
  const [exportPdfError, setExportPdfError] = useState(null);
  const debounceRef = useRef(null);
  const mountedRef = useRef(false);
  const npcIdRef = useRef(npc?.id || null);
  const savingRef = useRef(false);
  /** When a debounced save fires mid-flight, queue a follow-up with latest payload. */
  const pendingSaveRef = useRef(false);
  const buildPayloadRef = useRef(null);
  const nameRef = useRef(name);
  const onSaveRef = useRef(onSave);

  const [showNpcTrackingPanel, setShowNpcTrackingPanel] = useState(false);
  const [npcTrackingTab, setNpcTrackingTab] = useState("sheet");
  const [trackingSessionPick, setTrackingSessionPick] = useState(null);
  const [npcTrackingRolls, setNpcTrackingRolls] = useState([]);
  const [npcTrackingRollsLoading, setNpcTrackingRollsLoading] =
    useState(false);
  const [npcTrackingRollsErr, setNpcTrackingRollsErr] = useState(null);
  const [npcSheetHistoryRows, setNpcSheetHistoryRows] = useState([]);
  const [npcSheetHistoryLoading, setNpcSheetHistoryLoading] = useState(false);
  const [npcSheetHistoryErr, setNpcSheetHistoryErr] = useState(null);

  useEffect(() => {
    const sessions = activeCampaign?.sessions;
    if (!Array.isArray(sessions) || sessions.length === 0) {
      setTrackingSessionPick(activeSessionId);
      return;
    }
    const ids = new Set(sessions.map((s) => s.id));
    setTrackingSessionPick((prev) => {
      if (prev != null && ids.has(prev)) return prev;
      if (activeSessionId != null && ids.has(activeSessionId)) {
        return activeSessionId;
      }
      return sessions[0].id;
    });
  }, [activeCampaign?.sessions, activeSessionId, npc?.id]);

  useEffect(() => {
    if (!showNpcTrackingPanel) return;
    const onKey = (e) => {
      if (e.key === "Escape") setShowNpcTrackingPanel(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showNpcTrackingPanel]);

  useEffect(() => {
    if (!showNpcTrackingPanel || npcTrackingTab !== "sheet") return;
    if (npc?.id == null) {
      setNpcSheetHistoryRows([]);
      setNpcSheetHistoryLoading(false);
      setNpcSheetHistoryErr(null);
      return;
    }
    let cancelled = false;
    setNpcSheetHistoryLoading(true);
    setNpcSheetHistoryErr(null);
    setNpcSheetHistoryRows([]);
    const asArray = (res) => (Array.isArray(res) ? res : res?.results || []);
    Promise.all([
      characterHistoryAPI.list({ character: npc.id }).catch(() => []),
      experienceTrackerAPI.list({ character: npc.id }).catch(() => []),
      xpHistoryAPI.list({ character: npc.id }).catch(() => []),
    ])
      .then(([histRes, etRes, xhRes]) => {
        if (cancelled) return;
        const rows = [];
        asArray(histRes).forEach((entry) => {
          const changed = entry?.changed_fields || entry?.changedFields || {};
          const keys = Object.keys(changed || {});
          if (!keys.length) return;
          const details = keys.map((k) => ({
            key: k,
            label: historyFieldLabel(k),
            oldValue: stringifyValue(changed?.[k]?.old),
            newValue: stringifyValue(changed?.[k]?.new),
          }));
          rows.push({
            key: `sheet-${entry.id}`,
            timestamp: entry.timestamp,
            actor: entry.editor_username || "system",
            type: "sheet_edit",
            details,
          });
        });
        asArray(etRes).forEach((e) => {
          rows.push({
            key: `et-${e.id}`,
            timestamp: e.session_date,
            actor: "xp (tracker)",
            type: "xp_tracker",
            text: `+${e.xp_gained ?? 0} XP — ${e.trigger_display || e.trigger || "XP"}: ${e.description || "—"}`,
          });
        });
        asArray(xhRes).forEach((x) => {
          rows.push({
            key: `xh-${x.id}`,
            timestamp: x.timestamp,
            actor: "xp (ledger)",
            type: "xp_ledger",
            text: `+${x.amount ?? 0} XP — ${x.reason || "—"}`,
          });
        });
        rows.sort(
          (a, b) =>
            new Date(b.timestamp || 0).getTime() -
            new Date(a.timestamp || 0).getTime(),
        );
        setNpcSheetHistoryRows(rows);
      })
      .catch((e) => {
        if (cancelled) return;
        setNpcSheetHistoryErr(
          e instanceof Error ? e.message : "Failed to load history",
        );
      })
      .finally(() => {
        if (cancelled) return;
        setNpcSheetHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showNpcTrackingPanel, npcTrackingTab, npc?.id]);

  useEffect(() => {
    if (
      !showNpcTrackingPanel ||
      npcTrackingTab !== "session" ||
      !campaignId ||
      !trackingSessionPick
    ) {
      return;
    }
    let cancelled = false;
    setNpcTrackingRollsLoading(true);
    setNpcTrackingRollsErr(null);
    const asArray = (res) => (Array.isArray(res) ? res : res?.results || []);
    rollAPI
      .getRolls({ campaign: campaignId, session: trackingSessionPick })
      .then((res) => {
        if (cancelled) return;
        const all = asArray(res);
        const n = String(name || "").trim();
        const filtered = n
          ? all.filter((r) => rollIsNpcHealFortuneForThisNpc(r, n))
          : [];
        setNpcTrackingRolls(filtered);
      })
      .catch((e) => {
        if (!cancelled) {
          setNpcTrackingRollsErr(
            e instanceof Error ? e.message : "Failed to load rolls",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setNpcTrackingRollsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showNpcTrackingPanel, npcTrackingTab, campaignId, trackingSessionPick, name]);

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

  // ── Derived ──────────────────────────────────────────────────────────────────

  const totalPoints = Object.values(stats).reduce(
    (s, g) => s + GRADE_PTS[g],
    0,
  );
  const level = Math.max(1, totalPoints - LEVEL_OFFSET);
  // XP expenditure: each stand coin grade = 10 XP; no action dots for NPCs
  // Level 1 baseline = 100 XP (10 pts × 10). Each 10 XP above = +1 level.
  const totalSpentXP = totalPoints * 10;

  const durGrade = stats.durability;
  const vulnSegs = DUR_VULN_CLOCK[durGrade];
  const baseRegPhysical = DUR_REGULAR_ARMOR[durGrade];
  const regArmorMax = hasPhysicalArmorItem
    ? baseRegPhysical +
      Math.max(
        0,
        Math.min(6, Math.floor(Number(physicalArmorBonusCharges) || 0)),
      )
    : 0;
  const specArmorMax = DUR_SPECIAL_ARMOR[durGrade];
  const standArmorMax = DUR_STAND_ARMOR[durGrade];
  const isDurS = durGrade === "S";

  useEffect(() => {
    setRegularUsed((u) => (u > regArmorMax ? regArmorMax : u));
  }, [regArmorMax]);

  const powerInfo = POWER_TABLE[stats.power];
  const speedInfo = SPEED_TABLE[stats.speed];
  const rangeInfo = RANGE_TABLE[stats.range];
  const precInfo = PRECISION_TABLE[stats.precision];
  const devInfo = DEV_TABLE[stats.development];

  const standCoinReadouts = useMemo(
    () => ({
      power: `Lv${POWER_TABLE[stats.power].harm} harm · ${POWER_TABLE[stats.power].pos}`,
      speed: `${SPEED_TABLE[stats.speed].base} base · ${SPEED_TABLE[stats.speed].greater} greater${SPEED_TABLE[stats.speed].note ? ` · ${SPEED_TABLE[stats.speed].note}` : ""}`,
      range: `${RANGE_TABLE[stats.range].base} · ${RANGE_TABLE[stats.range].greater} greater · ${RANGE_TABLE[stats.range].lesser} lesser`,
      durability:
        isDurS
          ? "⚠ S-DUR: No vulnerability clock — alternative win conditions required"
          : `${vulnSegs}-seg clock · ${regArmorMax} physical · ${standArmorMax} stand · ${specArmorMax} special`,
      precision: `Partial → ${PRECISION_TABLE[stats.precision].partial}`,
      development: DEV_TABLE[stats.development].split("—")[0].trim(),
    }),
    [stats, isDurS, vulnSegs, regArmorMax, standArmorMax, specArmorMax],
  );

  const bumpStandCoinGrade = useCallback((key, delta) => {
    setStats((p) => {
      const idx = GRADES.indexOf(p[key]);
      const ni = Math.max(0, Math.min(GRADES.length - 1, idx + delta));
      const next = GRADES[ni];
      if (next === p[key]) return p;
      if (key === "durability") {
        queueMicrotask(() => {
          setRegularUsed(0);
          setSpecialUsed(0);
          setStandUsed(0);
        });
      }
      return { ...p, [key]: next };
    });
  }, []);

  // ── Clock helpers ─────────────────────────────────────────────────────────────

  const toggleClockDraftCard = (kind) => {
    setClockDraftError("");
    setClockDraftCard((prev) =>
      prev?.kind === kind ? null : { kind, name: "", segments: 8 },
    );
  };

  const patchClockDraft = (patch) => {
    setClockDraftCard((d) => (d ? { ...d, ...patch } : d));
    setClockDraftError("");
  };

  const cancelClockDraftCard = () => {
    setClockDraftError("");
    setClockDraftCard(null);
  };

  const commitClockDraftCard = () => {
    if (!clockDraftCard) return;
    const name = clockDraftCard.name.trim();
    if (!name) {
      setClockDraftError("Enter a name for this clock.");
      return;
    }
    setClockDraftError("");
    let segs = Number(clockDraftCard.segments);
    if (![4, 6, 8, 12].includes(segs)) segs = 8;
    const row = {
      id: Date.now(),
      name,
      segments: segs,
      filled: 0,
      show_to_players: false,
    };
    if (clockDraftCard.kind === "conflict") {
      setConflictClocks((p) => [...p, row]);
    } else {
      setAltClocks((p) => [...p, row]);
    }
    setClockDraftCard(null);
  };

  const updateConflictClock = (id, filled) =>
    setConflictClocks((p) =>
      p.map((c) => (npcClockIdsMatch(c.id, id) ? { ...c, filled } : c)),
    );
  const deleteConflictClock = (id) =>
    setConflictClocks((p) => p.filter((c) => !npcClockIdsMatch(c.id, id)));
  const updateAltClock = (id, filled) =>
    setAltClocks((p) =>
      p.map((c) => (npcClockIdsMatch(c.id, id) ? { ...c, filled } : c)),
    );
  const deleteAltClock = (id) =>
    setAltClocks((p) => p.filter((c) => !npcClockIdsMatch(c.id, id)));

  /** Between-score upkeep: full armor boxes + all clock progress cleared (autosaves). */
  const refreshRestClocksAndArmor = useCallback(() => {
    setRegularUsed(0);
    setStandUsed(0);
    setSpecialUsed(0);
    setVulnFilled(0);
    setConflictClocks((prev) => prev.map((c) => ({ ...c, filled: 0 })));
    setAltClocks((prev) => prev.map((c) => ({ ...c, filled: 0 })));
  }, []);

  const buildPayload = useCallback(
    () => ({
      ...(npcIdRef.current ? { id: npcIdRef.current } : {}),
      name,
      stand_name: standName,
      role,
      notes,
      inventory_notes: inventoryNotes,
      heritage: heritage || null,
      playbook,
      stand_coin_stats: {
        POWER: stats.power,
        SPEED: stats.speed,
        RANGE: stats.range,
        DURABILITY: stats.durability,
        PRECISION: stats.precision,
        DEVELOPMENT: stats.development,
      },
      conflict_clocks: conflictClocks,
      alt_clocks: altClocks,
      vulnerability_clock_current: vulnFilled,
      regular_armor_used: regularUsed,
      stand_armor_used: standUsed,
      special_armor_used: specialUsed,
      has_physical_armor_item: hasPhysicalArmorItem,
      physical_armor_bonus_charges: Math.max(
        0,
        Math.min(6, Math.floor(Number(physicalArmorBonusCharges) || 0)),
      ),
      heal_quality_fortune_dice: healQualityFortuneDice,
      heal_recover_in_play_position: healAllyPosition,
      heal_recover_in_play_effect: healAllyEffect,
      abilities: normalizeNpcSheetAbilitiesNoStandard(abilities),
      hamon_ability_ids: selectedHamonIds,
      spin_ability_ids: selectedSpinIds,
      campaign: campaign || null,
      faction: faction || null,
      image_url: imageUrl,
      contacts,
      faction_status: factionStatus,
      inventory,
      ...(imageFile ? { imageFile } : {}),
    }),
    [
      name,
      standName,
      role,
      notes,
      inventoryNotes,
      heritage,
      playbook,
      stats,
      conflictClocks,
      altClocks,
      vulnFilled,
      regularUsed,
      standUsed,
      specialUsed,
      hasPhysicalArmorItem,
      physicalArmorBonusCharges,
      healQualityFortuneDice,
      healAllyPosition,
      healAllyEffect,
      abilities,
      selectedHamonIds,
      selectedSpinIds,
      campaign,
      faction,
      imageUrl,
      imageFile,
      contacts,
      factionStatus,
      inventory,
    ],
  );

  buildPayloadRef.current = buildPayload;
  nameRef.current = name;
  onSaveRef.current = onSave;

  const runNpcAutosave = useCallback(async () => {
    const saveFn = onSaveRef.current;
    if (!saveFn) return;
    if (markNpcAutosaveBusyCollision(savingRef.current, pendingSaveRef)) {
      return;
    }
    // Don't auto-save a brand-new NPC that has never been persisted and
    // still has no name — this prevents spurious creates when a blank tab
    // mounts and init effects fire state changes before the user types.
    if (!npcIdRef.current && !String(nameRef.current || "").trim()) return;

    savingRef.current = true;
    setSaveStatus("saving");
    setSaveErrorDetail(null);
    try {
      const result = await saveFn(buildPayloadRef.current());
      if (result?.id && !npcIdRef.current) npcIdRef.current = result.id;
      if (Array.isArray(result?.conflict_clocks)) {
        const next = normalizeClockList(result.conflict_clocks);
        setConflictClocks((prev) =>
          npcClockListsSemanticallyEqual(prev, next) ? prev : next,
        );
      }
      if (Array.isArray(result?.alt_clocks)) {
        const next = normalizeClockList(result.alt_clocks);
        setAltClocks((prev) =>
          npcClockListsSemanticallyEqual(prev, next) ? prev : next,
        );
      }
      setSaveStatus("saved");
      setSaveErrorDetail(null);
      setTimeout(
        () => setSaveStatus((s) => (s === "saved" ? null : s)),
        2000,
      );
    } catch (err) {
      setSaveStatus("error");
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Save failed";
      setSaveErrorDetail(msg);
      console.error("NPC autosave failed:", err);
    } finally {
      savingRef.current = false;
      if (takeNpcAutosavePending(pendingSaveRef)) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          void runNpcAutosave();
        }, 0);
      }
    }
  }, []);

  // Debounced auto-save
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runNpcAutosave();
    }, 1500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    name,
    standName,
    role,
    notes,
    inventoryNotes,
    heritage,
    playbook,
    stats,
    conflictClocks,
    altClocks,
    vulnFilled,
    regularUsed,
    standUsed,
    specialUsed,
    hasPhysicalArmorItem,
    physicalArmorBonusCharges,
    healQualityFortuneDice,
    healAllyPosition,
    healAllyEffect,
    abilities,
    selectedHamonIds,
    selectedSpinIds,
    campaign,
    faction,
    imageUrl,
    imageFile,
    contacts,
    factionStatus,
    inventory,
    runNpcAutosave,
  ]);

  // ── Styles ────────────────────────────────────────────────────────────────────

  const S = {
    page: {
      fontFamily: "monospace",
      fontSize: "13px",
      background: "#000",
      color: "#fff",
      minHeight: "100vh",
    },
    hdr: {
      background: "#1a0533",
      padding: "8px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: "8px",
      borderBottom: "2px solid #7c3aed",
      position: "sticky",
      top: 0,
      zIndex: 10,
    },
    card: {
      background: "#0d0d1a",
      border: "1px solid #2d1f52",
      borderRadius: "4px",
      padding: "12px",
      marginBottom: "12px",
    },
    lbl: {
      color: "#a78bfa",
      fontSize: "11px",
      fontWeight: "bold",
      marginBottom: "4px",
      display: "block",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
    },
    inp: {
      background: "transparent",
      color: "#fff",
      border: "none",
      borderBottom: "1px solid #4b2d8f",
      padding: "2px 4px",
      width: "100%",
      fontFamily: "monospace",
      fontSize: "13px",
      outline: "none",
      boxSizing: "border-box",
    },
    sel: {
      background: "#1f1035",
      color: "#fff",
      border: "1px solid #4b2d8f",
      padding: "4px 8px",
      fontSize: "12px",
      fontFamily: "monospace",
    },
    btn: {
      padding: "4px 12px",
      borderRadius: "4px",
      fontSize: "12px",
      cursor: "pointer",
      border: "none",
      fontFamily: "monospace",
    },
    g2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" },
    g3: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" },
    ref: {
      background: "#0a0a14",
      border: "1px solid #1f1f3a",
      borderRadius: "4px",
      padding: "8px",
      fontSize: "11px",
    },
    warn: {
      background: "#1a0000",
      border: "1px solid #7f1d1d",
      borderRadius: "4px",
      padding: "6px 10px",
      fontSize: "11px",
      color: "#fca5a5",
    },
    sdur: {
      background: "#0a1a0a",
      border: "2px solid #16a34a",
      borderRadius: "6px",
      padding: "10px",
      fontSize: "11px",
      color: "#86efac",
    },
  };

  const handleExportPdf = useCallback(async () => {
    const npcId = npc?.id;
    if (!npcId) return;
    setExportPdfStatus("exporting");
    setExportPdfError(null);
    try {
      const baseName = String(name || npc?.name || "npc")
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 80);
      await npcAPI.exportPdf(npcId, `${baseName || "npc"}-npc-sheet.pdf`);
      setExportPdfStatus("done");
      window.setTimeout(
        () => setExportPdfStatus((s) => (s === "done" ? null : s)),
        2500,
      );
    } catch (err) {
      setExportPdfStatus("error");
      setExportPdfError(err?.message || "Export failed");
    }
  }, [npc?.id, npc?.name, name]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>
      {/* ── Header ── */}
      <div style={S.hdr}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{ fontSize: "18px", fontWeight: "bold", color: "#c4b5fd" }}
          >
            1(800)BIZARRE
          </span>
          <span style={{ color: "#7c3aed", fontSize: "14px" }}>◆</span>
          <span
            style={{ fontSize: "14px", color: "#9ca3af", fontWeight: "bold" }}
          >
            GM — NPC SHEET
          </span>
          {name && (
            <span style={{ color: "#fff", fontWeight: "bold" }}>{name}</span>
          )}
          {standName && (
            <span style={{ color: "#a78bfa" }}>「{standName}」</span>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {npc?.id && (
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={saveStatus === "saving" || exportPdfStatus === "exporting"}
              style={{
                background: "#374151",
                border: "1px solid #4b5563",
                borderRadius: "6px",
                padding: "6px 10px",
                cursor:
                  saveStatus === "saving" || exportPdfStatus === "exporting"
                    ? "not-allowed"
                    : "pointer",
                color: "#d1d5db",
                fontFamily: "monospace",
                fontSize: "12px",
              }}
              title="Download fillable PDF of this NPC sheet"
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
          <button
            type="button"
            onClick={() => setShowNpcTrackingPanel((v) => !v)}
            title={
              showNpcTrackingPanel
                ? "Close NPC tracking"
                    : "NPC tracking — character sheet history & session history"
            }
            style={{
              background: showNpcTrackingPanel ? "#312e81" : "#1f2937",
              border: "1px solid #4b5563",
              borderRadius: "6px",
              padding: "6px 8px",
              cursor: "pointer",
              lineHeight: 0,
            }}
          >
            <HistoryBranchIcon />
          </button>
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
              style={{ fontSize: "11px", color: "#f87171", maxWidth: "220px" }}
              title={saveErrorDetail || "Request failed — see browser console"}
            >
              Error saving
              {saveErrorDetail
                ? `: ${saveErrorDetail.length > 90 ? `${saveErrorDetail.slice(0, 90)}…` : saveErrorDetail}`
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

      {showNpcTrackingPanel && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="NPC history"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.62)",
            zIndex: 126,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: "72px",
          }}
          onClick={() => setShowNpcTrackingPanel(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#111827",
              border: "1px solid #374151",
              borderRadius: "8px",
              padding: "12px",
              width: "min(640px, 92vw)",
              maxHeight: "72vh",
              overflowY: "auto",
              fontSize: "11px",
              boxShadow: "0 14px 40px rgba(0,0,0,0.55)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ color: "#a78bfa", fontWeight: "bold" }}>
                NPC tracking
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: "10px", color: "#9ca3af" }}>
                  Esc to close
                </span>
                <button
                  type="button"
                  onClick={() => setShowNpcTrackingPanel(false)}
                  style={{ ...S.btn, padding: "4px 10px", fontSize: "10px" }}
                >
                  Close
                </button>
              </div>
            </div>
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 10,
                color: "#6b7280",
                lineHeight: 1.45,
              }}
            >
              Character sheet history: field edits + XP ledger/tracker. Session history:
              NPC-related fortune/action rolls for the selected campaign session.
            </p>
            <div
              style={{
                display: "flex",
                gap: "6px",
                marginBottom: "10px",
                flexWrap: "wrap",
              }}
            >
              {["sheet", "session"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setNpcTrackingTab(tab)}
                  style={{
                    ...S.btn,
                    fontSize: "10px",
                    padding: "6px 10px",
                    background:
                      npcTrackingTab === tab ? "#4338ca" : "#1f2937",
                    color: npcTrackingTab === tab ? "#f9fafb" : "#d1d5db",
                    border:
                      npcTrackingTab === tab
                        ? "1px solid #818cf8"
                        : "1px solid #374151",
                  }}
                >
                  {tab === "sheet" ? "Character sheet history" : "Session history"}
                </button>
              ))}
            </div>
            {npcTrackingTab === "session" ? (
              <>
                {campaignId == null ? (
                  <div style={{ color: "#9ca3af", marginBottom: "8px" }}>
                    Link this NPC to a campaign to load session history.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr",
                      gap: "8px",
                      marginBottom: "10px",
                    }}
                  >
                    <label
                      style={{
                        fontSize: "10px",
                        color: "#9ca3af",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      Session
                      <select
                        aria-label="Tracking session"
                        value={trackingSessionPick ?? ""}
                        onChange={(e) =>
                          setTrackingSessionPick(
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                        style={{ ...S.sel, fontSize: "11px" }}
                      >
                        {(activeCampaign?.sessions || []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name || `Session ${s.id}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                {npcTrackingRollsLoading ? (
                  <div style={{ color: "#9ca3af" }}>Loading session history…</div>
                ) : null}
                {npcTrackingRollsErr ? (
                  <div style={{ color: "#fca5a5", marginBottom: "8px" }}>
                    {npcTrackingRollsErr}
                  </div>
                ) : null}
                {!npcTrackingRollsLoading &&
                !npcTrackingRollsErr &&
                npcTrackingRolls.length === 0 &&
                campaignId != null &&
                String(name || "").trim() ? (
                  <div style={{ color: "#6b7280", fontSize: "10px" }}>
                    No session history entries for “{name.trim()}” in this session.
                  </div>
                ) : null}
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {npcTrackingRolls.map((r) => {
                    const diceStr = [].concat(r.results || []).join(", ");
                    const out = String(r.outcome || "").replace(/_/g, " ");
                    const pub = String(
                      r.fortune_public_label ??
                        r.fortunePublicLabel ??
                        "",
                    ).trim();
                    const pc = String(
                      r.character_name ?? r.characterName ?? "",
                    ).trim();
                    return (
                      <div
                        key={r.id}
                        style={{
                          borderBottom: "1px solid #374151",
                          padding: "8px 0",
                        }}
                      >
                        <div style={{ color: "#6b7280", fontSize: "9px" }}>
                          {r.timestamp}
                          {pc ? ` · ${pc}` : ""}
                        </div>
                        <div style={{ color: "#e5e7eb" }}>
                          {out}
                          {String(r.roll_type || "").toUpperCase() === "FORTUNE"
                            ? ""
                            : ` · ${r.roll_type}`}{" "}
                          · pool {r.dice_pool ?? 0}
                          {diceStr ? ` · [${diceStr}]` : ""}
                        </div>
                        {pub ? (
                          <div style={{ color: "#a78bfa", marginTop: "4px" }}>
                            {pub}
                          </div>
                        ) : null}
                        {!r.fortune_reveal_outcome &&
                        String(r.roll_type || "").toUpperCase() ===
                          "FORTUNE" ? (
                          <div
                            style={{
                              color: "#57534e",
                              fontSize: "9px",
                              marginTop: "4px",
                            }}
                          >
                            Outcome not revealed to players yet (GM view).
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                {npcSheetHistoryLoading ? (
                  <div style={{ color: "#9ca3af" }}>Loading character history…</div>
                ) : npcSheetHistoryErr ? (
                  <div style={{ color: "#fca5a5" }}>{npcSheetHistoryErr}</div>
                ) : npcSheetHistoryRows.length === 0 ? (
                  <div style={{ color: "#6b7280", lineHeight: 1.45 }}>
                    No history entries.
                  </div>
                ) : (
                  npcSheetHistoryRows.slice(0, 200).map((row) => (
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
                      row.details.length > 0 ? (
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
                        ))
                      ) : null}
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
        </div>
      )}

      {/* ── Mode Toggle ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "0",
          background: "#0d0d1a",
          borderBottom: "1px solid #2d1f52",
          padding: "6px 0",
        }}
      >
        {["NPC", "CREW"].map((mode) => (
          <button
            key={mode}
            onClick={() => setActiveMode(mode)}
            style={{
              padding: "6px 24px",
              fontSize: "12px",
              fontFamily: "monospace",
              fontWeight: "bold",
              border: "1px solid #4b2d8f",
              cursor: "pointer",
              letterSpacing: "0.08em",
              background: activeMode === mode ? "#7c3aed" : "#1a0533",
              color: activeMode === mode ? "#fff" : "#9ca3af",
              borderRadius: mode === "NPC" ? "4px 0 0 4px" : "0 4px 4px 0",
            }}
          >
            {mode === "NPC" ? "NPC MODE" : "CREW MODE"}
          </button>
        ))}
      </div>

      <div style={{ padding: "16px", maxWidth: "1400px", margin: "0 auto" }}>
        {activeMode === "NPC" && (
          <>
            {/* ── Identity Bar ── */}
            <div style={{ ...S.card, borderColor: "#4c1d95" }}>
              <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
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
                      border: "2px solid #4b2d8f",
                      background: "#1f1035",
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
                        background: "#1f1035",
                        color: "#a78bfa",
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
                        background: "#1f1035",
                        color: "#a78bfa",
                      }}
                    >
                      URL
                    </button>
                  </div>
                </div>
                {/* Fields */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                    gap: "16px",
                    alignItems: "end",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <div>
                    <span style={S.lbl}>NPC Name / User Name</span>
                    <input
                      style={S.inp}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Yoshikage Kira"
                    />
                  </div>
                  <div>
                    <span style={S.lbl}>Stand Name</span>
                    <input
                      style={{
                        ...S.inp,
                        opacity: playbook === "NON_BIZARRE" ? 0.4 : 1,
                      }}
                      value={standName}
                      onChange={(e) => setStandName(e.target.value)}
                      placeholder={
                        playbook === "NON_BIZARRE"
                          ? "No stand (unless narrative beat)"
                          : "e.g. 「Killer Queen」"
                      }
                    />
                  </div>
                  <div>
                    <span style={S.lbl}>Role / Type</span>
                    <input
                      style={S.inp}
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="Boss / Ally / Minion"
                    />
                  </div>
                  <div>
                    <span style={S.lbl}>Campaign</span>
                    <select
                      style={{ ...S.sel, width: "100%" }}
                      value={campaign}
                      onChange={(e) =>
                        setCampaign(
                          e.target.value ? parseInt(e.target.value, 10) : "",
                        )
                      }
                    >
                      <option value="">No Campaign</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span style={S.lbl}>Crew / Faction</span>
                    <select
                      style={{ ...S.sel, width: "100%" }}
                      value={faction || ""}
                      onChange={(e) =>
                        setFaction(
                          e.target.value ? parseInt(e.target.value, 10) : "",
                        )
                      }
                    >
                      <option value="">— None —</option>
                      {campaignFactions.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                    {isGM && campaignId && !showNewFactionForm && (
                      <button
                        onClick={() => setShowNewFactionForm(true)}
                        style={{
                          ...S.btn,
                          marginTop: "4px",
                          fontSize: "10px",
                          padding: "2px 8px",
                          background: "transparent",
                          border: "1px dashed #4b2d8f",
                          color: "#a78bfa",
                          width: "100%",
                        }}
                      >
                        ＋ New Faction
                      </button>
                    )}
                    {isGM && showNewFactionForm && (
                      <div style={{ marginTop: "6px", display: "flex", gap: "4px" }}>
                        <input
                          style={{ ...S.inp, flex: 1 }}
                          value={newFactionName}
                          onChange={(e) => { setNewFactionName(e.target.value); setFactionCreateError(""); }}
                          placeholder="Faction name…"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleCreateFaction();
                            if (e.key === "Escape") {
                              setShowNewFactionForm(false);
                              setNewFactionName("");
                              setFactionCreateError("");
                            }
                          }}
                          autoFocus
                        />
                        <button
                          onClick={handleCreateFaction}
                          disabled={creatingFaction || !newFactionName.trim()}
                          style={{
                            ...S.btn,
                            background: "#4c1d95",
                            color: "#e9d5ff",
                            fontSize: "10px",
                            padding: "2px 8px",
                          }}
                        >
                          {creatingFaction ? "…" : "Create"}
                        </button>
                        <button
                          onClick={() => {
                            setShowNewFactionForm(false);
                            setNewFactionName("");
                            setFactionCreateError("");
                          }}
                          style={{
                            ...S.btn,
                            background: "transparent",
                            color: "#6b7280",
                            fontSize: "10px",
                            padding: "2px 6px",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    {factionCreateError && (
                      <div style={{ color: "#f87171", fontSize: "11px", marginTop: "4px" }}>
                        {factionCreateError}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "center", minWidth: "100px" }}>
                    <span style={S.lbl}>NPC LEVEL</span>
                    <div
                      style={{
                        fontSize: "28px",
                        fontWeight: "bold",
                        color:
                          level >= 7
                            ? "#f87171"
                            : level >= 4
                              ? "#fbbf24"
                              : "#34d399",
                        lineHeight: 1,
                      }}
                    >
                      {level}
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#6b7280",
                        marginTop: "2px",
                      }}
                    >
                      {totalPoints} pts × 10
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#4c1d95",
                        marginTop: "1px",
                      }}
                    >
                      = {totalSpentXP} XP spent
                    </div>
                  </div>
                </div>
                {/* Heritage + NPC Type row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                    marginTop: "12px",
                  }}
                >
                  <div>
                    <span style={S.lbl}>Heritage</span>
                    <select
                      style={{ ...S.sel, width: "100%" }}
                      value={heritage ?? ""}
                      onChange={(e) =>
                        setHeritage(
                          e.target.value
                            ? parseInt(e.target.value, 10)
                            : null,
                        )
                      }
                    >
                      <option value="">— None —</option>
                      {heritagesList.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span style={S.lbl}>NPC Type</span>
                    <select
                      style={{ ...S.sel, width: "100%" }}
                      value={playbook}
                      onChange={(e) => setPlaybook(e.target.value)}
                    >
                      <option value="STAND">Stand User</option>
                      <option value="HAMON">Hamon User</option>
                      <option value="SPIN">Spin User</option>
                      <option value="NON_BIZARRE">Non-Bizarre</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div style={S.g2}>
              {/* ════ LEFT — Stats + Reference ════ */}
              <div>
                {/* Stand Coin Stats */}
                <div style={S.card}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: "10px",
                    }}
                  >
                    <span style={S.lbl}>Stand Coin Stats</span>
                    <span style={{ fontSize: "11px", color: "#6b7280" }}>
                      {totalPoints} pts → Level {level}
                    </span>
                  </div>

                  <NpcsStandCoin
                    grades={stats}
                    readouts={standCoinReadouts}
                    onStep={bumpStandCoinGrade}
                  />
                </div>

                {/* Stat Reference Cards */}
                <div style={S.card}>
                  <span style={S.lbl}>Combat Reference</span>

                  {/* Power */}
                  <div style={{ ...S.ref, marginBottom: "8px" }}>
                    <div
                      style={{
                        color: "#f87171",
                        fontWeight: "bold",
                        marginBottom: "4px",
                      }}
                    >
                      POWER {stats.power} — Base Harm: Level {powerInfo.harm}
                    </div>
                    <div style={{ color: "#9ca3af" }}>
                      Greater Effect → Harm +1 level &nbsp;|&nbsp; Lesser Effect
                      → Harm −1 level
                    </div>
                    {(stats.power === "S" || stats.power === "A") && (
                      <div style={{ color: "#fbbf24", marginTop: "3px" }}>
                        ⚠ Can force PC position worse by 1 step
                      </div>
                    )}
                  </div>

                  {/* Speed */}
                  <div style={{ ...S.ref, marginBottom: "8px" }}>
                    <div
                      style={{
                        color: "#60a5fa",
                        fontWeight: "bold",
                        marginBottom: "4px",
                      }}
                    >
                      SPEED {stats.speed} — {speedInfo.base}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "4px",
                        color: "#9ca3af",
                      }}
                    >
                      <div>Greater: {speedInfo.greater}</div>
                      <div>Lesser: {speedInfo.lesser}</div>
                    </div>
                    <div
                      style={{
                        color: "#6b7280",
                        marginTop: "8px",
                        fontSize: "10px",
                        lineHeight: 1.45,
                      }}
                    >
                      <div
                        style={{
                          color: "#9ca3af",
                          fontWeight: 600,
                          marginBottom: "4px",
                        }}
                      >
                        Unexpected action vs PCs
                      </div>
                      Speed sets starting position when Stands clash directly.
                      Compare grades: higher usually starts Risky or better,
                      equal starts Risky, lower starts Desperate. GM adjusts
                      from fiction. Turn order stays narrative — not a fixed
                      initiative list.
                    </div>
                  </div>

                  {/* Range */}
                  <div style={{ ...S.ref, marginBottom: "8px" }}>
                    <div
                      style={{
                        color: "#34d399",
                        fontWeight: "bold",
                        marginBottom: "4px",
                      }}
                    >
                      RANGE {stats.range} — {rangeInfo.base}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "4px",
                        color: "#9ca3af",
                      }}
                    >
                      <div>Greater: {rangeInfo.greater}</div>
                      <div>Lesser: {rangeInfo.lesser}</div>
                    </div>
                    {stats.range !== "S" && (
                      <div style={{ color: "#6b7280", marginTop: "2px" }}>
                        Beyond optimal range → Effect drops 1 level
                      </div>
                    )}
                  </div>

                  {/* Precision */}
                  <div style={{ ...S.ref, marginBottom: "8px" }}>
                    <div
                      style={{
                        color: "#e879f9",
                        fontWeight: "bold",
                        marginBottom: "4px",
                      }}
                    >
                      PRECISION {stats.precision} — Reactive Counter-Effects
                    </div>
                    <div style={{ color: "#9ca3af" }}>
                      <div>PC rolls 4–5 (partial): {precInfo.partial}</div>
                      <div style={{ marginTop: "2px" }}>
                        PC rolls 1–3 (failure): {precInfo.failure}
                      </div>
                    </div>
                  </div>

                  {/* Development */}
                  <div style={S.ref}>
                    <div
                      style={{
                        color: "#fb923c",
                        fontWeight: "bold",
                        marginBottom: "4px",
                      }}
                    >
                      DEVELOPMENT {stats.development} — Tactical Adaptability
                    </div>
                    <div style={{ color: "#9ca3af", lineHeight: "1.5" }}>
                      {devInfo}
                    </div>
                  </div>
                </div>

                {/* Heritage reference (recover-in-play defaults live under Heal ally → Recover in play) */}
                <div style={S.card}>
                  <span style={S.lbl}>Heritage</span>
                  {resolvedHeritageDetails ? (
                    <>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#fde68a",
                          marginBottom: "6px",
                        }}
                      >
                        {resolvedHeritageDetails.name || "Heritage"}
                      </div>
                      {resolvedHeritageDetails.description ? (
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#9ca3af",
                            lineHeight: 1.55,
                            marginBottom: "8px",
                          }}
                        >
                          {resolvedHeritageDetails.description}
                        </div>
                      ) : null}
                      {Array.isArray(resolvedHeritageDetails.benefits) &&
                      resolvedHeritageDetails.benefits.length > 0 ? (
                        <div style={{ marginBottom: "8px" }}>
                          <div
                            style={{
                              fontSize: "9px",
                              fontWeight: 600,
                              color: "#6ee7b7",
                              marginBottom: "4px",
                            }}
                          >
                            Benefits
                          </div>
                          <ul
                            style={{
                              margin: 0,
                              paddingLeft: "18px",
                              fontSize: "10px",
                              color: "#a7f3d0",
                              lineHeight: 1.5,
                            }}
                          >
                            {resolvedHeritageDetails.benefits.map((b) => (
                              <li key={b.id}>
                                {b.name}
                                {b.description ? (
                                  <span style={{ color: "#6b7280" }}>
                                    {" "}
                                    — {b.description}
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {Array.isArray(resolvedHeritageDetails.detriments) &&
                      resolvedHeritageDetails.detriments.length > 0 ? (
                        <div style={{ marginBottom: "8px" }}>
                          <div
                            style={{
                              fontSize: "9px",
                              fontWeight: 600,
                              color: "#fca5a5",
                              marginBottom: "4px",
                            }}
                          >
                            Detriments
                          </div>
                          <ul
                            style={{
                              margin: 0,
                              paddingLeft: "18px",
                              fontSize: "10px",
                              color: "#fecaca",
                              lineHeight: 1.5,
                            }}
                          >
                            {resolvedHeritageDetails.detriments.map((d) => (
                              <li key={d.id}>
                                {d.name}
                                {d.description ? (
                                  <span style={{ color: "#6b7280" }}>
                                    {" "}
                                    — {d.description}
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#6b7280",
                        marginBottom: "10px",
                        lineHeight: 1.5,
                      }}
                    >
                      No heritage on this NPC. Choose one under Identity to show
                      properties here.
                    </div>
                  )}
                </div>

                {/* Abilities */}
                <div style={S.card}>
                  <span style={S.lbl}>Stand Abilities</span>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#6b7280",
                      marginBottom: "8px",
                    }}
                  >
                    Narrative descriptions only — no mechanical dots
                  </div>
                  {abilities.map((ab) => {
                    const typeVal =
                      String(ab.type || "").toLowerCase() === "passive"
                        ? "passive"
                        : "unique";
                    return (
                      <div
                        key={ab.id}
                        style={{
                          background: "#1a1030",
                          border: "1px solid #2d1f52",
                          borderRadius: "4px",
                          padding: "8px",
                          marginBottom: "6px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                display: "flex",
                                gap: "6px",
                                alignItems: "center",
                                marginBottom: "4px",
                                flexWrap: "wrap",
                              }}
                            >
                              <input
                                value={ab.name}
                                onChange={(e) =>
                                  setAbilities((p) =>
                                    p.map((a) =>
                                      a.id === ab.id
                                        ? { ...a, name: e.target.value }
                                        : a,
                                    ),
                                  )
                                }
                                style={{
                                  ...S.inp,
                                  flex: 1,
                                  minWidth: "140px",
                                  fontWeight: "bold",
                                  borderBottom: "1px solid #4b2d8f",
                                  fontSize: "12px",
                                }}
                                placeholder="Ability name"
                              />
                              <select
                                value={typeVal}
                                onChange={(e) =>
                                  setAbilities((p) =>
                                    p.map((a) =>
                                      a.id === ab.id
                                        ? { ...a, type: e.target.value }
                                        : a,
                                    ),
                                  )
                                }
                                style={{
                                  ...S.sel,
                                  fontSize: "10px",
                                  padding: "2px 4px",
                                }}
                              >
                                <option value="unique">Unique</option>
                                <option value="passive">Passive</option>
                              </select>
                            </div>
                            <textarea
                              value={ab.description}
                              onChange={(e) =>
                                setAbilities((p) =>
                                  p.map((a) =>
                                    a.id === ab.id
                                      ? { ...a, description: e.target.value }
                                      : a,
                                  ),
                                )
                              }
                              placeholder="What does this ability do narratively?"
                              style={{
                                width: "100%",
                                background: "transparent",
                                color: "#d1d5db",
                                border: "none",
                                fontFamily: "monospace",
                                fontSize: "11px",
                                resize: "vertical",
                                outline: "none",
                                minHeight: "40px",
                                boxSizing: "border-box",
                              }}
                            />
                          </div>
                          <button
                            onClick={() =>
                              setAbilities((p) =>
                                p.filter((a) => a.id !== ab.id),
                              )
                            }
                            style={{
                              color: "#f87171",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "15px",
                              marginLeft: "6px",
                              flexShrink: 0,
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <button
                    onClick={() =>
                      setAbilities((p) => [
                        ...p,
                        {
                          id: Date.now(),
                          name: "",
                          description: "",
                          type: "unique",
                        },
                      ])
                    }
                    style={{
                      ...S.btn,
                      border: "2px dashed #2d1f52",
                      background: "transparent",
                      color: "#6b7280",
                      width: "100%",
                      padding: "6px",
                    }}
                  >
                    + Add Ability
                  </button>
                </div>

                {/* Playbook Abilities — Hamon / Spin / Non-Bizarre */}
                {playbook !== "STAND" && (
                  <div style={S.card}>
                    <span style={S.lbl}>
                      {playbook === "HAMON"
                        ? "Hamon Playbook Abilities"
                        : playbook === "SPIN"
                          ? "Spin Playbook Abilities"
                          : "Non-Bizarre NPC"}
                    </span>

                    {playbook === "NON_BIZARRE" && (
                      <div
                        style={{
                          background: "#0a0a14",
                          border: "1px solid #374151",
                          borderRadius: "4px",
                          padding: "10px",
                          fontSize: "11px",
                          color: "#9ca3af",
                          lineHeight: "1.6",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: "bold",
                            color: "#fbbf24",
                            marginBottom: "6px",
                          }}
                        >
                          ⚠ Non-Bizarre NPC
                        </div>
                        <div>
                          This NPC does not draw from the Hamon or Spin
                          playbooks. Stand Ability blurbs in this sheet are
                          narration only — they do <strong>not</strong>{" "}
                          automatically grant a Stand; manifestation needs a GM
                          beat.
                        </div>
                      </div>
                    )}

                    {playbook === "HAMON" && (
                      <div>
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#6b7280",
                            marginBottom: "8px",
                          }}
                        >
                          Select Hamon abilities from the playbook. Toggle to
                          assign or remove.
                        </div>
                        {hamonAbilitiesList.length === 0 ? (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#6b7280",
                              padding: "8px",
                            }}
                          >
                            Loading abilities…
                          </div>
                        ) : (
                          hamonAbilitiesList.map((a) => {
                            const selected = selectedHamonIds.includes(a.id);
                            const desc = sanitizeNpcPlaybookAbilityDescription(
                              a.description,
                            );
                            return (
                              <div
                                key={a.id}
                                onClick={() => toggleHamonAbility(a.id)}
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: "8px",
                                  padding: "6px 8px",
                                  marginBottom: "4px",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  background: selected
                                    ? "#1a0a3a"
                                    : "#0d0d1a",
                                  border: `1px solid ${selected ? "#7c3aed" : "#2d1f52"}`,
                                }}
                              >
                                <div
                                  style={{
                                    width: "14px",
                                    height: "14px",
                                    borderRadius: "3px",
                                    border: "1px solid #7c3aed",
                                    background: selected
                                      ? "#7c3aed"
                                      : "transparent",
                                    flexShrink: 0,
                                    marginTop: "1px",
                                  }}
                                />
                                <div style={{ flex: 1 }}>
                                  <div
                                    style={{
                                      fontWeight: "bold",
                                      fontSize: "12px",
                                      color: selected ? "#e9d5ff" : "#d1d5db",
                                    }}
                                  >
                                    {a.name}
                                    {a.hamon_type && (
                                      <span
                                        style={{
                                          marginLeft: "6px",
                                          fontSize: "10px",
                                          color: "#a78bfa",
                                          fontWeight: "normal",
                                        }}
                                      >
                                        {a.hamon_type}
                                      </span>
                                    )}
                                  </div>
                                  {desc ? (
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        color: "#6b7280",
                                        marginTop: "2px",
                                        lineHeight: "1.4",
                                      }}
                                    >
                                      {desc}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {playbook === "SPIN" && (
                      <div>
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#6b7280",
                            marginBottom: "8px",
                          }}
                        >
                          Select Spin abilities from the playbook. Toggle to
                          assign or remove.
                        </div>
                        {spinAbilitiesList.length === 0 ? (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#6b7280",
                              padding: "8px",
                            }}
                          >
                            Loading abilities…
                          </div>
                        ) : (
                          spinAbilitiesList.map((a) => {
                            const selected = selectedSpinIds.includes(a.id);
                            const desc = sanitizeNpcPlaybookAbilityDescription(
                              a.description,
                            );
                            return (
                              <div
                                key={a.id}
                                onClick={() => toggleSpinAbility(a.id)}
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: "8px",
                                  padding: "6px 8px",
                                  marginBottom: "4px",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  background: selected
                                    ? "#0a1a0a"
                                    : "#0d0d1a",
                                  border: `1px solid ${selected ? "#16a34a" : "#2d1f52"}`,
                                }}
                              >
                                <div
                                  style={{
                                    width: "14px",
                                    height: "14px",
                                    borderRadius: "3px",
                                    border: "1px solid #16a34a",
                                    background: selected
                                      ? "#16a34a"
                                      : "transparent",
                                    flexShrink: 0,
                                    marginTop: "1px",
                                  }}
                                />
                                <div style={{ flex: 1 }}>
                                  <div
                                    style={{
                                      fontWeight: "bold",
                                      fontSize: "12px",
                                      color: selected ? "#86efac" : "#d1d5db",
                                    }}
                                  >
                                    {a.name}
                                    {a.spin_type && (
                                      <span
                                        style={{
                                          marginLeft: "6px",
                                          fontSize: "10px",
                                          color: "#34d399",
                                          fontWeight: "normal",
                                        }}
                                      >
                                        {a.spin_type}
                                      </span>
                                    )}
                                  </div>
                                  {desc ? (
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        color: "#6b7280",
                                        marginTop: "2px",
                                        lineHeight: "1.4",
                                      }}
                                    >
                                      {desc}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ════ RIGHT — Clocks + Armor ════ */}
              <div>
                {/* Durability / Vulnerability Section */}
                {isDurS ? (
                  /* S-DURABILITY — No vulnerability clock */
                  <div style={{ ...S.card, border: "2px solid #16a34a" }}>
                    <div style={S.sdur}>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: "bold",
                          color: "#22c55e",
                          marginBottom: "6px",
                        }}
                      >
                        ⬛ DURABILITY S — INVINCIBLE TO DIRECT HARM
                      </div>
                      <div style={{ marginBottom: "8px" }}>
                        This NPC has no Vulnerability Clock. Direct harm from
                        PCs cannot defeat them. Create alternative win condition
                        clocks below.
                      </div>
                      <div style={{ color: "#6b7280", fontSize: "10px" }}>
                        Examples: "Expose the User" · "Break Stand Logic" ·
                        "Destroy the Mechanism"
                      </div>
                    </div>
                    {/* Still show armor for S */}
                    <div style={{ marginTop: "12px" }}>
                      <span style={S.lbl}>Armor Charges (S-DUR)</span>
                      <div
                        style={{
                          marginTop: "8px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        <NpcPhysicalArmorBlock
                          shortLabel
                          hasItem={hasPhysicalArmorItem}
                          onHasItemChange={(v) => {
                            setHasPhysicalArmorItem(v);
                            if (!v) setRegularUsed(0);
                          }}
                          bonusCharges={physicalArmorBonusCharges}
                          onBonusChargesChange={setPhysicalArmorBonusCharges}
                          regArmorMax={regArmorMax}
                          regularUsed={regularUsed}
                          onRegularUsed={setRegularUsed}
                        />
                        <div
                          style={{
                            display: "flex",
                            gap: "16px",
                            justifyContent: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <ArmorTracker
                            label="STAND"
                            max={standArmorMax}
                            used={standUsed}
                            onChange={setStandUsed}
                            color="#0ea5e9"
                          />
                          <ArmorTracker
                            label="SPECIAL"
                            max={specArmorMax}
                            used={specialUsed}
                            onChange={setSpecialUsed}
                            color="#7c3aed"
                          />
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#6b7280",
                          textAlign: "center",
                          marginTop: "6px",
                        }}
                      >
                        Spend BEFORE filling any clock. Physical = −1 harm;
                        Stand = path armor; Special = negates harm.
                      </div>
                    </div>

                    {/* Alt win condition clocks */}
                    <div style={{ marginTop: "16px" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "8px",
                        }}
                      >
                        <span style={S.lbl}>Alternative Win Conditions</span>
                        <button
                          type="button"
                          onClick={() => toggleClockDraftCard("alt")}
                          style={{
                            ...S.btn,
                            background: "#166534",
                            color: "#86efac",
                            fontSize: "11px",
                          }}
                        >
                          + Add Clock
                        </button>
                      </div>
                      <NpcClockAddCard
                        draft={
                          clockDraftCard?.kind === "alt"
                            ? clockDraftCard
                            : null
                        }
                        error={clockDraftCard?.kind === "alt" ? clockDraftError : ""}
                        onFieldChange={patchClockDraft}
                        onCommit={() => {
                          if (clockDraftCard?.kind === "alt")
                            commitClockDraftCard();
                        }}
                        onCancel={cancelClockDraftCard}
                        namePlaceholder='e.g. "Expose User", "Break Stand Logic"'
                        borderColor="#166534"
                        createBg="#14532d"
                        createColor="#86efac"
                        createLabel="Add clock"
                      />
                      {altClocks.length === 0 && (
                        <div style={{ ...S.warn, textAlign: "center" }}>
                          S-DUR NPCs must have at least one alternative win
                          condition clock!
                        </div>
                      )}
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "16px",
                          justifyContent: "center",
                        }}
                      >
                        {altClocks.map((clk, cidx) => (
                          <div
                            key={
                              clk.id != null ? String(clk.id) : `alt-${cidx}`
                            }
                            style={{
                              textAlign: "center",
                              position: "relative",
                            }}
                          >
                            <ProgressClock
                              size={90}
                              segments={clk.segments}
                              filled={clk.filled}
                              onClick={(f) => updateAltClock(clk.id, f)}
                              color="#16a34a"
                              label={clk.name}
                              sublabel={`${clk.segments}-segment clock`}
                            />
                            <button
                              type="button"
                              onClick={() => deleteAltClock(clk.id)}
                              style={{
                                position: "absolute",
                                top: "-4px",
                                right: "-4px",
                                color: "#f87171",
                                background: "#1a0000",
                                border: "1px solid #7f1d1d",
                                borderRadius: "50%",
                                width: "16px",
                                height: "16px",
                                cursor: "pointer",
                                fontSize: "10px",
                                padding: 0,
                                lineHeight: 1,
                              }}
                            >
                              ×
                            </button>
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px",
                                marginTop: "4px",
                                fontSize: "10px",
                                color: "#86efac",
                                cursor: "pointer",
                                userSelect: "none",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={!!clk.show_to_players}
                                onChange={(e) =>
                                  setAltClocks((p) =>
                                    p.map((c) =>
                                      npcClockIdsMatch(c.id, clk.id)
                                        ? {
                                            ...c,
                                            show_to_players: e.target.checked,
                                          }
                                        : c,
                                    ),
                                  )
                                }
                              />
                              Players see
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const newName = prompt(
                                  "Rename clock:",
                                  clk.name,
                                );
                                if (newName)
                                  setAltClocks((p) =>
                                    p.map((c) =>
                                      npcClockIdsMatch(c.id, clk.id)
                                        ? { ...c, name: newName }
                                        : c,
                                    ),
                                  );
                              }}
                              style={{
                                display: "block",
                                margin: "2px auto 0",
                                color: "#6b7280",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "10px",
                              }}
                            >
                              rename
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* NORMAL DURABILITY — Vulnerability Clock + Armor */
                  <div style={S.card}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        marginBottom: "10px",
                      }}
                    >
                      <span style={S.lbl}>
                        Durability {stats.durability} — Vulnerability Clock
                      </span>
                      <span style={{ fontSize: "10px", color: "#6b7280" }}>
                        {vulnSegs} segments
                      </span>
                    </div>

                    {/* Vuln clock — independently adjustable by GM */}
                    <div
                      style={{
                        display: "flex",
                        gap: "20px",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: "0 0 auto" }}>
                        {/* Vulnerability clock — GM can increment or decrement directly */}
                        {(() => {
                          const isDefeated = vulnFilled >= vulnSegs;
                          return (
                            <div style={{ textAlign: "center" }}>
                              {isDefeated && (
                                <div
                                  style={{
                                    ...S.warn,
                                    marginBottom: "6px",
                                    textAlign: "center",
                                    fontWeight: "bold",
                                  }}
                                >
                                  ☠ DEFEATED
                                </div>
                              )}
                              <ProgressClock
                                size={100}
                                segments={vulnSegs}
                                filled={vulnFilled}
                                color={isDefeated ? "#991b1b" : "#dc2626"}
                                label="Vulnerability"
                                sublabel={`${vulnFilled}/${vulnSegs}`}
                                onClick={(newFilled) =>
                                  setVulnFilled(
                                    Math.min(Math.max(0, newFilled), vulnSegs),
                                  )
                                }
                              />
                            </div>
                          );
                        })()}
                        {isGM && campaignId && npc?.id && vulnSegs > 0 && (
                          <div
                            style={{
                              marginTop: "10px",
                              maxWidth: "260px",
                              textAlign: "left",
                              fontSize: "10px",
                              color: "#9ca3af",
                            }}
                          >
                            {activeSessionLoading && (
                              <div>Loading session…</div>
                            )}
                            {!activeSessionLoading && activeSessionId == null && (
                              <div>
                                Set an active session for this campaign to control
                                player visibility.
                              </div>
                            )}
                            {!activeSessionLoading &&
                              activeSessionId != null &&
                              !sessionInvolvementForNpc && (
                                <div>
                                  Add this NPC to the active session in Campaign
                                  Management to show its vulnerability clock on player
                                  character sheets.
                                </div>
                              )}
                            {!activeSessionLoading &&
                              sessionInvolvementForNpc && (
                                <label
                                  style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: "6px",
                                    cursor:
                                      vulnRevealSaving ||
                                      !!sessionInvolvementForNpc.show_clocks_to_players
                                        ? "not-allowed"
                                        : "pointer",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={
                                      !!sessionInvolvementForNpc.show_clocks_to_players ||
                                      !!sessionInvolvementForNpc.show_vulnerability_clock_to_players
                                    }
                                    disabled={
                                      vulnRevealSaving ||
                                      !!sessionInvolvementForNpc.show_clocks_to_players
                                    }
                                    onChange={() =>
                                      void toggleVulnerabilityVisibleToPlayers()
                                    }
                                  />
                                  <span>
                                    Show vulnerability clock on player character
                                    sheets (active session)
                                  </span>
                                </label>
                              )}
                          </div>
                        )}
                      </div>

                      {/* Armor charges */}
                      <div
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        <div style={{ fontSize: "10px", color: "#9ca3af" }}>
                          Spend armor charges <strong>before</strong> filling
                          clocks.
                        </div>
                        <NpcPhysicalArmorBlock
                          shortLabel={false}
                          hasItem={hasPhysicalArmorItem}
                          onHasItemChange={(v) => {
                            setHasPhysicalArmorItem(v);
                            if (!v) setRegularUsed(0);
                          }}
                          bonusCharges={physicalArmorBonusCharges}
                          onBonusChargesChange={setPhysicalArmorBonusCharges}
                          regArmorMax={regArmorMax}
                          regularUsed={regularUsed}
                          onRegularUsed={setRegularUsed}
                        />
                        <ArmorTracker
                          label="STAND ARMOR"
                          max={standArmorMax}
                          used={standUsed}
                          onChange={setStandUsed}
                          color="#0ea5e9"
                        />
                        <ArmorTracker
                          label="SPECIAL ARMOR"
                          max={specArmorMax}
                          used={specialUsed}
                          onChange={setSpecialUsed}
                          color="#7c3aed"
                        />
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#4b5563",
                            lineHeight: "1.5",
                          }}
                        >
                          Physical: Durability baseline + optional GM extra — only
                          when the physical armor item box is checked
                          <br />
                          Stand (Durability): path / Stand armor pool
                          <br />
                          Special (Durability): completely negate harm
                        </div>
                        <button
                          onClick={() => {
                            setRegularUsed(0);
                            setStandUsed(0);
                            setSpecialUsed(0);
                          }}
                          style={{
                            ...S.btn,
                            background: "#1f2937",
                            color: "#9ca3af",
                            fontSize: "10px",
                            alignSelf: "flex-start",
                          }}
                        >
                          Reset Armor
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Conflict Clocks — PCs roll to fill these */}
                <div style={S.card}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <div>
                      <span style={S.lbl}>Conflict Clocks</span>
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#6b7280",
                          marginTop: "2px",
                        }}
                      >
                        PCs roll action ratings to fill these. Limited=1 tick,
                        Standard=2, Greater=3. Use{" "}
                        <strong>Players see</strong> to show individual clocks on
                        session-linked PC sheets without revealing every clock.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleClockDraftCard("conflict")}
                      style={{
                        ...S.btn,
                        background: "#4c1d95",
                        color: "#e9d5ff",
                        fontSize: "11px",
                      }}
                    >
                      + Clock
                    </button>
                  </div>

                  <NpcClockAddCard
                    draft={
                      clockDraftCard?.kind === "conflict"
                        ? clockDraftCard
                        : null
                    }
                    error={
                      clockDraftCard?.kind === "conflict"
                        ? clockDraftError
                        : ""
                    }
                    onFieldChange={patchClockDraft}
                    onCommit={() => {
                      if (clockDraftCard?.kind === "conflict")
                        commitClockDraftCard();
                    }}
                    onCancel={cancelClockDraftCard}
                    namePlaceholder='e.g. "Defeat antagonist", "Expose the User"'
                    borderColor="#6d28d9"
                    createBg="#4c1d95"
                    createColor="#e9d5ff"
                    createLabel="Add clock"
                  />

                  {conflictClocks.length === 0 && (
                    <div
                      style={{
                        color: "#6b7280",
                        fontSize: "11px",
                        textAlign: "center",
                        padding: "12px",
                      }}
                    >
                      No clocks yet — add one to start tracking the conflict.
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "16px",
                      justifyContent:
                        conflictClocks.length <= 2 ? "center" : "flex-start",
                    }}
                  >
                    {conflictClocks.map((clk, cidx) => {
                      const isComplete = clk.filled >= clk.segments;
                      return (
                        <div
                          key={
                            clk.id != null ? String(clk.id) : `conf-${cidx}`
                          }
                          style={{
                            textAlign: "center",
                            position: "relative",
                            background: isComplete ? "#0a1a0a" : "transparent",
                            border: isComplete ? "1px solid #16a34a" : "none",
                            borderRadius: "6px",
                            padding: isComplete ? "6px" : "0",
                          }}
                        >
                          {isComplete && (
                            <div
                              style={{
                                fontSize: "10px",
                                color: "#22c55e",
                                fontWeight: "bold",
                                marginBottom: "4px",
                              }}
                            >
                              ✓ COMPLETE
                            </div>
                          )}
                          <ProgressClock
                            size={90}
                            segments={clk.segments}
                            filled={clk.filled}
                            onClick={(f) => updateConflictClock(clk.id, f)}
                            color={isComplete ? "#16a34a" : "#7c3aed"}
                            label={clk.name}
                            sublabel={`${clk.segments}-seg`}
                          />
                          <div
                            style={{
                              marginTop: "6px",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                fontSize: "10px",
                                color: "#a78bfa",
                                cursor: "pointer",
                                userSelect: "none",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={!!clk.show_to_players}
                                onChange={(e) =>
                                  setConflictClocks((p) =>
                                    p.map((c) =>
                                      npcClockIdsMatch(c.id, clk.id)
                                        ? {
                                            ...c,
                                            show_to_players: e.target.checked,
                                          }
                                        : c,
                                    ),
                                  )
                                }
                              />
                              Players see
                            </label>
                            <div
                              style={{
                                display: "flex",
                                gap: "4px",
                                justifyContent: "center",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  const newName = prompt(
                                    "Rename clock:",
                                    clk.name,
                                  );
                                  if (newName)
                                    setConflictClocks((p) =>
                                      p.map((c) =>
                                        npcClockIdsMatch(c.id, clk.id)
                                          ? { ...c, name: newName }
                                          : c,
                                      ),
                                    );
                                }}
                                style={{
                                  color: "#6b7280",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: "10px",
                                }}
                              >
                                rename
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteConflictClock(clk.id)}
                                style={{
                                  color: "#f87171",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: "10px",
                                }}
                              >
                                delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Effect tick reference */}
                  <div
                    style={{
                      marginTop: "12px",
                      display: "flex",
                      gap: "6px",
                      justifyContent: "center",
                    }}
                  >
                    {[
                      ["LIMITED", "1 tick", "#6b7280"],
                      ["STANDARD", "2 ticks", "#7c3aed"],
                      ["GREATER", "3 ticks", "#16a34a"],
                    ].map(([label, ticks, color]) => (
                      <div
                        key={label}
                        style={{
                          background: "#0a0a14",
                          border: `1px solid ${color}`,
                          borderRadius: "4px",
                          padding: "4px 8px",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "10px",
                            color,
                            fontWeight: "bold",
                          }}
                        >
                          {label}
                        </div>
                        <div style={{ fontSize: "11px", color: "#d1d5db" }}>
                          {ticks}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Healing and Recovery — GM reference (no PC-style dice pool on NPCs) */}
                <div style={S.card}>
                  <span style={S.lbl}>Healing and recovery</span>
                  <div
                    style={{
                      fontSize: "11px",
                      lineHeight: 1.75,
                      color: "#9ca3af",
                    }}
                  >
                    <div
                      style={{
                        marginBottom: "10px",
                        padding: "8px",
                        background: "#0a0a14",
                        borderRadius: "4px",
                        border: "1px solid #2d1f52",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "10px",
                          fontWeight: "bold",
                          color: "#a78bfa",
                          marginBottom: "4px",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Heal ally
                      </div>
                      <div
                        style={{
                          marginBottom: "10px",
                          padding: "8px",
                          background: "#08080f",
                          borderRadius: "4px",
                          border: "1px solid #3b2d5c",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "10px",
                            fontWeight: "bold",
                            color: "#c4b5fd",
                            marginBottom: "6px",
                            letterSpacing: "0.04em",
                          }}
                        >
                          Quality tier
                        </div>
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#6b7280",
                            marginBottom: "8px",
                            lineHeight: 1.5,
                          }}
                        >
                          Sets how many <strong style={{ color: "#a78bfa" }}>d6</strong>{" "}
                          to roll on a <strong style={{ color: "#a78bfa" }}>fortune</strong>{" "}
                          when this NPC provides care. After you pick a heal target,
                          use <strong style={{ color: "#d1d5db" }}>Roll recover in play fortune</strong>{" "}
                          under <strong style={{ color: "#d1d5db" }}>Recover in play</strong>{" "}
                          (same card family as this tier), or{" "}
                          <strong style={{ color: "#d1d5db" }}>
                            Roll downtime recover fortune
                          </strong>{" "}
                          under <strong style={{ color: "#d1d5db" }}>Downtime recover</strong>{" "}
                          below. Same tier for both; table preview only (not saved).
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "6px",
                          }}
                        >
                          {[
                            { dice: 1, label: "I", blurb: "1d" },
                            { dice: 2, label: "II", blurb: "2d" },
                            { dice: 3, label: "III", blurb: "3d" },
                            { dice: 4, label: "IV", blurb: "4d" },
                          ].map(({ dice, label, blurb }) => {
                            const on = healQualityFortuneDice === dice;
                            return (
                              <button
                                key={dice}
                                type="button"
                                onClick={() => setHealQualityFortuneDice(dice)}
                                title={`Fortune pool ${blurb} when this NPC heals or stabilizes`}
                                style={{
                                  flex: "1 1 68px",
                                  minWidth: "68px",
                                  padding: "6px 4px",
                                  borderRadius: "4px",
                                  border: on
                                    ? "1px solid #a78bfa"
                                    : "1px solid #4b5563",
                                  background: on ? "#4c1d95" : "#111827",
                                  color: on ? "#f5f3ff" : "#9ca3af",
                                  fontSize: "10px",
                                  fontFamily: "monospace",
                                  cursor: "pointer",
                                  lineHeight: 1.35,
                                }}
                              >
                                <div style={{ fontWeight: "bold", color: "#e9d5ff" }}>
                                  Tier {label}
                                </div>
                                <div style={{ fontSize: "9px", opacity: 0.9 }}>
                                  {blurb} fortune
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div style={{ color: "#6b7280", marginBottom: "10px" }}>
                        When this NPC treats or stabilizes a PC (or another NPC),
                        resolve with agreed fiction: fortune, clocks, consumables,
                        or a direct consequence trade. NPCs do not use PC action
                        dice or stand-coin pools for healing rolls unless the table
                        explicitly homebrews it.
                      </div>
                      <div
                        style={{
                          fontSize: "10px",
                          fontWeight: "bold",
                          color: "#94a3b8",
                          marginBottom: "4px",
                        }}
                      >
                        Fellow faction NPCs
                      </div>
                      {currentFactionId == null ? (
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#57534e",
                            marginBottom: "10px",
                          }}
                        >
                          Assign this NPC to a faction above to list allies in the
                          same faction.
                        </div>
                      ) : factionNpcPeers.length === 0 ? (
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#57534e",
                            marginBottom: "10px",
                          }}
                        >
                          No other NPCs in this faction yet.
                        </div>
                      ) : (
                        <ul
                          style={{
                            margin: "0 0 10px 0",
                            paddingLeft: "18px",
                            fontSize: "10px",
                            color: "#d1d5db",
                          }}
                        >
                          {factionNpcPeers.map((n) => (
                            <li key={n.id}>
                              {n.name || "NPC"}
                              {n.stand_name ? (
                                <span style={{ color: "#6b7280" }}>
                                  {" "}
                                  — {n.stand_name}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div
                        style={{
                          fontSize: "10px",
                          fontWeight: "bold",
                          color: "#94a3b8",
                          marginBottom: "4px",
                        }}
                      >
                        Player character (heal target)
                      </div>
                      {campaignId == null ? (
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#57534e",
                            marginBottom: "10px",
                          }}
                        >
                          Link this NPC to a campaign to pick a PC from the roster.
                        </div>
                      ) : campaignPlayerCharacters.length === 0 ? (
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#57534e",
                            marginBottom: "10px",
                          }}
                        >
                          No PCs on this campaign yet.
                        </div>
                      ) : (
                        <select
                          aria-label="Heal target player character"
                          value={healAllyPcId}
                          onChange={(e) => setHealAllyPcId(e.target.value)}
                          style={{
                            width: "100%",
                            maxWidth: "320px",
                            marginBottom: "10px",
                            background: "#1f2937",
                            color: "#e5e7eb",
                            border: "1px solid #4b5563",
                            padding: "6px 8px",
                            fontSize: "11px",
                            fontFamily: "monospace",
                            borderRadius: "4px",
                          }}
                        >
                          <option value="">— Choose PC —</option>
                          {campaignPlayerCharacters.map((ch) => (
                            <option key={ch.id} value={String(ch.id)}>
                              {ch.true_name || ch.alias || `Character ${ch.id}`}
                            </option>
                          ))}
                        </select>
                      )}
                      <div
                        style={{
                          marginTop: "10px",
                          paddingTop: "10px",
                          borderTop: "1px solid #2d1f52",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "10px",
                            fontWeight: "bold",
                            color: "#38bdf8",
                            marginBottom: "6px",
                            letterSpacing: "0.03em",
                          }}
                        >
                          Recover in play (mid-score)
                        </div>
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#57534e",
                            marginBottom: "8px",
                            lineHeight: 1.65,
                          }}
                        >
                          <strong style={{ color: "#78716c" }}>Ruling:</strong>{" "}
                          During an active score the fiction must allow a credible
                          pause—time, cover, or pressure drop the table agrees on.
                          Use position/effect to flag how dangerous rushed treatment
                          is. If you mirror PC healing costs, stress and similar
                          spends usually belong to the{" "}
                          <strong style={{ color: "#a8a29e" }}>
                            recipient PC
                          </strong>
                          , not this NPC’s sheet.
                        </div>
                        {campaignId != null &&
                        campaignPlayerCharacters.length > 0 &&
                        !healAllyPcId ? (
                          <div
                            style={{
                              fontSize: "9px",
                              color: "#78716c",
                              marginBottom: "10px",
                              lineHeight: 1.55,
                              padding: "8px",
                              background: "#0d1117",
                              borderRadius: "4px",
                              border: "1px solid #374151",
                            }}
                          >
                            Choose a <strong style={{ color: "#a8a29e" }}>player character</strong>{" "}
                            above to unlock recover-in-play{" "}
                            <strong style={{ color: "#a8a29e" }}>position</strong>,{" "}
                            <strong style={{ color: "#a8a29e" }}>effect</strong>, and{" "}
                            <strong style={{ color: "#a8a29e" }}>fortune</strong>{" "}
                            (same nested card style as{" "}
                            <strong style={{ color: "#a8a29e" }}>Quality tier</strong>
                            ).
                          </div>
                        ) : null}
                        {healAllyPcId ? (
                          <div
                            style={{
                              marginBottom: "10px",
                              padding: "8px",
                              background: "#08080f",
                              borderRadius: "4px",
                              border: "1px solid #3b2d5c",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "9px",
                                fontWeight: "bold",
                                color: "#c4b5fd",
                                marginBottom: "6px",
                                letterSpacing: "0.04em",
                              }}
                            >
                              Quality tier — recover in play
                            </div>
                            <div
                              style={{
                                fontSize: "9px",
                                fontWeight: "bold",
                                color: "#6b7280",
                                marginBottom: "6px",
                              }}
                            >
                              Recover in play — default position & effect
                            </div>
                            <div
                              style={{
                                fontSize: "10px",
                                color: "#57534e",
                                marginBottom: "8px",
                                lineHeight: 1.55,
                              }}
                            >
                              Saved on this NPC for recover in play under this
                              character&apos;s care (current target: selected PC
                              above).
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "8px",
                                alignItems: "center",
                                marginBottom: "8px",
                              }}
                            >
                              <label
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "2px",
                                  fontSize: "9px",
                                  color: "#6b7280",
                                }}
                              >
                                Position
                                <select
                                  aria-label="Recover in play default position"
                                  value={healAllyPosition}
                                  onChange={(e) =>
                                    setHealAllyPosition(e.target.value)
                                  }
                                  style={{
                                    background: "#1f2937",
                                    color: "#e5e7eb",
                                    border: "1px solid #4b5563",
                                    padding: "4px 6px",
                                    fontSize: "11px",
                                    fontFamily: "monospace",
                                    borderRadius: "4px",
                                  }}
                                >
                                  <option value="controlled">Controlled</option>
                                  <option value="risky">Risky</option>
                                  <option value="desperate">Desperate</option>
                                </select>
                              </label>
                              <label
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "2px",
                                  fontSize: "9px",
                                  color: "#6b7280",
                                }}
                              >
                                Effect
                                <select
                                  aria-label="Recover in play default effect tier"
                                  value={healAllyEffect}
                                  onChange={(e) =>
                                    setHealAllyEffect(e.target.value)
                                  }
                                  style={{
                                    background: "#1f2937",
                                    color: "#e5e7eb",
                                    border: "1px solid #4b5563",
                                    padding: "4px 6px",
                                    fontSize: "11px",
                                    fontFamily: "monospace",
                                    borderRadius: "4px",
                                  }}
                                >
                                  <option value="limited">Limited</option>
                                  <option value="standard">Standard</option>
                                  <option value="extreme">Extreme</option>
                                </select>
                              </label>
                            </div>
                            <div
                              style={{
                                fontSize: "9px",
                                color: "#6b7280",
                                lineHeight: 1.45,
                                marginBottom: "6px",
                              }}
                            >
                              Fortune uses the <strong style={{ color: "#a8a29e" }}>d6 count</strong>{" "}
                              from <strong style={{ color: "#a8a29e" }}>Quality tier</strong>{" "}
                              above.
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                rollHealQualityFortune("recover_in_play")
                              }
                              title="Roll Nd6 using Quality tier (GM preview — not saved to session)"
                              style={{
                                padding: "8px 10px",
                                borderRadius: "4px",
                                border: "1px solid #7c3aed",
                                background: "#5b21b6",
                                color: "#faf5ff",
                                fontSize: "11px",
                                fontFamily: "monospace",
                                fontWeight: "bold",
                                cursor: "pointer",
                                width: "100%",
                                boxSizing: "border-box",
                              }}
                            >
                              Roll recover in play fortune ({healQualityFortuneDice}d)
                            </button>
                            {healFortuneRollPreview?.kind === "recover_in_play" ? (
                              <div
                                style={{
                                  marginTop: "6px",
                                  fontSize: "10px",
                                  color: "#c4b5fd",
                                  textAlign: "center",
                                  lineHeight: 1.5,
                                  padding: "6px",
                                  background: "#111827",
                                  borderRadius: "4px",
                                  border: "1px solid #4c1d95",
                                }}
                              >
                                [
                                {healFortuneRollPreview.results.join(", ")}] → highest{" "}
                                <strong>{healFortuneRollPreview.highest}</strong>
                                {healFortuneRollPreview.critical ? (
                                  <span style={{ color: "#fbbf24" }}> · critical</span>
                                ) : null}
                                <div style={{ fontSize: "9px", color: "#6b7280" }}>
                                  GM preview only — log to session history or a PC
                                  roll if you need a saved record.
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <textarea
                          value={healAllyRecoveryNote}
                          onChange={(e) =>
                            setHealAllyRecoveryNote(e.target.value)
                          }
                          placeholder="In-play notes: stress spent, clocks ticked, complications, scene beats…"
                          style={{
                            width: "100%",
                            minHeight: "48px",
                            background: "#0d1117",
                            color: "#d1d5db",
                            border: "1px solid #374151",
                            padding: "6px 8px",
                            fontSize: "10px",
                            fontFamily: "monospace",
                            borderRadius: "4px",
                            resize: "vertical",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          marginTop: "10px",
                          paddingTop: "10px",
                          borderTop: "1px solid #2d1f52",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "10px",
                            fontWeight: "bold",
                            color: "#34d399",
                            marginBottom: "6px",
                            letterSpacing: "0.03em",
                          }}
                        >
                          Downtime recover
                        </div>
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#57534e",
                            marginBottom: "8px",
                            lineHeight: 1.65,
                          }}
                        >
                          <strong style={{ color: "#78716c" }}>Ruling:</strong>{" "}
                          Between scores (or any pause the table treats as
                          downtime): longer treatment scenes, full kits, sleep,
                          and healing clocks without the score breathing down your
                          neck.{" "}
                          <strong style={{ color: "#a8a29e" }}>
                            Not the same bar as mid-action recover
                          </strong>
                          —no position/effect track here unless you deliberately
                          re-introduce danger as a second beat.
                        </div>
                        {healAllyPcId ? (
                          <div
                            style={{
                              marginBottom: "8px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "6px",
                              alignItems: "stretch",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => rollHealQualityFortune("downtime")}
                              title="Roll Nd6 using Quality tier (GM preview — not saved to session)"
                              style={{
                                padding: "8px 10px",
                                borderRadius: "4px",
                                border: "1px solid #059669",
                                background: "#047857",
                                color: "#ecfdf5",
                                fontSize: "11px",
                                fontFamily: "monospace",
                                fontWeight: "bold",
                                cursor: "pointer",
                              }}
                            >
                              Roll downtime recover fortune ({healQualityFortuneDice}d)
                            </button>
                            {healFortuneRollPreview?.kind === "downtime" ? (
                              <div
                                style={{
                                  fontSize: "10px",
                                  color: "#6ee7b7",
                                  textAlign: "center",
                                  lineHeight: 1.5,
                                  padding: "6px",
                                  background: "#111827",
                                  borderRadius: "4px",
                                  border: "1px solid #065f46",
                                }}
                              >
                                [
                                {healFortuneRollPreview.results.join(", ")}] → highest{" "}
                                <strong>{healFortuneRollPreview.highest}</strong>
                                {healFortuneRollPreview.critical ? (
                                  <span style={{ color: "#fbbf24" }}> · critical</span>
                                ) : null}
                                <div style={{ fontSize: "9px", color: "#6b7280" }}>
                                  GM preview only — log to session history or a PC
                                  roll if you need a saved record.
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : campaignId != null &&
                          campaignPlayerCharacters.length > 0 ? (
                          <div
                            style={{
                              fontSize: "9px",
                              color: "#78716c",
                              marginBottom: "8px",
                              lineHeight: 1.55,
                            }}
                          >
                            Choose a <strong style={{ color: "#a8a29e" }}>heal target</strong>{" "}
                            above to roll downtime recover fortune.
                          </div>
                        ) : null}
                        <textarea
                          value={healAllyDowntimeNote}
                          onChange={(e) =>
                            setHealAllyDowntimeNote(e.target.value)
                          }
                          placeholder="Downtime notes: projects, healing clock fills, supplies used, off-screen care…"
                          style={{
                            width: "100%",
                            minHeight: "48px",
                            background: "#0d1117",
                            color: "#d1d5db",
                            border: "1px solid #374151",
                            padding: "6px 8px",
                            fontSize: "10px",
                            fontFamily: "monospace",
                            borderRadius: "4px",
                            resize: "vertical",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "8px",
                        background: "#0a0a14",
                        borderRadius: "4px",
                        border: "1px solid #2d1f52",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "10px",
                          fontWeight: "bold",
                          color: "#a78bfa",
                          marginBottom: "4px",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Rest & recovery
                      </div>
                      <div
                        style={{
                          color: "#6b7280",
                          marginBottom: "10px",
                          lineHeight: 1.55,
                        }}
                      >
                        Complements <strong style={{ color: "#94a3b8" }}>
                          Downtime recover
                        </strong>{" "}
                        above: armor resets, stress clears, long projects, and any
                        other between-score upkeep the table tracks for this NPC.
                      </div>
                      <button
                        type="button"
                        aria-label="Refresh all clocks and armor charges for rest"
                        title="Clears vulnerability, conflict, and alt clock progress; restores spent regular, stand, and special armor (autosaves)."
                        onClick={refreshRestClocksAndArmor}
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "8px 10px",
                          borderRadius: "4px",
                          border: "1px solid #7c3aed",
                          background: "#4c1d95",
                          color: "#f5f3ff",
                          fontSize: "11px",
                          fontFamily: "monospace",
                          fontWeight: "bold",
                          cursor: "pointer",
                        }}
                      >
                        Refresh clocks & armor charges
                      </button>
                    </div>
                  </div>
                </div>

                {/* GM Notes */}
                <div style={S.card}>
                  <span style={S.lbl}>GM Notes</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Tactics, motivations, encounter context, rematch notes…"
                    style={{
                      width: "100%",
                      height: "120px",
                      background: "#0a0a14",
                      color: "#d1d5db",
                      border: "1px solid #2d1f52",
                      padding: "8px",
                      fontFamily: "monospace",
                      fontSize: "12px",
                      resize: "vertical",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>
                {/* Inventory (free text) */}
                <div style={S.card}>
                  <span style={S.lbl}>INVENTORY</span>
                  <textarea
                    value={inventoryNotes}
                    onChange={(e) => setInventoryNotes(e.target.value)}
                    placeholder="Gear, valuables, evidence, vehicles, anything they carry…"
                    style={{
                      width: "100%",
                      height: "120px",
                      background: "#0a0a14",
                      color: "#d1d5db",
                      border: "1px solid #2d1f52",
                      padding: "8px",
                      fontFamily: "monospace",
                      fontSize: "12px",
                      resize: "vertical",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════ CREW MODE ══════════════════════════════════ */}
        {activeMode === "CREW" && (
          <div>
            {/* Crew Header */}
            <div style={S.card}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <span
                  style={{
                    fontSize: "16px",
                    fontWeight: "bold",
                    color: "#c4b5fd",
                  }}
                >
                  {name || "New NPC"} — Crew Management
                </span>
                {role && (
                  <span
                    style={{
                      background: "#4c1d95",
                      padding: "2px 10px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      color: "#e9d5ff",
                    }}
                  >
                    {role}
                  </span>
                )}
              </div>
              <div style={{ marginTop: "8px" }}>
                <span style={S.lbl}>CREW / FACTION</span>
                <select
                  style={{ ...S.sel, width: "100%" }}
                  value={faction || ""}
                  onChange={(e) =>
                    setFaction(
                      e.target.value ? parseInt(e.target.value, 10) : "",
                    )
                  }
                >
                  <option value="">— None —</option>
                  {campaignFactions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                {isGM && campaignId && !showNewFactionForm && (
                  <button
                    onClick={() => setShowNewFactionForm(true)}
                    style={{
                      ...S.btn,
                      marginLeft: "8px",
                      fontSize: "10px",
                      padding: "3px 10px",
                      background: "transparent",
                      border: "1px dashed #4b2d8f",
                      color: "#a78bfa",
                    }}
                  >
                    ＋ New Faction
                  </button>
                )}
                {isGM && showNewFactionForm && (
                  <div style={{ marginTop: "6px", display: "flex", gap: "4px" }}>
                    <input
                      style={{ ...S.inp, flex: 1 }}
                      value={newFactionName}
                      onChange={(e) => { setNewFactionName(e.target.value); setFactionCreateError(""); }}
                      placeholder="Faction name…"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateFaction();
                        if (e.key === "Escape") {
                          setShowNewFactionForm(false);
                          setNewFactionName("");
                          setFactionCreateError("");
                        }
                      }}
                      autoFocus
                    />
                    <button
                      onClick={handleCreateFaction}
                      disabled={creatingFaction || !newFactionName.trim()}
                      style={{
                        ...S.btn,
                        background: "#4c1d95",
                        color: "#e9d5ff",
                        fontSize: "10px",
                        padding: "2px 8px",
                      }}
                    >
                      {creatingFaction ? "…" : "Create"}
                    </button>
                    <button
                      onClick={() => {
                        setShowNewFactionForm(false);
                        setNewFactionName("");
                        setFactionCreateError("");
                      }}
                      style={{
                        ...S.btn,
                        background: "transparent",
                        color: "#6b7280",
                        fontSize: "10px",
                        padding: "2px 6px",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
                {factionCreateError && (
                  <div style={{ color: "#f87171", fontSize: "11px", marginTop: "4px" }}>
                    {factionCreateError}
                  </div>
                )}
                <div
                  style={{
                    fontSize: "10px",
                    color: "#6b7280",
                    marginTop: "4px",
                  }}
                >
                  Faction this NPC belongs to (also manageable in campaign
                  management)
                </div>
              </div>
            </div>

            {/* Faction Identity Panel — only shown when a faction is selected */}
            {faction && (
              <div style={{ ...S.card, borderColor: "#4c1d95" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <span style={{ ...S.lbl, margin: 0 }}>FACTION IDENTITY</span>
                  {factionDetailLoading && (
                    <span style={{ fontSize: "10px", color: "#6b7280" }}>Loading…</span>
                  )}
                  {isGM && (
                    <span style={{ fontSize: "10px", color: "#a78bfa", marginLeft: "auto" }}>
                      ⚡ Changes saved to faction &amp; shared with all NPCs in this faction
                    </span>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr", gap: "12px" }}>
                  <div>
                    <span style={S.lbl}>Faction Name</span>
                    <input
                      style={S.inp}
                      value={factionName}
                      onChange={(e) => setFactionName(e.target.value)}
                      placeholder="e.g. The Passione"
                      disabled={!isGM}
                    />
                  </div>
                  <div>
                    <span style={S.lbl}>Faction Type</span>
                    <input
                      style={S.inp}
                      value={factionType}
                      onChange={(e) => setFactionType(e.target.value)}
                      placeholder="e.g. Criminal Syndicate"
                      disabled={!isGM}
                    />
                  </div>
                  <div>
                    <span style={S.lbl}>Level</span>
                    <input
                      style={{ ...S.inp, width: "60px" }}
                      type="number"
                      min="0"
                      value={factionLevel}
                      onChange={(e) => setFactionLevel(Number(e.target.value))}
                      disabled={!isGM}
                    />
                  </div>
                  <div>
                    <span style={S.lbl}>Hold</span>
                    <select
                      style={S.sel}
                      value={factionHold}
                      onChange={(e) => setFactionHold(e.target.value)}
                      disabled={!isGM}
                    >
                      <option value="weak">Weak</option>
                      <option value="strong">Strong</option>
                    </select>
                  </div>
                  <div>
                    <span style={S.lbl}>Reputation</span>
                    <input
                      style={{ ...S.inp, width: "60px" }}
                      type="number"
                      value={factionReputation}
                      onChange={(e) => setFactionReputation(Number(e.target.value))}
                      disabled={!isGM}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Shared label banner when faction is set */}
            {faction && (
              <div
                style={{
                  background: "#1a0533",
                  border: "1px solid #4b2d8f",
                  borderRadius: "4px",
                  padding: "6px 12px",
                  marginBottom: "10px",
                  fontSize: "11px",
                  color: "#a78bfa",
                }}
              >
                ⚡ The fields below are <strong>shared across all NPCs in this faction</strong> — edits here update the faction for everyone.
              </div>
            )}

            <div style={S.g2}>
              {/* Contacts */}
              <div style={S.card}>
                <span style={S.lbl}>CONTACTS / ASSOCIATES</span>
                <div style={{ marginBottom: "8px" }}>
                  {(faction ? factionContacts : contacts).map((c, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: "6px",
                        marginBottom: "6px",
                        alignItems: "center",
                      }}
                    >
                      <input
                        value={c.name}
                        placeholder="Name"
                        onChange={(e) =>
                          faction
                            ? setFactionContacts((p) =>
                                p.map((x, j) =>
                                  j === i ? { ...x, name: e.target.value } : x,
                                ),
                              )
                            : setContacts((p) =>
                                p.map((x, j) =>
                                  j === i ? { ...x, name: e.target.value } : x,
                                ),
                              )
                        }
                        style={{ ...S.inp, flex: 1 }}
                      />
                      <input
                        value={c.role || ""}
                        placeholder="Role / relation"
                        onChange={(e) =>
                          faction
                            ? setFactionContacts((p) =>
                                p.map((x, j) =>
                                  j === i ? { ...x, role: e.target.value } : x,
                                ),
                              )
                            : setContacts((p) =>
                                p.map((x, j) =>
                                  j === i ? { ...x, role: e.target.value } : x,
                                ),
                              )
                        }
                        style={{ ...S.inp, flex: 1 }}
                      />
                      <select
                        value={c.disposition || "neutral"}
                        onChange={(e) =>
                          faction
                            ? setFactionContacts((p) =>
                                p.map((x, j) =>
                                  j === i
                                    ? { ...x, disposition: e.target.value }
                                    : x,
                                ),
                              )
                            : setContacts((p) =>
                                p.map((x, j) =>
                                  j === i
                                    ? { ...x, disposition: e.target.value }
                                    : x,
                                ),
                              )
                        }
                        style={{
                          ...S.sel,
                          fontSize: "11px",
                          padding: "2px 4px",
                        }}
                      >
                        <option value="allied">Allied</option>
                        <option value="friendly">Friendly</option>
                        <option value="neutral">Neutral</option>
                        <option value="suspicious">Suspicious</option>
                        <option value="hostile">Hostile</option>
                      </select>
                      <button
                        onClick={() =>
                          faction
                            ? setFactionContacts((p) => p.filter((_, j) => j !== i))
                            : setContacts((p) => p.filter((_, j) => j !== i))
                        }
                        style={{
                          color: "#f87171",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "14px",
                          flexShrink: 0,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() =>
                    faction
                      ? setFactionContacts((p) => [
                          ...p,
                          { name: "", role: "", disposition: "neutral" },
                        ])
                      : setContacts((p) => [
                          ...p,
                          { name: "", role: "", disposition: "neutral" },
                        ])
                  }
                  style={{
                    ...S.btn,
                    border: "2px dashed #374151",
                    background: "transparent",
                    color: "#6b7280",
                    width: "100%",
                    padding: "6px",
                  }}
                >
                  + Add Contact
                </button>
              </div>

              {/* Faction Status */}
              <div style={S.card}>
                <span style={S.lbl}>FACTION STATUS</span>
                <div style={{ marginBottom: "8px" }}>
                  {Object.entries(faction ? factionStatusData : factionStatus).map(([fName, value]) => (
                    <div
                      key={fName}
                      style={{
                        display: "flex",
                        gap: "6px",
                        marginBottom: "6px",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{ flex: 1, fontSize: "12px", color: "#d1d5db" }}
                      >
                        {fName}
                      </span>
                      <div
                        style={{
                          display: "flex",
                          gap: "2px",
                          alignItems: "center",
                        }}
                      >
                        <button
                          onClick={() =>
                            faction
                              ? setFactionStatusData((p) => ({
                                  ...p,
                                  [fName]: Math.max(-3, (p[fName] || 0) - 1),
                                }))
                              : setFactionStatus((p) => ({
                                  ...p,
                                  [fName]: Math.max(-3, (p[fName] || 0) - 1),
                                }))
                          }
                          style={{
                            ...S.btn,
                            padding: "1px 6px",
                            background: "#7f1d1d",
                            color: "#fca5a5",
                            fontSize: "11px",
                          }}
                        >
                          −
                        </button>
                        <span
                          style={{
                            display: "inline-block",
                            width: "28px",
                            textAlign: "center",
                            fontWeight: "bold",
                            fontSize: "13px",
                            color:
                              value > 0
                                ? "#34d399"
                                : value < 0
                                  ? "#f87171"
                                  : "#9ca3af",
                          }}
                        >
                          {value > 0 ? `+${value}` : value}
                        </span>
                        <button
                          onClick={() =>
                            faction
                              ? setFactionStatusData((p) => ({
                                  ...p,
                                  [fName]: Math.min(3, (p[fName] || 0) + 1),
                                }))
                              : setFactionStatus((p) => ({
                                  ...p,
                                  [fName]: Math.min(3, (p[fName] || 0) + 1),
                                }))
                          }
                          style={{
                            ...S.btn,
                            padding: "1px 6px",
                            background: "#14532d",
                            color: "#86efac",
                            fontSize: "11px",
                          }}
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() =>
                          faction
                            ? setFactionStatusData((p) => {
                                const n = { ...p };
                                delete n[fName];
                                return n;
                              })
                            : setFactionStatus((p) => {
                                const n = { ...p };
                                delete n[fName];
                                return n;
                              })
                        }
                        style={{
                          color: "#f87171",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "14px",
                          flexShrink: 0,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const n = prompt("Faction name:");
                    if (!n) return;
                    if (faction) {
                      if (!factionStatusData[n])
                        setFactionStatusData((p) => ({ ...p, [n]: 0 }));
                    } else {
                      if (!factionStatus[n])
                        setFactionStatus((p) => ({ ...p, [n]: 0 }));
                    }
                  }}
                  style={{
                    ...S.btn,
                    border: "2px dashed #374151",
                    background: "transparent",
                    color: "#6b7280",
                    width: "100%",
                    padding: "6px",
                  }}
                >
                  + Add Faction
                </button>
                <div
                  style={{
                    marginTop: "10px",
                    fontSize: "10px",
                    color: "#6b7280",
                  }}
                >
                  −3 War · −2 Hostile · −1 Interfering · 0 Neutral · +1 Helpful
                  · +2 Friendly · +3 Allied
                </div>
              </div>
            </div>

            {/* Inventory */}
            <div style={S.card}>
              <span style={S.lbl}>INVENTORY</span>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginBottom: "8px",
                }}
              >
                {(faction ? factionInventory : inventory).map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: "4px",
                      alignItems: "center",
                      background: "#1f1035",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      border: "1px solid #2d1f52",
                    }}
                  >
                    <input
                      value={item.name}
                      placeholder="Item"
                      onChange={(e) =>
                        faction
                          ? setFactionInventory((p) =>
                              p.map((x, j) =>
                                j === i ? { ...x, name: e.target.value } : x,
                              ),
                            )
                          : setInventory((p) =>
                              p.map((x, j) =>
                                j === i ? { ...x, name: e.target.value } : x,
                              ),
                            )
                      }
                      style={{
                        ...S.inp,
                        width: "120px",
                        borderBottom: "none",
                        fontSize: "12px",
                      }}
                    />
                    <input
                      value={item.qty != null ? item.qty : ""}
                      placeholder="#"
                      type="number"
                      min="0"
                      onChange={(e) =>
                        faction
                          ? setFactionInventory((p) =>
                              p.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      qty:
                                        e.target.value === ""
                                          ? null
                                          : Number(e.target.value),
                                    }
                                  : x,
                              ),
                            )
                          : setInventory((p) =>
                              p.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      qty:
                                        e.target.value === ""
                                          ? null
                                          : Number(e.target.value),
                                    }
                                  : x,
                              ),
                            )
                      }
                      style={{
                        ...S.inp,
                        width: "36px",
                        borderBottom: "none",
                        fontSize: "12px",
                        textAlign: "center",
                      }}
                    />
                    <button
                      onClick={() =>
                        faction
                          ? setFactionInventory((p) => p.filter((_, j) => j !== i))
                          : setInventory((p) => p.filter((_, j) => j !== i))
                      }
                      style={{
                        color: "#f87171",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() =>
                  faction
                    ? setFactionInventory((p) => [...p, { name: "", qty: 1 }])
                    : setInventory((p) => [...p, { name: "", qty: 1 }])
                }
                style={{
                  ...S.btn,
                  border: "2px dashed #374151",
                  background: "transparent",
                  color: "#6b7280",
                  width: "100%",
                  padding: "6px",
                }}
              >
                + Add Item
              </button>
            </div>

            {/* Crew Notes */}
            <div style={S.card}>
              <span style={S.lbl}>CREW NOTES</span>
              <textarea
                value={faction ? factionCrewNotes : notes}
                onChange={(e) =>
                  faction ? setFactionCrewNotes(e.target.value) : setNotes(e.target.value)
                }
                placeholder="Crew connections, territory control, gang resources, operations notes…"
                style={{
                  width: "100%",
                  height: "140px",
                  background: "#0a0a14",
                  color: "#d1d5db",
                  border: "1px solid #2d1f52",
                  padding: "8px",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  resize: "vertical",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { NPCSheet };

// ─── App Wrapper (standalone demo) ─────────────────────────────────────────────

export default function App() {
  const [current] = useState({
    id: 1,
    name: "Yoshikage Kira",
    standName: "Killer Queen",
    role: "Boss",
    notes:
      "Obsessive, methodical. Wants a quiet life. Will reset scenario if cornered.",
    stats: {
      power: "A",
      speed: "B",
      range: "C",
      durability: "B",
      precision: "A",
      development: "C",
    },
    conflictClocks: [
      { id: 1, name: "Defeat Kira", segments: 12, filled: 0 },
      { id: 2, name: "Expose Identity", segments: 6, filled: 0 },
    ],
    altClocks: [],
    regularUsed: 0,
    specialUsed: 0,
    abilities: [
      {
        id: 1,
        name: "Sheer Heart Attack",
        type: "unique",
        description: "Heat-seeking autonomous bomb.",
      },
      {
        id: 2,
        name: "Bites the Dust",
        type: "unique",
        description: "Reversal bomb implanted in a host.",
      },
    ],
  });

  const handleSave = async (data) => {
    console.log("Demo save:", data);
    return data;
  };

  return <NPCSheet npc={current} onSave={handleSave} campaigns={[]} />;
}

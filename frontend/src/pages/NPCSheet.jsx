import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { referenceAPI, factionAPI } from "../features/character-sheet";

// ─── SRD Data Tables ──────────────────────────────────────────────────────────

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

// NOTE: SRD has two level formulas — one doc says -9, another says -10.
// Change this constant to whichever is confirmed correct.
const LEVEL_OFFSET = 9;

const GRADES = ["F", "D", "C", "B", "A", "S"];
const GRADE_PTS = { F: 0, D: 1, C: 2, B: 3, A: 4, S: 5 };

// Durability → Vulnerability Clock segments
const DUR_VULN_CLOCK = { F: 4, D: 6, C: 8, B: 10, A: 12, S: 0 };

// Durability → Regular armor charges (SRD: F=0, D=1, C=1, B=2, A=3, S=3)
const DUR_REGULAR_ARMOR = { F: 0, D: 1, C: 1, B: 2, A: 3, S: 3 };

// Durability → Special armor charges (Stand Armor effectiveness)
const DUR_SPECIAL_ARMOR = { F: 0, D: 0, C: 1, B: 1, A: 2, S: 2 };

// Power → base harm level + position note
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
    note: "Acts before everyone",
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

// ─── GradeSelector ────────────────────────────────────────────────────────────

const GradeSelector = ({ value, onChange, label, infoLine }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "8px",
    }}
  >
    <div style={{ minWidth: "90px" }}>
      <div
        style={{
          fontSize: "11px",
          color: "#d1d5db",
          fontWeight: "bold",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      {infoLine && (
        <div style={{ fontSize: "10px", color: "#6b7280", marginTop: "1px" }}>
          {infoLine}
        </div>
      )}
    </div>
    <div style={{ display: "flex", gap: "3px" }}>
      {GRADES.map((g) => (
        <button
          key={g}
          onClick={() => onChange(g)}
          style={{
            width: "28px",
            height: "28px",
            border: "1px solid",
            borderColor: value === g ? "#a78bfa" : "#374151",
            background: value === g ? "#4c1d95" : "#1f2937",
            color: value === g ? "#e9d5ff" : "#6b7280",
            fontWeight: value === g ? "bold" : "normal",
            fontSize: "11px",
            cursor: "pointer",
            fontFamily: "monospace",
            borderRadius: "3px",
          }}
        >
          {g}
        </button>
      ))}
    </div>
  </div>
);

// ─── NPCSheet ─────────────────────────────────────────────────────────────────

const NPCSheet = ({ npc, onSave, onClose, campaigns = [], isGM = false, onFactionChange }) => {
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
  const [campaign, setCampaign] = useState(npc?.campaign || "");
  const [faction, setFaction] = useState(npc?.faction ?? npc?.faction_id ?? "");

  useEffect(() => {
    setFaction(npc?.faction ?? npc?.faction_id ?? "");
  }, [npc?.id, npc?.faction, npc?.faction_id]);

  const campaignId = typeof campaign === "object" ? campaign?.id : campaign;
  const baseCampaignFactions = useMemo(
    () =>
      (campaignId != null && campaigns?.find((c) => c.id === campaignId))
        ?.factions || [],
    [campaignId, campaigns],
  );

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

  const [conflictClocks, setConflictClocks] = useState(
    npc?.conflict_clocks ?? npc?.conflictClocks ?? [],
  );

  const [altClocks, setAltClocks] = useState(
    npc?.alt_clocks ?? npc?.altClocks ?? [],
  );

  const [vulnFilled, setVulnFilled] = useState(
    npc?.vulnerability_clock_current ?? 0,
  );

  const [regularUsed, setRegularUsed] = useState(
    npc?.regular_armor_used ?? npc?.regularUsed ?? 0,
  );
  const [specialUsed, setSpecialUsed] = useState(
    npc?.special_armor_used ?? npc?.specialUsed ?? 0,
  );

  const [abilities, setAbilities] = useState(npc?.abilities ?? []);
  const [standardAbilitiesList, setStandardAbilitiesList] = useState([]);

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

  // Sync heritage/playbook when NPC identity changes
  useEffect(() => {
    setHeritage(npc?.heritage ?? npc?.heritage_id ?? null);
    setPlaybook(npc?.playbook ?? "STAND");
    setSelectedHamonIds(npc?.selected_hamon_abilities ?? []);
    setSelectedSpinIds(npc?.selected_spin_abilities ?? []);
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

  useEffect(() => {
    referenceAPI
      .getAbilities()
      .then((list) => setStandardAbilitiesList(list || []))
      .catch(() => setStandardAbilitiesList([]));
  }, []);

  const [standardPickerAbId, setStandardPickerAbId] = useState(null);
  const [standardPickerSearch, setStandardPickerSearch] = useState("");
  const standardPickerRef = useRef(null);

  useEffect(() => {
    if (!standardPickerAbId) return;
    const handleClick = (e) => {
      if (
        standardPickerRef.current &&
        !standardPickerRef.current.contains(e.target)
      ) {
        setStandardPickerAbId(null);
        setStandardPickerSearch("");
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [standardPickerAbId]);

  // Portrait state
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(npc?.image_url || "");
  const [imagePreview, setImagePreview] = useState(
    npc?.image || npc?.image_url || "",
  );
  const fileInputRef = useRef(null);

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState(null);
  const debounceRef = useRef(null);
  const mountedRef = useRef(false);
  const npcIdRef = useRef(npc?.id || null);
  const savingRef = useRef(false);

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
  const regArmorMax = DUR_REGULAR_ARMOR[durGrade];
  const specArmorMax = DUR_SPECIAL_ARMOR[durGrade];
  const isDurS = durGrade === "S";

  const powerInfo = POWER_TABLE[stats.power];
  const speedInfo = SPEED_TABLE[stats.speed];
  const rangeInfo = RANGE_TABLE[stats.range];
  const precInfo = PRECISION_TABLE[stats.precision];
  const devInfo = DEV_TABLE[stats.development];

  // ── Clock helpers ─────────────────────────────────────────────────────────────

  const addConflictClock = () => {
    const name = prompt(
      'Clock name (e.g. "Defeat Diavolo", "Expose the User"):',
    );
    if (!name) return;
    const segs = parseInt(prompt("Segments (4, 6, 8, 12):") || "8");
    if (![4, 6, 8, 12].includes(segs)) {
      alert("Must be 4, 6, 8, or 12.");
      return;
    }
    setConflictClocks((p) => [
      ...p,
      { id: Date.now(), name, segments: segs, filled: 0 },
    ]);
  };

  const addAltClock = () => {
    const name = prompt(
      'Alternative win condition (e.g. "Expose User", "Break Stand Logic"):',
    );
    if (!name) return;
    const segs = parseInt(prompt("Segments (4, 6, 8, 12):") || "8");
    if (![4, 6, 8, 12].includes(segs)) return;
    setAltClocks((p) => [
      ...p,
      { id: Date.now(), name, segments: segs, filled: 0 },
    ]);
  };

  const updateConflictClock = (id, filled) =>
    setConflictClocks((p) =>
      p.map((c) => (c.id === id ? { ...c, filled } : c)),
    );
  const deleteConflictClock = (id) =>
    setConflictClocks((p) => p.filter((c) => c.id !== id));
  const updateAltClock = (id, filled) =>
    setAltClocks((p) => p.map((c) => (c.id === id ? { ...c, filled } : c)));
  const deleteAltClock = (id) =>
    setAltClocks((p) => p.filter((c) => c.id !== id));

  const buildPayload = useCallback(
    () => ({
      ...(npcIdRef.current ? { id: npcIdRef.current } : {}),
      name,
      stand_name: standName,
      role,
      notes,
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
      special_armor_used: specialUsed,
      abilities,
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
      heritage,
      playbook,
      stats,
      conflictClocks,
      altClocks,
      vulnFilled,
      regularUsed,
      specialUsed,
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

  // Debounced auto-save
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (savingRef.current || !onSave) return;
      // Don't auto-save a brand-new NPC that has never been persisted and
      // still has no name — this prevents spurious creates when a blank tab
      // mounts and init effects fire state changes before the user types.
      if (!npcIdRef.current && !name.trim()) return;
      savingRef.current = true;
      setSaveStatus("saving");
      try {
        const result = await onSave(buildPayload());
        if (result?.id && !npcIdRef.current) npcIdRef.current = result.id;
        setSaveStatus("saved");
        setTimeout(
          () => setSaveStatus((s) => (s === "saved" ? null : s)),
          2000,
        );
      } catch {
        setSaveStatus("error");
      } finally {
        savingRef.current = false;
      }
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
    heritage,
    playbook,
    stats,
    conflictClocks,
    altClocks,
    vulnFilled,
    regularUsed,
    specialUsed,
    abilities,
    selectedHamonIds,
    selectedSpinIds,
    campaign,
    imageUrl,
    imageFile,
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
    g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
    g3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" },
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
          {saveStatus === "saving" && (
            <span style={{ fontSize: "11px", color: "#fbbf24" }}>
              Saving...
            </span>
          )}
          {saveStatus === "saved" && (
            <span style={{ fontSize: "11px", color: "#34d399" }}>Saved</span>
          )}
          {saveStatus === "error" && (
            <span style={{ fontSize: "11px", color: "#f87171" }}>
              Error saving
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
              <div style={{ display: "flex", gap: "16px", alignItems: "end" }}>
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
                    gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr auto",
                    gap: "16px",
                    alignItems: "end",
                    flex: 1,
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

                  <GradeSelector
                    value={stats.power}
                    onChange={(v) => setStats((p) => ({ ...p, power: v }))}
                    label="Power"
                    infoLine={`Lv${POWER_TABLE[stats.power].harm} harm · ${POWER_TABLE[stats.power].pos}`}
                  />

                  <GradeSelector
                    value={stats.speed}
                    onChange={(v) => setStats((p) => ({ ...p, speed: v }))}
                    label="Speed"
                    infoLine={`${SPEED_TABLE[stats.speed].base} base · ${SPEED_TABLE[stats.speed].greater} greater${SPEED_TABLE[stats.speed].note ? ` · ${SPEED_TABLE[stats.speed].note}` : ""}`}
                  />

                  <GradeSelector
                    value={stats.range}
                    onChange={(v) => setStats((p) => ({ ...p, range: v }))}
                    label="Range"
                    infoLine={`${RANGE_TABLE[stats.range].base} · ${RANGE_TABLE[stats.range].greater} greater · ${RANGE_TABLE[stats.range].lesser} lesser`}
                  />

                  <GradeSelector
                    value={stats.durability}
                    onChange={(v) => {
                      setStats((p) => ({ ...p, durability: v }));
                      setRegularUsed(0);
                      setSpecialUsed(0);
                    }}
                    label="Durability"
                    infoLine={
                      isDurS
                        ? "⚠ S-DUR: No vulnerability clock — alternative win conditions required"
                        : `${vulnSegs}-seg clock · ${regArmorMax} regular · ${specArmorMax} special`
                    }
                  />

                  <GradeSelector
                    value={stats.precision}
                    onChange={(v) => setStats((p) => ({ ...p, precision: v }))}
                    label="Precision"
                    infoLine={`Partial → ${PRECISION_TABLE[stats.precision].partial}`}
                  />

                  <GradeSelector
                    value={stats.development}
                    onChange={(v) =>
                      setStats((p) => ({ ...p, development: v }))
                    }
                    label="Development"
                    infoLine={DEV_TABLE[stats.development].split("—")[0].trim()}
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
                    <div style={{ color: "#6b7280", marginTop: "2px" }}>
                      Initiative: GM's call — NPCs never roll
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
                    const standardOptions = standardAbilitiesList.filter(
                      (a) =>
                        (a.type || "").toLowerCase() === "standard" || !a.type,
                    );
                    const q = (
                      standardPickerAbId === ab.id ? standardPickerSearch : ""
                    )
                      .trim()
                      .toLowerCase();
                    const filteredStandard = q
                      ? standardOptions.filter(
                          (a) =>
                            (a.name || "").toLowerCase().includes(q) ||
                            (a.description || "").toLowerCase().includes(q) ||
                            (CATEGORY_LABELS[a.category] || "")
                              .toLowerCase()
                              .includes(q),
                        )
                      : standardOptions;
                    const selectedStandard = ab.standardId
                      ? standardAbilitiesList.find(
                          (a) => a.id === ab.standardId,
                        )
                      : standardOptions.find((a) => a.name === ab.name);
                    const isStandard =
                      ab.type === "standard" ||
                      !!ab.standardId ||
                      !!selectedStandard;
                    const pickerOpen = standardPickerAbId === ab.id;

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
                              {isStandard ? (
                                <div
                                  style={{
                                    position: "relative",
                                    flex: 1,
                                    minWidth: "140px",
                                  }}
                                  ref={pickerOpen ? standardPickerRef : null}
                                >
                                  <input
                                    value={
                                      pickerOpen
                                        ? standardPickerSearch
                                        : selectedStandard?.name ||
                                          ab.name ||
                                          "Select standard ability..."
                                    }
                                    onChange={(e) => {
                                      setStandardPickerSearch(e.target.value);
                                      setStandardPickerAbId(ab.id);
                                    }}
                                    onFocus={() => {
                                      setStandardPickerAbId(ab.id);
                                      setStandardPickerSearch("");
                                    }}
                                    placeholder="Select standard ability..."
                                    style={{
                                      ...S.inp,
                                      fontWeight: "bold",
                                      borderBottom: "1px solid #4b2d8f",
                                      fontSize: "12px",
                                      border: "1px solid #2d1f52",
                                      padding: "4px 8px",
                                    }}
                                  />
                                  {pickerOpen && (
                                    <div
                                      style={{
                                        position: "absolute",
                                        top: "100%",
                                        left: 0,
                                        right: 0,
                                        marginTop: "2px",
                                        background: "#111827",
                                        border: "1px solid #374151",
                                        borderRadius: "4px",
                                        maxHeight: "180px",
                                        overflowY: "auto",
                                        zIndex: 100,
                                        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                                      }}
                                    >
                                      {filteredStandard.length === 0 ? (
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
                                        filteredStandard.map((a) => (
                                          <div
                                            key={a.id}
                                            onClick={() => {
                                              setAbilities((p) =>
                                                p.map((x) =>
                                                  x.id === ab.id
                                                    ? {
                                                        ...x,
                                                        name: a.name,
                                                        description:
                                                          a.description || "",
                                                        standardId: a.id,
                                                        type: "standard",
                                                      }
                                                    : x,
                                                ),
                                              );
                                              setStandardPickerAbId(null);
                                              setStandardPickerSearch("");
                                            }}
                                            style={{
                                              padding: "8px 10px",
                                              cursor: "pointer",
                                              fontSize: "12px",
                                              borderBottom: "1px solid #1f2937",
                                              background:
                                                selectedStandard?.id === a.id
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
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
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
                                    fontWeight: "bold",
                                    borderBottom: "1px solid #4b2d8f",
                                    fontSize: "12px",
                                  }}
                                  placeholder="Ability name"
                                />
                              )}
                              <select
                                value={ab.type}
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
                                <option value="standard">Standard</option>
                                <option value="passive">Passive</option>
                              </select>
                            </div>
                            {isStandard && selectedStandard && (
                              <div
                                style={{
                                  marginBottom: "8px",
                                  padding: "8px",
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
                                  {selectedStandard.name}
                                </div>
                                {selectedStandard.category && (
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
                                      selectedStandard.category
                                    ] || selectedStandard.category}
                                  </span>
                                )}
                                {selectedStandard.description && (
                                  <div
                                    style={{
                                      color: "#9ca3af",
                                      lineHeight: "1.4",
                                      marginTop: "6px",
                                    }}
                                  >
                                    {selectedStandard.description}
                                  </div>
                                )}
                              </div>
                            )}
                            {!isStandard && (
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
                            )}
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
                          playbooks. Any standard abilities assigned do{" "}
                          <strong>not</strong> automatically grant a Stand —
                          Stand manifestation requires a narrative beat (GM
                          decision).
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
                                    {a.stress_cost > 0 && (
                                      <span
                                        style={{
                                          marginLeft: "6px",
                                          fontSize: "10px",
                                          color: "#f87171",
                                          fontWeight: "normal",
                                        }}
                                      >
                                        {a.stress_cost} stress
                                      </span>
                                    )}
                                  </div>
                                  {a.description && (
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        color: "#6b7280",
                                        marginTop: "2px",
                                        lineHeight: "1.4",
                                      }}
                                    >
                                      {a.description}
                                    </div>
                                  )}
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
                                    {a.stress_cost > 0 && (
                                      <span
                                        style={{
                                          marginLeft: "6px",
                                          fontSize: "10px",
                                          color: "#f87171",
                                          fontWeight: "normal",
                                        }}
                                      >
                                        {a.stress_cost} stress
                                      </span>
                                    )}
                                  </div>
                                  {a.description && (
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        color: "#6b7280",
                                        marginTop: "2px",
                                        lineHeight: "1.4",
                                      }}
                                    >
                                      {a.description}
                                    </div>
                                  )}
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
                          display: "flex",
                          gap: "24px",
                          justifyContent: "center",
                          marginTop: "8px",
                        }}
                      >
                        <ArmorTracker
                          label="REGULAR"
                          max={regArmorMax}
                          used={regularUsed}
                          onChange={setRegularUsed}
                          color="#f59e0b"
                        />
                        <ArmorTracker
                          label="SPECIAL"
                          max={specArmorMax}
                          used={specialUsed}
                          onChange={setSpecialUsed}
                          color="#7c3aed"
                        />
                      </div>
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#6b7280",
                          textAlign: "center",
                          marginTop: "6px",
                        }}
                      >
                        Spend BEFORE filling any clock. Special = completely
                        negates harm.
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
                          onClick={addAltClock}
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
                        {altClocks.map((clk) => (
                          <div
                            key={clk.id}
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
                            <button
                              onClick={() => {
                                const newName = prompt(
                                  "Rename clock:",
                                  clk.name,
                                );
                                if (newName)
                                  setAltClocks((p) =>
                                    p.map((c) =>
                                      c.id === clk.id
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
                        <ArmorTracker
                          label="REGULAR ARMOR"
                          max={regArmorMax}
                          used={regularUsed}
                          onChange={setRegularUsed}
                          color="#f59e0b"
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
                          Regular: reduce harm by 1 level
                          <br />
                          Special: completely negate harm
                        </div>
                        <button
                          onClick={() => {
                            setRegularUsed(0);
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
                        Standard=2, Greater=3.
                      </div>
                    </div>
                    <button
                      onClick={addConflictClock}
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
                    {conflictClocks.map((clk) => {
                      const isComplete = clk.filled >= clk.segments;
                      return (
                        <div
                          key={clk.id}
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
                              marginTop: "4px",
                              display: "flex",
                              gap: "4px",
                              justifyContent: "center",
                            }}
                          >
                            <button
                              onClick={() => {
                                const newName = prompt(
                                  "Rename clock:",
                                  clk.name,
                                );
                                if (newName)
                                  setConflictClocks((p) =>
                                    p.map((c) =>
                                      c.id === clk.id
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

                {/* Level Differential Reference */}
                <div style={S.card}>
                  <span style={S.lbl}>Level Differential</span>
                  <div
                    style={{
                      fontSize: "11px",
                      lineHeight: "1.8",
                      color: "#9ca3af",
                    }}
                  >
                    <div>
                      <span style={{ color: "#34d399" }}>
                        PC Level &gt; NPC Level:
                      </span>{" "}
                      +1 Position OR +1 Effect (GM chooses)
                    </div>
                    <div>
                      <span style={{ color: "#f87171" }}>
                        NPC Level &gt; PC Level:
                      </span>{" "}
                      −1 Position OR −1 Effect (GM chooses)
                    </div>
                    <div>
                      <span style={{ color: "#dc2626" }}>
                        NPC Level 3+ higher:
                      </span>{" "}
                      Both worsen position AND reduce effect
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "6px",
                      background: "#0a0a14",
                      borderRadius: "4px",
                      fontSize: "11px",
                      color: "#6b7280",
                    }}
                  >
                    This NPC is Level{" "}
                    <strong
                      style={{
                        color:
                          level >= 7
                            ? "#f87171"
                            : level >= 4
                              ? "#fbbf24"
                              : "#34d399",
                      }}
                    >
                      {level}
                    </strong>{" "}
                    ({totalSpentXP} XP in Stand Coin). Starting PCs are Level 1
                    (~95 XP: 60 coin + 35 dots). Level differential effects
                    apply automatically.
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
                  style={S.sel}
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
              <span style={S.lbl}>INVENTORY / ASSETS</span>
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

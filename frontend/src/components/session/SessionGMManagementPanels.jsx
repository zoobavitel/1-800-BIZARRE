import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  sessionAPI,
  resolveMediaUrl,
  npcAPI,
  characterAPI,
  crewAPI,
  factionAPI,
  rollAPI,
  experienceTrackerAPI,
  xpHistoryAPI,
  characterHistoryAPI,
} from "../../features/character-sheet/services/api";
import { buildRouteHref, handleSpaNavClick } from "../../utils/spaNavigation";
import { ACTION_RATING_KEYS } from "../../features/character-sheet/constants/srd";
import NpcsStandCoin from "../NpcsStandCoin";
import { PositionStack, EffectShapes } from "../position-effect/PositionEffectIndicators";

const GRADES = ["F", "D", "C", "B", "A", "S"];

function stepGrade(letter, delta) {
  const u = String(letter || "D").toUpperCase();
  const i = GRADES.indexOf(u);
  const base = i >= 0 ? i : 1;
  const j = Math.max(0, Math.min(GRADES.length - 1, base + delta));
  return GRADES[j];
}

function rawStandToGrades(raw) {
  const g = (k) => {
    if (!raw || typeof raw !== "object") return "D";
    const v = raw[k] ?? raw[k.toUpperCase()] ?? "D";
    const t = String(v).toUpperCase();
    return GRADES.includes(t) ? t : "D";
  };
  return {
    power: g("power"),
    speed: g("speed"),
    range: g("range"),
    durability: g("durability"),
    precision: g("precision"),
    development: g("development"),
  };
}

function readoutsFromGrades(grades) {
  const out = {};
  for (const k of Object.keys(grades)) {
    out[k] = `Grade ${grades[k]}`;
  }
  return out;
}

function npcCreatorId(npc) {
  const c = npc?.creator ?? npc?.creator_id;
  if (c == null || c === "") return null;
  if (typeof c === "object" && c !== null) return c.id ?? null;
  const n = Number(c);
  return Number.isFinite(n) ? n : null;
}

/** Campaign GM, NPC creator, or staff may adjust stand coin from this panel. */
function canEditNpcStandCoin(user, campaign, npc) {
  if (!user?.id) return false;
  if (user.is_staff) return true;
  const gmRaw = campaign?.gm;
  const gmId =
    gmRaw && typeof gmRaw === "object" ? gmRaw.id : gmRaw ?? null;
  if (gmId != null && Number(gmId) === Number(user.id)) return true;
  const cid = npcCreatorId(npc);
  if (cid != null && Number(cid) === Number(user.id)) return true;
  return false;
}

function unwrapApiArray(data) {
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

const XP_LEDGER_HISTORY_KEYS = new Set([
  "xp_clocks",
  "total_xp_spent",
  "heritage_points_gained",
  "stand_coin_points_gained",
  "action_dice_gained",
  "action_dots",
]);

const HISTORY_FIELD_LABELS = {
  xp_clocks: "XP tracks",
  total_xp_spent: "Total XP spent",
  heritage_points_gained: "Heritage points gained",
  stand_coin_points_gained: "Stand coin points gained",
  action_dice_gained: "Action dice gained",
  action_dots: "Action dots",
};

function historyFieldLabel(key) {
  return HISTORY_FIELD_LABELS[key] || key.replace(/_/g, " ");
}

function stringifyHistoryValue(v) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return String(v);
  try {
    return JSON.stringify(v);
  } catch (_err) {
    return String(v);
  }
}

function sumNumericRecord(obj) {
  if (!obj || typeof obj !== "object") return 0;
  let s = 0;
  for (const v of Object.values(obj)) s += Number(v) || 0;
  return s;
}

/** Human-readable nonzero action ratings, e.g. "command +2, hunt +2". */
function formatNonZeroDotSpread(obj) {
  if (!obj || typeof obj !== "object") return "(none)";
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    const n = Number(v) || 0;
    if (n !== 0) parts.push(`${k} +${n}`);
  }
  return parts.length ? parts.join(", ") : "(all zero)";
}

/**
 * Split sheet ledger deltas so GMs can tell creation / initial layout from spends.
 * @returns {{ initial: string[], expenditure: string[], other: string[] }}
 */
function partitionLedgerHistoryEntry(entry) {
  const initial = [];
  const expenditure = [];
  const other = [];
  const changed = entry?.changed_fields;
  if (!changed || typeof changed !== "object") {
    return { initial, expenditure, other };
  }

  const pushIni = (s) => initial.push(s);
  const pushExp = (s) => expenditure.push(s);
  const pushOth = (s) => other.push(s);

  for (const key of Object.keys(changed)) {
    if (!XP_LEDGER_HISTORY_KEYS.has(key)) continue;
    const chunk = changed[key];
    if (!chunk || typeof chunk !== "object") continue;

    if (key === "action_dots") {
      const oldD = chunk.old;
      const newD = chunk.new;
      if (
        oldD &&
        newD &&
        typeof oldD === "object" &&
        typeof newD === "object"
      ) {
        const so = sumNumericRecord(oldD);
        const sn = sumNumericRecord(newD);
        if (so === 0 && sn > 0) {
          pushIni(
            `Action dots — initial buy (${sn} dots): ${formatNonZeroDotSpread(newD)}`,
          );
          continue;
        }
        if (sn > so && so > 0) {
          pushExp(
            `Action dots — +${sn - so} dot(s) with XP (total dots ${so}→${sn}): ${formatNonZeroDotSpread(oldD)} → ${formatNonZeroDotSpread(newD)}`,
          );
          continue;
        }
        if (sn === so && sn > 0) {
          pushOth(
            `Action dots — same total (${sn}), redistributed: ${formatNonZeroDotSpread(oldD)} → ${formatNonZeroDotSpread(newD)}`,
          );
          continue;
        }
        if (sn < so) {
          pushOth(
            `Action dots — net −${so - sn} (unusual vs spend flow): ${formatNonZeroDotSpread(oldD)} → ${formatNonZeroDotSpread(newD)}`,
          );
          continue;
        }
        pushOth(
          `Action dots: ${stringifyHistoryValue(oldD)} → ${stringifyHistoryValue(newD)}`,
        );
      }
      continue;
    }

    if (key === "xp_clocks") {
      const oldXC = chunk.old;
      const newXC = chunk.new;
      if (
        oldXC &&
        newXC &&
        typeof oldXC === "object" &&
        typeof newXC === "object"
      ) {
        const sumOld = sumNumericRecord(oldXC);
        const sumNew = sumNumericRecord(newXC);
        const keys = new Set([...Object.keys(oldXC), ...Object.keys(newXC)]);
        let anyDecrease = false;
        let anyIncrease = false;
        for (const tk of keys) {
          const o = Number(oldXC[tk]) || 0;
          const n = Number(newXC[tk]) || 0;
          if (n < o) anyDecrease = true;
          if (n > o) anyIncrease = true;
        }
        if (
          sumOld === 0 &&
          sumNew > 0 &&
          !anyDecrease &&
          anyIncrease
        ) {
          const parts = [];
          for (const tk of keys) {
            const o = Number(oldXC[tk]) || 0;
            const n = Number(newXC[tk]) || 0;
            if (n === o) continue;
            parts.push(`${tk} +${n - o}`);
          }
          pushIni(
            `Playbook XP tracks — initial fills (${parts.join("; ")})`,
          );
          continue;
        }
        for (const tk of keys) {
          const o = Number(oldXC[tk]) || 0;
          const n = Number(newXC[tk]) || 0;
          if (n === o) continue;
          if (n < o) {
            pushExp(`Playbook XP — spent ticks on "${tk}": ${o}→${n} (−${o - n})`);
          } else {
            pushOth(`Playbook XP — ticks gained on sheet for "${tk}": ${o}→${n} (+${n - o})`);
          }
        }
      }
      continue;
    }

    if (key === "total_xp_spent") {
      const o = Number(chunk.old);
      const n = Number(chunk.new);
      if (
        Number.isFinite(o) &&
        Number.isFinite(n) &&
        n !== o
      ) {
        if (n > o) pushExp(`Recorded total XP spent +${n - o}: ${o}→${n}`);
        else pushOth(`Recorded total XP spent ${o}→${n}`);
      }
      continue;
    }

    const o = chunk.old;
    const n = chunk.new;
    if (JSON.stringify(o) === JSON.stringify(n)) continue;
    pushOth(`${historyFieldLabel(key)}: ${stringifyHistoryValue(o)} → ${stringifyHistoryValue(n)}`);
  }

  return { initial, expenditure, other };
}

function ledgerBucketsTouchXpFields(buckets) {
  const n =
    buckets.initial.length + buckets.expenditure.length + buckets.other.length;
  return n > 0;
}

function renderSessionLedgerBucketUl(
  entries,
  bucketKey,
  charDisplayNameById,
) {
  const out = [];
  for (const entry of entries || []) {
    const lines = entry?.advancement_buckets?.[bucketKey] || [];
    if (!lines.length) continue;
    const cid = Number(entry.character);
    const title =
      charDisplayNameById.get(cid) ||
      entry.character_true_name ||
      `PC ${entry.character}`;
    const when = entry.timestamp
      ? new Date(entry.timestamp).toLocaleString()
      : "—";
    out.push(
      <li key={`${bucketKey}-entry-${entry.id}`} style={{ marginBottom: 10 }}>
        <div style={{ color: "#e5e7eb", marginBottom: 4 }}>
          <span>{when}</span>
          <span style={{ color: "#9ca3af" }}>
            {" "}
            · {title}
          </span>
        </div>
        <ul
          style={{
            margin: 0,
            paddingLeft: 16,
            color: "#cbd5e1",
            fontSize: 10,
            lineHeight: 1.4,
          }}
        >
          {lines.map((line, i) => (
            <li key={`${entry.id}-${bucketKey}-${i}`}>{line}</li>
          ))}
        </ul>
      </li>,
    );
  }
  return out;
}

function flatActionDots(actionDots) {
  if (!actionDots || typeof actionDots !== "object") return [];
  const first = Object.values(actionDots)[0];
  if (first && typeof first === "object" && !Array.isArray(first)) {
    return Object.entries(actionDots).flatMap(([, g]) =>
      Object.entries(g || {}).map(([a, d]) => [a, d]),
    );
  }
  return Object.entries(actionDots);
}

const card = {
  boxSizing: "border-box",
  width: 280,
  minHeight: 120,
  padding: 10,
  background: "#0d1117",
  border: "1px solid #374151",
  borderRadius: 8,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 11,
  color: "#e5e7eb",
};

const grid = {
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  alignItems: "stretch",
  marginTop: 8,
};

const lbl = { fontSize: 10, color: "#9ca3af", textTransform: "uppercase" };

/** Visual severity for session compact harm grid (warns as higher tiers fill). */
function compactHarmFieldStyle(key, rawValue) {
  const filled = String(rawValue ?? "").trim().length > 0;
  const borderA = filled ? 1 : 0.55;
  const fillA = filled ? 0.28 : 0.14;
  if (key === "l4") {
    return {
      border: `1px solid rgba(248, 113, 113, ${borderA})`,
      background: `rgba(127, 29, 29, ${fillA})`,
      color: "#fecaca",
    };
  }
  if (key === "l3") {
    return {
      border: `1px solid rgba(251, 146, 60, ${borderA})`,
      background: `rgba(154, 52, 18, ${fillA})`,
      color: "#ffedd5",
    };
  }
  if (key === "l2a" || key === "l2b") {
    return {
      border: `1px solid rgba(250, 204, 21, ${borderA})`,
      background: `rgba(113, 63, 18, ${fillA})`,
      color: "#fef9c3",
    };
  }
  return {
    border: `1px solid rgba(96, 165, 250, ${borderA})`,
    background: `rgba(30, 58, 138, ${fillA})`,
    color: "#dbeafe",
  };
}

/**
 * Session GM quick-flow: NPC roster, player roster, bulk position/effect, add-NPC.
 */
export default function SessionGMManagementPanels({
  S,
  session,
  sessionData,
  setSessionData,
  campaign,
  crews = [],
  campaignNPCs,
  characters,
  clocks,
  onRefresh,
  setError,
  onNavigateToNPC,
  onNavigateToCharacter,
  rolls = [],
  manualRoll,
  setManualRoll,
  manualRollSaving,
  onManualRollCreate,
  manualXp,
  setManualXp,
  manualXpSaving,
  onManualXpGrant,
  user = null,
}) {
  const [showAddNpc, setShowAddNpc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localNpcPatch, setLocalNpcPatch] = useState({});
  const [harmDraftByChar, setHarmDraftByChar] = useState({});
  const [goalAssignCharId, setGoalAssignCharId] = useState("");
  const [goalAssignDraft, setGoalAssignDraft] = useState("");
  const [goalAssignMode, setGoalAssignMode] = useState("global");
  const [crewSavingId, setCrewSavingId] = useState(null);
  /** Local crew field drafts; reset when `crews` refetch from parent. */
  const [crewDraftById, setCrewDraftById] = useState({});
  const [showAllRecentRolls, setShowAllRecentRolls] = useState(false);
  const [manualRollCardOpen, setManualRollCardOpen] = useState(true);
  const [sessionXpCardOpen, setSessionXpCardOpen] = useState(true);
  const [recentRollSavingId, setRecentRollSavingId] = useState(null);
  const [factionSavingId, setFactionSavingId] = useState(null);
  const [factionDraftById, setFactionDraftById] = useState({});
  const [npcFactionSavingId, setNpcFactionSavingId] = useState(null);
  const [sessionQuickFactionName, setSessionQuickFactionName] = useState("");
  const [sessionQuickFactionBusy, setSessionQuickFactionBusy] = useState(false);
  const [xpLifetimeCharId, setXpLifetimeCharId] = useState("");
  const [xpLifetimeModalOpen, setXpLifetimeModalOpen] = useState(false);
  const [xpLifetimeRows, setXpLifetimeRows] = useState([]);
  const [xpLifetimeLoading, setXpLifetimeLoading] = useState(false);
  const [xpLifetimeError, setXpLifetimeError] = useState(null);
  /** Sheet saves that touched XP clocks / advancement; filtered by session date heuristic. */
  const [sessionAdvancementHistory, setSessionAdvancementHistory] = useState(
    [],
  );
  const [
    sessionAdvancementHistoryLoaded,
    setSessionAdvancementHistoryLoaded,
  ] = useState(false);

  const npcInvolvements = useMemo(
    () => sessionData?.npc_involvements || [],
    [sessionData?.npc_involvements],
  );
  const invByNpc = useMemo(
    () => Object.fromEntries((npcInvolvements || []).map((i) => [i.npc, i])),
    [npcInvolvements],
  );

  const involvedNpcs = useMemo(() => {
    const ids = new Set((npcInvolvements || []).map((i) => i.npc));
    return (campaignNPCs || []).filter((n) => ids.has(n.id));
  }, [campaignNPCs, npcInvolvements]);

  const factionsById = useMemo(() => {
    const m = {};
    for (const f of campaign?.factions || []) {
      if (f?.id == null) continue;
      m[f.id] = f;
      m[String(f.id)] = f;
    }
    return m;
  }, [campaign?.factions]);

  /** One entry per faction id that has ≥1 NPC in this session (no duplicates). */
  const sessionFactionNpcGroups = useMemo(() => {
    const map = new Map();
    const ungrouped = [];
    for (const npc of involvedNpcs) {
      const raw = npc.faction ?? npc.faction_id ?? null;
      const fid =
        raw != null && raw !== "" ? Number.parseInt(String(raw), 10) : null;
      if (fid != null && Number.isFinite(fid)) {
        if (!map.has(fid)) map.set(fid, []);
        map.get(fid).push(npc);
      } else {
        ungrouped.push(npc);
      }
    }
    const sortedPairs = [...map.entries()].sort((a, b) => {
      const na = factionsById[a[0]]?.name || factionsById[String(a[0])]?.name;
      const nb = factionsById[b[0]]?.name || factionsById[String(b[0])]?.name;
      return String(na ?? a[0]).localeCompare(String(nb ?? b[0]), undefined, {
        sensitivity: "base",
      });
    });
    return { factionPairs: sortedPairs, ungrouped };
  }, [involvedNpcs, factionsById]);

  const addableNpcList = useMemo(
    () =>
      (campaignNPCs || []).filter((n) => !invByNpc[n.id]) || [],
    [campaignNPCs, invByNpc],
  );

  const patchSessionInv = useCallback(
    async (nextList) => {
      setSaving(true);
      try {
        const updated = await sessionAPI.patchSession(session.id, {
          npc_involvements: nextList,
        });
        setSessionData(updated);
        onRefresh();
      } catch (e) {
        setError(e.message || "Session update failed");
      } finally {
        setSaving(false);
      }
    },
    [session.id, setSessionData, onRefresh, setError],
  );

  const addNpcToSession = (npcId) => {
    const next = [
      ...npcInvolvements,
      {
        npc: npcId,
        show_clocks_to_players: false,
        show_vulnerability_clock_to_players: false,
        show_stand_coin_to_players: false,
        show_all_abilities_to_players: false,
      },
    ];
    return patchSessionInv(next);
  };

  const handleAddNpcCardClick = () => {
    const totalCampaignNpcs = (campaignNPCs || []).length;
    if (totalCampaignNpcs === 0) {
      if (!campaign?.id) {
        setError("Campaign is missing; cannot open NPC creation.");
        return;
      }
      if (typeof onNavigateToNPC !== "function") {
        setError("NPC creation link is not available from this view.");
        return;
      }
      const ok = window.confirm(
        "This campaign has no NPCs yet. Open the NPC sheet to create one for this campaign? After you save the NPC, come back here and use Add NPC to session again.",
      );
      if (!ok) return;
      onNavigateToNPC(null, { campaignId: campaign.id });
      return;
    }
    setShowAddNpc(true);
  };

  const updateInv = (npcId, partial) => {
    const next = (npcInvolvements || []).map((row) => {
      if (row.npc !== npcId) return row;
      return { ...row, ...partial };
    });
    return patchSessionInv(next);
  };

  const mergePosEffect = useCallback(
    async (map) => {
      setSaving(true);
      try {
        const cur = { ...(sessionData?.position_effect_by_character || {}) };
        for (const [k, v] of Object.entries(map)) {
          if (v == null || v === "default") {
            delete cur[k];
            delete cur[String(k)];
          } else {
            cur[String(k)] = v;
          }
        }
        const updated = await sessionAPI.patchSession(session.id, {
          position_effect_by_character: cur,
        });
        setSessionData(updated);
        onRefresh();
      } catch (e) {
        setError(e.message || "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [session.id, sessionData, setSessionData, onRefresh, setError],
  );

  const campaignChars = useMemo(
    () =>
      campaign?.campaign_characters ||
      (characters || []).map((c) => ({
        id: c.id,
        true_name: c.true_name,
        ...c,
      })),
    [campaign, characters],
  );

  const charDisplayNameById = useMemo(() => {
    const m = new Map();
    for (const ch of campaignChars || []) {
      const cid = ch?.id != null ? Number(ch.id) : NaN;
      if (!Number.isFinite(cid)) continue;
      const full =
        (characters || []).find((c) => Number(c?.id) === cid) || ch;
      m.set(cid, full.true_name || full.name || `PC ${cid}`);
    }
    return m;
  }, [campaignChars, characters]);

  const sessionXpEntriesSorted = useMemo(() => {
    const raw = sessionData?.xp_entries;
    const list = Array.isArray(raw) ? raw : unwrapApiArray(raw);
    return [...list].sort(
      (a, b) =>
        new Date(b.session_date || 0) - new Date(a.session_date || 0),
    );
  }, [sessionData?.xp_entries]);

  const sessionXpFeedSorted = useMemo(() => {
    const histRaw = sessionData?.xp_history;
    const hist = Array.isArray(histRaw)
      ? histRaw
      : unwrapApiArray(histRaw);
    const rows = [];
    for (const e of sessionXpEntriesSorted) {
      rows.push({
        key: `et-${e.id}`,
        when: e.session_date,
        character: e.character,
        xp: Number(e.xp_gained) || 0,
        typeLabel: e.trigger_display || e.trigger || "—",
        note: String(e.description || "").trim(),
        source: "Tracker",
      });
    }
    for (const h of hist) {
      const amt = Number(h.amount) || 0;
      rows.push({
        key: `xh-${h.id}`,
        when: h.timestamp,
        character: h.character,
        xp: amt,
        typeLabel:
          amt < 0
            ? "Spend / adjustment"
            : amt > 0
              ? "Ledger (+)"
              : "Ledger",
        note: String(h.reason || "").trim(),
        source: "XP history",
      });
    }
    return rows.sort(
      (a, b) => new Date(b.when || 0) - new Date(a.when || 0),
    );
  }, [sessionXpEntriesSorted, sessionData?.xp_history]);

  const pcXpRequirementsByCharacter = useMemo(() => {
    const m = new Map();
    for (const row of sessionXpEntriesSorted) {
      const cid = Number(row.character);
      if (!Number.isFinite(cid)) continue;
      const typeLbl = row.trigger_display || row.trigger || "XP";
      const desc = String(row.description || "").trim();
      const line = desc
        ? `${typeLbl} (+${row.xp_gained ?? 0}) — ${desc}`
        : `${typeLbl} (+${row.xp_gained ?? 0})`;
      if (!m.has(cid)) m.set(cid, []);
      m.get(cid).push(line);
    }
    return m;
  }, [sessionXpEntriesSorted]);

  const sessionCompletedClocks = useMemo(() => {
    const sid = session?.id != null ? Number(session.id) : NaN;
    if (!Number.isFinite(sid)) return [];
    return (clocks || []).filter((c) => {
      const cs =
        c.session != null ? Number(c.session) : NaN;
      if (!Number.isFinite(cs) || cs !== sid) return false;
      const filled = Number(c.filled_segments) || 0;
      const max = Number(c.max_segments) || 0;
      return (
        c.completed === true ||
        (max > 0 && filled >= max)
      );
    });
  }, [clocks, session?.id]);

  const pcIdsInCampaign = useMemo(() => {
    const s = new Set();
    for (const ch of campaignChars || []) {
      const cid = Number(ch?.id);
      if (Number.isFinite(cid)) s.add(cid);
    }
    return s;
  }, [campaignChars]);

  useEffect(() => {
    if (!campaign?.id) {
      setSessionAdvancementHistory([]);
      setSessionAdvancementHistoryLoaded(false);
      return;
    }
    let cancelled = false;
    setSessionAdvancementHistoryLoaded(false);
    characterHistoryAPI
      .list({ campaign: campaign.id })
      .then((data) => {
        if (cancelled) return;
        const list = unwrapApiArray(data);
        const sessionStartMs = sessionData?.session_date
          ? new Date(sessionData.session_date).getTime()
          : NaN;
        const slopMs = 60 * 60 * 1000;
        const filtered = list
          .map((entry) => ({
            ...entry,
            advancement_buckets: partitionLedgerHistoryEntry(entry),
          }))
          .filter((entry) => {
            const cid = Number(entry.character);
            if (!pcIdsInCampaign.has(cid)) return false;
            if (!ledgerBucketsTouchXpFields(entry.advancement_buckets))
              return false;
            if (!Number.isFinite(sessionStartMs)) return false;
            const ts = new Date(entry.timestamp).getTime();
            return ts >= sessionStartMs - slopMs;
          })
          .sort(
            (a, b) =>
              new Date(b.timestamp || 0) - new Date(a.timestamp || 0),
          );
        setSessionAdvancementHistory(filtered);
        setSessionAdvancementHistoryLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setSessionAdvancementHistory([]);
        setSessionAdvancementHistoryLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [
    campaign?.id,
    sessionData?.session_date,
    sessionData?.id,
    pcIdsInCampaign,
  ]);

  const advancementLedgerNodes = useMemo(
    () => ({
      initial: renderSessionLedgerBucketUl(
        sessionAdvancementHistory,
        "initial",
        charDisplayNameById,
      ),
      expenditure: renderSessionLedgerBucketUl(
        sessionAdvancementHistory,
        "expenditure",
        charDisplayNameById,
      ),
      other: renderSessionLedgerBucketUl(
        sessionAdvancementHistory,
        "other",
        charDisplayNameById,
      ),
    }),
    [sessionAdvancementHistory, charDisplayNameById],
  );

  function progressClockOwnerLabel(clk) {
    if (clk?.character != null && clk.character !== "") {
      const cid = Number(clk.character);
      const name =
        charDisplayNameById.get(cid) || `PC ${clk.character}`;
      return name;
    }
    if (clk?.crew != null && clk.crew !== "")
      return `Crew #${clk.crew}`;
    if (clk?.npc != null && clk.npc !== "") return `NPC #${clk.npc}`;
    return "Campaign / session";
  }

  useEffect(() => {
    if (!xpLifetimeModalOpen || !xpLifetimeCharId) {
      setXpLifetimeRows([]);
      return;
    }
    const cid = parseInt(String(xpLifetimeCharId), 10);
    if (!Number.isFinite(cid)) return;
    let cancelled = false;
    setXpLifetimeLoading(true);
    setXpLifetimeError(null);
    Promise.all([
      experienceTrackerAPI.list({ character: cid }).catch(() => []),
      xpHistoryAPI.list({ character: cid }).catch(() => []),
    ])
      .then(([et, xh]) => {
        if (cancelled) return;
        const rows = [
          ...unwrapApiArray(et).map((e) => ({
            key: `t-${e.id}`,
            when: e.session_date,
            text: `${e.trigger_display || e.trigger || "XP"}: ${e.description || ""} (+${e.xp_gained ?? 0} XP)`,
          })),
          ...unwrapApiArray(xh).map((x) => ({
            key: `h-${x.id}`,
            when: x.timestamp,
            text: `${x.reason || "XP history"} (+${x.amount ?? 0})`,
          })),
        ];
        rows.sort((a, b) => new Date(b.when) - new Date(a.when));
        setXpLifetimeRows(rows);
      })
      .catch((e) => {
        if (!cancelled) setXpLifetimeError(e.message || "Load failed");
      })
      .finally(() => {
        if (!cancelled) setXpLifetimeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [xpLifetimeModalOpen, xpLifetimeCharId]);

  const peMap = sessionData?.position_effect_by_character || {};
  const defaultPos = sessionData?.default_position || "risky";
  const defaultEff = sessionData?.default_effect || "standard";
  const goalMap = useMemo(
    () => sessionData?.roll_goal_by_character || {},
    [sessionData?.roll_goal_by_character],
  );

  const sessionRolls = rolls;
  const getRecentCharacterRolls = useCallback(
    (characterId) =>
      (sessionRolls || [])
        .filter((r) => {
          if (String(r.character) !== String(characterId)) return false;
          // Fortune rolls are GM-authored and shown in the dedicated Fortune history panel.
          if (String((r.roll_type || "").toUpperCase()) === "FORTUNE") return false;
          if (showAllRecentRolls) return true;
          return (
            String((r.roll_type || "").toUpperCase()) === "ACTION" &&
            String((r.action_name || "").toUpperCase()) !== "FORTUNE"
          );
        })
        .slice(0, 5),
    [sessionRolls, showAllRecentRolls],
  );

  const editRecentRoll = useCallback(
    async (roll) => {
      if (!roll?.id) return;
      const actionInput = window.prompt(
        "Action/label",
        String(roll.action_name || "action"),
      );
      if (actionInput == null) return;
      const diceInput = window.prompt(
        "Dice results (comma separated 1-6)",
        (roll.results || []).join(", "),
      );
      if (diceInput == null) return;
      const parsed = String(diceInput)
        .split(/[\s,]+/)
        .map((n) => Number.parseInt(n, 10))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 6);
      if (!parsed.length) {
        setError("Dice must be numbers 1-6.");
        return;
      }
      const outcomeInput = window.prompt(
        "Outcome (CRITICAL_SUCCESS/FULL_SUCCESS/PARTIAL_SUCCESS/FAILURE/BOTCH)",
        String(roll.outcome || "FULL_SUCCESS"),
      );
      if (outcomeInput == null) return;
      const outcome = String(outcomeInput || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
      setRecentRollSavingId(roll.id);
      setError(null);
      try {
        await rollAPI.patchRoll(roll.id, {
          action_name: String(actionInput || "").trim(),
          results: parsed,
          outcome,
          dice_pool: parsed.length,
        });
        onRefresh();
      } catch (e) {
        setError(e.message || "Failed to update roll.");
      } finally {
        setRecentRollSavingId(null);
      }
    },
    [onRefresh, setError],
  );

  const deleteRecentRoll = useCallback(
    async (roll) => {
      if (!roll?.id) return;
      const ok = window.confirm("Delete this roll record?");
      if (!ok) return;
      setRecentRollSavingId(roll.id);
      setError(null);
      try {
        await rollAPI.deleteRoll(roll.id);
        onRefresh();
      } catch (e) {
        setError(e.message || "Failed to delete roll.");
      } finally {
        setRecentRollSavingId(null);
      }
    },
    [onRefresh, setError],
  );

  useEffect(() => {
    const next = {};
    (campaignChars || []).forEach((ch) => {
      const full = (characters || []).find((c) => c.id === ch.id) || ch;
      const l1a = (full.harm_level1_name || "").toString();
      const l1b = (full.harm_level1_slot2_name || "").toString();
      const l2a = (full.harm_level2_name || "").toString();
      const l2b = (full.harm_level2_slot2_name || "").toString();
      const l3 = (full.harm_level3_name || "").toString();
      const l4 = (full.harm_level4_name || "").toString();
      next[ch.id] = { l1a, l1b, l2a, l2b, l3, l4 };
    });
    setHarmDraftByChar(next);
  }, [campaignChars, characters]);

  useEffect(() => {
    const first = campaignChars?.[0]?.id;
    if (!goalAssignCharId && first != null) {
      setGoalAssignCharId(String(first));
    }
  }, [campaignChars, goalAssignCharId]);

  useEffect(() => {
    const m = {};
    for (const c of crews || []) {
      if (c?.id == null) continue;
      m[c.id] = {
        name: c.name ?? "",
        description: c.description ?? "",
        notes: c.notes ?? "",
        level: String(c.level ?? ""),
        hold: String(c.hold ?? ""),
        rep: String(c.rep ?? ""),
        turf: String(c.turf ?? ""),
        wanted_level: String(c.wanted_level ?? ""),
        coin: String(c.coin ?? ""),
        stash: String(c.stash ?? ""),
        xp: String(c.xp ?? ""),
        advancement_points: String(c.advancement_points ?? ""),
      };
    }
    setCrewDraftById(m);
  }, [crews]);

  useEffect(() => {
    const m = {};
    for (const f of campaign?.factions || []) {
      if (f?.id == null) continue;
      m[f.id] = {
        name: f.name ?? "",
        faction_type: f.faction_type ?? "",
        level: String(f.level ?? 0),
        hold: String(f.hold ?? "weak"),
        reputation: String(f.reputation ?? 0),
        notes: f.notes ?? "",
        crew_notes: f.crew_notes ?? "",
        visible_to_players: !!f.visible_to_players,
        contacts: JSON.stringify(f.contacts ?? [], null, 2),
        inventory: JSON.stringify(f.inventory ?? [], null, 2),
        faction_status: JSON.stringify(f.faction_status ?? {}, null, 2),
      };
    }
    setFactionDraftById(m);
  }, [campaign?.factions]);

  const patchCrewSnapshot = async (crewId, partial) => {
    if (!crewId) return;
    setCrewSavingId(crewId);
    setError(null);
    try {
      await crewAPI.patchCrew(crewId, partial);
      onRefresh();
    } catch (e) {
      setError(e.message || "Crew update failed");
    } finally {
      setCrewSavingId(null);
    }
  };

  const patchFactionSnapshot = async (factionId) => {
    if (!factionId) return;
    const draft = factionDraftById[factionId];
    if (!draft) return;
    const parseJsonText = (raw, fallback) => {
      const txt = String(raw ?? "").trim();
      if (!txt) return fallback;
      return JSON.parse(txt);
    };
    setFactionSavingId(factionId);
    setError(null);
    try {
      await factionAPI.patchFaction(factionId, {
        name: String(draft.name ?? "").trim(),
        faction_type: String(draft.faction_type ?? "").trim(),
        level: Number.parseInt(String(draft.level ?? "0"), 10) || 0,
        hold: String(draft.hold ?? "weak") || "weak",
        reputation: Number.parseInt(String(draft.reputation ?? "0"), 10) || 0,
        notes: String(draft.notes ?? ""),
        crew_notes: String(draft.crew_notes ?? ""),
        visible_to_players: !!draft.visible_to_players,
        contacts: parseJsonText(draft.contacts, []),
        inventory: parseJsonText(draft.inventory, []),
        faction_status: parseJsonText(draft.faction_status, {}),
      });
      onRefresh();
    } catch (e) {
      setError(e.message || "Faction update failed");
    } finally {
      setFactionSavingId(null);
    }
  };

  useEffect(() => {
    if (!goalAssignCharId) return;
    const v =
      goalMap[String(goalAssignCharId)] ?? goalMap[goalAssignCharId] ?? "";
    setGoalAssignDraft(String(v || ""));
  }, [goalAssignCharId, goalMap]);

  const npcFactionSelectValue = (npc) => {
    const f = npc?.faction;
    if (f == null || f === "") return "";
    if (typeof f === "object" && f !== null && f.id != null) return String(f.id);
    return String(f);
  };

  const handleAssignNpcFaction = useCallback(
    async (npc, factionId) => {
      if (!npc?.id) return;
      setNpcFactionSavingId(npc.id);
      setError(null);
      try {
        await npcAPI.patchNPC(npc.id, { faction: factionId });
        onRefresh();
      } catch (e) {
        setError(e.message || "Could not update NPC faction");
      } finally {
        setNpcFactionSavingId(null);
      }
    },
    [onRefresh, setError],
  );

  /** Create a campaign faction and assign every unfactioned NPC in the current "No faction" session group. */
  const handleCreateFactionAndAssignUngrouped = useCallback(async () => {
    const trimmed = sessionQuickFactionName.trim();
    if (!trimmed || !campaign?.id) {
      setError("Enter a faction name.");
      return;
    }
    const list = sessionFactionNpcGroups.ungrouped;
    if (!list.length) return;
    const dup = (campaign?.factions || []).some(
      (f) => String(f.name || "").trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (dup) {
      setError(`A faction named "${trimmed}" already exists in this campaign.`);
      return;
    }
    setSessionQuickFactionBusy(true);
    setError(null);
    try {
      const created = await factionAPI.createFaction({
        name: trimmed,
        campaign: campaign.id,
      });
      await Promise.all(
        list.map((npc) => npcAPI.patchNPC(npc.id, { faction: created.id })),
      );
      setSessionQuickFactionName("");
      onRefresh();
    } catch (e) {
      setError(e.message || "Could not create faction or assign NPCs");
    } finally {
      setSessionQuickFactionBusy(false);
    }
  }, [
    sessionQuickFactionName,
    campaign?.id,
    campaign?.factions,
    sessionFactionNpcGroups.ungrouped,
    onRefresh,
    setError,
  ]);

  const handleNpcStandStep = (npc, key, delta) => {
    if (!canEditNpcStandCoin(user, campaign, npc)) return;
    const g = rawStandToGrades(npc.stand_coin_stats);
    const nextLetter = stepGrade(g[key], delta);
    const next = { ...(npc.stand_coin_stats || {}), [key.toUpperCase()]: nextLetter };
    setLocalNpcPatch((p) => ({ ...p, [npc.id]: true }));
    npcAPI
      .patchNPC(npc.id, { stand_coin_stats: next })
      .then(() => {
        onRefresh();
      })
      .catch((e) => setError(e.message))
      .finally(() =>
        setLocalNpcPatch((p) => {
          const n = { ...p };
          delete n[npc.id];
          return n;
        }),
      );
  };

  const factionGroupWrap = {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #374151",
    borderRadius: 8,
    padding: 12,
    background: "#0b1220",
  };

  const renderNpcSessionCard = (npc) => {
    const inv = invByNpc[npc.id] || {};
    const grades = rawStandToGrades(npc.stand_coin_stats);
    const busy = !!localNpcPatch[npc.id];
    const canEditStand = canEditNpcStandCoin(user, campaign, npc);
    const npcPortraitSrc = resolveMediaUrl(npc.image || npc.image_url || "");
    return (
      <div key={npc.id} style={card}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          {npcPortraitSrc ? (
            <img
              src={npcPortraitSrc}
              alt=""
              style={{
                width: 52,
                height: 52,
                flexShrink: 0,
                objectFit: "cover",
                borderRadius: 6,
                border: "1px solid #30363d",
                background: "#111",
              }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: "bold" }}>{npc.name || `NPC ${npc.id}`}</div>
            <div style={{ fontSize: 10, color: "#9ca3af" }}>
              {npc.stand_name || "—"}
            </div>
            <a
              href={buildRouteHref("npcs", { npcId: npc.id })}
              onClick={(e) => handleSpaNavClick(e, () => onNavigateToNPC?.(npc.id))}
              style={{ ...S.btn, fontSize: 10, marginTop: 4 }}
            >
              Full sheet
            </a>
            <div style={{ marginTop: 8 }}>
              <div style={lbl}>Faction (campaign)</div>
              <select
                value={npcFactionSelectValue(npc)}
                onChange={(e) => {
                  const v = e.target.value;
                  const nextId = v === "" ? null : parseInt(v, 10);
                  if (!Number.isFinite(nextId) && nextId !== null) return;
                  const cur = npcFactionSelectValue(npc);
                  if (v === cur) return;
                  handleAssignNpcFaction(npc, nextId);
                }}
                style={{ ...S.select, width: "100%", fontSize: 11, marginTop: 4 }}
                disabled={
                  saving || npcFactionSavingId === npc.id || !campaign?.id
                }
              >
                <option value="">— None —</option>
                {(campaign?.factions || []).map((f) => (
                  <option key={f.id} value={String(f.id)}>
                    {f.name || `Faction ${f.id}`}
                  </option>
                ))}
              </select>
              {(!campaign?.factions || campaign.factions.length === 0) && (
                <div style={{ fontSize: 9, color: "#6b7280", marginTop: 4 }}>
                  {`No factions yet — use "Create faction & assign" in the No faction group above, or add one from campaign management.`}
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <NpcsStandCoin
            grades={grades}
            readouts={readoutsFromGrades(grades)}
            onStep={(k, d) => handleNpcStandStep(npc, k, d)}
            readOnly={!canEditStand}
            variant="npc"
          />
        </div>
        {busy && (
          <div style={{ fontSize: 10, color: "#a78bfa" }}>Saving…</div>
        )}
        <div style={lbl}>Player visibility (this session)</div>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="checkbox"
            checked={!!inv.show_clocks_to_players}
            onChange={() => {
              const show = !inv.show_clocks_to_players;
              updateInv(npc.id, {
                show_clocks_to_players: show,
                show_vulnerability_clock_to_players: show
                  ? true
                  : inv.show_vulnerability_clock_to_players,
              });
            }}
            disabled={saving}
          />
          <span>Clocks</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="checkbox"
            checked={!!inv.show_stand_coin_to_players}
            onChange={() =>
              updateInv(npc.id, {
                show_stand_coin_to_players: !inv.show_stand_coin_to_players,
              })
            }
            disabled={saving}
          />
          <span>Stand coin</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="checkbox"
            checked={!!inv.show_all_abilities_to_players}
            onChange={() =>
              updateInv(npc.id, {
                show_all_abilities_to_players: !inv.show_all_abilities_to_players,
              })
            }
            disabled={saving}
          />
          <span>All abilities</span>
        </label>
        <div style={lbl}>Abilities (preview)</div>
        <ul style={{ margin: 0, paddingLeft: 16, color: "#9ca3af" }}>
          {(npc.abilities || []).slice(0, 4).map((a, i) => (
            <li key={i}>{(a && a.name) || JSON.stringify(a).slice(0, 40)}</li>
          ))}
          {(!npc.abilities || npc.abilities.length === 0) && <li>—</li>}
        </ul>
        <div style={lbl}>Clocks (summary)</div>
        <div style={{ fontSize: 10, color: "#6b7280" }}>
          Vuln {npc.vulnerability_clock_current ?? 0}/
          {npc.vulnerability_clock_max ?? 0}
        </div>
        <button
          type="button"
          onClick={() => {
            const next = npcInvolvements.filter((i) => i.npc !== npc.id);
            patchSessionInv(next);
          }}
          style={{ ...S.btnDanger, fontSize: 10, alignSelf: "flex-start" }}
          disabled={saving}
        >
          Remove from session
        </button>
      </div>
    );
  };

  return (
    <>
      <div style={S.card}>
        <span style={S.sectionLbl}>Session NPC roster</span>
        <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 0" }}>
          NPCs grouped by faction (one faction card when multiple NPCs share it).
          Use + to add from the campaign roster. Assign faction from each NPC card, or
          use Create faction & assign in the No faction block to add a campaign faction
          and attach every unfactioned NPC here at once. Toggle what players can see;
          quick-edit Stand coin (GM or that NPC's owner).
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 10 }}>
          {sessionFactionNpcGroups.factionPairs.map(([fid, npcList]) => {
            const fac =
              factionsById[fid] ||
              factionsById[String(fid)] ||
              {};
            const name = fac.name || `Faction ${fid}`;
            const draft = factionDraftById[fid] || {
              name: name,
              faction_type: String(fac.faction_type ?? ""),
              level: String(fac.level ?? 0),
              hold: String(fac.hold ?? "weak"),
              reputation: String(fac.reputation ?? 0),
              notes: String(fac.notes ?? ""),
              crew_notes: String(fac.crew_notes ?? ""),
              visible_to_players: !!fac.visible_to_players,
              contacts: JSON.stringify(fac.contacts ?? [], null, 2),
              inventory: JSON.stringify(fac.inventory ?? [], null, 2),
              faction_status: JSON.stringify(fac.faction_status ?? {}, null, 2),
            };
            const setDraftField = (field, value) =>
              setFactionDraftById((prev) => ({
                ...prev,
                [fid]: { ...(prev[fid] || draft), [field]: value },
              }));
            return (
              <div key={`faction-${fid}`} style={factionGroupWrap}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: "bold", fontSize: 13, color: "#a78bfa" }}>
                    {name}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      display: "grid",
                      gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr",
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={lbl}>Faction name</div>
                      <input
                        style={{ ...S.inp, width: "100%" }}
                        value={draft.name}
                        onChange={(e) => setDraftField("name", e.target.value)}
                      />
                    </div>
                    <div>
                      <div style={lbl}>Faction type</div>
                      <input
                        style={{ ...S.inp, width: "100%" }}
                        value={draft.faction_type}
                        onChange={(e) => setDraftField("faction_type", e.target.value)}
                      />
                    </div>
                    <div>
                      <div style={lbl}>Level</div>
                      <input
                        type="number"
                        style={{ ...S.inp, width: "100%" }}
                        value={draft.level}
                        onChange={(e) => setDraftField("level", e.target.value)}
                      />
                    </div>
                    <div>
                      <div style={lbl}>Hold</div>
                      <select
                        style={{ ...S.select, width: "100%" }}
                        value={draft.hold}
                        onChange={(e) => setDraftField("hold", e.target.value)}
                      >
                        <option value="weak">weak</option>
                        <option value="strong">strong</option>
                      </select>
                    </div>
                    <div>
                      <div style={lbl}>Rep</div>
                      <input
                        type="number"
                        style={{ ...S.inp, width: "100%" }}
                        value={draft.reputation}
                        onChange={(e) => setDraftField("reputation", e.target.value)}
                      />
                    </div>
                    <div style={{ gridColumn: "1 / span 2" }}>
                      <div style={lbl}>Notes</div>
                      <textarea
                        style={{ ...S.inp, width: "100%", minHeight: 56, border: "1px solid #374151", padding: 6 }}
                        value={draft.notes}
                        onChange={(e) => setDraftField("notes", e.target.value)}
                      />
                    </div>
                    <div style={{ gridColumn: "3 / span 2" }}>
                      <div style={lbl}>Crew notes</div>
                      <textarea
                        style={{ ...S.inp, width: "100%", minHeight: 56, border: "1px solid #374151", padding: 6 }}
                        value={draft.crew_notes}
                        onChange={(e) => setDraftField("crew_notes", e.target.value)}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 4 }}>
                      <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11 }}>
                        <input
                          type="checkbox"
                          checked={!!draft.visible_to_players}
                          onChange={(e) =>
                            setDraftField("visible_to_players", e.target.checked)
                          }
                        />
                        Visible to players
                      </label>
                    </div>
                    <div style={{ gridColumn: "1 / span 2" }}>
                      <div style={lbl}>Contacts (JSON)</div>
                      <textarea
                        style={{ ...S.inp, width: "100%", minHeight: 88, border: "1px solid #374151", padding: 6 }}
                        value={draft.contacts}
                        onChange={(e) => setDraftField("contacts", e.target.value)}
                      />
                    </div>
                    <div style={{ gridColumn: "3 / span 2" }}>
                      <div style={lbl}>Inventory (JSON)</div>
                      <textarea
                        style={{ ...S.inp, width: "100%", minHeight: 88, border: "1px solid #374151", padding: 6 }}
                        value={draft.inventory}
                        onChange={(e) => setDraftField("inventory", e.target.value)}
                      />
                    </div>
                    <div style={{ gridColumn: "5 / span 1" }}>
                      <div style={lbl}>Status (JSON)</div>
                      <textarea
                        style={{ ...S.inp, width: "100%", minHeight: 88, border: "1px solid #374151", padding: 6 }}
                        value={draft.faction_status}
                        onChange={(e) => setDraftField("faction_status", e.target.value)}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      style={S.btnPrimary}
                      onClick={() => patchFactionSnapshot(fid)}
                      disabled={factionSavingId === fid}
                    >
                      {factionSavingId === fid ? "Saving..." : "Save faction fields"}
                    </button>
                    <span style={{ fontSize: 10, color: "#6b7280" }}>
                      Edit fields here; changes apply to this faction everywhere.
                    </span>
                  </div>
                </div>
                <div style={grid}>{npcList.map((npc) => renderNpcSessionCard(npc))}</div>
              </div>
            );
          })}

          {sessionFactionNpcGroups.ungrouped.length > 0 && (
            <div style={factionGroupWrap}>
              <div style={{ fontWeight: "bold", fontSize: 13, color: "#a78bfa", marginBottom: 8 }}>
                No faction
              </div>
              <div
                style={{
                  marginBottom: 12,
                  padding: 10,
                  background: "#111827",
                  borderRadius: 6,
                  border: "1px solid #374151",
                }}
              >
                <div style={{ ...lbl, marginBottom: 6 }}>Create faction & assign</div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    value={sessionQuickFactionName}
                    onChange={(e) => setSessionQuickFactionName(e.target.value)}
                    placeholder="New faction name"
                    style={{ ...S.inp, flex: "1 1 160px", minWidth: 140, fontSize: 11 }}
                    disabled={sessionQuickFactionBusy || saving}
                  />
                  <button
                    type="button"
                    style={{ ...S.btnPrimary, fontSize: 11 }}
                    onClick={handleCreateFactionAndAssignUngrouped}
                    disabled={
                      sessionQuickFactionBusy ||
                      saving ||
                      !campaign?.id ||
                      !sessionQuickFactionName.trim()
                    }
                  >
                    {sessionQuickFactionBusy
                      ? "Working…"
                      : `Create & assign ${sessionFactionNpcGroups.ungrouped.length} NPC(s)`}
                  </button>
                </div>
                <div style={{ fontSize: 9, color: "#6b7280", marginTop: 6 }}>
                  {`Adds a campaign faction and sets every unfactioned NPC listed below to it (same as choosing it in each card's dropdown after refresh).`}
                </div>
              </div>
              <div style={grid}>
                {sessionFactionNpcGroups.ungrouped.map((npc) => renderNpcSessionCard(npc))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "stretch" }}>
            <button
              type="button"
              onClick={handleAddNpcCardClick}
              style={{
                ...card,
                borderStyle: "dashed",
                cursor: "pointer",
                justifyContent: "center",
                alignItems: "center",
                minHeight: 180,
              }}
              disabled={saving}
            >
              <span style={{ fontSize: 24, color: "#6b7280" }}>+</span>
              <span style={{ color: "#9ca3af" }}>Add NPC to session</span>
              {(campaignNPCs || []).length === 0 ? (
                <span
                  style={{
                    fontSize: 9,
                    color: "#6b7280",
                    marginTop: 8,
                    textAlign: "center",
                    lineHeight: 1.35,
                    maxWidth: 240,
                  }}
                >
                  No NPCs in this campaign yet — click to open the NPC builder
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </div>

      {showAddNpc && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowAddNpc(false)}
        >
          <div
            style={{
              background: "#111827",
              border: "1px solid #4b5563",
              borderRadius: 8,
              padding: 16,
              maxWidth: 420,
              width: "100%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: "bold", marginBottom: 8 }}>Add campaign NPC</div>
            {addableNpcList.length === 0 ? (
              <div style={{ color: "#9ca3af" }}>All campaign NPCs are already in this session.</div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {addableNpcList.map((n) => (
                  <li key={n.id} style={{ marginBottom: 6 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        await addNpcToSession(n.id);
                        setShowAddNpc(false);
                      }}
                      style={{ ...S.btnPrimary, width: "100%", textAlign: "left" }}
                    >
                      {n.name} {n.stand_name ? `· ${n.stand_name}` : ""}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setShowAddNpc(false)}
              style={{ ...S.btnGhost, marginTop: 12, width: "100%" }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div style={S.card}>
        <span style={S.sectionLbl}>Session player roster</span>
        <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 0" }}>
          Quick view: portrait, stand coin, action dots, XP tracks, personal clocks in this
          session. Crew summary (edit here or on campaign). Below: PCs in this crew’s
          campaign.
        </p>
        {(crews || []).length === 0 ? (
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 10 }}>
            No crews linked to this campaign.
          </div>
        ) : (
          <div style={{ marginTop: 12, marginBottom: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            {(crews || []).map((crew) => {
              const d = crewDraftById[crew.id] || {};
              const busy = crewSavingId === crew.id;
              const playbookLabel =
                crew.playbook == null
                  ? "—"
                  : typeof crew.playbook === "string"
                    ? crew.playbook
                    : crew.playbook?.name || "—";
              const memberNames = Array.isArray(crew.members)
                ? crew.members
                    .map((m) => m.true_name || m.name || m.username)
                    .filter(Boolean)
                    .join(", ")
                : "";
              const rels = crew.faction_relationships;
              const relRows = Array.isArray(rels)
                ? rels.map((rel) =>
                    `${rel.faction_name || rel.faction_id}: ${rel.reputation_value}`,
                  )
                : [];
              const stashSlots = crew.stash_slots;
              const stashFilled =
                Array.isArray(stashSlots) ? stashSlots.filter(Boolean).length : null;
              return (
                <div
                  key={crew.id}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "1px solid #4338ca",
                    borderRadius: 8,
                    padding: 12,
                    background: "#0d1117",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontWeight: "bold", color: "#a78bfa", fontSize: 12 }}>
                      Crew · {(d.name ?? crew.name)?.trim() || `Crew ${crew.id}`}
                    </span>
                    {busy ? (
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>Saving…</span>
                    ) : null}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                      gap: 10,
                      marginTop: 10,
                    }}
                  >
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>Name</span>
                      <input
                        style={S.inp}
                        value={d.name ?? ""}
                        onChange={(e) =>
                          setCrewDraftById((p) => ({
                            ...p,
                            [crew.id]: { ...(p[crew.id] || {}), name: e.target.value },
                          }))
                        }
                        onBlur={() => {
                          const v = String(d.name || "").trim();
                          if (v !== String(crew.name || "").trim()) {
                            patchCrewSnapshot(crew.id, { name: v });
                          }
                        }}
                        disabled={busy}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>Level</span>
                      <input
                        style={S.inp}
                        value={d.level ?? ""}
                        inputMode="numeric"
                        onChange={(e) =>
                          setCrewDraftById((p) => ({
                            ...p,
                            [crew.id]: { ...(p[crew.id] || {}), level: e.target.value },
                          }))
                        }
                        onBlur={() => {
                          const n = parseInt(String(d.level).trim(), 10);
                          if (!Number.isFinite(n) || n === crew.level) return;
                          patchCrewSnapshot(crew.id, { level: n });
                        }}
                        disabled={busy}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>Hold</span>
                      <input
                        style={S.inp}
                        value={d.hold ?? ""}
                        onChange={(e) =>
                          setCrewDraftById((p) => ({
                            ...p,
                            [crew.id]: { ...(p[crew.id] || {}), hold: e.target.value },
                          }))
                        }
                        onBlur={() => {
                          const s = String(d.hold || "").trim();
                          if (s === String(crew.hold ?? "").trim()) return;
                          patchCrewSnapshot(crew.id, { hold: s });
                        }}
                        disabled={busy}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>Rep</span>
                      <input
                        style={S.inp}
                        value={d.rep ?? ""}
                        inputMode="numeric"
                        onChange={(e) =>
                          setCrewDraftById((p) => ({
                            ...p,
                            [crew.id]: { ...(p[crew.id] || {}), rep: e.target.value },
                          }))
                        }
                        onBlur={() => {
                          const n = parseInt(String(d.rep).trim(), 10);
                          if (!Number.isFinite(n) || n === crew.rep) return;
                          patchCrewSnapshot(crew.id, { rep: n });
                        }}
                        disabled={busy}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>Wanted ★</span>
                      <input
                        style={S.inp}
                        value={String(campaign?.wanted_stars ?? 0)}
                        inputMode="numeric"
                        readOnly
                        disabled
                      />
                      <span style={{ fontSize: 9, color: "#6b7280" }}>
                        Synced from campaign Wanted Level
                      </span>
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>Turf (0–6)</span>
                      <input
                        style={S.inp}
                        value={d.turf ?? ""}
                        inputMode="numeric"
                        onChange={(e) =>
                          setCrewDraftById((p) => ({
                            ...p,
                            [crew.id]: { ...(p[crew.id] || {}), turf: e.target.value },
                          }))
                        }
                        onBlur={() => {
                          const n = parseInt(String(d.turf).trim(), 10);
                          if (!Number.isFinite(n) || n === crew.turf) return;
                          patchCrewSnapshot(crew.id, { turf: n });
                        }}
                        disabled={busy}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>Coin</span>
                      <input
                        style={S.inp}
                        value={d.coin ?? ""}
                        inputMode="numeric"
                        onChange={(e) =>
                          setCrewDraftById((p) => ({
                            ...p,
                            [crew.id]: { ...(p[crew.id] || {}), coin: e.target.value },
                          }))
                        }
                        onBlur={() => {
                          const n = parseInt(String(d.coin).trim(), 10);
                          if (!Number.isFinite(n) || n === crew.coin) return;
                          patchCrewSnapshot(crew.id, { coin: n });
                        }}
                        disabled={busy}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>Stash</span>
                      <input
                        style={S.inp}
                        value={d.stash ?? ""}
                        inputMode="numeric"
                        onChange={(e) =>
                          setCrewDraftById((p) => ({
                            ...p,
                            [crew.id]: { ...(p[crew.id] || {}), stash: e.target.value },
                          }))
                        }
                        onBlur={() => {
                          const n = parseInt(String(d.stash).trim(), 10);
                          if (!Number.isFinite(n) || n === crew.stash) return;
                          patchCrewSnapshot(crew.id, { stash: n });
                        }}
                        disabled={busy}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>XP</span>
                      <input
                        style={S.inp}
                        value={d.xp ?? ""}
                        inputMode="numeric"
                        onChange={(e) =>
                          setCrewDraftById((p) => ({
                            ...p,
                            [crew.id]: { ...(p[crew.id] || {}), xp: e.target.value },
                          }))
                        }
                        onBlur={() => {
                          const n = parseInt(String(d.xp).trim(), 10);
                          if (!Number.isFinite(n) || n === crew.xp) return;
                          patchCrewSnapshot(crew.id, { xp: n });
                        }}
                        disabled={busy}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>
                        Advancement pts
                      </span>
                      <input
                        style={S.inp}
                        value={d.advancement_points ?? ""}
                        inputMode="numeric"
                        onChange={(e) =>
                          setCrewDraftById((p) => ({
                            ...p,
                            [crew.id]: {
                              ...(p[crew.id] || {}),
                              advancement_points: e.target.value,
                            },
                          }))
                        }
                        onBlur={() => {
                          const n = parseInt(
                            String(d.advancement_points).trim(),
                            10,
                          );
                          if (
                            !Number.isFinite(n) ||
                            n === crew.advancement_points
                          )
                            return;
                          patchCrewSnapshot(crew.id, {
                            advancement_points: n,
                          });
                        }}
                        disabled={busy}
                      />
                    </label>
                  </div>
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      marginTop: 10,
                    }}
                  >
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>Description</span>
                    <textarea
                      style={{
                        ...S.inp,
                        minHeight: 56,
                        resize: "vertical",
                        fontFamily: "monospace",
                        fontSize: 11,
                      }}
                      value={d.description ?? ""}
                      onChange={(e) =>
                        setCrewDraftById((p) => ({
                          ...p,
                          [crew.id]: {
                            ...(p[crew.id] || {}),
                            description: e.target.value,
                          },
                        }))
                      }
                      onBlur={() => {
                        const v = String(d.description || "");
                        if (v !== String(crew.description || "")) {
                          patchCrewSnapshot(crew.id, { description: v });
                        }
                      }}
                      disabled={busy}
                    />
                  </label>
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      marginTop: 8,
                    }}
                  >
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>Notes</span>
                    <textarea
                      style={{
                        ...S.inp,
                        minHeight: 44,
                        resize: "vertical",
                        fontFamily: "monospace",
                        fontSize: 11,
                      }}
                      value={d.notes ?? ""}
                      onChange={(e) =>
                        setCrewDraftById((p) => ({
                          ...p,
                          [crew.id]: { ...(p[crew.id] || {}), notes: e.target.value },
                        }))
                      }
                      onBlur={() => {
                        const v = String(d.notes || "");
                        if (v !== String(crew.notes || "")) {
                          patchCrewSnapshot(crew.id, { notes: v });
                        }
                      }}
                      disabled={busy}
                    />
                  </label>
                  <div style={{ marginTop: 10, fontSize: 10, color: "#6b7280" }}>
                    <div>
                      <span style={{ color: "#9ca3af" }}>Playbook: </span>
                      {playbookLabel}
                    </div>
                    {crew.proposed_name ? (
                      <div style={{ marginTop: 4 }}>
                        <span style={{ color: "#9ca3af" }}>Proposed name: </span>
                        {crew.proposed_name}
                      </div>
                    ) : null}
                    {memberNames ? (
                      <div style={{ marginTop: 4 }}>
                        <span style={{ color: "#9ca3af" }}>Members: </span>
                        {memberNames}
                      </div>
                    ) : null}
                    {relRows.length > 0 ? (
                      <div style={{ marginTop: 4 }}>
                        <span style={{ color: "#9ca3af" }}>Faction rep: </span>
                        {relRows.join(" · ")}
                      </div>
                    ) : null}
                    {stashFilled != null ? (
                      <div style={{ marginTop: 4 }}>
                        <span style={{ color: "#9ca3af" }}>Stash grid: </span>
                        {stashFilled}/40 filled
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={grid}>
          {campaignChars.map((ch) => {
            const cid = ch?.id != null ? Number(ch.id) : NaN;
            const full =
              (characters || []).find((c) => Number(c?.id) === cid) || ch;
            const portraitSrc = resolveMediaUrl(
              full.image || full.image_url || "",
            );
            const stand = full.stand || {};
            const grades = rawStandToGrades({
              power: stand.power,
              speed: stand.speed,
              range: stand.range,
              durability: stand.durability,
              precision: stand.precision,
              development: stand.development,
            });
            const xp = full.xp_clocks || {};
            const ad = full.action_dots || {};
            const name = full.true_name || full.name || `PC ${full.id}`;
            const pcClks = (clocks || []).filter(
              (c) => c.character === full.id && c.session === session.id,
            );
            const canSRank = full.gm_can_have_s_rank_stand_stats === true;
            return (
              <div key={full.id} style={{ ...card, width: 300 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  {portraitSrc ? (
                    <img
                      src={portraitSrc}
                      alt=""
                      style={{
                        width: 64,
                        height: 64,
                        flexShrink: 0,
                        objectFit: "cover",
                        borderRadius: 6,
                        border: "1px solid #30363d",
                        background: "#111",
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : null}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: "bold" }}>{name}</div>
                    <a
                      href={buildRouteHref("character", { characterId: full.id })}
                      onClick={(e) =>
                        handleSpaNavClick(e, () => onNavigateToCharacter?.(full.id))
                      }
                      style={{ ...S.btn, fontSize: 10, marginTop: 4 }}
                    >
                      Open sheet
                    </a>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <NpcsStandCoin
                    grades={grades}
                    readouts={readoutsFromGrades(grades)}
                    onStep={(k, d) => {
                      const st = full.stand || {};
                      const next = { ...grades, [k]: stepGrade(grades[k], d) };
                      setSaving(true);
                      characterAPI
                        .patchCharacter(full.id, {
                          stand: {
                            ...st,
                            power: next.power,
                            speed: next.speed,
                            range: next.range,
                            durability: next.durability,
                            precision: next.precision,
                            development: next.development,
                          },
                        })
                        .then(() => onRefresh())
                        .catch((e) => setError(e.message))
                        .finally(() => setSaving(false));
                    }}
                    variant="pc"
                    pcMaxGrade={canSRank ? "S" : "A"}
                  />
                </div>
                <div style={lbl}>Actions (dots)</div>
                <div style={{ fontSize: 10, color: "#9ca3af", maxHeight: 56, overflow: "auto" }}>
                  {flatActionDots(ad)
                    .map(([a, d]) => `${a}: ${d}`)
                    .join(" · ") || "—"}
                </div>
                <div style={lbl}>XP tracks</div>
                <div style={{ fontSize: 10, color: "#9ca3af" }}>
                  In {xp.insight ?? 0} · Pw {xp.prowess ?? 0} · Re {xp.resolve ?? 0} ·
                  Pb {xp.playbook ?? 0}
                </div>
                <div style={lbl}>Clocks (this session)</div>
                <ul style={{ margin: 0, paddingLeft: 14, color: "#6b7280" }}>
                  {pcClks.slice(0, 4).map((c) => (
                    <li key={c.id}>
                      {c.name} ({c.filled_segments}/{c.max_segments})
                    </li>
                  ))}
                  {pcClks.length === 0 && <li>—</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <div style={S.card}>
        <span style={S.sectionLbl}>Bulk position / effect (per character)</span>
        <p style={{ fontSize: 11, color: "#6b7280" }}>
          Overrides session defaults for these PCs on action rolls. Leave row at session
          default to use defaults (clear with Reset).
        </p>
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-end",
            marginBottom: 12,
          }}
        >
          <div>
            <div style={lbl}>Session default position</div>
            <select
              style={S.select}
              value={defaultPos}
              onChange={(e) => {
                const default_position = e.target.value;
                setSaving(true);
                sessionAPI
                  .patchSession(session.id, { default_position })
                  .then((updated) => {
                    setSessionData(updated);
                    onRefresh();
                  })
                  .catch((err) => setError(err.message || "Save failed"))
                  .finally(() => setSaving(false));
              }}
              disabled={saving}
            >
              <option value="controlled">Controlled</option>
              <option value="risky">Risky</option>
              <option value="desperate">Desperate</option>
            </select>
          </div>
          <div>
            <div style={lbl}>Session default effect</div>
            <select
              style={S.select}
              value={defaultEff}
              onChange={(e) => {
                const default_effect = e.target.value;
                setSaving(true);
                sessionAPI
                  .patchSession(session.id, { default_effect })
                  .then((updated) => {
                    setSessionData(updated);
                    onRefresh();
                  })
                  .catch((err) => setError(err.message || "Save failed"))
                  .finally(() => setSaving(false));
              }}
              disabled={saving}
            >
              <option value="limited">Limited</option>
              <option value="standard">Standard</option>
              <option value="extreme">Extreme</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 10, maxWidth: 420 }}>
          <div style={lbl}>Roll goal label (players see in roll pool)</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => setGoalAssignMode("global")}
              style={{
                ...S.btn,
                fontSize: 10,
                background: goalAssignMode === "global" ? "#4338ca" : "#1f2937",
                color: goalAssignMode === "global" ? "#fff" : "#9ca3af",
              }}
            >
              Global
            </button>
            <button
              type="button"
              onClick={() => setGoalAssignMode("individual")}
              style={{
                ...S.btn,
                fontSize: 10,
                background:
                  goalAssignMode === "individual" ? "#4338ca" : "#1f2937",
                color: goalAssignMode === "individual" ? "#fff" : "#9ca3af",
              }}
            >
              Individual
            </button>
          </div>
          {goalAssignMode === "global" ? (
            <div style={{ display: "grid", gap: 6 }}>
              <input
                style={{ ...S.inp, width: "100%" }}
                value={sessionData?.roll_goal_label ?? ""}
                onChange={(e) =>
                  setSessionData((p) => ({
                    ...p,
                    roll_goal_label: e.target.value,
                  }))
                }
                onBlur={(e) => {
                  const value = e.target.value || "";
                  setSaving(true);
                  sessionAPI
                    .patchSession(session.id, { roll_goal_label: value })
                    .then((updated) => {
                      setSessionData(updated);
                      onRefresh();
                    })
                    .catch((err) => setError(err.message || "Save failed"))
                    .finally(() => setSaving(false));
                }}
                placeholder="e.g. Quietly open the service door"
              />
              <div style={{ fontSize: 10, color: "#6b7280" }}>
                Applies to everyone unless a per-player label is set.
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              <select
                style={{ ...S.select, width: "100%" }}
                value={goalAssignCharId}
                onChange={(e) => setGoalAssignCharId(e.target.value)}
              >
                <option value="">Choose player</option>
                {(campaignChars || []).map((ch) => (
                  <option key={ch.id} value={String(ch.id)}>
                    {ch.true_name || ch.name || `PC ${ch.id}`}
                  </option>
                ))}
              </select>
              <input
                style={{ ...S.inp, width: "100%" }}
                value={goalAssignDraft}
                onChange={(e) => setGoalAssignDraft(e.target.value)}
                onBlur={(e) => {
                  const cid = String(goalAssignCharId || "").trim();
                  if (!cid) return;
                  const value = (e.target.value || "").trim();
                  const next = { ...(goalMap || {}) };
                  if (!value) delete next[cid];
                  else next[cid] = value;
                  setSaving(true);
                  sessionAPI
                    .patchSession(session.id, { roll_goal_by_character: next })
                    .then((updated) => {
                      setSessionData(updated);
                      onRefresh();
                    })
                    .catch((err) => setError(err.message || "Save failed"))
                    .finally(() => setSaving(false));
                }}
                placeholder="e.g. Quietly open the service door"
              />
              <div style={{ fontSize: 10, color: "#6b7280" }}>
                Assigned per selected player; this prepopulates their roll goal
                field in character sheet.
              </div>
            </div>
          )}
        </div>
        <div
          style={{
            marginBottom: 12,
            marginTop: 4,
            padding: 12,
            background: "#0d1117",
            borderRadius: 8,
            border: "1px solid #374151",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: manualRollCardOpen ? 8 : 0,
            }}
          >
            <span
              style={{
                fontSize: "11px",
                color: "#a78bfa",
                fontWeight: "bold",
              }}
            >
              Manual dice roll (offline)
            </span>
            <button
              type="button"
              onClick={() => setManualRollCardOpen((o) => !o)}
              aria-expanded={manualRollCardOpen}
              style={{
                flexShrink: 0,
                fontSize: 11,
                color: "#9ca3af",
                background: "#161b22",
                border: "1px solid #374151",
                borderRadius: 4,
                padding: "4px 8px",
                cursor: "pointer",
              }}
            >
              {manualRollCardOpen ? "Collapse" : "Expand"}
            </button>
          </div>
          {manualRollCardOpen ? (
            <>
          <div
            style={{
              fontSize: "10px",
              color: "#6b7280",
              marginBottom: "10px",
            }}
          >
            Log table results. Action rolls use session default position / effect
            from Position & effect (below).
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              alignItems: "flex-end",
              fontSize: "11px",
            }}
          >
            <div>
              <span
                style={{
                  color: "#9ca3af",
                  display: "block",
                  marginBottom: "2px",
                }}
              >
                Roll type
              </span>
              <select
                style={S.select}
                value={manualRoll.rollKind}
                onChange={(e) =>
                  setManualRoll((p) => ({ ...p, rollKind: e.target.value }))
                }
              >
                <option value="ACTION">Action</option>
                <option value="RESISTANCE">Resistance</option>
                <option value="CLEAR_STRESS">Vice / clear stress</option>
              </select>
            </div>
            <div>
              <span
                style={{
                  color: "#9ca3af",
                  display: "block",
                  marginBottom: "2px",
                }}
              >
                Character
              </span>
              <select
                style={S.select}
                value={manualRoll.characterId}
                onChange={(e) =>
                  setManualRoll((p) => ({
                    ...p,
                    characterId: e.target.value,
                  }))
                }
              >
                <option value="">—</option>
                {campaignChars.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.true_name || ch.name || `PC ${ch.id}`}
                  </option>
                ))}
              </select>
            </div>
            {String(manualRoll.rollKind || "").toUpperCase() === "ACTION" ? (
              <div>
                <span
                  style={{
                    color: "#9ca3af",
                    display: "block",
                    marginBottom: "2px",
                  }}
                >
                  Action
                </span>
                <select
                  style={S.select}
                  value={
                    ACTION_RATING_KEYS.map((k) => k.toLowerCase()).includes(
                      String(manualRoll.actionName || "").toLowerCase(),
                    )
                      ? String(manualRoll.actionName || "").toLowerCase()
                      : "skirmish"
                  }
                  onChange={(e) =>
                    setManualRoll((p) => ({
                      ...p,
                      actionName: e.target.value,
                    }))
                  }
                >
                  {ACTION_RATING_KEYS.map((key) => {
                    const v = key.toLowerCase();
                    const label =
                      key.charAt(0) + key.slice(1).toLowerCase();
                    return (
                      <option key={v} value={v}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : String(manualRoll.rollKind || "").toUpperCase() ===
              "RESISTANCE" ? (
              <div>
                <span
                  style={{
                    color: "#9ca3af",
                    display: "block",
                    marginBottom: "2px",
                  }}
                >
                  Attribute
                </span>
                <select
                  style={S.select}
                  value={manualRoll.resistanceAttr}
                  onChange={(e) =>
                    setManualRoll((p) => ({
                      ...p,
                      resistanceAttr: e.target.value,
                    }))
                  }
                >
                  <option value="insight">Insight</option>
                  <option value="prowess">Prowess</option>
                  <option value="resolve">Resolve</option>
                </select>
              </div>
            ) : (
              <div>
                <span
                  style={{
                    color: "#9ca3af",
                    display: "block",
                    marginBottom: "2px",
                  }}
                >
                  Note (overindulge, etc.)
                </span>
                <input
                  style={{ ...S.inp, width: 180 }}
                  value={manualRoll.viceNote}
                  onChange={(e) =>
                    setManualRoll((p) => ({ ...p, viceNote: e.target.value }))
                  }
                  placeholder="optional"
                />
              </div>
            )}
            <div>
              <span
                style={{
                  color: "#9ca3af",
                  display: "block",
                  marginBottom: "2px",
                }}
              >
                Dice (1–6)
              </span>
              <input
                style={{ ...S.inp, width: 90 }}
                value={manualRoll.diceStr}
                onChange={(e) =>
                  setManualRoll((p) => ({ ...p, diceStr: e.target.value }))
                }
                placeholder="4, 5"
              />
            </div>
            <div>
              <span
                style={{
                  color: "#9ca3af",
                  display: "block",
                  marginBottom: "2px",
                }}
              >
                Outcome
              </span>
              <select
                style={S.select}
                value={manualRoll.outcome}
                onChange={(e) =>
                  setManualRoll((p) => ({ ...p, outcome: e.target.value }))
                }
              >
                <option value="CRITICAL_SUCCESS">Critical</option>
                <option value="FULL_SUCCESS">Full</option>
                <option value="PARTIAL_SUCCESS">Partial</option>
                <option value="FAILURE">Failure</option>
                <option value="BOTCH">Botch</option>
              </select>
            </div>
            <button
              type="button"
              onClick={onManualRollCreate}
              style={S.btnPrimary}
              disabled={manualRollSaving}
            >
              {manualRollSaving ? "Saving..." : "Add manual roll"}
            </button>
          </div>
            </>
          ) : null}
        </div>
        {manualXp != null && setManualXp != null && onManualXpGrant != null ? (
          <div
            style={{
              marginBottom: 12,
              marginTop: 4,
              padding: 12,
              background: "#0d1117",
              borderRadius: 8,
              border: "1px solid #374151",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: sessionXpCardOpen ? 4 : 0,
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "#a78bfa",
                  fontWeight: "bold",
                }}
              >
                Session XP
              </span>
              <button
                type="button"
                onClick={() => setSessionXpCardOpen((o) => !o)}
                aria-expanded={sessionXpCardOpen}
                style={{
                  flexShrink: 0,
                  fontSize: 11,
                  color: "#9ca3af",
                  background: "#161b22",
                  border: "1px solid #374151",
                  borderRadius: 4,
                  padding: "4px 8px",
                  cursor: "pointer",
                }}
              >
                {sessionXpCardOpen ? "Collapse" : "Expand"}
              </button>
            </div>
            {sessionXpCardOpen ? (
            <>
            <div
              style={{
                fontSize: "10px",
                color: "#6b7280",
                marginBottom: "10px",
              }}
            >
              <strong style={{ color: "#9ca3af" }}>Manual award</strong> — for
              offline dice, table rulings, or end-of-session trigger marks with no
              auto XP. The panels below pull together{" "}
              <strong>experience tracker</strong> rows, <strong>linked XP history</strong>,
              <strong>completed progress clocks</strong> on this session, and{" "}
              <strong>sheet saves</strong> that changed XP tracks (spend / refill), scoped
              roughly to this session&apos;s <strong>session date</strong>.
            </div>
            <details
              style={{
                fontSize: 10,
                color: "#9ca3af",
                marginBottom: 10,
              }}
            >
              <summary
                style={{
                  color: "#d1d5db",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                XP types & automatic awards
              </summary>
              <ul
                style={{
                  margin: "8px 0 0",
                  paddingLeft: 18,
                  lineHeight: 1.45,
                }}
              >
                <li>
                  <strong style={{ color: "#e5e7eb" }}>DESPERATE_ROLL</strong> — +1
                  on an attribute XP clock when a desperate{" "}
                  <em>action</em> roll is made on the site for this session (mapped
                  skill → insight / prowess / resolve; capped per track).
                </li>
                <li>
                  <strong style={{ color: "#e5e7eb" }}>MANUAL</strong> — this form or
                  the character sheet &ldquo;add XP&rdquo; flow; description usually
                  includes the track and reason.
                </li>
                <li>
                  <strong style={{ color: "#e5e7eb" }}>Heritage expression</strong> — auto
                  on action rolls where heritage benefits applied (BELIEFS / heritage
                  track), when logged by the server.
                </li>
                <li>
                  Other trigger labels (beliefs, struggle, standout, etc.) appear when
                  the site or a GM logs them (manual or automation).
                </li>
              </ul>
            </details>
            <div
              style={{
                fontSize: 10,
                color: "#9ca3af",
                marginBottom: 6,
                fontWeight: "bold",
              }}
            >
              By PC — requirements logged (experience tracker)
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#6b7280",
                marginBottom: 10,
                lineHeight: 1.45,
              }}
            >
              {(() => {
                const anyReq = (campaignChars || []).some((ch) =>
                  (pcXpRequirementsByCharacter.get(Number(ch.id)) || []).length,
                );
                if (!anyReq) {
                  return (
                    <span>
                      No tracker rows for this session yet. Auto awards (e.g. desperate
                      rolls, heritage on rolls) and manual grants show here once the
                      backend logs them.
                    </span>
                  );
                }
                return (campaignChars || []).map((ch) => {
                  const cid = Number(ch.id);
                  const lines = pcXpRequirementsByCharacter.get(cid);
                  if (!lines?.length) return null;
                  const title =
                    charDisplayNameById.get(cid) ||
                    ch.true_name ||
                    ch.name ||
                    `PC ${cid}`;
                  return (
                    <div
                      key={`xp-req-${cid}`}
                      style={{ marginBottom: 8 }}
                    >
                      <div
                        style={{
                          color: "#d1d5db",
                          fontWeight: 600,
                          marginBottom: 4,
                        }}
                      >
                        {title}
                      </div>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: 18,
                          color: "#9ca3af",
                        }}
                      >
                        {lines.map((line, i) => (
                          <li key={`${cid}-${i}`}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  );
                });
              })()}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#9ca3af",
                marginBottom: 6,
                fontWeight: "bold",
              }}
            >
              Clocks completed this session
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#6b7280",
                marginBottom: 10,
                lineHeight: 1.45,
              }}
            >
              {sessionCompletedClocks.length === 0 ? (
                <span>No progress clocks on this session are marked complete yet.</span>
              ) : (
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    color: "#9ca3af",
                  }}
                >
                  {sessionCompletedClocks.map((clk) => (
                    <li key={`done-clk-${clk.id}`}>
                      <span style={{ color: "#d1d5db" }}>
                        {clk.name || "Clock"}
                      </span>
                      {` · ${progressClockOwnerLabel(clk)} · `}
                      {Number(clk.filled_segments) || 0}/{Number(clk.max_segments) || 0}
                      {clk.clock_type ? ` (${clk.clock_type})` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#9ca3af",
                marginBottom: 6,
                fontWeight: "bold",
              }}
            >
              Sheet changes — initial buy-in vs paid with XP
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#6b7280",
                marginBottom: 10,
                lineHeight: 1.45,
              }}
            >
              {!sessionAdvancementHistoryLoaded ? (
                <span>Loading sheet history…</span>
              ) : !sessionData?.session_date ? (
                <span>
                  Set a session date on this session to bound sheet edits to
                  &ldquo;this session&rdquo; (uses session date minus one hour).
                </span>
              ) : sessionAdvancementHistory.length === 0 ? (
                <span>
                  No character sheet saves in this window touched XP tracks, total
                  spent, action dots, or related advancement fields.
                </span>
              ) : (
                <>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#d1d5db",
                      marginBottom: 6,
                      marginTop: 2,
                    }}
                  >
                    Initial buy-in / setup (from empty baselines)
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: "#52525b",
                      marginBottom: 6,
                      lineHeight: 1.35,
                    }}
                  >
                    First-time action-dot layout (was all zero) or first playbook
                    tick fills starting from zero totals — not assumed to be XP
                    spent.
                  </div>
                  {advancementLedgerNodes.initial.length === 0 ? (
                    <div style={{ marginBottom: 12, color: "#6b7280" }}>
                      No initial-layout rows in this window.
                    </div>
                  ) : (
                    <ul
                      style={{
                        margin: "0 0 12px 0",
                        paddingLeft: 18,
                        color: "#9ca3af",
                        listStyle: "disc",
                      }}
                    >
                      {advancementLedgerNodes.initial}
                    </ul>
                  )}
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#d1d5db",
                      marginBottom: 6,
                    }}
                  >
                    Paid with XP (expenditure / advances)
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: "#52525b",
                      marginBottom: 6,
                      lineHeight: 1.35,
                    }}
                  >
                    Extra dots after you already had a built sheet, playbook ticks that
                    went down or cleared, or an increased &ldquo;total XP spent&rdquo;
                    tally.
                  </div>
                  {advancementLedgerNodes.expenditure.length === 0 ? (
                    <div style={{ marginBottom: 12, color: "#6b7280" }}>
                      No paid-with-XP rows in this window.
                    </div>
                  ) : (
                    <ul
                      style={{
                        margin: "0 0 12px 0",
                        paddingLeft: 18,
                        color: "#9ca3af",
                        listStyle: "disc",
                      }}
                    >
                      {advancementLedgerNodes.expenditure}
                    </ul>
                  )}
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#d1d5db",
                      marginBottom: 6,
                    }}
                  >
                    Other sheet ledger (not sorted above)
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: "#52525b",
                      marginBottom: 6,
                      lineHeight: 1.35,
                    }}
                  >
                    Redistributed dots with the same total, ticks only going up on the
                    sheet, stand coin / heritage tallies, etc.
                  </div>
                  {advancementLedgerNodes.other.length === 0 ? (
                    <div style={{ color: "#6b7280" }}>None in this window.</div>
                  ) : (
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: 18,
                        color: "#9ca3af",
                        listStyle: "disc",
                      }}
                    >
                      {advancementLedgerNodes.other}
                    </ul>
                  )}
                </>
              )}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#9ca3af",
                marginBottom: 6,
                fontWeight: "bold",
              }}
            >
              Session XP log (tracker + linked ledger)
            </div>
            <div
              style={{
                maxHeight: 200,
                overflowY: "auto",
                border: "1px solid #30363d",
                borderRadius: 6,
                marginBottom: 12,
                background: "#0b1220",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 10,
                }}
              >
                <thead>
                  <tr style={{ background: "#161b22", color: "#8b949e" }}>
                    <th style={{ textAlign: "left", padding: 6 }}>When</th>
                    <th style={{ textAlign: "left", padding: 6 }}>PC</th>
                    <th style={{ textAlign: "right", padding: 6 }}>Δ XP</th>
                    <th style={{ textAlign: "left", padding: 6 }}>Type</th>
                    <th style={{ textAlign: "left", padding: 6 }}>Source</th>
                    <th style={{ textAlign: "left", padding: 6 }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionXpFeedSorted.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        style={{ padding: 8, color: "#6b7280" }}
                      >
                        No tracker or linked XP-history rows yet. Grant manual XP or refresh
                        after play — new rows should appear here.
                      </td>
                    </tr>
                  ) : (
                    sessionXpFeedSorted.map((row) => {
                      const cid = Number(row.character);
                      const name =
                        charDisplayNameById.get(cid) || `PC ${row.character}`;
                      const xpN = Number(row.xp) || 0;
                      const xpStr = xpN >= 0 ? `+${xpN}` : `${xpN}`;
                      const xpColor =
                        xpN < 0 ? "#f87171" : xpN === 0 ? "#9ca3af" : "#34d399";
                      const desc = String(row.note || "").trim();
                      const descShort =
                        desc.length > 48 ? `${desc.slice(0, 45)}…` : desc;
                      return (
                        <tr
                          key={row.key}
                          style={{ borderTop: "1px solid #21262d" }}
                        >
                          <td
                            style={{
                              padding: 6,
                              whiteSpace: "nowrap",
                              verticalAlign: "top",
                            }}
                          >
                            {row.when
                              ? new Date(row.when).toLocaleString()
                              : "—"}
                          </td>
                          <td
                            style={{
                              padding: 6,
                              verticalAlign: "top",
                              color: "#e5e7eb",
                            }}
                          >
                            {name}
                          </td>
                          <td
                            style={{
                              padding: 6,
                              textAlign: "right",
                              verticalAlign: "top",
                              color: xpColor,
                            }}
                          >
                            {xpStr}
                          </td>
                          <td
                            style={{
                              padding: 6,
                              verticalAlign: "top",
                              color: "#c9d1d9",
                            }}
                          >
                            {row.typeLabel || "—"}
                          </td>
                          <td
                            style={{
                              padding: 6,
                              verticalAlign: "top",
                              color: "#8b949e",
                            }}
                          >
                            {row.source}
                          </td>
                          <td
                            style={{
                              padding: 6,
                              verticalAlign: "top",
                              color: "#9ca3af",
                              maxWidth: 200,
                              wordBreak: "break-word",
                            }}
                            title={desc || undefined}
                          >
                            {descShort || "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "flex-end",
                marginBottom: 14,
                fontSize: 11,
              }}
            >
              <div>
                <span
                  style={{
                    color: "#9ca3af",
                    display: "block",
                    marginBottom: 2,
                  }}
                >
                  All-time XP log for
                </span>
                <select
                  style={S.select}
                  value={xpLifetimeCharId}
                  onChange={(e) => setXpLifetimeCharId(e.target.value)}
                >
                  <option value="">— choose PC —</option>
                  {campaignChars.map((ch) => (
                    <option key={ch.id} value={String(ch.id)}>
                      {ch.true_name || ch.name || `PC ${ch.id}`}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                style={S.btnPrimary}
                disabled={!xpLifetimeCharId}
                onClick={() => setXpLifetimeModalOpen(true)}
              >
                Open full log…
              </button>
              {onNavigateToCharacter ? (
                <button
                  type="button"
                  style={S.btnGhost}
                  disabled={!xpLifetimeCharId}
                  onClick={() =>
                    onNavigateToCharacter(Number(xpLifetimeCharId))
                  }
                >
                  Open character sheet
                </button>
              ) : null}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#9ca3af",
                marginBottom: 8,
                fontWeight: "bold",
              }}
            >
              Add manual award
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                alignItems: "flex-end",
                fontSize: "11px",
              }}
            >
              <div>
                <span
                  style={{
                    color: "#9ca3af",
                    display: "block",
                    marginBottom: "2px",
                  }}
                >
                  Character
                </span>
                <select
                  style={S.select}
                  value={manualXp.characterId}
                  onChange={(e) =>
                    setManualXp((p) => ({
                      ...p,
                      characterId: e.target.value,
                    }))
                  }
                >
                  <option value="">—</option>
                  {campaignChars.map((ch) => (
                    <option key={ch.id} value={String(ch.id)}>
                      {ch.true_name || ch.name || `PC ${ch.id}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span
                  style={{
                    color: "#9ca3af",
                    display: "block",
                    marginBottom: "2px",
                  }}
                >
                  XP track
                </span>
                <select
                  style={S.select}
                  value={manualXp.track}
                  onChange={(e) =>
                    setManualXp((p) => ({ ...p, track: e.target.value }))
                  }
                >
                  <option value="playbook">Playbook</option>
                  <option value="insight">Insight</option>
                  <option value="prowess">Prowess</option>
                  <option value="resolve">Resolve</option>
                  <option value="heritage">Heritage</option>
                </select>
              </div>
              <div>
                <span
                  style={{
                    color: "#9ca3af",
                    display: "block",
                    marginBottom: "2px",
                  }}
                >
                  Amount (1–20)
                </span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  style={{ ...S.inp, width: 72 }}
                  value={manualXp.amount}
                  onChange={(e) =>
                    setManualXp((p) => ({
                      ...p,
                      amount: Math.min(
                        20,
                        Math.max(1, parseInt(e.target.value, 10) || 1),
                      ),
                    }))
                  }
                />
              </div>
              <div style={{ flex: "1 1 200px", minWidth: "160px" }}>
                <span
                  style={{
                    color: "#9ca3af",
                    display: "block",
                    marginBottom: "2px",
                  }}
                >
                  Reason / note
                </span>
                <input
                  style={{ ...S.inp, width: "100%" }}
                  value={manualXp.reason}
                  onChange={(e) =>
                    setManualXp((p) => ({ ...p, reason: e.target.value }))
                  }
                  placeholder="e.g. Desperate skirmish at table, +2 XP"
                />
              </div>
              <button
                type="button"
                onClick={onManualXpGrant}
                style={S.btnPrimary}
                disabled={manualXpSaving}
              >
                {manualXpSaving ? "Saving..." : "Add XP"}
              </button>
            </div>
            </>
            ) : null}
          </div>
        ) : null}
        <div style={{ display: "grid", gap: 10 }}>
          {campaignChars.map((ch) => {
            const id = ch.id;
            const patchHarmFromDraft = async () => {
              const d = harmDraftByChar[id] || {};
              const payload = {
                harm_level1_name: d.l1a || "",
                harm_level1_used: !!(d.l1a || "").trim(),
                harm_level1_slot2_name: d.l1b || "",
                harm_level1_slot2_used: !!(d.l1b || "").trim(),
                harm_level2_name: d.l2a || "",
                harm_level2_used: !!(d.l2a || "").trim(),
                harm_level2_slot2_name: d.l2b || "",
                harm_level2_slot2_used: !!(d.l2b || "").trim(),
                harm_level3_name: d.l3 || "",
                harm_level3_used: !!(d.l3 || "").trim(),
                harm_level4_name: d.l4 || "",
                harm_level4_used: !!(d.l4 || "").trim(),
              };
              try {
                await characterAPI.patchCharacter(id, payload);
                onRefresh();
              } catch (e) {
                setError(e.message || "Failed to save harm");
              }
            };
            const row = peMap[String(id)] || peMap[id] || null;
            const pos = row?.position || defaultPos;
            const eff = row?.effect || defaultEff;
            return (
              <div
                key={id}
                style={{
                  border: "1px solid #374151",
                  borderRadius: 8,
                  padding: 10,
                  background: "#0b1220",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                    gap: 8,
                  }}
                >
                  <strong style={{ color: "#e5e7eb", fontSize: 12 }}>
                    {ch.true_name || ch.name || id}
                  </strong>
                  <button
                    type="button"
                    onClick={() => mergePosEffect({ [id]: null })}
                    style={{ ...S.btnGhost, fontSize: 10 }}
                    disabled={saving}
                    title="Use session default for this PC"
                  >
                    Reset
                  </button>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 18,
                    flexWrap: "wrap",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <PositionStack
                      activePosition={pos}
                      readOnly={saving}
                      onSelect={(value) =>
                        mergePosEffect({
                          [id]: { position: value, effect: eff },
                        })
                      }
                    />
                    <EffectShapes
                      activeEffect={eff}
                      readOnly={saving}
                      onSelect={(value) =>
                        mergePosEffect({
                          [id]: { position: pos, effect: value },
                        })
                      }
                    />
                  </div>
                  <div style={{ minWidth: 220, flex: "1 1 220px" }}>
                    <div
                      style={{
                        ...lbl,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span>Recent rolls</span>
                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 10,
                          color: "#9ca3af",
                          textTransform: "none",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={showAllRecentRolls}
                          onChange={(e) => setShowAllRecentRolls(e.target.checked)}
                        />
                        All roll types
                      </label>
                    </div>
                    <div
                      style={{
                        border: "1px solid #374151",
                        borderRadius: 6,
                        padding: 8,
                        background: "#0d1117",
                        maxHeight: 120,
                        overflow: "auto",
                        fontSize: 10,
                        color: "#9ca3af",
                      }}
                    >
                      {getRecentCharacterRolls(id).length === 0 ? (
                        <div>—</div>
                      ) : (
                        getRecentCharacterRolls(id).map((r) => (
                          <div
                            key={r.id}
                            style={{
                              marginBottom: 4,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 8,
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              {showAllRecentRolls ? (
                                <span style={{ color: "#6b7280" }}>
                                  {String(r.roll_type || "").toUpperCase()} ·{" "}
                                </span>
                              ) : null}
                              {(r.action_name || "action").toUpperCase()} ·{" "}
                              {(r.results || []).join(", ")} →{" "}
                              {(r.outcome || "").replace(/_/g, " ")}
                              {r.xp_award_detail ? (
                                <span
                                  style={{
                                    display: "block",
                                    marginTop: 3,
                                    color: "#34d399",
                                    fontSize: 9,
                                    lineHeight: 1.35,
                                  }}
                                >
                                  +{r.xp_award_detail.xp_gained} XP ·{" "}
                                  {r.xp_award_detail.trigger_label ||
                                    r.xp_award_detail.trigger}
                                  {r.xp_award_detail.track &&
                                  r.xp_award_detail.track_total != null &&
                                  r.xp_award_detail.track_total !== undefined
                                    ? ` · ${String(r.xp_award_detail.track)} ${r.xp_award_detail.track_total}`
                                    : ""}
                                  {r.xp_award_detail.all_tracks_total != null &&
                                  r.xp_award_detail.all_tracks_total !== undefined
                                    ? ` · all clocks ${r.xp_award_detail.all_tracks_total}`
                                    : ""}
                                </span>
                              ) : null}
                            </div>
                            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                              <button
                                type="button"
                                style={{ ...S.btnGhost, fontSize: 9, padding: "2px 6px" }}
                                onClick={() => editRecentRoll(r)}
                                disabled={recentRollSavingId === r.id}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                style={{ ...S.btnDanger, fontSize: 9, padding: "2px 6px" }}
                                onClick={() => deleteRecentRoll(r)}
                                disabled={recentRollSavingId === r.id}
                              >
                                Del
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div style={{ minWidth: 220, flex: "1 1 220px" }}>
                    <div style={lbl}>Harm (compact)</div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 6,
                        fontSize: 10,
                      }}
                    >
                      {(
                        [
                          ["l4", "L4", "1 / -1"],
                          ["l3", "L3", "1 / -1"],
                          ["l2a", "L2A", null],
                          ["l2b", "L2B", null],
                          ["l1a", "L1A", null],
                          ["l1b", "L1B", null],
                        ]
                      ).map(([key, label, gridColumn]) => (
                        <input
                          key={`${id}-${key}`}
                          value={harmDraftByChar[id]?.[key] || ""}
                          onChange={(e) =>
                            setHarmDraftByChar((prev) => ({
                              ...prev,
                              [id]: { ...(prev[id] || {}), [key]: e.target.value },
                            }))
                          }
                          onBlur={patchHarmFromDraft}
                          placeholder={label}
                          style={{
                            ...S.inp,
                            fontSize: 10,
                            padding: "4px 6px",
                            minWidth: 0,
                            ...compactHarmFieldStyle(
                              key,
                              harmDraftByChar[id]?.[key],
                            ),
                            ...(gridColumn ? { gridColumn } : {}),
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {xpLifetimeModalOpen && xpLifetimeCharId ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            zIndex: 220,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setXpLifetimeModalOpen(false)}
        >
          <div
            style={{
              background: "#111827",
              border: "1px solid #4b5563",
              borderRadius: 8,
              padding: 16,
              maxWidth: 520,
              width: "100%",
              maxHeight: "80vh",
              overflow: "auto",
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{ fontWeight: "bold", marginBottom: 8, color: "#e5e7eb" }}
            >
              All-time XP —{" "}
              {charDisplayNameById.get(Number(xpLifetimeCharId)) ||
                `PC ${xpLifetimeCharId}`}
            </div>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 12px" }}>
              Experience tracker entries and legacy XP history for this character
              (all sessions), newest first.
            </p>
            {xpLifetimeLoading ? (
              <div style={{ color: "#9ca3af" }}>Loading…</div>
            ) : xpLifetimeError ? (
              <div style={{ color: "#f87171" }}>{xpLifetimeError}</div>
            ) : (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 11,
                  color: "#d1d5db",
                  maxHeight: "55vh",
                  overflowY: "auto",
                }}
              >
                {xpLifetimeRows.length === 0 ? (
                  <li style={{ color: "#6b7280", listStyle: "none" }}>
                    No entries.
                  </li>
                ) : (
                  xpLifetimeRows.map((r) => (
                    <li key={r.key} style={{ marginBottom: 10 }}>
                      <span style={{ color: "#6b7280", fontSize: 10 }}>
                        {r.when ? new Date(r.when).toLocaleString() : "—"}
                      </span>
                      <div style={{ marginTop: 2 }}>{r.text}</div>
                    </li>
                  ))
                )}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setXpLifetimeModalOpen(false)}
              style={{ ...S.btnPrimary, marginTop: 14, width: "100%" }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

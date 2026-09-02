import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
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
  progressClockAPI,
  normalizeCharacterInventory,
  hasPlaybook,
  playbookToDisplay,
} from "../../features/character-sheet/services/api";
import { progressClockShowsPlayersBadge } from "../../features/character-sheet/utils/progressClockVisibility";
import { buildRouteHref, handleSpaNavClick } from "../../utils/spaNavigation";
import {
  ACTION_RATING_KEYS,
  STAND_ROLL_KEYS_ALL,
} from "../../features/character-sheet/constants/srd";
import NpcsStandCoin from "../NpcsStandCoin";
import { PositionStack, EffectShapes } from "../position-effect/PositionEffectIndicators";
import {
  getPositionEffectModifierHints,
  peModifierBucketLabel,
} from "./peModifierAbilityHints";
import {
  archetypeLabelsJoined,
  normalizePlaybookXpArchetypeKeys,
} from "../../features/character-sheet/utils/playbookXpTriggerSrd";
import { rosterHasLinkedCrewForCrewSheetFactionUi } from "../../features/character-sheet/utils/characterUtils";

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

/** Count `true` entries in character sheet coin_boxes / stash_slots arrays. */
function countSheetBoolSlots(arr) {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((n, x) => n + (x === true ? 1 : 0), 0);
}

function sheetCoinBoxesFromHandCount(n) {
  const k = Math.max(0, Math.min(4, Number(n) || 0));
  return [0, 1, 2, 3].map((i) => i < k);
}

function sheetStashSlotsFromFilledCount(n) {
  const k = Math.max(0, Math.min(40, Number(n) || 0));
  return Array.from({ length: 40 }, (_, i) => i < k);
}

/** Session FK on a progress clock row (API returns numeric id). */
function normalizeProgressClockSessionId(clk) {
  const raw = clk?.session;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function progressClockIsDone(clk) {
  if (clk?.completed === true) return true;
  const filled = Number(clk?.filled_segments) || 0;
  const max = Number(clk?.max_segments) || 0;
  return max > 0 && filled >= max;
}

/**
 * Long-term project on a PC or crew sheet, not tied to an NPC row,
 * and not created by the campaign GM (so mid-session / carryover player work shows here).
 */
function isPlayerOwnedProjectClock(clk, gmId) {
  if (String(clk?.clock_type || "").toUpperCase() !== "PROJECT") return false;
  if (clk?.npc != null && clk.npc !== "") return false;
  const hasChar = clk?.character != null && clk.character !== "";
  const hasCrew = clk?.crew != null && clk.crew !== "";
  if (!hasChar && !hasCrew) return false;
  const g =
    gmId != null && gmId !== "" ? Number(gmId) : NaN;
  const creator =
    clk?.created_by != null && clk.created_by !== ""
      ? Number(clk.created_by)
      : null;
  if (Number.isFinite(g) && Number.isFinite(creator) && creator === g) {
    return false;
  }
  return true;
}

function progressClockSessionScopeShort(clk, currentSessionId) {
  const cs = normalizeProgressClockSessionId(clk);
  const cur =
    currentSessionId != null && currentSessionId !== ""
      ? Number(currentSessionId)
      : NaN;
  if (cs == null) return "Carryover / open";
  if (Number.isFinite(cur) && cs === cur) return "This session";
  return `Other session (#${cs})`;
}

function rollHasTruthyFk(val) {
  if (val == null || val === "") return false;
  return true;
}

function recoveryContextTooltip(ctx) {
  const c = String(ctx || "").trim().toLowerCase();
  if (!c) return "";
  if (c === "ally") return "Ally recovery (treating another PC)";
  if (c === "self_downtime") return "Downtime self-recover (healing clock)";
  if (c === "self_mid_action") return "Mid-action self-recover (healing clock)";
  if (c === "self_treatment_roll") return "Self treatment roll";
  return c.replace(/_/g, " ");
}

function isModifierAssistRow(s) {
  if (!s || typeof s !== "object") return false;
  if (String(s.kind || "").toLowerCase() === "assist") return true;
  return /^assist\s*\(/i.test(String(s.name || ""));
}

function assistInfoFromRoll(r) {
  const pad = Number(r.pool_assist_dice || 0) || 0;
  const src = Array.isArray(r.modifier_sources) ? r.modifier_sources : [];
  const row = src.find(isModifierAssistRow);
  if (pad < 1 && !row) return null;
  const fromName = row
    ? String(row.name || "")
        .replace(/^\s*[Aa]ssist\s*\(\s*/, "")
        .replace(/\)\s*$/, "")
        .trim()
    : "";
  const desc = String(r.description || "");
  const m = desc.match(/\[Assist:\s*([^\]]+)\]/i);
  const fromDesc = m ? String(m[1]).trim() : "";
  const helper = fromName || fromDesc;
  return {
    label: "+1d",
    title: helper
      ? `Crew assist: +1d from ${helper}`
      : "Crew assist: +1d (pool_assist_dice / modifier_sources)",
  };
}

/** @returns {{ parts: string[], sum: number }} */
function poolBreakdownPiecesFromStoredFields(r) {
  const base = Number(r.pool_action_rating) || 0;
  const attr = Number(r.pool_attribute_dice) || 0;
  const bonus = Number(r.pool_bonus_dice) || 0;
  const assist = Number(r.pool_assist_dice) || 0;
  const pushDice = !!r.push_for_dice;
  const devilDice = !!r.uses_devil_bargain;
  const parts = [];
  if (base > 0) parts.push(`base ${base}`);
  if (attr > 0) parts.push(`attr ${attr}`);
  if (bonus > 0) parts.push(`bonus ${bonus}`);
  if (assist > 0) parts.push(`assist ${assist}`);
  if (pushDice) parts.push("push +1");
  if (devilDice) parts.push("devil +1");
  const sum =
    base +
    attr +
    bonus +
    assist +
    (pushDice ? 1 : 0) +
    (devilDice ? 1 : 0);
  return { parts, sum };
}

function humanizeModifierSourcesRows(mods) {
  if (!Array.isArray(mods) || !mods.length) return [];
  return mods.map((row) => {
    if (!row || typeof row !== "object") return "";
    const name = String(row.name ?? "").trim();
    const delta = String(row.delta ?? "").trim();
    const kind = String(row.kind ?? "").trim();
    const cat = String(row.category ?? "").trim();
    const bits = [];
    if (kind) bits.push(kind);
    if (name && name !== delta) bits.push(name);
    if (delta) bits.push(delta);
    if (!bits.length && cat) bits.push(cat);
    return bits.join(": ").replace(/^:\s*/, "").trim();
  }).filter(Boolean);
}

/** Physical dice rolled (tier pool may be 0 in Blades 0‑d tier rules). */
function recentRollDiceCountDisplay(r) {
  const stored = Number(r.dice_pool);
  const rc = Array.isArray(r.results) ? r.results.length : 0;
  if (Number.isFinite(stored) && stored > 0) return stored;
  if (rc > 0) return rc;
  return Number.isFinite(stored) ? stored : 0;
}

/**
 * Visible line suffix for Recent rolls row: how many dice, from stored pool_* when present.
 */
function recentRollDiceSourcesSummary(r) {
  const displayCount = recentRollDiceCountDisplay(r);
  const { parts } = poolBreakdownPiecesFromStoredFields(r);
  const mods = Array.isArray(r.modifier_sources) ? r.modifier_sources : [];
  if (displayCount === 0 && parts.length === 0 && mods.length === 0)
    return null;

  const headNd = `${displayCount}d`;
  if (parts.length > 0) {
    return `${headNd} · ${parts.join(" + ")}`;
  }

  if (mods.length > 0) {
    const short = mods
      .map((row) => {
        if (!row || typeof row !== "object") return "";
        const n = String(row.name || "").trim();
        const d = String(row.delta || "").trim();
        if (/^assist\b/i.test(n) || String(row.kind || "").toLowerCase() === "assist")
          return "+assist";
        if (String(row.kind || "").toLowerCase() === "push") return "+push";
        if (String(row.kind || "").toLowerCase() === "devil_bargain")
          return "+devil";
        if ((n || d).length <= 56)
          return d && n !== d ? `${n} (${d})` : n || d || "";
        return (n || d).slice(0, 53) + "…";
      })
      .filter(Boolean);
    const uq = [...new Set(short)].slice(0, 5);
    if (uq.length === 0) return headNd;
    return `${headNd} · ${uq.join(", ")}`;
  }

  return displayCount > 0 ? headNd : null;
}

/** Long tooltip: stored pool_* lines + modifier_sources (+ push effect / devil text). */
function recentRollDiceSourcesTooltip(r) {
  const lines = [];
  const storedTier = Number(r.dice_pool);
  const diceRolled = Array.isArray(r.results) ? r.results.length : 0;
  if (Number.isFinite(storedTier) && storedTier >= 0) {
    lines.push(`Recorded tier dice_pool: ${storedTier}d`);
  }
  if (diceRolled > 0) lines.push(`Dice rolled (results): ${diceRolled}`);

  const { parts, sum } = poolBreakdownPiecesFromStoredFields(r);
  if (parts.length > 0) {
    lines.push(`From stored pool_* (${sum}d):`);
    lines.push(parts.map((p) => `  • ${p}`).join("\n"));
  }
  const base = Number(r.pool_action_rating) || 0;
  const rt = String(r.roll_type || "").toUpperCase();
  const compareTotal =
    Number.isFinite(storedTier) && storedTier > 0 ? storedTier : diceRolled;
  if (
    compareTotal > 0 &&
    parts.length > 0 &&
    sum !== compareTotal &&
    (rt === "ACTION" || base > 0)
  )
    lines.push(
      `(Breakdown sums to ${sum}d vs tier/total ${compareTotal}d — edited or legacy.)`,
    );

  if (r.push_for_effect)
    lines.push("Push for effect: yes (effect / position trade — not an extra risk die)");

  const dc = String(r.devil_bargain_consequence || "").trim();
  if (r.uses_devil_bargain && dc)
    lines.push(`Devil's bargain note: ${dc}`);

  const detailed = humanizeModifierSourcesRows(
    Array.isArray(r.modifier_sources) ? r.modifier_sources : [],
  );
  if (detailed.length) {
    lines.push("modifier_sources:");
    detailed.forEach((t) => lines.push(`  • ${t}`));
  }

  return lines.filter(Boolean).join("\n").trim();
}

function buildRecentRollDetailTitle(r) {
  const parts = [];
  if (rollHasTruthyFk(r.group_action)) {
    parts.push(`Group action id ${r.group_action}`);
  }
  const rb = recoveryBadgeFromRoll(r);
  if (rb?.title) parts.push(rb.title);
  const ai = assistInfoFromRoll(r);
  if (ai?.title) parts.push(ai.title);
  const gl = String(r.goal_label || "").trim();
  if (gl && !parts.some((p) => p.includes(gl))) parts.push(gl);
  if (!parts.length) return undefined;
  return parts.join(" · ");
}

function recoveryBadgeFromRoll(r) {
  const rt = String(r.roll_type || "").toUpperCase();
  const ctx = String(r.recovery_context || "").trim().toLowerCase();
  const tgt = String(r.recovery_target_character_name || "").trim();
  if (rollHasTruthyFk(r.recovery_target) || ctx === "ally") {
    return {
      label: "Heal",
      title: tgt ? `Recovery treatment for ${tgt}` : "Ally recovery treatment",
    };
  }
  if (
    ctx === "self_downtime" ||
    ctx === "self_mid_action" ||
    (rt === "OTHER" && /healing clock recover/i.test(String(r.goal_label || "")))
  ) {
    return {
      label: "Recover",
      title: recoveryContextTooltip(ctx) || "Healing clock self-recover",
    };
  }
  const mods = Array.isArray(r.modifier_sources) ? r.modifier_sources : [];
  const healMod = mods.find((s) => {
    const k = String(s?.kind || "").toLowerCase();
    return k === "healing" || k.startsWith("recovery");
  });
  if (healMod) {
    return {
      label: "Heal",
      title: String(healMod.name || healMod.notes || "Recovery / treatment"),
    };
  }
  if (ctx) {
    return { label: "Recover", title: recoveryContextTooltip(ctx) };
  }
  return null;
}

/** Progress clocks scoped to campaign session (aligned with CampaignManagement ClockManager). */
const SESSION_PC_CLOCK_SEGMENTS = [4, 6, 8, 12];
const SESSION_PC_CLOCK_TYPES = [
  { value: "CUSTOM", label: "Custom" },
  { value: "DANGER", label: "Danger" },
  { value: "MISSION", label: "Mission" },
  { value: "HEALING", label: "Healing" },
  { value: "PROJECT", label: "Long-term Project" },
  { value: "COUNTDOWN", label: "Countdown" },
];

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

/** One history row’s “initial” bucket (dots from all-zero, empty playbook clocks → fills). */
function renderLedgerInitialBlock(
  entry,
  charDisplayNameById,
  keySuffix,
  note = null,
) {
  const lines = entry?.advancement_buckets?.initial || [];
  if (!lines.length) return null;
  const cid = Number(entry.character);
  const title =
    charDisplayNameById.get(cid) ||
    entry.character_true_name ||
    `PC ${entry.character}`;
  const when = entry.timestamp
    ? new Date(entry.timestamp).toLocaleString()
    : "—";
  return (
    <li key={`initial-${keySuffix}-${entry.id}`} style={{ marginBottom: 10 }}>
      <div style={{ color: "#e5e7eb", marginBottom: 4 }}>
        <span>{when}</span>
        <span style={{ color: "#9ca3af" }}>
          {" "}
          · {title}
        </span>
        {note ? (
          <span style={{ color: "#6b7280", fontSize: 9 }}> {note}</span>
        ) : null}
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
          <li key={`${entry.id}-initial-${keySuffix}-${i}`}>{line}</li>
        ))}
      </ul>
    </li>
  );
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

/** Blades-style attribute ratings: count of actions in each group with dot &gt; 0. */
function insightProwessResolveFromActionDots(actionDots) {
  const m = Object.fromEntries(flatActionDots(actionDots));
  const c = (keys) =>
    keys.reduce((n, k) => n + ((Number(m[k]) || 0) > 0 ? 1 : 0), 0);
  return {
    insight: c(["hunt", "study", "survey", "tinker"]),
    prowess: c(["finesse", "prowl", "skirmish", "wreck"]),
    resolve: c(["bizarre", "attune", "command", "consort", "sway"]),
  };
}

/** One-line summary for roster inventory row (strings or common object shapes). */
function rosterFormatInventoryLine(item) {
  if (item == null || item === "") return null;
  if (typeof item === "string") {
    const t = item.trim();
    return t || null;
  }
  if (typeof item === "object" && !Array.isArray(item)) {
    const name = String(item.name ?? item.label ?? "").trim();
    const desc = String(item.description ?? item.detail ?? "").trim();
    const qty =
      item.quantity != null && item.quantity !== ""
        ? ` ×${item.quantity}`
        : "";
    if (name && desc) return `${name}${qty} — ${desc}`;
    if (name) return `${name}${qty}`;
    try {
      return JSON.stringify(item);
    } catch {
      return "[item]";
    }
  }
  try {
    return JSON.stringify(item);
  } catch {
    return String(item);
  }
}

function rosterCharacterNoteSections(ch) {
  // Context-only fields (read-only) shown in a collapsible <details> under
  // the editable NOTES textarea. `background_note2` is intentionally
  // excluded because it IS the editable notes field and showing it twice
  // would imply two separate stores.
  const out = [];
  const push = (label, val) => {
    const t = String(val ?? "").trim();
    if (t) out.push({ label, text: t });
  };
  push("Background", ch.background_note);
  push("Appearance", ch.appearance);
  push("Vice details", ch.vice_details);
  return out;
}

/** Durability grade → max stand path armor charges (SRD; mirrors NPC sheet). */
const ROSTER_DUR_STAND_ARMOR_MAX = {
  F: 1,
  D: 2,
  C: 3,
  B: 4,
  A: 5,
  S: 6,
};

function rosterStandArmorMaxFromDurabilityGrade(letter) {
  const k = String(letter ?? "F")
    .trim()
    .toUpperCase()
    .slice(0, 1);
  return ROSTER_DUR_STAND_ARMOR_MAX[k] ?? 0;
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

const NPC_QUICK_PLAYBOOK_OPTIONS = [
  { value: "STAND", label: "Stand User" },
  { value: "HAMON", label: "Hamon User" },
  { value: "SPIN", label: "Spin User" },
  { value: "NON_BIZARRE", label: "Non-Bizarre" },
];

const NPC_QUICK_STAT_PRESETS = [
  { value: "balanced", label: "Standard (all grade D)" },
  { value: "bruiser", label: "Bruiser (Dur B, Power C)" },
  { value: "skirmisher", label: "Skirmisher (Speed B, Prec C)" },
  { value: "threat", label: "Even threat (all C)" },
];

function standCoinStatsFromQuickPreset(preset) {
  const d = {
    POWER: "D",
    SPEED: "D",
    RANGE: "D",
    DURABILITY: "D",
    PRECISION: "D",
    DEVELOPMENT: "D",
  };
  if (preset === "bruiser") return { ...d, DURABILITY: "B", POWER: "C" };
  if (preset === "skirmisher") return { ...d, SPEED: "B", PRECISION: "C" };
  if (preset === "threat") {
    return {
      POWER: "C",
      SPEED: "C",
      RANGE: "C",
      DURABILITY: "C",
      PRECISION: "C",
      DEVELOPMENT: "C",
    };
  }
  return d;
}

function parseQuickNpcAbilityLines(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const t = Date.now();
  return lines.map((name, i) => ({
    id: t + i,
    name: name.slice(0, 120),
    description: "",
    type: "unique",
  }));
}

function makeQuickNpcClockRow(name, idSalt = 0) {
  return {
    id: Date.now() + idSalt * 10000,
    name,
    segments: 8,
    filled: 0,
    show_to_players: false,
  };
}

/** Opaque bg + dark options: `S.inp` uses transparent bg + white text → unreadable native option list on many OS themes. */
const QUICK_NPC_SELECT_STYLE = {
  fontSize: 12,
  width: "100%",
  boxSizing: "border-box",
  backgroundColor: "#1f1035",
  color: "#f9fafb",
  border: "1px solid #4b2d8f",
  borderRadius: 4,
  padding: "6px 8px",
  colorScheme: "dark",
};

const QUICK_NPC_OPTION_STYLE = {
  backgroundColor: "#111827",
  color: "#f3f4f6",
};

/** Visual severity for session compact harm grid (warns as higher tiers fill). */
/** Map API character harm_* fields → compact session grid draft keys. */
function harmDraftFromApiCharacter(ch) {
  const o = ch || {};
  return {
    l1a: String(o.harm_level1_name ?? "").trim(),
    l1b: String(o.harm_level1_slot2_name ?? "").trim(),
    l2a: String(o.harm_level2_name ?? "").trim(),
    l2b: String(o.harm_level2_slot2_name ?? "").trim(),
    l3: String(o.harm_level3_name ?? "").trim(),
    l4: String(o.harm_level4_name ?? "").trim(),
  };
}

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

/** End-of-session playbook clock triggers (ExperienceTracker). */
const SESSION_PLAYBOOK_TRIGGER_CODES = new Set([
  "BELIEFS",
  "STRUGGLE",
  "PLAYBOOK_SPECIFIC",
  "STANDOUT",
]);

/** POST /experience-tracker/award/ — playbook-specific column. */
const PLAYBOOK_SESSION_TOGGLE_TRIGGER = "PLAYBOOK_SPECIFIC";

function formatSessionXpAwardHow(awardSource, awardedByUsername) {
  const s = String(awardSource || "AUTO").toUpperCase();
  if (s === "AUTO") return "Automatic";
  if (s === "GM") {
    const u = String(awardedByUsername || "").trim();
    return u ? `GM toggle (${u})` : "GM toggle";
  }
  if (s === "PLAYER") {
    const u = String(awardedByUsername || "").trim();
    return u ? `Player toggle (${u})` : "Player toggle";
  }
  return s;
}

function sessionPlaybookTriggerTag(code) {
  const c = String(code || "").toUpperCase();
  if (c === "PLAYBOOK_SPECIFIC") return "PLAYBOOK";
  if (SESSION_PLAYBOOK_TRIGGER_CODES.has(c)) return c;
  return "";
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
  /** Refetch session-scoped `characters` after sheet PATCH (campaign refresh alone does not). */
  onSessionCharactersRefresh = null,
  /** Refetch session detail (xp_entries, rolls, clocks) — needed after XP award/revoke. */
  onSessionPanelRefresh = null,
  user = null,
}) {
  /** Prefer session panel refetch (includes clocks). Parent `onRefresh` is often
   * only `getCampaign` — waiting on that (or SSE/poll) is why create felt slow. */
  const refreshSessionClocks = useCallback(async () => {
    if (typeof onSessionPanelRefresh === "function") {
      await onSessionPanelRefresh();
      return;
    }
    await onRefresh?.();
  }, [onSessionPanelRefresh, onRefresh]);

  const [showAddNpc, setShowAddNpc] = useState(false);
  /** Quick-create NPC when every campaign NPC is already in this session */
  const [quickNpcName, setQuickNpcName] = useState("");
  const [quickNpcRole, setQuickNpcRole] = useState("");
  const [quickNpcPlaybook, setQuickNpcPlaybook] = useState("STAND");
  const [quickNpcStatPreset, setQuickNpcStatPreset] = useState("balanced");
  const [quickNpcAbilitiesText, setQuickNpcAbilitiesText] = useState("");
  const [quickNpcConflictClock, setQuickNpcConflictClock] = useState(false);
  const [quickNpcAltClock, setQuickNpcAltClock] = useState(false);
  const [quickNpcFactionId, setQuickNpcFactionId] = useState("");
  const [quickNpcNewFactionName, setQuickNpcNewFactionName] = useState("");
  const [quickNpcFactionCreateBusy, setQuickNpcFactionCreateBusy] =
    useState(false);
  const [quickNpcCreateBusy, setQuickNpcCreateBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localNpcPatch, setLocalNpcPatch] = useState({});
  /** Optimistic NPC stand grades after GM wedge clicks (until campaign NPC refetch). */
  const [localNpcStandById, setLocalNpcStandById] = useState({});
  const [pcStandForceBusyId, setPcStandForceBusyId] = useState(null);
  const [harmDraftByChar, setHarmDraftByChar] = useState({});
  const [goalAssignCharId, setGoalAssignCharId] = useState("");
  const [goalAssignDraft, setGoalAssignDraft] = useState("");
  const [goalAssignMode, setGoalAssignMode] = useState("global");
  const [crewSavingId, setCrewSavingId] = useState(null);
  /** Local crew field drafts; reset when `crews` refetch from parent. */
  const [crewDraftById, setCrewDraftById] = useState({});
  const [manualRollCardOpen, setManualRollCardOpen] = useState(true);
  const [sessionXpCardOpen, setSessionXpCardOpen] = useState(true);
  const [bulkPeSectionCollapsed, setBulkPeSectionCollapsed] = useState(false);
  const [recentRollSavingId, setRecentRollSavingId] = useState(null);
  const [factionSavingId, setFactionSavingId] = useState(null);
  const [factionDraftById, setFactionDraftById] = useState({});
  const factionDraftByIdRef = useRef({});
  const factionAutosaveTimersRef = useRef({});

  useEffect(() => {
    factionDraftByIdRef.current = factionDraftById;
  }, [factionDraftById]);

  useEffect(
    () => () => {
      const timers = factionAutosaveTimersRef.current;
      Object.keys(timers).forEach((k) => clearTimeout(timers[k]));
      factionAutosaveTimersRef.current = {};
    },
    [],
  );

  const [npcFactionSavingId, setNpcFactionSavingId] = useState(null);
  /** `vuln:<npcId>` or `clk:<progressClockId>` while a roster NPC clock save runs */
  const [npcUiBusyKey, setNpcUiBusyKey] = useState(null);
  const [collapsedCrewCards, setCollapsedCrewCards] = useState({});
  const [collapsedFactionCards, setCollapsedFactionCards] = useState({});
  const [collapsedNpcCards, setCollapsedNpcCards] = useState({});
  const [collapsedPcCards, setCollapsedPcCards] = useState({});
  const [npcRosterSectionCollapsed, setNpcRosterSectionCollapsed] =
    useState(false);
  const [playerRosterSectionCollapsed, setPlayerRosterSectionCollapsed] =
    useState(false);
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
  /** Same shape as session ledger rows but full campaign (no session-date filter); used to surface pre-session initial buy-in. */
  const [campaignAdvancementLedgerEntries, setCampaignAdvancementLedgerEntries] =
    useState([]);
  /** All progress clocks for campaign (any session); GM session view only — for player project list. */
  const [campaignWideClocks, setCampaignWideClocks] = useState([]);
  const [campaignWideClocksLoaded, setCampaignWideClocksLoaded] =
    useState(false);

  /** Inline create for per-PC progress clocks on this session (roster card). */
  const [pcSessionClockDraftFor, setPcSessionClockDraftFor] = useState(null);
  const [pcSessionClockDraft, setPcSessionClockDraft] = useState({
    name: "",
    max_segments: 8,
    clock_type: "CUSTOM",
    visible_to_players: false,
  });
  const [pcSessionClockBusyCharId, setPcSessionClockBusyCharId] = useState(null);

  /** Inline create for per-NPC progress clocks on this session (roster card). */
  const [npcSessionClockDraftFor, setNpcSessionClockDraftFor] = useState(null);
  const [npcSessionClockDraft, setNpcSessionClockDraft] = useState({
    name: "",
    max_segments: 8,
    clock_type: "CUSTOM",
    visible_to_players: false,
  });
  const [npcSessionClockBusyNpcId, setNpcSessionClockBusyNpcId] = useState(null);
  const [pcSheetHandCoinEdits, setPcSheetHandCoinEdits] = useState({});
  const [pcSheetStashFilledEdits, setPcSheetStashFilledEdits] = useState({});
  const [pcSheetMoneySavingId, setPcSheetMoneySavingId] = useState(null);
  const [pcRosterInvDraftByChar, setPcRosterInvDraftByChar] = useState({});
  /** GM-side draft of the PC sheet NOTES (`background_note2`) keyed by character id. */
  const [pcRosterNotesDraftByChar, setPcRosterNotesDraftByChar] = useState({});
  /** Inventory + notes PATCH from session roster PC cards */
  const [pcRosterSheetBusyId, setPcRosterSheetBusyId] = useState(null);

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

  useEffect(() => {
    if (!showAddNpc) return;
    setQuickNpcName("");
    setQuickNpcRole("");
    setQuickNpcPlaybook("STAND");
    setQuickNpcStatPreset("balanced");
    setQuickNpcAbilitiesText("");
    setQuickNpcConflictClock(false);
    setQuickNpcAltClock(false);
    setQuickNpcFactionId("");
    setQuickNpcNewFactionName("");
    setQuickNpcFactionCreateBusy(false);
    setQuickNpcCreateBusy(false);
  }, [showAddNpc]);

  const handleCreateQuickNpcModalFaction = async () => {
    const trimmed = String(quickNpcNewFactionName || "").trim();
    if (!trimmed || !campaign?.id) {
      setError("Enter a name for the new faction.");
      return;
    }
    const dup = (campaign?.factions || []).some(
      (f) => String(f.name || "").trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (dup) {
      setError(`A faction named "${trimmed}" already exists in this campaign.`);
      return;
    }
    setQuickNpcFactionCreateBusy(true);
    setError(null);
    try {
      const created = await factionAPI.createFaction({
        name: trimmed,
        campaign: campaign.id,
      });
      setQuickNpcFactionId(String(created.id));
      setQuickNpcNewFactionName("");
      onRefresh?.();
    } catch (e) {
      setError(e?.message || "Could not create faction.");
    } finally {
      setQuickNpcFactionCreateBusy(false);
    }
  };

  const handleQuickCreateNpcForSession = async (openSheetAfter) => {
    const nameTrim = String(quickNpcName || "").trim();
    if (!nameTrim) {
      setError("Enter a name for the new NPC.");
      return;
    }
    if (!campaign?.id) {
      setError("Campaign is missing; cannot create NPC.");
      return;
    }
    setQuickNpcCreateBusy(true);
    setError(null);
    try {
      const abilities = parseQuickNpcAbilityLines(quickNpcAbilitiesText);
      const conflict_clocks = quickNpcConflictClock
        ? [makeQuickNpcClockRow("Conflict", 1)]
        : [];
      const alt_clocks = quickNpcAltClock
        ? [makeQuickNpcClockRow("Alt track", 2)]
        : [];
      const factionNum =
        quickNpcFactionId === ""
          ? null
          : parseInt(String(quickNpcFactionId), 10);
      const payload = {
        name: nameTrim,
        campaign: campaign.id,
        playbook: quickNpcPlaybook,
        stand_coin_stats: standCoinStatsFromQuickPreset(quickNpcStatPreset),
        role: String(quickNpcRole || "").trim(),
        abilities,
        conflict_clocks,
        alt_clocks,
        notes: "",
        inventory_notes: "",
      };
      if (quickNpcFactionId !== "" && Number.isFinite(factionNum)) {
        payload.faction = factionNum;
      }
      const created = await npcAPI.createNPC(payload);
      await addNpcToSession(created.id);
      setShowAddNpc(false);
      onRefresh?.();
      if (openSheetAfter && typeof onNavigateToNPC === "function") {
        onNavigateToNPC(created.id, { campaignId: campaign.id });
      }
    } catch (e) {
      const msg =
        e?.message ||
        e?.detail ||
        (Array.isArray(e?.name) ? e.name[0] : null) ||
        "Failed to create NPC.";
      setError(typeof msg === "string" ? msg : "Failed to create NPC.");
    } finally {
      setQuickNpcCreateBusy(false);
    }
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

  /** Same precondition as CharacterSheet crew-mode faction reputation (linked crew PK). */
  const canToggleFactionVisibleToPlayers = useMemo(
    () => rosterHasLinkedCrewForCrewSheetFactionUi(campaignChars),
    [campaignChars],
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
      const trig = String(e.trigger || "").toUpperCase();
      rows.push({
        key: `et-${e.id}`,
        when: e.session_date,
        character: e.character,
        xp: Number(e.xp_gained) || 0,
        typeLabel: e.trigger_display || e.trigger || "—",
        triggerCode: trig,
        isPlaybookSessionTrigger: SESSION_PLAYBOOK_TRIGGER_CODES.has(trig),
        awardHow: formatSessionXpAwardHow(
          e.award_source,
          e.awarded_by_username,
        ),
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
        triggerCode: "",
        isPlaybookSessionTrigger: false,
        awardHow: null,
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
      const label = desc
        ? `${typeLbl} (+${row.xp_gained ?? 0}) — ${desc}`
        : `${typeLbl} (+${row.xp_gained ?? 0})`;
      const sessLbl = row.session_name
        ? row.session_name
        : row.session
          ? `session ${row.session}`
          : "out of session";
      const src = String(row.award_source || "AUTO").toUpperCase();
      const trig = String(row.trigger || "").toUpperCase();
      const awardHow = formatSessionXpAwardHow(
        row.award_source,
        row.awarded_by_username,
      );
      const triggerTag = SESSION_PLAYBOOK_TRIGGER_CODES.has(trig)
        ? sessionPlaybookTriggerTag(trig)
        : "";
      if (!m.has(cid)) m.set(cid, []);
      m.get(cid).push({
        id: row.id,
        label,
        awardHow,
        triggerTag,
        source: src,
        sessionLabel: sessLbl,
        xp: Number(row.xp_gained) || 0,
        clockKey: row.clock_key || "",
      });
    }
    return m;
  }, [sessionXpEntriesSorted]);

  const [xpEntryDeleteBusy, setXpEntryDeleteBusy] = useState(null);
  const [xpEntryDeleteError, setXpEntryDeleteError] = useState(null);
  const handleDeleteXpEntry = useCallback(
    async (entryId) => {
      if (!entryId) return;
      setXpEntryDeleteError(null);
      setXpEntryDeleteBusy(entryId);
      try {
        await experienceTrackerAPI.remove(entryId);
        await onSessionPanelRefresh?.();
        await onSessionCharactersRefresh?.();
        await onRefresh?.();
      } catch (err) {
        setXpEntryDeleteError(err?.message || "Could not delete XP entry.");
      } finally {
        setXpEntryDeleteBusy(null);
      }
    },
    [onRefresh, onSessionCharactersRefresh, onSessionPanelRefresh],
  );

  /**
   * Per-PC tally of end-of-session XP triggers (BELIEFS / STRUGGLE / playbook)
   * for this session, summed from the tracker and SRD-capped at 2 / trigger.
   * PLAYBOOK_SPECIFIC and legacy STANDOUT map to the PLAYBOOK scorecard bucket.
   */
  const pcXpTriggerCountsByCharacter = useMemo(() => {
    const m = new Map();
    for (const row of sessionXpEntriesSorted) {
      const cid = Number(row.character);
      if (!Number.isFinite(cid)) continue;
      let trig = String(row.trigger || "").toUpperCase();
      if (trig === "PLAYBOOK_SPECIFIC" || trig === "STANDOUT") trig = "PLAYBOOK";
      if (trig !== "BELIEFS" && trig !== "STRUGGLE" && trig !== "PLAYBOOK") {
        continue;
      }
      const amt = Math.max(0, Number(row.xp_gained) || 0);
      if (!m.has(cid)) m.set(cid, { BELIEFS: 0, STRUGGLE: 0, PLAYBOOK: 0 });
      m.get(cid)[trig] = Math.min(2, m.get(cid)[trig] + amt);
    }
    return m;
  }, [sessionXpEntriesSorted]);

  const [xpToggleBusy, setXpToggleBusy] = useState({ cid: null, trigger: null });
  const [xpToggleError, setXpToggleError] = useState(null);

  const handleGmXpTriggerToggle = useCallback(
    async (characterId, trigger, delta) => {
      if (!characterId || !trigger) return;
      setXpToggleError(null);
      setXpToggleBusy({ cid: characterId, trigger });
      try {
        if (delta > 0) {
          await experienceTrackerAPI.award({
            character: characterId,
            trigger,
          });
        } else {
          await experienceTrackerAPI.revoke({
            character: characterId,
            trigger,
          });
        }
        // Campaign-only onRefresh leaves sessionData.xp_entries stale; refetch session panel.
        await onSessionPanelRefresh?.();
        await onSessionCharactersRefresh?.();
        await onRefresh?.();
      } catch (err) {
        setXpToggleError(err?.message || "Could not toggle XP trigger.");
      } finally {
        setXpToggleBusy({ cid: null, trigger: null });
      }
    },
    [onRefresh, onSessionCharactersRefresh, onSessionPanelRefresh],
  );

  useEffect(() => {
    if (!campaign?.id) {
      setCampaignWideClocks([]);
      setCampaignWideClocksLoaded(false);
      return undefined;
    }
    let cancelled = false;
    setCampaignWideClocksLoaded(false);
    progressClockAPI
      .getProgressClocks({ campaign: campaign.id })
      .then((data) => {
        if (cancelled) return;
        setCampaignWideClocks(unwrapApiArray(data));
        setCampaignWideClocksLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setCampaignWideClocks([]);
        setCampaignWideClocksLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [campaign?.id, session?.id]);

  const gmPlayerProjectClocks = useMemo(() => {
    const gmRaw = campaign?.gm;
    const gmId =
      gmRaw && typeof gmRaw === "object" ? gmRaw.id : gmRaw ?? null;
    const list = (campaignWideClocks || []).filter((c) =>
      isPlayerOwnedProjectClock(c, gmId),
    );
    return [...list].sort((a, b) => {
      const da = progressClockIsDone(a) ? 1 : 0;
      const db = progressClockIsDone(b) ? 1 : 0;
      if (da !== db) return da - db;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [campaignWideClocks, campaign?.gm]);

  /** Progress clocks on this session owned by an NPC (for roster quick ticks). */
  const npcSessionClocksByNpcId = useMemo(() => {
    const sid = session?.id != null ? Number(session.id) : NaN;
    const m = new Map();
    if (!Number.isFinite(sid)) return m;
    for (const c of clocks || []) {
      const cs = c.session != null ? Number(c.session) : NaN;
      if (!Number.isFinite(cs) || cs !== sid) continue;
      const nid = c.npc != null ? Number(c.npc) : NaN;
      if (!Number.isFinite(nid)) continue;
      if (!m.has(nid)) m.set(nid, []);
      m.get(nid).push(c);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || "")),
      );
    }
    return m;
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
      setCampaignAdvancementLedgerEntries([]);
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
        const mapped = list
          .map((entry) => ({
            ...entry,
            advancement_buckets: partitionLedgerHistoryEntry(entry),
          }))
          .filter((entry) => {
            const cid = Number(entry.character);
            if (!pcIdsInCampaign.has(cid)) return false;
            return ledgerBucketsTouchXpFields(entry.advancement_buckets);
          });
        setCampaignAdvancementLedgerEntries(mapped);
        const filtered = mapped
          .filter((entry) => {
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
        setCampaignAdvancementLedgerEntries([]);
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

  /** Session-window initial rows + each PC’s first campaign-wide zero-baseline buy-in if it predates session (fixes “built sheet before session date”). */
  const initialBuyInLedgerItems = useMemo(() => {
    const inWindow = renderSessionLedgerBucketUl(
      sessionAdvancementHistory,
      "initial",
      charDisplayNameById,
    );
    const idsInWindowWithInitial = new Set();
    for (const e of sessionAdvancementHistory || []) {
      if ((e.advancement_buckets?.initial || []).length)
        idsInWindowWithInitial.add(e.id);
    }
    const sessionStartMs = sessionData?.session_date
      ? new Date(sessionData.session_date).getTime()
      : NaN;
    const slopMs = 60 * 60 * 1000;
    const extras = [];
    if (
      Number.isFinite(sessionStartMs) &&
      (campaignAdvancementLedgerEntries || []).length
    ) {
      const asc = [...campaignAdvancementLedgerEntries].sort(
        (a, b) =>
          new Date(a.timestamp || 0).getTime() -
          new Date(b.timestamp || 0).getTime(),
      );
      const firstInitialByChar = new Map();
      for (const e of asc) {
        const ini = e.advancement_buckets?.initial;
        if (!ini?.length) continue;
        const cid = Number(e.character);
        if (!Number.isFinite(cid) || !pcIdsInCampaign.has(cid)) continue;
        if (!firstInitialByChar.has(cid)) firstInitialByChar.set(cid, e);
      }
      for (const entry of firstInitialByChar.values()) {
        if (idsInWindowWithInitial.has(entry.id)) continue;
        const ts = new Date(entry.timestamp || 0).getTime();
        if (!Number.isFinite(ts) || ts >= sessionStartMs - slopMs) continue;
        const block = renderLedgerInitialBlock(
          entry,
          charDisplayNameById,
          "presession",
          "— first logged zero→layout buy-in before this session date (full campaign sheet history); not spend.",
        );
        if (block) extras.push(block);
      }
    }
    return [...extras, ...inWindow];
  }, [
    sessionAdvancementHistory,
    campaignAdvancementLedgerEntries,
    sessionData?.session_date,
    charDisplayNameById,
    pcIdsInCampaign,
  ]);

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
  const getRecentCharacterRolls = useCallback((characterId) => {
    const list = (sessionRolls || []).filter(
      (r) => String(r.character) === String(characterId),
    );
    const sorted = [...list].sort((a, b) => {
      const ta = new Date(a.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || 0).getTime();
      if (tb !== ta) return tb - ta;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
    return sorted.slice(0, 5);
  }, [sessionRolls]);

  /** Sum of stress logged on rolls for this PC in the current session (resistance, push, etc.). */
  const sessionStressSpentForCharacter = useCallback(
    (characterId) => {
      let total = 0;
      for (const r of sessionRolls || []) {
        if (String(r.character) !== String(characterId)) continue;
        total += Math.max(0, Number(r.roller_stress_spent) || 0);
      }
      return total;
    },
    [sessionRolls],
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
      next[ch.id] = harmDraftFromApiCharacter(full);
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

  const patchFactionSnapshot = useCallback(async (factionId) => {
    if (!factionId) return;
    const draft = factionDraftByIdRef.current[factionId];
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
  }, [onRefresh, setError]);

  const scheduleFactionAutosave = useCallback(
    (factionId) => {
      if (!factionId) return;
      const timers = factionAutosaveTimersRef.current;
      if (timers[factionId]) clearTimeout(timers[factionId]);
      timers[factionId] = setTimeout(() => {
        patchFactionSnapshot(factionId);
        delete timers[factionId];
      }, 450);
    },
    [patchFactionSnapshot],
  );

  const handlePcSheetHandCoinBlur = useCallback(
    async (characterId, raw, currentCoinBoxes) => {
      const val = Math.max(0, Math.min(4, parseInt(String(raw).trim(), 10) || 0));
      const cur = countSheetBoolSlots(currentCoinBoxes);
      if (val === cur) {
        setPcSheetHandCoinEdits((p) => {
          const n = { ...p };
          delete n[characterId];
          return n;
        });
        return;
      }
      setPcSheetMoneySavingId(characterId);
      setError(null);
      try {
        await characterAPI.patchCharacter(characterId, {
          coin_boxes: sheetCoinBoxesFromHandCount(val),
        });
        setPcSheetHandCoinEdits((p) => {
          const n = { ...p };
          delete n[characterId];
          return n;
        });
        await onSessionCharactersRefresh?.();
        await onRefresh();
      } catch (e) {
        setError(e.message || "Could not update character coin.");
      } finally {
        setPcSheetMoneySavingId(null);
      }
    },
    [onRefresh, onSessionCharactersRefresh, setError],
  );

  const handlePcSheetStashFilledBlur = useCallback(
    async (characterId, raw, currentStashSlots) => {
      const val = Math.max(0, Math.min(40, parseInt(String(raw).trim(), 10) || 0));
      const cur = countSheetBoolSlots(currentStashSlots);
      if (val === cur) {
        setPcSheetStashFilledEdits((p) => {
          const n = { ...p };
          delete n[characterId];
          return n;
        });
        return;
      }
      setPcSheetMoneySavingId(characterId);
      setError(null);
      try {
        await characterAPI.patchCharacter(characterId, {
          stash_slots: sheetStashSlotsFromFilledCount(val),
        });
        setPcSheetStashFilledEdits((p) => {
          const n = { ...p };
          delete n[characterId];
          return n;
        });
        await onSessionCharactersRefresh?.();
        await onRefresh();
      } catch (e) {
        setError(e.message || "Could not update character stash.");
      } finally {
        setPcSheetMoneySavingId(null);
      }
    },
    [onRefresh, onSessionCharactersRefresh, setError],
  );

  /**
   * Save the GM-edited NOTES textarea on a roster PC card.
   *
   * PC sheet's NOTES panel is wired to `background_note2` server-side (the
   * `sheetNotes` alias in the frontend transform); this lets the GM edit
   * that same field directly from session view without opening the PC
   * sheet. No-op if the draft equals the server value to avoid spurious
   * PATCH + SSE rebroadcasts.
   */
  const handlePcRosterSaveNotes = useCallback(
    async (characterId, currentNotes, draftValue) => {
      const cur = String(currentNotes ?? "");
      const next = String(draftValue ?? "");
      if (cur === next) return;
      setPcRosterSheetBusyId(characterId);
      setError(null);
      try {
        await characterAPI.patchCharacter(characterId, {
          background_note2: next,
        });
        setPcRosterNotesDraftByChar((p) => {
          const n = { ...p };
          delete n[characterId];
          return n;
        });
        await onSessionCharactersRefresh?.();
        await onRefresh();
      } catch (e) {
        setError(e.message || "Could not update notes.");
      } finally {
        setPcRosterSheetBusyId(null);
      }
    },
    [onRefresh, onSessionCharactersRefresh, setError],
  );

  const handlePcRosterAppendInventory = useCallback(
    async (characterId, currentInventory, draftLine) => {
      const trimmed = String(draftLine ?? "").trim();
      if (!trimmed) return;
      const base = normalizeCharacterInventory(currentInventory);
      const next = [
        ...base,
        {
          id:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `item-${Date.now()}`,
          name: trimmed,
          detail: "",
          category: "other",
          load: 1,
          quality: 1,
          coin_value: null,
          catalog_id: null,
        },
      ];
      setPcRosterSheetBusyId(characterId);
      setError(null);
      try {
        await characterAPI.patchCharacter(characterId, { inventory: next });
        setPcRosterInvDraftByChar((p) => {
          const n = { ...p };
          delete n[characterId];
          return n;
        });
        await onSessionCharactersRefresh?.();
        await onRefresh();
      } catch (e) {
        setError(e.message || "Could not update inventory.");
      } finally {
        setPcRosterSheetBusyId(null);
      }
    },
    [onRefresh, onSessionCharactersRefresh, setError],
  );

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
    const base = localNpcStandById[npc.id]
      ? rawStandToGrades(localNpcStandById[npc.id])
      : rawStandToGrades(npc.stand_coin_stats);
    const nextLetter = stepGrade(base[key], delta);
    const next = {
      ...(npc.stand_coin_stats || {}),
      ...(localNpcStandById[npc.id] || {}),
      [key.toUpperCase()]: nextLetter,
      [key]: nextLetter,
    };
    // Normalize to uppercase keys for API.
    const payload = {
      POWER: next.POWER ?? next.power ?? base.power,
      SPEED: next.SPEED ?? next.speed ?? base.speed,
      RANGE: next.RANGE ?? next.range ?? base.range,
      DURABILITY: next.DURABILITY ?? next.durability ?? base.durability,
      PRECISION: next.PRECISION ?? next.precision ?? base.precision,
      DEVELOPMENT: next.DEVELOPMENT ?? next.development ?? base.development,
    };
    payload[key.toUpperCase()] = nextLetter;
    setLocalNpcStandById((p) => ({ ...p, [npc.id]: payload }));
    setLocalNpcPatch((p) => ({ ...p, [npc.id]: true }));
    npcAPI
      .patchNPC(npc.id, { stand_coin_stats: payload })
      .then(async () => {
        await onSessionPanelRefresh?.();
        await onRefresh?.();
      })
      .catch((e) => {
        setLocalNpcStandById((p) => {
          const n = { ...p };
          delete n[npc.id];
          return n;
        });
        setError(e.message);
      })
      .finally(() =>
        setLocalNpcPatch((p) => {
          const n = { ...p };
          delete n[npc.id];
          return n;
        }),
      );
  };

  const refreshAfterPcSheetChange = useCallback(async () => {
    await onSessionCharactersRefresh?.();
    await onRefresh?.();
  }, [onSessionCharactersRefresh, onRefresh]);

  const applyPcGmStandUpgrade = useCallback(
    async (characterId, standStat) => {
      setPcStandForceBusyId(characterId);
      setError(null);
      try {
        const res = await characterAPI.gmForceStandStat(characterId, {
          stand_stat: standStat,
          xp_track: "playbook",
        });
        await refreshAfterPcSheetChange();
        if (res?.pending_stand_a_reward) {
          const stat = String(
            res.pending_stand_a_reward.stand_stat || standStat,
          ).toUpperCase();
          setError(
            `Stand Coin ${stat} is now A. Player must pick B→A abilities on their character sheet.`,
          );
        }
      } catch (e) {
        setError(e?.message || "Could not force Stand Coin advance.");
        throw e;
      } finally {
        setPcStandForceBusyId(null);
      }
    },
    [refreshAfterPcSheetChange, setError],
  );

  const handlePcStandStep = useCallback(
    async (full, key, delta) => {
      if (!full?.id) return;
      const stand = full.stand || {};
      const grades = rawStandToGrades({
        power: stand.power,
        speed: stand.speed,
        range: stand.range,
        durability: stand.durability,
        precision: stand.precision,
        development: stand.development,
      });
      const canSRank = full.gm_can_have_s_rank_stand_stats === true;
      const nextLetter = stepGrade(grades[key], delta);
      if (nextLetter === grades[key]) return;
      if (delta < 0) {
        setSaving(true);
        setError(null);
        const next = { ...grades, [key]: nextLetter };
        try {
          await characterAPI.patchCharacter(full.id, {
            stand: {
              ...stand,
              power: next.power,
              speed: next.speed,
              range: next.range,
              durability: next.durability,
              precision: next.precision,
              development: next.development,
            },
          });
          await refreshAfterPcSheetChange();
        } catch (e) {
          setError(e?.message || "Could not lower Stand Coin grade.");
        } finally {
          setSaving(false);
        }
        return;
      }
      // Upgrade: treat as playbook advance (tops up XP if short).
      // B→A reward is deferred to the player character sheet.
      if (!canSRank && grades[key] === "A") return;
      setSaving(true);
      try {
        await applyPcGmStandUpgrade(full.id, key);
      } catch {
        /* error already surfaced */
      } finally {
        setSaving(false);
      }
    },
    [applyPcGmStandUpgrade, refreshAfterPcSheetChange, setError],
  );

  const bumpNpcVulnerability = useCallback(
    async (npc, delta) => {
      if (!canEditNpcStandCoin(user, campaign, npc)) return;
      const max = Number(npc.vulnerability_clock_max) ?? 0;
      const cur = Number(npc.vulnerability_clock_current) ?? 0;
      if (max <= 0) return;
      const next = Math.max(0, Math.min(max, cur + delta));
      if (next === cur) return;
      const key = `vuln:${npc.id}`;
      setNpcUiBusyKey(key);
      setError(null);
      try {
        await npcAPI.patchNPC(npc.id, {
          vulnerability_clock_current: next,
        });
        await onRefresh();
      } catch (e) {
        setError(e.message || "Could not update vulnerability.");
      } finally {
        setNpcUiBusyKey((k) => (k === key ? null : k));
      }
    },
    [user, campaign, onRefresh, setError],
  );

  const bumpNpcSessionProgressClock = useCallback(
    async (npc, clock, delta) => {
      if (!canEditNpcStandCoin(user, campaign, npc)) return;
      const cap = Number(clock.max_segments) || 0;
      const cur = Number(clock.filled_segments) || 0;
      if (cap <= 0) return;
      const next = Math.max(0, Math.min(cap, cur + delta));
      if (next === cur) return;
      const key = `clk:${clock.id}`;
      setNpcUiBusyKey(key);
      setError(null);
      try {
        await progressClockAPI.updateProgressClock(clock.id, {
          filled_segments: next,
        });
        await refreshSessionClocks();
      } catch (e) {
        setError(e.message || "Could not update clock.");
      } finally {
        setNpcUiBusyKey((k) => (k === key ? null : k));
      }
    },
    [user, campaign, refreshSessionClocks, setError],
  );

  const factionGroupWrap = {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #374151",
    borderRadius: 8,
    padding: 12,
    background: "#0b1220",
  };

  const toggleCollapsedCard = (setter, key) => {
    setter((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderNpcSessionCard = (npc) => {
    const inv = invByNpc[npc.id] || {};
    const grades = rawStandToGrades(
      localNpcStandById[npc.id] || npc.stand_coin_stats,
    );
    const busy = !!localNpcPatch[npc.id];
    const canEditStand = canEditNpcStandCoin(user, campaign, npc);
    const npcClks = npcSessionClocksByNpcId.get(npc.id) || [];
    const vulnMax = Number(npc.vulnerability_clock_max) ?? 0;
    const vulnCur = Number(npc.vulnerability_clock_current) ?? 0;
    const vulnBusy = npcUiBusyKey === `vuln:${npc.id}`;
    const npcPortraitSrc = resolveMediaUrl(npc.image || npc.image_url || "");
    const npcCollapseKey = String(npc.id);
    const npcCollapsed = !!collapsedNpcCards[npcCollapseKey];
    return (
      <div key={npc.id} style={card}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: "bold" }}>{npc.name || `NPC ${npc.id}`}</div>
            <div style={{ fontSize: 10, color: "#9ca3af" }}>
              {npc.stand_name || "—"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleCollapsedCard(setCollapsedNpcCards, npcCollapseKey)}
            style={{ ...S.btnGhost, fontSize: 10, padding: "2px 8px" }}
            title={npcCollapsed ? "Expand NPC card" : "Collapse NPC card"}
          >
            {npcCollapsed ? "Expand" : "Collapse"}
          </button>
        </div>
        {!npcCollapsed ? (
          <>
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
            <a
              href={buildRouteHref("npcs", { npcId: npc.id })}
              onClick={(e) => handleSpaNavClick(e, () => onNavigateToNPC?.(npc.id))}
              style={{
                ...S.btnGhost,
                fontSize: 10,
                marginTop: 4,
                display: "inline-block",
                textDecoration: "none",
              }}
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
                // Master "Clocks" off ⇒ no clock payload to players (vuln-only
                // visibility is toggled from the NPC sheet, not left stale here).
                show_vulnerability_clock_to_players: show ? true : false,
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
        <div style={lbl}>Clocks</div>
        <div style={{ fontSize: 10, color: "#d1d5db" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <span style={{ fontWeight: 600, color: "#9ca3af" }}>Vulnerability</span>
            {vulnMax <= 0 ? (
              <span
                style={{ color: "#6b7280" }}
                title="S-rank durability: no standard vulnerability clock on sheet."
              >
                — (n/a)
              </span>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <button
                  type="button"
                  style={{ ...S.btnGhost, fontSize: 9, padding: "1px 6px" }}
                  title="Tick vulnerability down"
                  disabled={
                    saving ||
                    busy ||
                    vulnBusy ||
                    !canEditStand ||
                    vulnCur <= 0
                  }
                  onClick={() => bumpNpcVulnerability(npc, -1)}
                >
                  −
                </button>
                <span style={{ color: "#e5e7eb", fontVariantNumeric: "tabular-nums" }}>
                  {vulnCur}/{vulnMax}
                </span>
                <button
                  type="button"
                  style={{ ...S.btnGhost, fontSize: 9, padding: "1px 6px" }}
                  title="Tick vulnerability up"
                  disabled={
                    saving ||
                    busy ||
                    vulnBusy ||
                    !canEditStand ||
                    vulnCur >= vulnMax
                  }
                  onClick={() => bumpNpcVulnerability(npc, 1)}
                >
                  +
                </button>
              </span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
              marginBottom: 4,
            }}
          >
            <div
              style={{
                fontWeight: 600,
                color: "#9ca3af",
                letterSpacing: "0.04em",
              }}
            >
              Session progress
            </div>
            <button
              type="button"
              disabled={
                saving ||
                busy ||
                !canEditStand ||
                npcSessionClockBusyNpcId === npc.id
              }
              onClick={() => {
                if (npcSessionClockDraftFor === npc.id) {
                  setNpcSessionClockDraftFor(null);
                } else {
                  setNpcSessionClockDraft({
                    name: "",
                    max_segments: 8,
                    clock_type: "CUSTOM",
                    visible_to_players: false,
                  });
                  setNpcSessionClockDraftFor(npc.id);
                }
              }}
              style={{
                ...S.btn,
                fontSize: 10,
                padding: "2px 8px",
                background: "#1e3a5f",
                color: "#bae6fd",
              }}
            >
              {npcSessionClockDraftFor === npc.id ? "Close" : "+ Clock"}
            </button>
          </div>
          {npcSessionClockDraftFor === npc.id ? (
            <div
              style={{
                marginTop: 4,
                marginBottom: 8,
                padding: 8,
                borderRadius: 6,
                border: "1px solid #374151",
                background: "#0d1117",
                display: "grid",
                gap: 8,
              }}
            >
              <input
                style={S.inp}
                placeholder="Clock name"
                value={npcSessionClockDraft.name}
                onChange={(e) =>
                  setNpcSessionClockDraft((d) => ({
                    ...d,
                    name: e.target.value,
                  }))
                }
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <label style={{ fontSize: 10, color: "#9ca3af" }}>
                  Segments
                  <select
                    style={{ ...S.select, marginLeft: 6 }}
                    value={npcSessionClockDraft.max_segments}
                    onChange={(e) =>
                      setNpcSessionClockDraft((d) => ({
                        ...d,
                        max_segments: Number(e.target.value),
                      }))
                    }
                  >
                    {SESSION_PC_CLOCK_SEGMENTS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: 10, color: "#9ca3af" }}>
                  Type
                  <select
                    style={{ ...S.select, marginLeft: 6 }}
                    value={npcSessionClockDraft.clock_type}
                    onChange={(e) =>
                      setNpcSessionClockDraft((d) => ({
                        ...d,
                        clock_type: e.target.value,
                      }))
                    }
                  >
                    {SESSION_PC_CLOCK_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 10,
                  color: "#a7f3d0",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={npcSessionClockDraft.visible_to_players}
                  onChange={(e) =>
                    setNpcSessionClockDraft((d) => ({
                      ...d,
                      visible_to_players: e.target.checked,
                    }))
                  }
                />
                Visible to players
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  style={S.btnPrimary}
                  disabled={npcSessionClockBusyNpcId === npc.id}
                  onClick={async () => {
                    const nm = String(npcSessionClockDraft.name || "").trim();
                    if (!nm) {
                      setError("Enter a name for the clock.");
                      return;
                    }
                    setNpcSessionClockBusyNpcId(npc.id);
                    setError(null);
                    try {
                      await progressClockAPI.createProgressClock({
                        campaign: campaign.id,
                        session: session.id,
                        npc: npc.id,
                        name: nm,
                        clock_type:
                          npcSessionClockDraft.clock_type || "CUSTOM",
                        max_segments:
                          npcSessionClockDraft.max_segments || 8,
                        filled_segments: 0,
                        visible_to_players:
                          !!npcSessionClockDraft.visible_to_players,
                      });
                      setNpcSessionClockDraftFor(null);
                      setNpcSessionClockDraft({
                        name: "",
                        max_segments: 8,
                        clock_type: "CUSTOM",
                        visible_to_players: false,
                      });
                      await refreshSessionClocks();
                    } catch (e) {
                      setError(
                        e?.message || "Could not create progress clock.",
                      );
                    } finally {
                      setNpcSessionClockBusyNpcId(null);
                    }
                  }}
                >
                  {npcSessionClockBusyNpcId === npc.id ? "Saving…" : "Create"}
                </button>
                <button
                  type="button"
                  style={S.btnGhost}
                  onClick={() => {
                    setNpcSessionClockDraftFor(null);
                    setNpcSessionClockDraft({
                      name: "",
                      max_segments: 8,
                      clock_type: "CUSTOM",
                      visible_to_players: false,
                    });
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
          <ul
            style={{
              margin: 0,
              paddingLeft: 14,
              color: "#9ca3af",
              maxHeight: 120,
              overflowY: "auto",
            }}
          >
            {npcClks.map((c) => {
              const clkBusy = npcUiBusyKey === `clk:${c.id}`;
              return (
                <li
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ flex: "1 1 120px" }}>
                    {c.name} ({c.filled_segments}/{c.max_segments})
                    {progressClockShowsPlayersBadge(c, campaign?.gm) ? (
                      <span style={{ color: "#6ee7b7", fontSize: 9 }}>
                        {" "}
                        · players
                      </span>
                    ) : null}
                  </span>
                  <span style={{ display: "inline-flex", gap: 4 }}>
                    <button
                      type="button"
                      style={{ ...S.btnGhost, fontSize: 9, padding: "1px 6px" }}
                      title="Fewer ticks"
                      disabled={
                        saving ||
                        busy ||
                        clkBusy ||
                        !canEditStand ||
                        (Number(c.filled_segments) || 0) <= 0
                      }
                      onClick={() => bumpNpcSessionProgressClock(npc, c, -1)}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      style={{ ...S.btnGhost, fontSize: 9, padding: "1px 6px" }}
                      title="More ticks"
                      disabled={
                        saving ||
                        busy ||
                        clkBusy ||
                        !canEditStand ||
                        (Number(c.filled_segments) || 0) >=
                          (Number(c.max_segments) || 0)
                      }
                      onClick={() => bumpNpcSessionProgressClock(npc, c, 1)}
                    >
                      +
                    </button>
                  </span>
                </li>
              );
            })}
            {npcClks.length === 0 && npcSessionClockDraftFor !== npc.id ? (
              <li style={{ color: "#6b7280" }}>—</li>
            ) : null}
          </ul>
          <div style={{ fontSize: 9, color: "#6b7280", marginTop: 6 }}>
            Conflict / alt clocks stay on the full NPC sheet.
          </div>
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
          </>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <div style={S.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <span style={{ ...S.sectionLbl, marginBottom: 0 }}>
            Session NPC roster
          </span>
          <button
            type="button"
            onClick={() => setNpcRosterSectionCollapsed((v) => !v)}
            style={{ ...S.btnGhost, fontSize: 10, padding: "2px 8px", flexShrink: 0 }}
            title={
              npcRosterSectionCollapsed
                ? "Expand session NPC roster"
                : "Collapse session NPC roster"
            }
          >
            {npcRosterSectionCollapsed ? "Expand" : "Collapse"}
          </button>
        </div>
        {!npcRosterSectionCollapsed ? (
          <>
            <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 0" }}>
              NPCs grouped by faction (one faction card when multiple NPCs share it).
              Use + to add from the campaign roster. Assign faction from each NPC card, or
              use Create faction & assign in the No faction block to add a campaign faction
              and attach every unfactioned NPC here at once. Toggle what players can see;
              quick-edit Stand coin, vulnerability, and session progress clocks (GM or
              that NPC&apos;s owner).
            </p>
            <div
              style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 10 }}
            >
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
            const setDraftField = (field, value) => {
              setFactionDraftById((prev) => ({
                ...prev,
                [fid]: { ...(prev[fid] || draft), [field]: value },
              }));
              scheduleFactionAutosave(fid);
            };
            const factionCollapseKey = String(fid);
            const factionCollapsed = !!collapsedFactionCards[factionCollapseKey];
            return (
              <div key={`faction-${fid}`} style={factionGroupWrap}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: factionCollapsed ? 0 : 10,
                  }}
                >
                  <div style={{ fontWeight: "bold", fontSize: 13, color: "#a78bfa" }}>
                    {name}{" "}
                    <span style={{ color: "#9ca3af", fontWeight: 500 }}>
                      ({npcList.length} NPC{npcList.length === 1 ? "" : "s"})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      toggleCollapsedCard(setCollapsedFactionCards, factionCollapseKey)
                    }
                    style={{ ...S.btnGhost, fontSize: 10, padding: "2px 8px" }}
                    title={factionCollapsed ? "Expand faction card" : "Collapse faction card"}
                  >
                    {factionCollapsed ? "Expand" : "Collapse"}
                  </button>
                </div>
                {!factionCollapsed ? (
                  <>
                    <div style={{ marginBottom: 10 }}>
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
                      <label
                        style={{
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                          fontSize: 11,
                          opacity: canToggleFactionVisibleToPlayers ? 1 : 0.55,
                          cursor: canToggleFactionVisibleToPlayers
                            ? "pointer"
                            : "not-allowed",
                        }}
                        title={
                          canToggleFactionVisibleToPlayers
                            ? undefined
                            : "Enable faction visibility on crew sheet first. Assign at least one PC to a campaign crew."
                        }
                      >
                        <input
                          type="checkbox"
                          disabled={!canToggleFactionVisibleToPlayers}
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
                    {factionSavingId === fid ? (
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>
                        Saving faction…
                      </span>
                    ) : null}
                    <span style={{ fontSize: 10, color: "#6b7280" }}>
                      Faction fields save automatically shortly after you edit.
                    </span>
                  </div>
                    </div>
                    <div style={grid}>{npcList.map((npc) => renderNpcSessionCard(npc))}</div>
                  </>
                ) : null}
              </div>
            );
          })}

          {sessionFactionNpcGroups.ungrouped.length > 0 && (
            <div style={factionGroupWrap}>
              {(() => {
                const ungroupedCollapseKey = "ungrouped";
                const ungroupedCollapsed = !!collapsedFactionCards[ungroupedCollapseKey];
                const ungroupedCount = sessionFactionNpcGroups.ungrouped.length;
                return (
                  <>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        marginBottom: ungroupedCollapsed ? 0 : 8,
                      }}
                    >
                      <div style={{ fontWeight: "bold", fontSize: 13, color: "#a78bfa" }}>
                        No faction{" "}
                        <span style={{ color: "#9ca3af", fontWeight: 500 }}>
                          ({ungroupedCount} NPC{ungroupedCount === 1 ? "" : "s"})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          toggleCollapsedCard(setCollapsedFactionCards, ungroupedCollapseKey)
                        }
                        style={{ ...S.btnGhost, fontSize: 10, padding: "2px 8px" }}
                        title={
                          ungroupedCollapsed
                            ? "Expand ungrouped faction card"
                            : "Collapse ungrouped faction card"
                        }
                      >
                        {ungroupedCollapsed ? "Expand" : "Collapse"}
                      </button>
                    </div>
                    {!ungroupedCollapsed ? (
                      <>
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
                      </>
                    ) : null}
                  </>
                );
              })()}
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
          </>
        ) : null}
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
              maxWidth: 480,
              width: "100%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: "bold", marginBottom: 8 }}>Add campaign NPC</div>
            {addableNpcList.length === 0 ? (
              <>
                <div style={{ color: "#9ca3af", marginBottom: 10, lineHeight: 1.45 }}>
                  All campaign NPCs are already in this session. Create a new NPC for
                  this campaign with stand coin grades, optional abilities and clocks,
                  then add it to the session — or open the full sheet after save.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={lbl}>Name</span>
                    <input
                      type="text"
                      value={quickNpcName}
                      onChange={(e) => setQuickNpcName(e.target.value)}
                      placeholder="e.g. Highway Star"
                      style={{ ...S.inp, fontSize: 12 }}
                      disabled={quickNpcCreateBusy || saving}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={lbl}>Role / type (optional)</span>
                    <input
                      type="text"
                      value={quickNpcRole}
                      onChange={(e) => setQuickNpcRole(e.target.value)}
                      placeholder="Boss, ally, hazard…"
                      style={{ ...S.inp, fontSize: 12 }}
                      disabled={quickNpcCreateBusy || saving}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={lbl}>Playbook</span>
                    <select
                      value={quickNpcPlaybook}
                      onChange={(e) => setQuickNpcPlaybook(e.target.value)}
                      style={QUICK_NPC_SELECT_STYLE}
                      disabled={quickNpcCreateBusy || saving}
                    >
                      {NPC_QUICK_PLAYBOOK_OPTIONS.map((o) => (
                        <option
                          key={o.value}
                          value={o.value}
                          style={QUICK_NPC_OPTION_STYLE}
                        >
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={lbl}>Stand coin preset</span>
                    <select
                      value={quickNpcStatPreset}
                      onChange={(e) => setQuickNpcStatPreset(e.target.value)}
                      style={QUICK_NPC_SELECT_STYLE}
                      disabled={quickNpcCreateBusy || saving}
                    >
                      {NPC_QUICK_STAT_PRESETS.map((o) => (
                        <option
                          key={o.value}
                          value={o.value}
                          style={QUICK_NPC_OPTION_STYLE}
                        >
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {campaign?.id ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        padding: 10,
                        background: "#0b1220",
                        border: "1px solid #374151",
                        borderRadius: 6,
                      }}
                    >
                      <span style={lbl}>Faction (optional)</span>
                      {(campaign.factions || []).length > 0 ? (
                        <select
                          value={quickNpcFactionId}
                          onChange={(e) => setQuickNpcFactionId(e.target.value)}
                          style={QUICK_NPC_SELECT_STYLE}
                          disabled={
                            quickNpcCreateBusy ||
                            saving ||
                            quickNpcFactionCreateBusy
                          }
                        >
                          <option value="" style={QUICK_NPC_OPTION_STYLE}>
                            — None —
                          </option>
                          {(campaign.factions || []).map((f) => (
                            <option
                              key={f.id}
                              value={f.id}
                              style={QUICK_NPC_OPTION_STYLE}
                            >
                              {f.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div style={{ fontSize: 10, color: "#6b7280" }}>
                          No factions in this campaign yet — create one below, then it
                          will appear in the list after refresh.
                        </div>
                      )}
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
                          value={quickNpcNewFactionName}
                          onChange={(e) => setQuickNpcNewFactionName(e.target.value)}
                          placeholder="New faction name"
                          style={{
                            ...S.inp,
                            flex: "1 1 160px",
                            minWidth: 140,
                            fontSize: 12,
                            backgroundColor: "#1f1035",
                            color: "#f9fafb",
                            border: "1px solid #4b2d8f",
                            borderRadius: 4,
                            padding: "6px 8px",
                          }}
                          disabled={
                            quickNpcCreateBusy ||
                            saving ||
                            quickNpcFactionCreateBusy
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleCreateQuickNpcModalFaction();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleCreateQuickNpcModalFaction()}
                          style={{ ...S.btnPrimary, fontSize: 11 }}
                          disabled={
                            quickNpcCreateBusy ||
                            saving ||
                            quickNpcFactionCreateBusy ||
                            !String(quickNpcNewFactionName || "").trim()
                          }
                        >
                          {quickNpcFactionCreateBusy
                            ? "Creating…"
                            : "Create faction"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={lbl}>Abilities (optional, one per line)</span>
                    <textarea
                      value={quickNpcAbilitiesText}
                      onChange={(e) => setQuickNpcAbilitiesText(e.target.value)}
                      placeholder="Each line becomes a unique ability name on the sheet."
                      rows={4}
                      style={{
                        ...S.inp,
                        fontSize: 11,
                        minHeight: 72,
                        resize: "vertical",
                        border: "1px solid #374151",
                        borderRadius: 4,
                        padding: 8,
                      }}
                      disabled={quickNpcCreateBusy || saving}
                    />
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={lbl}>Starting clocks</span>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 11,
                        color: "#d1d5db",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={quickNpcConflictClock}
                        onChange={(e) => setQuickNpcConflictClock(e.target.checked)}
                        disabled={quickNpcCreateBusy || saving}
                      />
                      8-segment conflict clock (&quot;Conflict&quot;)
                    </label>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 11,
                        color: "#d1d5db",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={quickNpcAltClock}
                        onChange={(e) => setQuickNpcAltClock(e.target.checked)}
                        disabled={quickNpcCreateBusy || saving}
                      />
                      8-segment alt clock (&quot;Alt track&quot;)
                    </label>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => handleQuickCreateNpcForSession(false)}
                      style={{ ...S.btnPrimary, flex: "1 1 160px", fontSize: 11 }}
                      disabled={quickNpcCreateBusy || saving || !quickNpcName.trim()}
                    >
                      {quickNpcCreateBusy ? "Creating…" : "Create & add to session"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickCreateNpcForSession(true)}
                      style={{
                        ...S.btnGhost,
                        flex: "1 1 160px",
                        fontSize: 11,
                        border: "1px solid #4b5563",
                      }}
                      disabled={
                        quickNpcCreateBusy ||
                        saving ||
                        !quickNpcName.trim() ||
                        typeof onNavigateToNPC !== "function"
                      }
                      title={
                        typeof onNavigateToNPC !== "function"
                          ? "Navigation to NPC sheet is not available here."
                          : undefined
                      }
                    >
                      {quickNpcCreateBusy ? "Creating…" : "Create, add & open sheet"}
                    </button>
                  </div>
                </div>
              </>
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <span style={{ ...S.sectionLbl, marginBottom: 0 }}>
            Session player roster
          </span>
          <button
            type="button"
            onClick={() => setPlayerRosterSectionCollapsed((v) => !v)}
            style={{ ...S.btnGhost, fontSize: 10, padding: "2px 8px", flexShrink: 0 }}
            title={
              playerRosterSectionCollapsed
                ? "Expand session player roster"
                : "Collapse session player roster"
            }
          >
            {playerRosterSectionCollapsed ? "Expand" : "Collapse"}
          </button>
        </div>
        {!playerRosterSectionCollapsed ? (
          <>
            <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 0" }}>
              Quick view: portrait, stand coin, action dots, XP tracks, personal coin
              &amp; stash, session clocks. Crew pool coin/stash in each crew card. PCs
              in this crew&apos;s campaign below.
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
              const crewCollapseKey = String(crew.id);
              const crewCollapsed = !!collapsedCrewCards[crewCollapseKey];
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {busy ? (
                        <span style={{ fontSize: 10, color: "#9ca3af" }}>Saving…</span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          toggleCollapsedCard(setCollapsedCrewCards, crewCollapseKey)
                        }
                        style={S.btnGhost}
                        title={crewCollapsed ? "Expand crew card" : "Collapse crew card"}
                      >
                        {crewCollapsed ? "Expand" : "Collapse"}
                      </button>
                    </div>
                  </div>
                  {!crewCollapsed ? (
                    <>
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
                    </>
                  ) : null}
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
            const standArmorMax = rosterStandArmorMaxFromDurabilityGrade(
              grades.durability,
            );
            const standArmorUsed = Math.max(
              0,
              Math.floor(Number(full.stand_armor_used) || 0),
            );
            const hasPhyArmor = !!full.has_physical_armor_item;
            const phyArmorMax = Math.min(
              6,
              Math.max(
                0,
                Math.floor(Number(full.physical_armor_bonus_charges) || 0),
              ),
            );
            const phyArmorUsed = Math.min(
              6,
              Math.max(0, Math.floor(Number(full.physical_armor_used) || 0)),
            );
            const xp = full.xp_clocks || {};
            const ad = full.action_dots || {};
            const ipr = insightProwessResolveFromActionDots(ad);
            const name = full.true_name || full.name || `PC ${full.id}`;
            const invLines = (Array.isArray(full.inventory) ? full.inventory : [])
              .map(rosterFormatInventoryLine)
              .filter(Boolean);
            const noteSections = rosterCharacterNoteSections(full);
            const pcClks = (clocks || []).filter(
              (c) =>
                Number(c.character) === Number(full.id) &&
                Number(c.session) === Number(session.id),
            );
            const canSRank = full.gm_can_have_s_rank_stand_stats === true;
            const isStandUser = hasPlaybook(
              full.playbook,
              full.secondary_playbook ?? full.secondaryPlaybook,
              "Stand",
            );
            const pcCollapseKey = `quick-${full.id}`;
            const pcCollapsed = !!collapsedPcCards[pcCollapseKey];
            const pcStandBusy =
              saving || pcStandForceBusyId === full.id;
            return (
              <div key={full.id} style={{ ...card, width: 300 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: "bold", minWidth: 0 }}>{name}</div>
                  <button
                    type="button"
                    onClick={() => toggleCollapsedCard(setCollapsedPcCards, pcCollapseKey)}
                    style={{ ...S.btnGhost, fontSize: 10, padding: "2px 8px" }}
                    title={pcCollapsed ? "Expand PC card" : "Collapse PC card"}
                  >
                    {pcCollapsed ? "Expand" : "Collapse"}
                  </button>
                </div>
                {!pcCollapsed ? (
                  <>
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
                        <a
                          href={buildRouteHref("character", { characterId: full.id })}
                          onClick={(e) =>
                            handleSpaNavClick(e, () => onNavigateToCharacter?.(full.id))
                          }
                          style={{
                            ...S.btnGhost,
                            fontSize: 10,
                            marginTop: 4,
                            display: "inline-block",
                            textDecoration: "none",
                          }}
                        >
                          Open sheet
                        </a>
                      </div>
                    </div>
                    {isStandUser ? (
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <NpcsStandCoin
                          grades={grades}
                          readouts={readoutsFromGrades(grades)}
                          onStep={(k, d) => {
                            if (pcStandBusy) return;
                            void handlePcStandStep(full, k, d);
                          }}
                          variant="pc"
                          pcMaxGrade={canSRank ? "S" : "A"}
                          readOnly={pcStandBusy}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: 10,
                          color: "#6b7280",
                          marginTop: 6,
                          lineHeight: 1.35,
                        }}
                      >
                        Stand Coin hidden — {playbookToDisplay(full.playbook)}{" "}
                        playbook (not a Stand user).
                      </div>
                    )}
                    <div style={lbl}>Actions (dot ratings)</div>
                    <div style={{ fontSize: 10, color: "#9ca3af", maxHeight: 56, overflow: "auto" }}>
                      {flatActionDots(ad)
                        .map(([a, d]) => `${a}: ${d}`)
                        .join(" · ") || "—"}
                    </div>
                    <div style={lbl}>Attribute ratings (from dots)</div>
                    <div style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.35 }}>
                      Insight {ipr.insight} · Prowess {ipr.prowess} · Resolve {ipr.resolve}{" "}
                      <span style={{ color: "#6b7280" }}>
                        (actions with ≥1 dot in each group)
                      </span>
                    </div>
                    <div style={lbl}>Armor uses</div>
                    <div style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.35 }}>
                      Physical{" "}
                      {hasPhyArmor ? `${phyArmorUsed}/${phyArmorMax}` : "—"} · Stand{" "}
                      {isStandUser && standArmorMax > 0
                        ? `${standArmorUsed}/${standArmorMax}`
                        : "—"}
                    </div>
                    <div style={lbl}>XP tracks</div>
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>
                      In {xp.insight ?? 0} · Pw {xp.prowess ?? 0} · Re {xp.resolve ?? 0} ·
                      Pb {xp.playbook ?? 0}
                    </div>
                    <div style={lbl}>Inventory</div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#9ca3af",
                        maxHeight: 96,
                        overflowY: "auto",
                        lineHeight: 1.35,
                        padding: "6px 8px",
                        background: "#0d1117",
                        borderRadius: 6,
                        border: "1px solid #30363d",
                      }}
                    >
                      {invLines.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {invLines.map((line, li) => (
                            <li key={`inv-${full.id}-${li}`}>{line}</li>
                          ))}
                        </ul>
                      ) : (
                        <span style={{ color: "#52525b" }}>—</span>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        marginTop: 6,
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="text"
                        value={pcRosterInvDraftByChar[full.id] ?? ""}
                        onChange={(e) =>
                          setPcRosterInvDraftByChar((p) => ({
                            ...p,
                            [full.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handlePcRosterAppendInventory(
                              full.id,
                              full.inventory,
                              e.currentTarget.value,
                            );
                          }
                        }}
                        placeholder="New item…"
                        aria-label={`Add inventory for ${name}`}
                        style={{
                          ...S.inp,
                          flex: 1,
                          fontSize: 11,
                          minWidth: 0,
                        }}
                        disabled={
                          saving ||
                          pcSheetMoneySavingId === full.id ||
                          pcRosterSheetBusyId === full.id
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handlePcRosterAppendInventory(
                            full.id,
                            full.inventory,
                            pcRosterInvDraftByChar[full.id],
                          )
                        }
                        disabled={
                          saving ||
                          pcSheetMoneySavingId === full.id ||
                          pcRosterSheetBusyId === full.id
                        }
                        style={{ ...S.btnGhost, fontSize: 10, flexShrink: 0 }}
                      >
                        Add
                      </button>
                    </div>
                    <div style={lbl}>Notes (PC sheet)</div>
                    {(() => {
                      const serverNotes = String(
                        full.background_note2 ?? "",
                      );
                      const hasDraft = Object.prototype.hasOwnProperty.call(
                        pcRosterNotesDraftByChar,
                        full.id,
                      );
                      const draftVal = hasDraft
                        ? pcRosterNotesDraftByChar[full.id]
                        : serverNotes;
                      const dirty = hasDraft && draftVal !== serverNotes;
                      const busy =
                        saving ||
                        pcSheetMoneySavingId === full.id ||
                        pcRosterSheetBusyId === full.id;
                      return (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          <textarea
                            value={draftVal}
                            onChange={(e) =>
                              setPcRosterNotesDraftByChar((p) => ({
                                ...p,
                                [full.id]: e.target.value,
                              }))
                            }
                            placeholder="Notes…"
                            aria-label={`Edit sheet notes for ${name}`}
                            rows={4}
                            style={{
                              width: "100%",
                              boxSizing: "border-box",
                              fontSize: 11,
                              lineHeight: 1.35,
                              padding: "6px 8px",
                              background: "#010409",
                              color: "#e5e7eb",
                              border: dirty
                                ? "1px solid #d97706"
                                : "1px solid #30363d",
                              borderRadius: 6,
                              resize: "vertical",
                              minHeight: 60,
                              fontFamily: "inherit",
                            }}
                            disabled={busy}
                          />
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              alignItems: "center",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                handlePcRosterSaveNotes(
                                  full.id,
                                  serverNotes,
                                  draftVal,
                                )
                              }
                              disabled={busy || !dirty}
                              style={{
                                ...S.btnGhost,
                                fontSize: 10,
                                opacity: !dirty ? 0.5 : 1,
                              }}
                            >
                              {busy ? "Saving…" : dirty ? "Save notes" : "Saved"}
                            </button>
                            {dirty && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPcRosterNotesDraftByChar((p) => {
                                    const n = { ...p };
                                    delete n[full.id];
                                    return n;
                                  })
                                }
                                disabled={busy}
                                style={{
                                  ...S.btnGhost,
                                  fontSize: 10,
                                }}
                              >
                                Revert
                              </button>
                            )}
                          </div>
                          {noteSections.length > 0 && (
                            <details
                              style={{ fontSize: 10, color: "#6b7280" }}
                            >
                              <summary
                                style={{
                                  cursor: "pointer",
                                  color: "#6b7280",
                                  marginBottom: 3,
                                }}
                              >
                                Sheet context (background / appearance / vice)
                              </summary>
                              <div
                                style={{
                                  maxHeight: 120,
                                  overflowY: "auto",
                                  padding: "6px 8px",
                                  background: "#0d1117",
                                  border: "1px solid #30363d",
                                  borderRadius: 6,
                                  marginTop: 4,
                                }}
                              >
                                {noteSections.map((sec, si) => (
                                  <div
                                    key={`${full.id}-ctx-${si}`}
                                    style={{
                                      marginBottom:
                                        si < noteSections.length - 1
                                          ? 8
                                          : 0,
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: 9,
                                        color: "#6b7280",
                                        fontWeight: 600,
                                        marginBottom: 3,
                                      }}
                                    >
                                      {sec.label}
                                    </div>
                                    <div
                                      style={{
                                        whiteSpace: "pre-wrap",
                                        color: "#9ca3af",
                                      }}
                                    >
                                      {sec.text}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    })()}
                    <div style={lbl}>Coin &amp; stash (personal)</div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px 12px",
                        alignItems: "center",
                        marginTop: 4,
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 10,
                          color: "#9ca3af",
                        }}
                      >
                        On hand (0–4)
                        <input
                          type="number"
                          min={0}
                          max={4}
                          disabled={
                            saving || pcSheetMoneySavingId === full.id
                          }
                          style={{ ...S.inp, width: 52, fontSize: 11 }}
                          value={
                            pcSheetHandCoinEdits[full.id] !== undefined
                              ? pcSheetHandCoinEdits[full.id]
                              : String(countSheetBoolSlots(full.coin_boxes))
                          }
                          onChange={(e) =>
                            setPcSheetHandCoinEdits((p) => ({
                              ...p,
                              [full.id]: e.target.value,
                            }))
                          }
                          onBlur={(e) =>
                            handlePcSheetHandCoinBlur(
                              full.id,
                              e.target.value,
                              full.coin_boxes,
                            )
                          }
                        />
                      </label>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 10,
                          color: "#9ca3af",
                        }}
                      >
                        Stash filled (0–40)
                        <input
                          type="number"
                          min={0}
                          max={40}
                          disabled={
                            saving || pcSheetMoneySavingId === full.id
                          }
                          style={{ ...S.inp, width: 52, fontSize: 11 }}
                          value={
                            pcSheetStashFilledEdits[full.id] !== undefined
                              ? pcSheetStashFilledEdits[full.id]
                              : String(countSheetBoolSlots(full.stash_slots))
                          }
                          onChange={(e) =>
                            setPcSheetStashFilledEdits((p) => ({
                              ...p,
                              [full.id]: e.target.value,
                            }))
                          }
                          onBlur={(e) =>
                            handlePcSheetStashFilledBlur(
                              full.id,
                              e.target.value,
                              full.stash_slots,
                            )
                          }
                        />
                      </label>
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: "#52525b",
                        marginTop: 2,
                        lineHeight: 1.35,
                      }}
                    >
                      Matches sheet coin boxes / stash slots (filled from the left).
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={lbl}>Clocks (this session)</div>
                      <button
                        type="button"
                        onClick={() => {
                          if (pcSessionClockDraftFor === full.id) {
                            setPcSessionClockDraftFor(null);
                          } else {
                            setPcSessionClockDraft({
                              name: "",
                              max_segments: 8,
                              clock_type: "CUSTOM",
                              visible_to_players: false,
                            });
                            setPcSessionClockDraftFor(full.id);
                          }
                        }}
                        style={{
                          ...S.btn,
                          fontSize: 10,
                          padding: "2px 8px",
                          background: "#1e3a5f",
                          color: "#bae6fd",
                        }}
                      >
                        {pcSessionClockDraftFor === full.id ? "Close" : "+ Clock"}
                      </button>
                    </div>
                    {pcSessionClockDraftFor === full.id ? (
                      <div
                        style={{
                          marginTop: 6,
                          marginBottom: 8,
                          padding: 8,
                          borderRadius: 6,
                          border: "1px solid #374151",
                          background: "#0d1117",
                          display: "grid",
                          gap: 8,
                        }}
                      >
                        <input
                          style={S.inp}
                          placeholder="Clock name"
                          value={pcSessionClockDraft.name}
                          onChange={(e) =>
                            setPcSessionClockDraft((d) => ({
                              ...d,
                              name: e.target.value,
                            }))
                          }
                        />
                        <div
                          style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
                        >
                          <label style={{ fontSize: 10, color: "#9ca3af" }}>
                            Segments
                            <select
                              style={{ ...S.select, marginLeft: 6 }}
                              value={pcSessionClockDraft.max_segments}
                              onChange={(e) =>
                                setPcSessionClockDraft((d) => ({
                                  ...d,
                                  max_segments: Number(e.target.value),
                                }))
                              }
                            >
                              {SESSION_PC_CLOCK_SEGMENTS.map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label style={{ fontSize: 10, color: "#9ca3af" }}>
                            Type
                            <select
                              style={{ ...S.select, marginLeft: 6 }}
                              value={pcSessionClockDraft.clock_type}
                              onChange={(e) =>
                                setPcSessionClockDraft((d) => ({
                                  ...d,
                                  clock_type: e.target.value,
                                }))
                              }
                            >
                              {SESSION_PC_CLOCK_TYPES.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 10,
                            color: "#a7f3d0",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={pcSessionClockDraft.visible_to_players}
                            onChange={(e) =>
                              setPcSessionClockDraft((d) => ({
                                ...d,
                                visible_to_players: e.target.checked,
                              }))
                            }
                          />
                          Visible to players
                        </label>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            style={S.btnPrimary}
                            disabled={pcSessionClockBusyCharId === full.id}
                            onClick={async () => {
                              const nm = String(
                                pcSessionClockDraft.name || "",
                              ).trim();
                              if (!nm) {
                                setError("Enter a name for the clock.");
                                return;
                              }
                              setPcSessionClockBusyCharId(full.id);
                              setError(null);
                              try {
                                await progressClockAPI.createProgressClock({
                                  campaign: campaign.id,
                                  session: session.id,
                                  character: full.id,
                                  name: nm,
                                  clock_type:
                                    pcSessionClockDraft.clock_type || "CUSTOM",
                                  max_segments:
                                    pcSessionClockDraft.max_segments || 8,
                                  filled_segments: 0,
                                  visible_to_players:
                                    !!pcSessionClockDraft.visible_to_players,
                                });
                                setPcSessionClockDraftFor(null);
                                setPcSessionClockDraft({
                                  name: "",
                                  max_segments: 8,
                                  clock_type: "CUSTOM",
                                  visible_to_players: false,
                                });
                                await refreshSessionClocks();
                              } catch (e) {
                                setError(
                                  e?.message ||
                                    "Could not create progress clock.",
                                );
                              } finally {
                                setPcSessionClockBusyCharId(null);
                              }
                            }}
                          >
                            {pcSessionClockBusyCharId === full.id
                              ? "Saving…"
                              : "Create"}
                          </button>
                          <button
                            type="button"
                            style={S.btnGhost}
                            onClick={() => {
                              setPcSessionClockDraftFor(null);
                              setPcSessionClockDraft({
                                name: "",
                                max_segments: 8,
                                clock_type: "CUSTOM",
                                visible_to_players: false,
                              });
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: 14,
                        color: "#6b7280",
                        maxHeight: 120,
                        overflowY: "auto",
                      }}
                    >
                      {pcClks.map((c) => (
                        <li
                          key={c.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            flexWrap: "wrap",
                            marginBottom: 4,
                          }}
                        >
                          <span style={{ flex: "1 1 120px" }}>
                            {c.name} ({c.filled_segments}/{c.max_segments})
                            {progressClockShowsPlayersBadge(c, campaign?.gm) ? (
                              <span style={{ color: "#6ee7b7", fontSize: 9 }}>
                                {" "}
                                · players
                              </span>
                            ) : null}
                          </span>
                          <span style={{ display: "flex", gap: 4 }}>
                            <button
                              type="button"
                              style={{
                                ...S.btnGhost,
                                fontSize: 9,
                                padding: "1px 6px",
                              }}
                              title="Fewer ticks"
                              disabled={pcSessionClockBusyCharId === full.id}
                              onClick={async () => {
                                const next = Math.max(
                                  0,
                                  (Number(c.filled_segments) || 0) - 1,
                                );
                                setPcSessionClockBusyCharId(full.id);
                                try {
                                  await progressClockAPI.updateProgressClock(
                                    c.id,
                                    { filled_segments: next },
                                  );
                                  await refreshSessionClocks();
                                } catch (e) {
                                  setError(
                                    e?.message || "Could not update clock.",
                                  );
                                } finally {
                                  setPcSessionClockBusyCharId(null);
                                }
                              }}
                            >
                              −
                            </button>
                            <button
                              type="button"
                              style={{
                                ...S.btnGhost,
                                fontSize: 9,
                                padding: "1px 6px",
                              }}
                              title="More ticks"
                              disabled={pcSessionClockBusyCharId === full.id}
                              onClick={async () => {
                                const cap = Number(c.max_segments) || 8;
                                const next = Math.min(
                                  cap,
                                  (Number(c.filled_segments) || 0) + 1,
                                );
                                setPcSessionClockBusyCharId(full.id);
                                try {
                                  await progressClockAPI.updateProgressClock(
                                    c.id,
                                    { filled_segments: next },
                                  );
                                  await refreshSessionClocks();
                                } catch (e) {
                                  setError(
                                    e?.message || "Could not update clock.",
                                  );
                                } finally {
                                  setPcSessionClockBusyCharId(null);
                                }
                              }}
                            >
                              +
                            </button>
                            <button
                              type="button"
                              style={{
                                ...S.btnGhost,
                                fontSize: 9,
                                padding: "1px 6px",
                                color: "#f87171",
                              }}
                              disabled={pcSessionClockBusyCharId === full.id}
                              onClick={async () => {
                                if (
                                  !window.confirm(
                                    `Delete clock "${c.name || "clock"}"?`,
                                  )
                                )
                                  return;
                                setPcSessionClockBusyCharId(full.id);
                                try {
                                  await progressClockAPI.deleteProgressClock(
                                    c.id,
                                  );
                                  await refreshSessionClocks();
                                } catch (e) {
                                  setError(
                                    e?.message || "Could not delete clock.",
                                  );
                                } finally {
                                  setPcSessionClockBusyCharId(null);
                                }
                              }}
                            >
                              ✕
                            </button>
                          </span>
                        </li>
                      ))}
                      {pcClks.length === 0 &&
                      pcSessionClockDraftFor !== full.id ? (
                        <li>—</li>
                      ) : null}
                    </ul>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
        </>
        ) : null}
      </div>

      <div style={S.card}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: bulkPeSectionCollapsed ? 0 : 8,
          }}
        >
          <span
            style={{
              ...S.sectionLbl,
              display: "block",
              marginTop: 0,
              marginBottom: 0,
              flex: "1 1 auto",
              minWidth: 0,
            }}
          >
            Bulk position / effect (per character)
          </span>
          <button
            type="button"
            onClick={() => setBulkPeSectionCollapsed((o) => !o)}
            aria-expanded={!bulkPeSectionCollapsed}
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
            title={
              bulkPeSectionCollapsed
                ? "Expand bulk position / effect panel"
                : "Collapse bulk position / effect panel"
            }
          >
            {bulkPeSectionCollapsed ? "Expand" : "Collapse"}
          </button>
        </div>
        {!bulkPeSectionCollapsed ? (
          <>
        <p style={{ fontSize: 11, color: "#6b7280", marginTop: 0 }}>
          Overrides session defaults for these PCs on action rolls. Use{" "}
          <strong>PE default</strong> next to a name to clear that PC&apos;s
          position/effect override. Use <strong>Reset harm</strong> to wipe that
          PC&apos;s harm fields (asks for confirmation before saving).
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
                <option value="CLEAR_STRESS">Downtime recovery (vice)</option>
                <option value="CLEAR_STRESS_IN_PLAY">
                  Recovery in play (clear stress)
                </option>
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
                  <option disabled style={{ opacity: 0.5 }}>
                    — Stand coin —
                  </option>
                  {STAND_ROLL_KEYS_ALL.map((sk) => {
                    const v = `stand_${sk}`;
                    const label = `Stand ${sk}`;
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
                  <option value="stand_durability">Stand durability</option>
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
              free-form XP grants to a specific track (offline dice, table
              rulings) — distinct from the{" "}
              <strong>Beliefs / Struggle / Standout trigger toggles</strong>{" "}
              above (those record an SRD end-of-session trigger and always go
              to the playbook clock, capped at 2 / trigger / session). The
              panels below pull together <strong>experience tracker</strong>{" "}
              rows, <strong>linked XP history</strong>,{" "}
              <strong>completed progress clocks</strong> on this session, and{" "}
              <strong>sheet saves</strong> that changed XP tracks (spend /
              refill), scoped roughly to this session&apos;s{" "}
              <strong>session date</strong>.
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
                  Other trigger labels (beliefs, struggle, playbook-specific,
                  etc.) appear when the site or a GM logs them (manual or
                  automation).
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
              End-of-session XP scorecard (toggle per PC, this session only)
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#6b7280",
                marginBottom: 10,
                lineHeight: 1.45,
              }}
            >
              {(campaignChars || []).length === 0 ? (
                <span>No player characters in this campaign yet.</span>
              ) : (
                <>
                  {xpToggleError && (
                    <div
                      style={{
                        color: "#fca5a5",
                        fontSize: 11,
                        marginBottom: 6,
                      }}
                    >
                      {xpToggleError}
                    </div>
                  )}
                  {(campaignChars || []).map((ch) => {
                    const cid = Number(ch.id);
                    const counts =
                      pcXpTriggerCountsByCharacter.get(cid) || {
                        BELIEFS: 0,
                        STRUGGLE: 0,
                        PLAYBOOK: 0,
                      };
                    const title =
                      charDisplayNameById.get(cid) ||
                      ch.true_name ||
                      ch.name ||
                      `PC ${cid}`;
                    const fullSheet =
                      (characters || []).find((c) => Number(c?.id) === cid) ||
                      ch;
                    const pbDisp = fullSheet?.playbook ?? ch?.playbook ?? "Stand";
                    const rawArch =
                      fullSheet?.playbookXpArchetypes ??
                      fullSheet?.playbook_xp_archetypes;
                    const archKeys = normalizePlaybookXpArchetypeKeys(
                      pbDisp,
                      rawArch,
                    );
                    const archCaption = archKeys.length
                      ? archetypeLabelsJoined(archKeys, pbDisp)
                      : "";
                    const rows = [
                      {
                        label: "Playbook-specific (abilities)",
                        detail: archCaption,
                        trigger: PLAYBOOK_SESSION_TOGGLE_TRIGGER,
                        v: counts.PLAYBOOK,
                      },
                      {
                        label: "Beliefs / drives / heritage",
                        detail: "",
                        trigger: "BELIEFS",
                        v: counts.BELIEFS,
                      },
                      {
                        label: "Struggle (vice / trauma / entanglement)",
                        detail: "",
                        trigger: "STRUGGLE",
                        v: counts.STRUGGLE,
                      },
                    ];
                    return (
                      <div
                        key={`xp-toggle-${cid}`}
                        style={{
                          marginBottom: 10,
                          padding: 6,
                          border: "1px solid #1f2937",
                          borderRadius: 4,
                        }}
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
                        {rows.map((row) => {
                          const busy =
                            xpToggleBusy.cid === cid &&
                            xpToggleBusy.trigger === row.trigger;
                          return (
                            <div
                              key={`${cid}-${row.trigger}`}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 8,
                                padding: "3px 0",
                              }}
                            >
                              <span style={{ color: "#9ca3af" }}>
                                {row.label}
                                {row.detail ? (
                                  <span
                                    style={{
                                      display: "block",
                                      fontSize: 10,
                                      color: "#6b7280",
                                      marginTop: 2,
                                      fontWeight: 400,
                                    }}
                                  >
                                    {row.detail}
                                  </span>
                                ) : null}
                              </span>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                {[0, 1].map((idx) => {
                                  const filled = idx < row.v;
                                  const action = filled ? -1 : 1;
                                  const isNextPip =
                                    (filled && idx === row.v - 1) ||
                                    (!filled && idx === row.v);
                                  const disabled = busy || !isNextPip;
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      disabled={disabled}
                                      onClick={() =>
                                        handleGmXpTriggerToggle(
                                          cid,
                                          row.trigger,
                                          action,
                                        )
                                      }
                                      aria-label={`${filled ? "Revoke" : "Award"} ${row.trigger} XP for ${title}`}
                                      title={
                                        filled
                                          ? "Click to untoggle (-1 XP)"
                                          : "Click to award +1 XP"
                                      }
                                      style={{
                                        width: 14,
                                        height: 14,
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
                                        opacity:
                                          disabled && !filled ? 0.45 : 1,
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
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
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
              By PC — requirements logged (experience tracker)
            </div>
            {xpEntryDeleteError && (
              <div
                style={{
                  color: "#fca5a5",
                  fontSize: 10,
                  marginBottom: 6,
                }}
              >
                {xpEntryDeleteError}
              </div>
            )}
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
                          padding: 0,
                          listStyle: "none",
                          color: "#9ca3af",
                          display: "flex",
                          flexDirection: "column",
                          gap: 3,
                        }}
                      >
                        {lines.map((entry, i) => {
                          const busy = xpEntryDeleteBusy === entry.id;
                          return (
                            <li
                              key={`${cid}-${entry.id ?? i}`}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                gap: 6,
                                background: "#0b1220",
                                border: "1px solid #1f2937",
                                borderRadius: 3,
                                padding: "3px 6px",
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                {entry.triggerTag ? (
                                  <div
                                    style={{
                                      fontSize: 9,
                                      fontFamily:
                                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                                      color: "#a78bfa",
                                      marginBottom: 2,
                                      fontWeight: 600,
                                    }}
                                    title="End-of-session playbook XP trigger (SRD cap 2/session)"
                                  >
                                    {entry.triggerTag}
                                  </div>
                                ) : null}
                                <div style={{ color: "#d1d5db" }}>
                                  {entry.label}
                                </div>
                                <div
                                  style={{
                                    color:
                                      entry.awardHow === "Automatic"
                                        ? "#6b7280"
                                        : "#9ca3af",
                                    fontSize: 9,
                                    marginTop: 1,
                                    lineHeight: 1.35,
                                  }}
                                  title={
                                    "Automatic = rolls / settlement · GM or Player toggle = session-trigger pip"
                                  }
                                >
                                  {entry.awardHow} · {entry.sessionLabel}
                                </div>
                              </div>
                              {entry.id && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteXpEntry(entry.id)
                                  }
                                  disabled={busy}
                                  aria-label="Delete XP entry"
                                  title="Delete this XP record"
                                  style={{
                                    flexShrink: 0,
                                    width: 18,
                                    height: 18,
                                    borderRadius: 3,
                                    border: "1px solid #7f1d1d",
                                    background: busy
                                      ? "#374151"
                                      : "#1f2937",
                                    color: "#fca5a5",
                                    cursor: busy
                                      ? "not-allowed"
                                      : "pointer",
                                    fontSize: 11,
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
              Player projects (campaign)
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#6b7280",
                marginBottom: 10,
                lineHeight: 1.45,
              }}
            >
              {!campaignWideClocksLoaded ? (
                <span>Loading player projects…</span>
              ) : gmPlayerProjectClocks.length === 0 ? (
                <span>
                  No player-owned long-term projects yet. Lists{" "}
                  <strong>PROJECT</strong> clocks on a <strong>PC or crew</strong> in
                  this campaign when the creator is not the GM (mid-session and
                  carryover clocks both appear).
                </span>
              ) : (
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    color: "#9ca3af",
                  }}
                >
                  {gmPlayerProjectClocks.map((clk) => {
                    const done = progressClockIsDone(clk);
                    const scope = progressClockSessionScopeShort(clk, session?.id);
                    return (
                      <li key={`player-proj-${clk.id}`}>
                        <span
                          style={{
                            color: done ? "#6b7280" : "#d1d5db",
                            opacity: done ? 0.85 : 1,
                          }}
                        >
                          {clk.name || "Project"}
                        </span>
                        {` · ${progressClockOwnerLabel(clk)} · `}
                        {Number(clk.filled_segments) || 0}/
                        {Number(clk.max_segments) || 0}
                        <span style={{ color: "#71717a" }}>{` · ${scope}`}</span>
                        {done ? (
                          <span style={{ color: "#22c55e", marginLeft: 4 }}>
                            complete
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
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
                    spent. Rows dated <strong>before</strong> this session (when
                    set) are pulled from full campaign sheet history so buy-in
                    after invite but before session night still shows here.
                  </div>
                  {initialBuyInLedgerItems.length === 0 ? (
                    <div style={{ marginBottom: 12, color: "#6b7280" }}>
                      {campaignAdvancementLedgerEntries.some(
                        (e) =>
                          (e.advancement_buckets?.expenditure || []).length ||
                          (e.advancement_buckets?.other || []).length,
                      ) ? (
                        <>
                          No zero-baseline initial rows in the session window, and
                          no earlier campaign save matched empty→filled layout for
                          PCs missing that pattern—common when the first logged
                          save already had partial dots. See{" "}
                          <strong>Paid with XP</strong> / other buckets below.
                        </>
                      ) : (
                        <>
                          No initial-layout rows (session + pre-session scan). No
                          ledger save yet matched all-zero action dots or empty
                          playbook clocks → first fills for these PCs.
                        </>
                      )}
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
                      {initialBuyInLedgerItems}
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
                    <th style={{ textAlign: "left", padding: 6 }}>Award</th>
                    <th style={{ textAlign: "left", padding: 6 }}>Source</th>
                    <th style={{ textAlign: "left", padding: 6 }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionXpFeedSorted.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
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
                            {row.isPlaybookSessionTrigger ? (
                              <div
                                style={{
                                  fontSize: 9,
                                  fontFamily:
                                    "ui-monospace, SFMono-Regular, Menlo, monospace",
                                  color: "#a78bfa",
                                  marginBottom: 2,
                                  fontWeight: 600,
                                }}
                                title="End-of-session playbook XP trigger (SRD cap 2/session)"
                              >
                                {sessionPlaybookTriggerTag(row.triggerCode)}
                              </div>
                            ) : null}
                            <div>{row.typeLabel || "—"}</div>
                          </td>
                          <td
                            style={{
                              padding: 6,
                              verticalAlign: "top",
                              color:
                                row.awardHow === "Automatic"
                                  ? "#6b7280"
                                  : row.awardHow
                                    ? "#9ca3af"
                                    : "#52525b",
                              fontSize: 9,
                              lineHeight: 1.35,
                              maxWidth: 120,
                              wordBreak: "break-word",
                            }}
                            title={
                              row.source === "Tracker"
                                ? "Automatic = rolls / settlement · GM or Player toggle = logged session-trigger pip"
                                : undefined
                            }
                          >
                            {row.awardHow ?? "—"}
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
                await onSessionCharactersRefresh?.();
                onRefresh();
              } catch (e) {
                setError(e.message || "Failed to save harm");
              }
            };
            const emptyHarmPayload = {
              harm_level1_name: "",
              harm_level1_used: false,
              harm_level1_slot2_name: "",
              harm_level1_slot2_used: false,
              harm_level2_name: "",
              harm_level2_used: false,
              harm_level2_slot2_name: "",
              harm_level2_slot2_used: false,
              harm_level3_name: "",
              harm_level3_used: false,
              harm_level4_name: "",
              harm_level4_used: false,
            };
            const confirmResetHarmForPc = async () => {
              const nm = (ch.true_name || ch.name || `PC ${id}`).trim();
              const ok = window.confirm(
                `Clear all harm (levels 1–4) for ${nm}? This saves immediately to the character sheet.`,
              );
              if (!ok) return;
              setError(null);
              setSaving(true);
              try {
                let body = await characterAPI.patchCharacter(id, emptyHarmPayload);
                if (!body || typeof body !== "object") body = {};
                if (!("harm_level1_name" in body)) {
                  body = await characterAPI.getCharacter(id);
                }
                setHarmDraftByChar((prev) => ({
                  ...prev,
                  [id]: harmDraftFromApiCharacter(body),
                }));
                await onSessionCharactersRefresh?.();
                onRefresh();
              } catch (e) {
                setError(e.message || "Failed to reset harm");
              } finally {
                setSaving(false);
              }
            };
            const row = peMap[String(id)] || peMap[id] || null;
            const pos = row?.position || defaultPos;
            const eff = row?.effect || defaultEff;
            const fullCharacter =
              (characters || []).find((c) => Number(c?.id) === Number(id)) ||
              ch;
            const pePositionEffectHints =
              getPositionEffectModifierHints(fullCharacter);
            const pePositionHints = pePositionEffectHints.filter(
              (h) => h.kind === "position" || h.kind === "position/effect",
            );
            const peEffectHints = pePositionEffectHints.filter(
              (h) => h.kind === "effect" || h.kind === "position/effect",
            );
            const peCollapseKey = `pe-${id}`;
            const peCollapsed = !!collapsedPcCards[peCollapseKey];
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
                  <a
                    href={buildRouteHref("character", { characterId: id })}
                    onClick={(e) =>
                      handleSpaNavClick(e, () => onNavigateToCharacter?.(id))
                    }
                    style={{
                      color: "#e5e7eb",
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: "underline",
                      textUnderlineOffset: "2px",
                    }}
                    title="Open character sheet"
                  >
                    {ch.true_name || ch.name || id}
                  </a>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                      type="button"
                      onClick={confirmResetHarmForPc}
                      style={{ ...S.btnGhost, fontSize: 10 }}
                      disabled={saving}
                      title="Clear every harm line for this PC (confirmation required)"
                    >
                      Reset harm
                    </button>
                    <button
                      type="button"
                      onClick={() => mergePosEffect({ [id]: null })}
                      style={{ ...S.btnGhost, fontSize: 10, padding: "6px 8px" }}
                      disabled={saving}
                      title="Use session default position / effect for this PC"
                    >
                      PE default
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleCollapsedCard(setCollapsedPcCards, peCollapseKey)}
                      style={{ ...S.btnGhost, fontSize: 10, padding: "2px 8px" }}
                      title={peCollapsed ? "Expand PC card" : "Collapse PC card"}
                    >
                      {peCollapsed ? "Expand" : "Collapse"}
                    </button>
                  </div>
                </div>
                {!peCollapsed ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 18,
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                    }}
                  >
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 6,
                      }}
                    >
                      <PositionStack
                        activePosition={pos}
                        readOnly={saving}
                        onSelect={(value) =>
                          mergePosEffect({
                            [id]: { position: value, effect: eff },
                          })
                        }
                      />
                      {pePositionHints.length > 0 ? (
                        <div
                          style={{
                            fontSize: 9,
                            color: "#6b7280",
                            lineHeight: 1.35,
                            maxWidth: 220,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              color: "#71717a",
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                              marginBottom: 2,
                            }}
                          >
                            Position modifiers (verify)
                          </div>
                          <div style={{ color: "#9ca3af" }}>
                            {pePositionHints.map((h, i) => (
                              <span key={`pos-${h.bucket}-${h.name}`}>
                                {i > 0 ? " · " : ""}
                                <span
                                  title={`${peModifierBucketLabel(h.bucket)} ability — verify on character sheet`}
                                >
                                  [{peModifierBucketLabel(h.bucket)}] {h.name}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 6,
                      }}
                    >
                      <EffectShapes
                        activeEffect={eff}
                        readOnly={saving}
                        onSelect={(value) =>
                          mergePosEffect({
                            [id]: { position: pos, effect: value },
                          })
                        }
                      />
                      {peEffectHints.length > 0 ? (
                        <div
                          style={{
                            fontSize: 9,
                            color: "#6b7280",
                            lineHeight: 1.35,
                            maxWidth: 220,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              color: "#71717a",
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                              marginBottom: 2,
                            }}
                          >
                            Effect modifiers (verify)
                          </div>
                          <div style={{ color: "#9ca3af" }}>
                            {peEffectHints.map((h, i) => (
                              <span key={`eff-${h.bucket}-${h.name}`}>
                                {i > 0 ? " · " : ""}
                                <span
                                  title={`${peModifierBucketLabel(h.bucket)} ability — verify on character sheet`}
                                >
                                  [{peModifierBucketLabel(h.bucket)}] {h.name}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div style={{ minWidth: 220, flex: "1 1 220px" }}>
                    <div style={lbl}>
                      <span>Recent rolls</span>
                    </div>
                    <div
                      title="Total stress recorded on this character’s rolls in this session (e.g. resistance cost, push). From roll payloads, not live clock ticks."
                      style={{
                        fontSize: 10,
                        color: "#a78bfa",
                        marginBottom: 6,
                        lineHeight: 1.35,
                      }}
                    >
                      Stress (session):{" "}
                      <span style={{ fontWeight: 800, color: "#e9d5ff" }}>
                        {sessionStressSpentForCharacter(id)}
                      </span>
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
                        getRecentCharacterRolls(id).map((r) => {
                          const rtUp = String(r.roll_type || "").toUpperCase();
                          const recBadge = recoveryBadgeFromRoll(r);
                          const asst = assistInfoFromRoll(r);
                          const rollHint = buildRecentRollDetailTitle(r);
                          const diceSrcSummary = recentRollDiceSourcesSummary(r);
                          const diceSrcTooltip =
                            recentRollDiceSourcesTooltip(r) ||
                            diceSrcSummary ||
                            undefined;
                          return (
                          <div
                            key={r.id}
                            title={rollHint}
                            style={{
                              marginBottom: 4,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 8,
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              {rtUp ? (
                                <span style={{ color: "#6b7280" }}>{rtUp} · </span>
                              ) : null}
                              {(r.action_name || "action").toUpperCase()} ·{" "}
                              {(r.results || []).join(", ")} →{" "}
                              {(r.outcome || "").replace(/_/g, " ")}
                              {diceSrcSummary ? (
                                <span
                                  title={diceSrcTooltip}
                                  style={{
                                    marginLeft: 6,
                                    color: "#71717a",
                                    fontSize: 9,
                                    verticalAlign: "middle",
                                  }}
                                >
                                  · {diceSrcSummary}
                                </span>
                              ) : null}
                              <span
                                style={{
                                  marginLeft: 6,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                  flexWrap: "wrap",
                                  verticalAlign: "middle",
                                }}
                              >
                                {rollHasTruthyFk(r.group_action) ? (
                                  <span
                                    title={`Group action id ${r.group_action}`}
                                    style={{
                                      fontSize: 8,
                                      fontWeight: 700,
                                      letterSpacing: "0.04em",
                                      padding: "1px 5px",
                                      borderRadius: 4,
                                      border: "1px solid #1d4ed8",
                                      background: "rgba(29, 78, 216, 0.2)",
                                      color: "#93c5fd",
                                    }}
                                  >
                                    GA
                                  </span>
                                ) : null}
                                {recBadge ? (
                                  <span
                                    title={recBadge.title}
                                    style={{
                                      fontSize: 8,
                                      fontWeight: 700,
                                      letterSpacing: "0.04em",
                                      padding: "1px 5px",
                                      borderRadius: 4,
                                      border: "1px solid #047857",
                                      background: "rgba(4, 120, 87, 0.2)",
                                      color: "#6ee7b7",
                                    }}
                                  >
                                    {recBadge.label}
                                  </span>
                                ) : null}
                                {asst ? (
                                  <span
                                    title={asst.title}
                                    style={{
                                      fontSize: 8,
                                      fontWeight: 700,
                                      letterSpacing: "0.04em",
                                      padding: "1px 5px",
                                      borderRadius: 4,
                                      border: "1px solid #b45309",
                                      background: "rgba(180, 83, 9, 0.2)",
                                      color: "#fcd34d",
                                    }}
                                  >
                                    {asst.label}
                                  </span>
                                ) : null}
                              </span>
                              {(Array.isArray(r.xp_award_details) &&
                              r.xp_award_details.length > 0
                                ? r.xp_award_details
                                : r.xp_award_detail
                                  ? [r.xp_award_detail]
                                  : []
                              ).map((xpRow, xpIdx) => (
                                <span
                                  key={`xp-${r.id}-${xpIdx}`}
                                  style={{
                                    display: "block",
                                    marginTop: 3,
                                    color: "#34d399",
                                    fontSize: 9,
                                    lineHeight: 1.35,
                                  }}
                                >
                                  +{xpRow.xp_gained} XP ·{" "}
                                  {xpRow.trigger_label || xpRow.trigger}
                                  {xpRow.track &&
                                  xpRow.track_total != null &&
                                  xpRow.track_total !== undefined
                                    ? ` · ${String(xpRow.track)} ${xpRow.track_total}`
                                    : ""}
                                  {xpRow.all_tracks_total != null &&
                                  xpRow.all_tracks_total !== undefined
                                    ? ` · all clocks ${xpRow.all_tracks_total}`
                                    : ""}
                                </span>
                              ))}
                              <details style={{ marginTop: 4 }}>
                                <summary
                                  style={{
                                    cursor: "pointer",
                                    color: "#6b7280",
                                    fontSize: 9,
                                  }}
                                >
                                  Properties
                                </summary>
                                <div
                                  style={{
                                    marginTop: 4,
                                    fontSize: 9,
                                    color: "#9ca3af",
                                    lineHeight: 1.35,
                                  }}
                                >
                                  {Array.isArray(r.modifier_sources) &&
                                  r.modifier_sources.length > 0 ? (
                                    <div>
                                      Sources:{" "}
                                      {r.modifier_sources
                                        .map((s) => s?.name || s?.delta)
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </div>
                                  ) : null}
                                  {Array.isArray(r.stress_sources) &&
                                  r.stress_sources.length > 0 ? (
                                    <div>
                                      Stress sources:{" "}
                                      {r.stress_sources
                                        .map((s) => s?.name || s?.delta)
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </div>
                                  ) : null}
                                  {Array.isArray(r.position_effect_sources) &&
                                  r.position_effect_sources.length > 0 ? (
                                    <div>
                                      Position/effect sources:{" "}
                                      {r.position_effect_sources
                                        .map((s) => s?.name || s?.delta)
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </div>
                                  ) : null}
                                </div>
                              </details>
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
                          );
                        })
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
                ) : null}
              </div>
            );
          })}
        </div>
          </>
        ) : null}
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

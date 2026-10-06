import React, { useCallback, useEffect, useState } from "react";
import {
  equipmentAPI,
  npcAPI,
} from "../../features/character-sheet/services/api";
import { buildRouteHref, handleSpaNavClick } from "../../utils/spaNavigation";
import NpcsStandCoin from "../NpcsStandCoin";
import {
  NestedTabBar,
  NPC_NESTED_TABS,
  NPC_PLAYBOOK_OPTIONS,
} from "../session/sessionShellUi";
import { rosterExpandPanelChrome } from "./rosterShared";
import RosterNpcExpandEditableTabs from "./RosterNpcExpandEditableTabs";

const GRADES = ["F", "D", "C", "B", "A", "S"];
const lbl = { fontSize: 10, color: "#9ca3af", textTransform: "uppercase" };

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

function stepGrade(letter, delta) {
  const u = String(letter || "D").toUpperCase();
  const i = GRADES.indexOf(u);
  const base = i >= 0 ? i : 1;
  return GRADES[Math.max(0, Math.min(GRADES.length - 1, base + delta))];
}

/**
 * Campaign roster NPC expand — session-style nested tabs (no duplicate face card).
 */
export default function NpcCampaignExpandPanel({
  npc: npcIn,
  S,
  campaign,
  onNavigateToNPC,
  onLeaveFaction,
  onRemoveFromCampaign,
  onMoveNpcToFaction,
  onRefresh,
  onError,
  onClose,
  readOnly = false,
}) {
  const [detail, setDetail] = useState(null);
  const [activeTab, setActiveTab] = useState("info");
  const [busy, setBusy] = useState(false);
  const [localStand, setLocalStand] = useState(null);
  const [equipmentCatalog, setEquipmentCatalog] = useState([]);

  useEffect(() => {
    setDetail(null);
    setLocalStand(null);
    setActiveTab("info");
    if (!npcIn?.id) return undefined;
    let cancelled = false;
    npcAPI
      .getNPC(npcIn.id)
      .then((body) => {
        if (!cancelled) setDetail(body && typeof body === "object" ? body : null);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [npcIn?.id]);

  useEffect(() => {
    if (!campaign?.id) {
      setEquipmentCatalog([]);
      return undefined;
    }
    let cancelled = false;
    equipmentAPI
      .list({ campaign: campaign.id, available_for_campaign: true })
      .then((list) => {
        if (!cancelled) setEquipmentCatalog(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setEquipmentCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [campaign?.id]);

  const npcId = npcIn?.id;
  const npc = { ...(npcIn || {}), ...(detail || {}) };

  const grades = rawStandToGrades(localStand || npc.stand_coin_stats);
  const factions = campaign?.factions || [];
  const factionId =
    npc.faction?.id ?? npc.faction_id ?? npc.faction ?? null;
  const factionSelectValue =
    factionId != null && factionId !== "" ? String(factionId) : "";

  const patchNpc = useCallback(
    async (partial) => {
      if (readOnly || !npcId) return;
      setBusy(true);
      onError?.(null);
      try {
        await npcAPI.patchNPC(npcId, partial);
        const body = await npcAPI.getNPC(npcId).catch(() => null);
        if (body && typeof body === "object") setDetail(body);
        onRefresh?.();
      } catch (e) {
        onError?.(e?.message || "NPC update failed");
      } finally {
        setBusy(false);
      }
    },
    [npcId, onError, onRefresh, readOnly],
  );

  const handleStandStep = useCallback(
    async (key, delta) => {
      if (readOnly || !npcId) return;
      const next = {
        ...grades,
        [key]: stepGrade(grades[key], delta),
      };
      setLocalStand(next);
      setBusy(true);
      onError?.(null);
      try {
        await npcAPI.patchNPC(npcId, { stand_coin_stats: next });
        onRefresh?.();
      } catch (e) {
        setLocalStand(null);
        onError?.(e?.message || "Stand update failed");
      } finally {
        setBusy(false);
      }
    },
    [grades, npcId, onError, onRefresh, readOnly],
  );

  if (!npcId) return null;

  const vulnMax = Number(npc.vulnerability_clock_max) ?? 0;
  const vulnCur = Number(npc.vulnerability_clock_current) ?? 0;

  const bumpVuln = async (delta) => {
    if (vulnMax <= 0) return;
    const next = Math.max(0, Math.min(vulnMax, vulnCur + delta));
    if (next === vulnCur) return;
    await patchNpc({ vulnerability_clock_current: next });
  };

  return (
    <div className="session-npc-expand-panel" style={rosterExpandPanelChrome}>
      <button
        type="button"
        className="session-expand-close"
        aria-label="Close NPC panel"
        title="Close"
        onClick={onClose}
      >
        ×
      </button>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
          paddingRight: 32,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: "bold", fontSize: 13 }}>
            {npc.name || `NPC ${npc.id}`}
          </div>
          {npc.stand_name ? (
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              「{npc.stand_name}」
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {typeof onNavigateToNPC === "function" ? (
            <a
              href={buildRouteHref("npcs", { npcId: npc.id })}
              onClick={(e) =>
                handleSpaNavClick(e, () => onNavigateToNPC(npc.id))
              }
              style={{
                ...S.btnGhost,
                fontSize: 10,
                textDecoration: "none",
              }}
            >
              Open sheet
            </a>
          ) : null}
          {onLeaveFaction ? (
            <button
              type="button"
              style={{ ...S.btnGhost, fontSize: 10 }}
              onClick={onLeaveFaction}
              disabled={busy}
            >
              Leave faction
            </button>
          ) : null}
          {typeof onRemoveFromCampaign === "function" ? (
            <button
              type="button"
              style={{
                ...S.btn,
                fontSize: 10,
                background: "#7f1d1d",
                color: "#fca5a5",
              }}
              onClick={onRemoveFromCampaign}
              disabled={busy}
            >
              Remove from campaign
            </button>
          ) : null}
        </div>
      </div>

      <NestedTabBar
        tabs={NPC_NESTED_TABS}
        active={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === "info" ||
      activeTab === "abilities" ||
      activeTab === "items" ? (
        <>
        <RosterNpcExpandEditableTabs
          activeTab={activeTab}
          npc={npc}
          S={S}
          busy={busy || readOnly}
          equipmentCatalog={equipmentCatalog}
          onPatch={readOnly ? undefined : patchNpc}
        />
          {activeTab === "info" && !readOnly ? (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 10,
                fontSize: 11,
              }}
            >
              <input
                type="checkbox"
                checked={npc.visible_to_players !== false}
                disabled={busy}
                onChange={(e) =>
                  patchNpc({ visible_to_players: e.target.checked })
                }
              />
              Visible to players
            </label>
          ) : null}
          {activeTab === "info" &&
          typeof onMoveNpcToFaction === "function" &&
          !readOnly ? (
            <div style={{ marginTop: 10 }}>
              <div style={lbl}>Faction (campaign)</div>
              <select
                value={factionSelectValue}
                onChange={(e) => {
                  const v = e.target.value;
                  const nextId = v === "" ? null : parseInt(v, 10);
                  if (v !== "" && !Number.isFinite(nextId)) return;
                  if (v === factionSelectValue) return;
                  onMoveNpcToFaction(npc.id, nextId);
                }}
                style={{ ...S.select, width: "100%", fontSize: 11, marginTop: 4 }}
                disabled={busy}
              >
                <option value="">— None —</option>
                {factions.map((f) => (
                  <option key={f.id} value={String(f.id)}>
                    {f.name || `Faction ${f.id}`}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </>
      ) : null}

      {activeTab === "clocks" ? (
        <div>
          <div style={lbl}>Clocks</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 8,
              fontSize: 11,
            }}
          >
            <span style={{ fontWeight: 600, color: "#9ca3af" }}>
              Vulnerability
            </span>
            {vulnMax <= 0 ? (
              <span style={{ color: "#6b7280" }}>— (n/a)</span>
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
                  disabled={busy || readOnly || vulnCur <= 0}
                  onClick={() => bumpVuln(-1)}
                >
                  −
                </button>
                <span
                  style={{
                    color: "#e5e7eb",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {vulnCur}/{vulnMax}
                </span>
                <button
                  type="button"
                  style={{ ...S.btnGhost, fontSize: 9, padding: "1px 6px" }}
                  disabled={busy || readOnly || vulnCur >= vulnMax}
                  onClick={() => bumpVuln(1)}
                >
                  +
                </button>
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: "#6b7280" }}>
            Session progress clocks live on a live session roster.
          </div>
        </div>
      ) : null}

      {activeTab === "more" ? (
        <div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ ...lbl, marginBottom: 4 }}>Playbook</div>
            <select
              value={npc.playbook || "STAND"}
              onChange={(e) => {
                const next = e.target.value;
                if (next === (npc.playbook || "STAND")) return;
                void patchNpc({ playbook: next });
              }}
              disabled={busy || readOnly}
              style={{ ...S.select, width: "100%", fontSize: 11 }}
            >
              {NPC_PLAYBOOK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ ...lbl, marginBottom: 6 }}>Stand coin</div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <NpcsStandCoin
              grades={grades}
              readouts={readoutsFromGrades(grades)}
              onStep={(k, d) => {
                if (busy) return;
                void handleStandStep(k, d);
              }}
              readOnly={busy || readOnly}
              variant="npc"
              hideIdleHint
            />
          </div>
          {busy ? (
            <div style={{ fontSize: 10, color: "#a78bfa", marginBottom: 8 }}>
              Saving…
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

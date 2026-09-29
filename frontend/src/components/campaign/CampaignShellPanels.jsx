import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  experienceTrackerAPI,
  normalizeListResponse,
  rollAPI,
  sessionAPI,
} from "../../features/character-sheet/services/api";
import {
  SESSION_SHELL_TABS,
  SessionShellTabBar,
} from "../session/sessionShellUi";
import CampaignHarmArmorGrid from "./CampaignHarmArmorGrid";

const lbl = { fontSize: 10, color: "#9ca3af", textTransform: "uppercase" };

function campaignActiveSessionId(campaign) {
  const a = campaign?.active_session;
  if (a == null || a === "") return null;
  if (typeof a === "object") return a.id != null ? Number(a.id) : null;
  const n = Number(a);
  return Number.isFinite(n) ? n : null;
}

function formatRollLine(r) {
  const rt = String(r.roll_type || "").toUpperCase();
  const diceStr = [].concat(r.results || []).join(", ");
  const outcomeStr = String(r.outcome || "").trim();
  const actor =
    String(r.rolled_by_username || "").trim() ||
    String(r.character_name || "").trim() ||
    String(r.character ?? "") ||
    "—";
  if (rt === "FORTUNE") {
    const mid = String(r.fortune_public_label || r.goal_label || "").trim();
    return `${actor} · Fortune${mid ? ` · ${mid}` : ""} · ${diceStr} → ${outcomeStr}`;
  }
  const action = String(r.action_name || "").trim() || "Roll";
  return `${actor} · ${action} · ${diceStr} → ${outcomeStr}`;
}

function formatXpLine(row) {
  const who =
    row.character_name ||
    row.character?.true_name ||
    row.character?.name ||
    (row.character != null ? `PC ${row.character}` : "—");
  const trig = String(row.trigger || row.source || row.kind || "XP").trim();
  const amt = row.amount != null ? `+${row.amount}` : "+1";
  const sess =
    row.session_name ||
    (row.session != null ? `Session ${row.session}` : "");
  return `${who} · ${trig} ${amt}${sess ? ` · ${sess}` : ""}`;
}

/**
 * Campaign-page shell: same tabs as session (Rosters / XP / Harm / Rolls / Rep).
 * Ledger tabs support per-session or all-sessions record scope. No scorecard.
 */
export default function CampaignShellPanels({
  campaign,
  S,
  characters = [],
  children,
  onOpenSession,
  onCharactersRefresh,
  isGM = false,
}) {
  const [shellTab, setShellTab] = useState("rosters");
  const [rosterShowNpc, setRosterShowNpc] = useState(true);
  const [rosterShowPc, setRosterShowPc] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [scope, setScope] = useState("active"); // active | all | <sessionId>
  const [rolls, setRolls] = useState([]);
  const [xpRows, setXpRows] = useState([]);
  const [ledgerBusy, setLedgerBusy] = useState(false);
  const [ledgerError, setLedgerError] = useState(null);
  const [harmError, setHarmError] = useState(null);

  const activeId = campaignActiveSessionId(campaign);

  useEffect(() => {
    if (!campaign?.id) return undefined;
    let cancelled = false;
    sessionAPI
      .getSessions(campaign.id)
      .then((list) => {
        if (!cancelled) setSessions(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [campaign?.id, campaign?.active_session]);

  useEffect(() => {
    if (scope === "active" && activeId == null) {
      setScope("all");
    }
  }, [scope, activeId]);

  const resolvedSessionId = useMemo(() => {
    if (scope === "all") return null;
    if (scope === "active") return activeId;
    const n = Number(scope);
    return Number.isFinite(n) ? n : null;
  }, [scope, activeId]);

  const loadLedgers = useCallback(async () => {
    if (!campaign?.id) return;
    if (shellTab !== "rolls" && shellTab !== "xp") return;
    setLedgerBusy(true);
    setLedgerError(null);
    try {
      if (shellTab === "rolls") {
        const params =
          resolvedSessionId != null
            ? { session: resolvedSessionId }
            : { campaign: campaign.id };
        const data = await rollAPI.getRolls(params);
        setRolls(normalizeListResponse(data));
      } else if (shellTab === "xp") {
        const chars = (characters || []).filter((c) => c?.id != null);
        const lists = await Promise.all(
          chars.map((c) =>
            experienceTrackerAPI
              .list({ character: c.id })
              .then((data) => {
                const rows = normalizeListResponse(data);
                return rows.map((r) => ({
                  ...r,
                  character_name:
                    r.character_name ||
                    c.true_name ||
                    c.name ||
                    `PC ${c.id}`,
                }));
              })
              .catch(() => []),
          ),
        );
        let flat = lists.flat();
        if (resolvedSessionId != null) {
          flat = flat.filter(
            (r) => Number(r.session) === Number(resolvedSessionId),
          );
        }
        flat.sort((a, b) => {
          const ta = new Date(a.created_at || a.timestamp || 0).getTime();
          const tb = new Date(b.created_at || b.timestamp || 0).getTime();
          return tb - ta;
        });
        setXpRows(flat);
      }
    } catch (e) {
      setLedgerError(e?.message || "Could not load records.");
      setRolls([]);
      setXpRows([]);
    } finally {
      setLedgerBusy(false);
    }
  }, [campaign?.id, characters, resolvedSessionId, shellTab]);

  useEffect(() => {
    void loadLedgers();
  }, [loadLedgers]);

  const scopeSelect = (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
        marginBottom: 12,
      }}
    >
      <span style={lbl}>Records for</span>
      <select
        style={{ ...S.select, fontSize: 11, maxWidth: 280 }}
        value={
          scope === "active" && activeId == null
            ? "all"
            : scope === "active"
              ? "active"
              : scope === "all"
                ? "all"
                : String(scope)
        }
        onChange={(e) => setScope(e.target.value)}
      >
        {activeId != null ? (
          <option value="active">Active session</option>
        ) : null}
        <option value="all">All sessions</option>
        {(sessions || []).map((s) => (
          <option key={s.id} value={String(s.id)}>
            {s.name || `Session ${s.id}`}
            {Number(s.id) === Number(activeId) ? " (active)" : ""}
          </option>
        ))}
      </select>
      {resolvedSessionId != null && typeof onOpenSession === "function" ? (
        <button
          type="button"
          style={{ ...S.btnGhost, fontSize: 10 }}
          onClick={() => {
            const s =
              (sessions || []).find(
                (x) => Number(x.id) === Number(resolvedSessionId),
              ) || { id: resolvedSessionId };
            onOpenSession(s);
          }}
        >
          Open session
        </button>
      ) : null}
    </div>
  );

  const repRows = useMemo(() => {
    return (characters || []).map((full) => {
      const name = full.true_name || full.name || `PC ${full.id}`;
      const crewId = full.crew ?? full.crew_id;
      const crews = campaign?.crews || [];
      const crew = crews.find((c) => Number(c.id) === Number(crewId));
      const rels = Array.isArray(crew?.faction_relationships)
        ? crew.faction_relationships
            .map(
              (r) =>
                `${r.faction_name || r.faction_id}: ${r.reputation_value}`,
            )
            .join(" · ")
        : "";
      return {
        id: full.id,
        name,
        body: rels || (crew ? `Crew: ${crew.name || crew.id}` : "—"),
      };
    });
  }, [characters, campaign?.crews]);

  const rosterChildren =
    typeof children === "function"
      ? children({ showNpc: rosterShowNpc, showPc: rosterShowPc })
      : children;

  return (
    <>
      <SessionShellTabBar
        tabs={SESSION_SHELL_TABS}
        active={shellTab}
        onChange={setShellTab}
        leading={
          shellTab === "rosters" ? (
            <>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>Show</span>
              <button
                type="button"
                aria-pressed={rosterShowNpc}
                onClick={() => {
                  if (rosterShowNpc && !rosterShowPc) return;
                  setRosterShowNpc((v) => !v);
                }}
                style={{
                  ...S.btnGhost,
                  fontSize: 11,
                  fontWeight: 600,
                  background: rosterShowNpc ? "#4338ca" : "transparent",
                  color: rosterShowNpc ? "#fff" : "#9ca3af",
                  borderColor: rosterShowNpc ? "#4338ca" : "#374151",
                }}
              >
                NPC
              </button>
              <button
                type="button"
                aria-pressed={rosterShowPc}
                onClick={() => {
                  if (rosterShowPc && !rosterShowNpc) return;
                  setRosterShowPc((v) => !v);
                }}
                style={{
                  ...S.btnGhost,
                  fontSize: 11,
                  fontWeight: 600,
                  background: rosterShowPc ? "#4338ca" : "transparent",
                  color: rosterShowPc ? "#fff" : "#9ca3af",
                  borderColor: rosterShowPc ? "#4338ca" : "#374151",
                }}
              >
                PC
              </button>
            </>
          ) : null
        }
      />

      {shellTab === "rosters" ? rosterChildren : null}

      {shellTab === "rolls" ? (
        <div style={S.card}>
          <span style={S.sectionLbl}>Rolls</span>
          <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 10px" }}>
            Dice history for the selected session scope. Open a session for live
            PE defaults and manual rolls.
          </p>
          {scopeSelect}
          {ledgerError ? <div style={S.err}>{ledgerError}</div> : null}
          {ledgerBusy ? (
            <div style={{ fontSize: 12, color: "#6b7280" }}>Loading…</div>
          ) : (
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "grid",
                gap: 6,
                maxHeight: 420,
                overflowY: "auto",
              }}
            >
              {rolls.length === 0 ? (
                <li style={{ color: "#6b7280", fontSize: 12 }}>No rolls.</li>
              ) : (
                rolls.map((r) => (
                  <li
                    key={r.id}
                    style={{
                      border: "1px solid #374151",
                      borderRadius: 6,
                      padding: "8px 10px",
                      background: "#0b1220",
                      fontSize: 11,
                      color: "#d1d5db",
                    }}
                  >
                    {formatRollLine(r)}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      ) : null}

      {shellTab === "xp" ? (
        <div style={S.card}>
          <span style={S.sectionLbl}>XP</span>
          <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 10px" }}>
            Tracked XP awards for the selected scope. End-session scorecard stays
            on the session view.
          </p>
          {scopeSelect}
          {ledgerError ? <div style={S.err}>{ledgerError}</div> : null}
          {ledgerBusy ? (
            <div style={{ fontSize: 12, color: "#6b7280" }}>Loading…</div>
          ) : (
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "grid",
                gap: 6,
                maxHeight: 420,
                overflowY: "auto",
              }}
            >
              {xpRows.length === 0 ? (
                <li style={{ color: "#6b7280", fontSize: 12 }}>No XP rows.</li>
              ) : (
                xpRows.map((r) => (
                  <li
                    key={r.id}
                    style={{
                      border: "1px solid #374151",
                      borderRadius: 6,
                      padding: "8px 10px",
                      background: "#0b1220",
                      fontSize: 11,
                      color: "#d1d5db",
                    }}
                  >
                    {formatXpLine(r)}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      ) : null}

      {shellTab === "harm" ? (
        <div style={S.card}>
          <span style={S.sectionLbl}>Harm / Armor</span>
          <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 10px" }}>
            Live compact harm tables for campaign PCs (grid). Edits save to the
            character sheet.
          </p>
          {harmError ? <div style={S.err}>{harmError}</div> : null}
          <CampaignHarmArmorGrid
            characters={characters}
            S={S}
            readOnly={!isGM}
            onRefresh={onCharactersRefresh}
            onError={setHarmError}
          />
        </div>
      ) : null}

      {shellTab === "rep" ? (
        <div style={S.card}>
          <span style={S.sectionLbl}>Reputation</span>
          <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 10px" }}>
            Crew faction standing from current sheets (not session-scoped).
          </p>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "grid",
              gap: 8,
            }}
          >
            {repRows.length === 0 ? (
              <li style={{ color: "#6b7280", fontSize: 12 }}>No PCs.</li>
            ) : (
              repRows.map((r) => (
                <li
                  key={r.id}
                  style={{
                    border: "1px solid #374151",
                    borderRadius: 6,
                    padding: "8px 10px",
                    background: "#0b1220",
                    fontSize: 11,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{r.name}</div>
                  <div style={{ color: "#9ca3af", lineHeight: 1.4 }}>{r.body}</div>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </>
  );
}

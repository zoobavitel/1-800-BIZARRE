import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  experienceTrackerAPI,
  normalizeListResponse,
  resolveMediaUrl,
  rollAPI,
  sessionAPI,
} from "../../features/character-sheet/services/api";
import {
  SESSION_SHELL_TABS,
  SessionShellTabBar,
} from "../session/sessionShellUi";
import HomeCardThumb from "../home/HomeCardThumb";
import { getCharacterPortraitSrc } from "../../utils/homeAvatar";
import CampaignHarmArmorGrid from "./CampaignHarmArmorGrid";

const lbl = { fontSize: 10, color: "#9ca3af", textTransform: "uppercase" };

const PC_COLUMN_GRID = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 12,
  alignItems: "start",
  maxHeight: 420,
  overflowY: "auto",
};

const PC_COLUMN_CARD = {
  border: "1px solid #374151",
  borderRadius: 6,
  padding: "8px 10px",
  background: "#0b1220",
  fontSize: 11,
  color: "#d1d5db",
  minWidth: 0,
};

function campaignActiveSessionId(campaign) {
  const a = campaign?.active_session;
  if (a == null || a === "") return null;
  if (typeof a === "object") return a.id != null ? Number(a.id) : null;
  const n = Number(a);
  return Number.isFinite(n) ? n : null;
}

function pcDisplayName(ch) {
  return ch?.true_name || ch?.name || ch?.alias || `PC ${ch?.id ?? "?"}`;
}

function sortPcsByName(characters) {
  return [...(characters || [])].sort((a, b) =>
    String(pcDisplayName(a)).localeCompare(String(pcDisplayName(b)), undefined, {
      sensitivity: "base",
    }),
  );
}

function characterIdFromRoll(r) {
  if (r?.character != null && typeof r.character === "object") {
    const n = Number(r.character.id);
    return Number.isFinite(n) ? n : null;
  }
  if (r?.character != null && r.character !== "") {
    const n = Number(r.character);
    return Number.isFinite(n) ? n : null;
  }
  if (r?.character_id != null) {
    const n = Number(r.character_id);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function characterIdFromXp(row) {
  if (row?.character != null && typeof row.character === "object") {
    const n = Number(row.character.id);
    return Number.isFinite(n) ? n : null;
  }
  if (row?.character != null && row.character !== "") {
    const n = Number(row.character);
    return Number.isFinite(n) ? n : null;
  }
  if (row?.character_id != null) {
    const n = Number(row.character_id);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Roll line without leading actor (used inside a PC column). */
function formatRollLineBody(r) {
  const rt = String(r.roll_type || "").toUpperCase();
  const diceStr = [].concat(r.results || []).join(", ");
  const outcomeStr = String(r.outcome || "").trim();
  if (rt === "FORTUNE") {
    const mid = String(r.fortune_public_label || r.goal_label || "").trim();
    return `Fortune${mid ? ` · ${mid}` : ""} · ${diceStr} → ${outcomeStr}`;
  }
  const action = String(r.action_name || "").trim() || "Roll";
  return `${action} · ${diceStr} → ${outcomeStr}`;
}

/** XP line without leading character name. */
function formatXpLineBody(row) {
  const trig = String(row.trigger || row.source || row.kind || "XP").trim();
  const amt = row.amount != null ? `+${row.amount}` : "+1";
  const sess =
    row.session_name ||
    (row.session != null ? `Session ${row.session}` : "");
  return `${trig} ${amt}${sess ? ` · ${sess}` : ""}`;
}

function formatSignedRep(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  if (n > 0) return `+${n}`;
  return String(n);
}

function factionThumbSrc(facOrRel) {
  if (!facOrRel || typeof facOrRel !== "object") return null;
  const fromUpload = resolveMediaUrl(
    facOrRel.faction_image || facOrRel.image || "",
  );
  if (fromUpload) return fromUpload;
  const url = String(
    facOrRel.faction_image_url ?? facOrRel.image_url ?? "",
  ).trim();
  return url || null;
}

function PcColumnCard({ title, children }) {
  return (
    <div style={PC_COLUMN_CARD}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: "#f3f4f6" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function StandingRow({ thumbSrc, label, value }) {
  const signed = formatSignedRep(value);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 6,
        minWidth: 0,
      }}
    >
      <HomeCardThumb
        src={thumbSrc}
        label={label}
        style={{
          width: 28,
          height: 28,
          borderRadius: 4,
          overflow: "hidden",
          flexShrink: 0,
          background: "#111827",
          border: "1px solid #374151",
          fontSize: 12,
        }}
      />
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>
        <div
          style={{
            color: "#d1d5db",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      </div>
      <div
        style={{
          flexShrink: 0,
          color: "#9ca3af",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {signed != null ? signed : "—"}
      </div>
    </div>
  );
}

/**
 * Campaign-page shell: same tabs as session (Rosters / XP / Harm / Rolls / Rep).
 * Ledger tabs support per-session or all-sessions record scope. No scorecard.
 */
export default function CampaignShellPanels({
  campaign,
  S,
  characters = [],
  npcs = [],
  children,
  onOpenSession,
  onCharactersRefresh,
  isGM = false,
  userId = null,
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
  const sortedPcs = useMemo(() => sortPcsByName(characters), [characters]);

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
                  character_id: r.character_id ?? c.id,
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

  const rollsByPc = useMemo(() => {
    const map = new Map();
    for (const ch of sortedPcs) {
      map.set(Number(ch.id), []);
    }
    const other = [];
    for (const r of rolls || []) {
      const cid = characterIdFromRoll(r);
      if (cid != null && map.has(cid)) {
        map.get(cid).push(r);
      } else {
        other.push(r);
      }
    }
    return { map, other };
  }, [rolls, sortedPcs]);

  const xpByPc = useMemo(() => {
    const map = new Map();
    for (const ch of sortedPcs) {
      map.set(Number(ch.id), []);
    }
    for (const row of xpRows || []) {
      const cid = characterIdFromXp(row);
      if (cid != null && map.has(cid)) {
        map.get(cid).push(row);
      }
    }
    return map;
  }, [xpRows, sortedPcs]);

  const factionByName = useMemo(() => {
    const m = new Map();
    for (const f of campaign?.factions || []) {
      const key = String(f?.name || "")
        .trim()
        .toLowerCase();
      if (key) m.set(key, f);
    }
    return m;
  }, [campaign?.factions]);

  const npcByName = useMemo(() => {
    const m = new Map();
    for (const n of npcs || []) {
      const key = String(n?.name || "")
        .trim()
        .toLowerCase();
      if (key) m.set(key, n);
    }
    return m;
  }, [npcs]);

  const repColumns = useMemo(() => {
    const crews = campaign?.crews || [];
    return sortedPcs.map((full) => {
      const name = pcDisplayName(full);
      const crewId = full.crew ?? full.crew_id;
      const crew = crews.find((c) => Number(c.id) === Number(crewId));
      const standing = [];

      const rels = Array.isArray(crew?.faction_relationships)
        ? crew.faction_relationships
        : [];
      for (const rel of rels) {
        if (rel.reputation_value == null && !isGM) continue;
        standing.push({
          key: `crew-fac-${rel.id ?? rel.faction_id}`,
          kind: "faction",
          label: rel.faction_name || `Faction ${rel.faction_id}`,
          value: rel.reputation_value,
          thumbSrc: factionThumbSrc(rel),
        });
      }

      const status =
        full.reputation_status && typeof full.reputation_status === "object"
          ? full.reputation_status
          : {};
      for (const [rawName, rawVal] of Object.entries(status)) {
        const label = String(rawName || "").trim();
        if (!label) continue;
        const key = label.toLowerCase();
        const fac = factionByName.get(key);
        const npc = !fac ? npcByName.get(key) : null;
        standing.push({
          key: `status-${key}`,
          kind: fac ? "faction" : npc ? "npc" : "other",
          label,
          value: rawVal,
          thumbSrc: fac
            ? factionThumbSrc(fac)
            : npc
              ? getCharacterPortraitSrc(npc)
              : null,
        });
      }

      return { id: full.id, name, standing };
    });
  }, [sortedPcs, campaign?.crews, factionByName, npcByName, isGM]);

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
          ) : sortedPcs.length === 0 && rollsByPc.other.length === 0 ? (
            <div style={{ fontSize: 12, color: "#6b7280" }}>No rolls.</div>
          ) : (
            <div style={PC_COLUMN_GRID}>
              {sortedPcs.map((ch) => {
                const rows = rollsByPc.map.get(Number(ch.id)) || [];
                return (
                  <PcColumnCard key={ch.id} title={pcDisplayName(ch)}>
                    {rows.length === 0 ? (
                      <div style={{ color: "#6b7280" }}>No rolls.</div>
                    ) : (
                      rows.map((r) => (
                        <div
                          key={r.id}
                          style={{
                            marginBottom: 4,
                            lineHeight: 1.4,
                            color: "#d1d5db",
                          }}
                        >
                          {formatRollLineBody(r)}
                        </div>
                      ))
                    )}
                  </PcColumnCard>
                );
              })}
              {rollsByPc.other.length > 0 ? (
                <PcColumnCard title="Other">
                  {rollsByPc.other.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        marginBottom: 4,
                        lineHeight: 1.4,
                        color: "#d1d5db",
                      }}
                    >
                      {formatRollLineBody(r)}
                    </div>
                  ))}
                </PcColumnCard>
              ) : null}
            </div>
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
          ) : sortedPcs.length === 0 ? (
            <div style={{ fontSize: 12, color: "#6b7280" }}>No XP rows.</div>
          ) : (
            <div style={PC_COLUMN_GRID}>
              {sortedPcs.map((ch) => {
                const rows = xpByPc.get(Number(ch.id)) || [];
                return (
                  <PcColumnCard key={ch.id} title={pcDisplayName(ch)}>
                    {rows.length === 0 ? (
                      <div style={{ color: "#6b7280" }}>No XP.</div>
                    ) : (
                      rows.map((r) => (
                        <div
                          key={r.id}
                          style={{
                            marginBottom: 4,
                            lineHeight: 1.4,
                            color: "#d1d5db",
                          }}
                        >
                          {formatXpLineBody(r)}
                        </div>
                      ))
                    )}
                  </PcColumnCard>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {shellTab === "harm" ? (
        <div style={S.card}>
          <span style={S.sectionLbl}>Harm / Armor</span>
          <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 10px" }}>
            Live compact harm tables for campaign PCs (grid).{" "}
            {isGM
              ? "Edits save to the character sheet."
              : "You can edit your own PC; others are view-only. Edits save to the character sheet."}
          </p>
          {harmError ? <div style={S.err}>{harmError}</div> : null}
          <CampaignHarmArmorGrid
            characters={characters}
            S={S}
            isGM={isGM}
            userId={userId}
            onRefresh={onCharactersRefresh}
            onError={setHarmError}
          />
        </div>
      ) : null}

      {shellTab === "rep" ? (
        <div style={S.card}>
          <span style={S.sectionLbl}>Reputation</span>
          <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 10px" }}>
            Crew faction and personal standing from current sheets (not
            session-scoped).
          </p>
          {repColumns.length === 0 ? (
            <div style={{ fontSize: 12, color: "#6b7280" }}>No PCs.</div>
          ) : (
            <div style={{ ...PC_COLUMN_GRID, maxHeight: undefined }}>
              {repColumns.map((col) => (
                <PcColumnCard key={col.id} title={col.name}>
                  {col.standing.length === 0 ? (
                    <div style={{ color: "#6b7280" }}>—</div>
                  ) : (
                    col.standing.map((row) => (
                      <StandingRow
                        key={row.key}
                        thumbSrc={row.thumbSrc}
                        label={row.label}
                        value={row.value}
                      />
                    ))
                  )}
                </PcColumnCard>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

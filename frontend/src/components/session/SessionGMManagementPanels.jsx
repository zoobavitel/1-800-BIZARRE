import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  sessionAPI,
  resolveMediaUrl,
  npcAPI,
  characterAPI,
  crewAPI,
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
        show_harm_clock_to_players: false,
        show_stand_coin_to_players: false,
        show_all_abilities_to_players: false,
      },
    ];
    return patchSessionInv(next);
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

  const peMap = sessionData?.position_effect_by_character || {};
  const defaultPos = sessionData?.default_position || "risky";
  const defaultEff = sessionData?.default_effect || "standard";
  const goalMap = useMemo(
    () => sessionData?.roll_goal_by_character || {},
    [sessionData?.roll_goal_by_character],
  );

  const sessionRolls = rolls;

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

  useEffect(() => {
    if (!goalAssignCharId) return;
    const v =
      goalMap[String(goalAssignCharId)] ?? goalMap[goalAssignCharId] ?? "";
    setGoalAssignDraft(String(v || ""));
  }, [goalAssignCharId, goalMap]);

  const handleNpcStandStep = (npc, key, delta) => {
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
    return (
      <div key={npc.id} style={card}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <img
            src={resolveMediaUrl(npc.image || npc.image_url) || "data:,"}
            alt=""
            style={{
              width: 48,
              height: 48,
              objectFit: "cover",
              borderRadius: 4,
              border: "1px solid #374151",
              background: "#111",
            }}
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
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
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <NpcsStandCoin
            grades={grades}
            readouts={readoutsFromGrades(grades)}
            onStep={(k, d) => handleNpcStandStep(npc, k, d)}
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
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="checkbox"
            checked={!!inv.show_harm_clock_to_players}
            onChange={() =>
              updateInv(npc.id, {
                show_harm_clock_to_players: !inv.show_harm_clock_to_players,
              })
            }
            disabled={saving}
          />
          <span>Harm clock</span>
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
          Harm {npc.harm_clock_current ?? 0}/{npc.harm_clock_max ?? 0} · Vuln{" "}
          {npc.vulnerability_clock_current ?? 0}/
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
          Use + to add from the campaign roster. Toggle what players can see;
          quick-edit Stand coin.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 10 }}>
          {sessionFactionNpcGroups.factionPairs.map(([fid, npcList]) => {
            const fac =
              factionsById[fid] ||
              factionsById[String(fid)] ||
              {};
            const name = fac.name || `Faction ${fid}`;
            const metaBits = [];
            if (fac.faction_type) metaBits.push(String(fac.faction_type));
            if (fac.level != null && fac.level !== "") metaBits.push(`Lvl ${fac.level}`);
            if (fac.hold != null && fac.hold !== "") metaBits.push(`Hold ${fac.hold}`);
            if (fac.reputation != null && fac.reputation !== "") {
              metaBits.push(`Rep ${fac.reputation}`);
            }
            const notesPreview = String(fac.notes || "").trim();
            const notesShort =
              notesPreview.length > 160
                ? `${notesPreview.slice(0, 160)}…`
                : notesPreview;
            return (
              <div key={`faction-${fid}`} style={factionGroupWrap}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: "bold", fontSize: 13, color: "#a78bfa" }}>
                    {name}
                  </div>
                  {metaBits.length > 0 && (
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>
                      {metaBits.join(" · ")}
                    </div>
                  )}
                  {notesShort ? (
                    <div style={{ fontSize: 10, color: "#6b7280", marginTop: 6, lineHeight: 1.4 }}>
                      {notesShort}
                    </div>
                  ) : null}
                </div>
                <div style={grid}>{npcList.map((npc) => renderNpcSessionCard(npc))}</div>
              </div>
            );
          })}

          {sessionFactionNpcGroups.ungrouped.length > 0 && (
            <div style={factionGroupWrap}>
              <div style={{ ...lbl, marginBottom: 8 }}>No faction</div>
              <div style={grid}>
                {sessionFactionNpcGroups.ungrouped.map((npc) => renderNpcSessionCard(npc))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "stretch" }}>
            <button
              type="button"
              onClick={() => setShowAddNpc(true)}
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
            const full = (characters || []).find((c) => c.id === ch.id) || ch;
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
                <div style={{ display: "flex", gap: 8 }}>
                  <img
                    src={resolveMediaUrl(full.image || full.image_url) || "data:,"}
                    alt=""
                    style={{
                      width: 48,
                      height: 48,
                      objectFit: "cover",
                      borderRadius: 4,
                      background: "#111",
                    }}
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                  <div>
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
          <span
            style={{
              fontSize: "11px",
              color: "#a78bfa",
              fontWeight: "bold",
              display: "block",
              marginBottom: "8px",
            }}
          >
            Manual dice roll (offline)
          </span>
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
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {campaignChars.map((ch) => {
            const id = ch.id;
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
                    <div style={lbl}>Recent rolls</div>
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
                      {(sessionRolls || [])
                        .filter(
                          (r) =>
                            String(r.character) === String(id) &&
                            String((r.roll_type || "").toUpperCase()) === "ACTION" &&
                            String((r.action_name || "").toUpperCase()) !== "FORTUNE",
                        )
                        .slice(0, 5).length === 0 ? (
                        <div>—</div>
                      ) : (
                        (sessionRolls || [])
                          .filter(
                            (r) =>
                              String(r.character) === String(id) &&
                              String((r.roll_type || "").toUpperCase()) === "ACTION" &&
                              String((r.action_name || "").toUpperCase()) !== "FORTUNE",
                          )
                          .slice(0, 5)
                          .map((r) => (
                            <div key={r.id} style={{ marginBottom: 4 }}>
                              {(r.action_name || "action").toUpperCase()} ·{" "}
                              {(r.results || []).join(", ")} →{" "}
                              {(r.outcome || "").replace(/_/g, " ")}
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
                      {[
                        ["l1a", "L1A"],
                        ["l1b", "L1B"],
                        ["l2a", "L2A"],
                        ["l2b", "L2B"],
                        ["l3", "L3"],
                        ["l4", "L4"],
                      ].map(([key, label]) => (
                        <input
                          key={key}
                          value={harmDraftByChar[id]?.[key] || ""}
                          onChange={(e) =>
                            setHarmDraftByChar((prev) => ({
                              ...prev,
                              [id]: { ...(prev[id] || {}), [key]: e.target.value },
                            }))
                          }
                          onBlur={async () => {
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
                          }}
                          placeholder={label}
                          style={{
                            ...S.inp,
                            fontSize: 10,
                            padding: "4px 6px",
                            minWidth: 0,
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
    </>
  );
}

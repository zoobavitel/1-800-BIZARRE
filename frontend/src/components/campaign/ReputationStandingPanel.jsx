import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  crewAPI,
  factionAPI,
  npcAPI,
  resolveMediaUrl,
} from "../../features/character-sheet/services/api";
import useOptimisticStandingMap from "../../hooks/useOptimisticStandingMap";
import { getCharacterPortraitSrc } from "../../utils/homeAvatar";
import {
  applySymmetricFactionStatus,
  normalizeFactionStatusMap,
  patchFactionPeerVisibility,
  peerStandingVisible,
  seedFactionStatusFromCampaign,
  syncReverseFactionStatuses,
} from "../../utils/factionStatus";
import {
  clampStandingValue,
  normalizeStandingMap,
  pcDisplayName,
} from "../../utils/standingMaps";
import StandingStepperRow from "../standing/StandingStepperRow";

const sectionLbl = {
  fontSize: 10,
  color: "#facc15",
  textTransform: "uppercase",
  fontWeight: 700,
  letterSpacing: "0.04em",
};

const CARD = {
  border: "1px solid #374151",
  borderRadius: 6,
  padding: "8px 10px",
  background: "#0b1220",
  fontSize: 11,
  color: "#d1d5db",
  minWidth: 0,
};

const GRID = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: 12,
  alignItems: "start",
};

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

function sortByName(list, nameFn) {
  return [...(list || [])].sort((a, b) =>
    String(nameFn(a)).localeCompare(String(nameFn(b)), undefined, {
      sensitivity: "base",
    }),
  );
}

/**
 * Shared campaign/session shell Rep tab: crew↔faction, PC personal, faction↔faction.
 */
export default function ReputationStandingPanel({
  S,
  crews = [],
  characters = [],
  npcs = [],
  factions = [],
  isGM = false,
  onRefresh,
  cardStyle,
}) {
  const [addNpcByPc, setAddNpcByPc] = useState({});
  /** Optimistic See toggles: `${factionId}:${peerName}` → bool */
  const [seeOverrides, setSeeOverrides] = useState({});
  const [seeBusy, setSeeBusy] = useState(false);
  const npcsRef = useRef(npcs);
  const factionsRef = useRef(factions);
  npcsRef.current = npcs;
  factionsRef.current = factions;

  const outerCard = cardStyle || S?.card || {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    padding: 16,
    marginBottom: 12,
  };

  const crewList = useMemo(
    () => sortByName(crews, (c) => c.name || c.id),
    [crews],
  );
  const pcs = useMemo(
    () => sortByName(characters.filter((c) => c?.id != null), pcDisplayName),
    [characters],
  );
  const factionList = useMemo(
    () =>
      sortByName(
        (factions || []).filter((f) => f?.id != null),
        (f) => f.name || f.id,
      ),
    [factions],
  );
  const npcList = useMemo(
    () =>
      sortByName(
        (npcs || []).filter((n) => n?.id != null),
        (n) => n.name || n.stand_name || n.id,
      ),
    [npcs],
  );

  const onCommit = useCallback(
    async (key, value) => {
      const parts = String(key).split(":");
      const kind = parts[0];
      if (kind === "crew") {
        const crewId = parts[1];
        const factionId = parts[2];
        await crewAPI.patchCrew(crewId, {
          faction_relationships: [
            {
              faction_id: Number(factionId),
              reputation_value: clampStandingValue(value),
            },
          ],
        });
      } else if (kind === "npc-pc") {
        const npcId = parts[1];
        const pcId = parts[2];
        const npc =
          (npcsRef.current || []).find((n) => String(n.id) === String(npcId)) ||
          {};
        const prev = normalizeStandingMap(npc.pc_standing);
        await npcAPI.patchNPC(npcId, {
          pc_standing: {
            ...prev,
            [String(pcId)]: clampStandingValue(value),
          },
        });
      } else if (kind === "fac") {
        const selfId = parts[1];
        const otherName = parts.slice(2).join(":");
        const list = factionsRef.current || [];
        const selfFaction = list.find((f) => String(f.id) === String(selfId));
        const other = list.find(
          (f) => String(f.name || "").trim() === String(otherName || "").trim(),
        );
        if (!selfFaction?.id || !other?.id) return;
        const selfName = String(selfFaction.name || "").trim();
        const prevSelf = normalizeFactionStatusMap(selfFaction.faction_status);
        const prevOther = normalizeFactionStatusMap(other.faction_status);
        const { statusA, statusB } = applySymmetricFactionStatus(
          selfName,
          otherName,
          value,
          prevSelf,
          prevOther,
        );
        await factionAPI.patchFaction(selfFaction.id, {
          faction_status: statusA,
        });
        await syncReverseFactionStatuses({
          selfId: selfFaction.id,
          selfName,
          statusMap: statusA,
          previousStatusMap: prevSelf,
          campaignFactions: list,
          getFaction: factionAPI.getFaction,
          patchFaction: factionAPI.patchFaction,
        });
        if (
          JSON.stringify(normalizeFactionStatusMap(statusB)) !==
          JSON.stringify(prevOther)
        ) {
          await factionAPI
            .patchFaction(other.id, { faction_status: statusB })
            .catch(() => {});
        }
      } else {
        return;
      }
      await onRefresh?.();
    },
    [onRefresh],
  );

  const {
    getValue,
    setValue,
    applyDelta,
    overrides,
    saving,
    error,
    setError,
  } = useOptimisticStandingMap({ onCommit });

  const resolveSee = useCallback(
    (fac, peerName) => {
      const okey = `${fac.id}:${peerName}`;
      if (Object.prototype.hasOwnProperty.call(seeOverrides, okey)) {
        return !!seeOverrides[okey];
      }
      return peerStandingVisible(fac.faction_status_visibility, peerName);
    },
    [seeOverrides],
  );

  const toggleSee = useCallback(
    async (fac, peerName, visible) => {
      if (!isGM || !fac?.id) return;
      const okey = `${fac.id}:${peerName}`;
      setSeeOverrides((p) => ({ ...p, [okey]: !!visible }));
      setSeeBusy(true);
      setError(null);
      try {
        await patchFactionPeerVisibility({
          selfFaction: fac,
          otherName: peerName,
          visible: !!visible,
          campaignFactions: factionsRef.current,
          getFaction: factionAPI.getFaction,
          patchFaction: factionAPI.patchFaction,
        });
        await onRefresh?.();
        setSeeOverrides((p) => {
          const next = { ...p };
          delete next[okey];
          return next;
        });
      } catch (e) {
        setSeeOverrides((p) => {
          const next = { ...p };
          delete next[okey];
          return next;
        });
        setError(e?.message || "Could not update standing visibility.");
      } finally {
        setSeeBusy(false);
      }
    },
    [isGM, onRefresh, setError],
  );

  const personalRowsByPc = useMemo(() => {
    const map = new Map();
    for (const pc of pcs) {
      const rows = [];
      const pcKey = String(pc.id);
      for (const npc of npcList) {
        const standing = normalizeStandingMap(npc.pc_standing);
        const okey = `npc-pc:${npc.id}:${pc.id}`;
        const hasServer = Object.prototype.hasOwnProperty.call(standing, pcKey);
        const hasOverride = Object.prototype.hasOwnProperty.call(
          overrides,
          okey,
        );
        if (!hasServer && !hasOverride) continue;
        const serverValue = hasServer ? standing[pcKey] : 0;
        const display = getValue(okey, serverValue);
        if (!isGM && display === 0 && !hasOverride) continue;
        rows.push({ npc, serverValue });
      }
      rows.sort((a, b) =>
        String(a.npc.name || "").localeCompare(String(b.npc.name || ""), undefined, {
          sensitivity: "base",
        }),
      );
      map.set(pc.id, rows);
    }
    return map;
  }, [getValue, isGM, npcList, overrides, pcs]);

  return (
    <div style={outerCard}>
      <span style={sectionLbl}>Reputation</span>
      <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 10px" }}>
        Crew faction, personal NPC→PC standing, and faction vs faction from current
        sheets (not session-scoped).
      </p>
      {error ? (
        <div style={{ fontSize: 11, color: "#fca5a5", marginBottom: 8 }}>
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            style={{
              marginLeft: 8,
              fontSize: 10,
              background: "transparent",
              border: "none",
              color: "#9ca3af",
              cursor: "pointer",
            }}
          >
            dismiss
          </button>
        </div>
      ) : null}
      {saving ? (
        <div style={{ fontSize: 10, color: "#a78bfa", marginBottom: 8 }}>
          Saving…
        </div>
      ) : null}

      <div style={{ ...sectionLbl, color: "#9ca3af", marginBottom: 8 }}>
        Crew standing
      </div>
      {crewList.length === 0 ? (
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>No crews.</div>
      ) : (
        <div style={{ ...GRID, marginBottom: 18 }}>
          {crewList.map((crew) => {
            const rels = Array.isArray(crew.faction_relationships)
              ? crew.faction_relationships
              : [];
            const byFid = new Map(
              rels.map((r) => [Number(r.faction_id), r]),
            );
            const rows = factionList.map((f) => {
              const link = byFid.get(Number(f.id));
              return {
                faction_id: f.id,
                label: f.name || `Faction ${f.id}`,
                serverValue:
                  link?.reputation_value != null
                    ? Number(link.reputation_value)
                    : 0,
                thumbSrc: factionThumbSrc(link || f),
              };
            });
            return (
              <div key={`crew-${crew.id}`} style={CARD}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: "#f3f4f6" }}>
                  {crew.name || `Crew ${crew.id}`}
                </div>
                {rows.length === 0 ? (
                  <div style={{ color: "#6b7280" }}>—</div>
                ) : (
                  rows.map((row) => {
                    const key = `crew:${crew.id}:${row.faction_id}`;
                    return (
                      <StandingStepperRow
                        key={key}
                        thumbSrc={row.thumbSrc}
                        label={row.label}
                        value={getValue(key, row.serverValue)}
                        editable={isGM}
                        onDelta={(d) => applyDelta(key, row.serverValue, d)}
                      />
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ ...sectionLbl, color: "#9ca3af", marginBottom: 8 }}>
        Personal standing
      </div>
      {pcs.length === 0 ? (
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>No PCs.</div>
      ) : (
        <div style={{ ...GRID, marginBottom: 18 }}>
          {pcs.map((pc) => {
            const rows = personalRowsByPc.get(pc.id) || [];
            const listedIds = new Set(rows.map((r) => Number(r.npc.id)));
            const addable = npcList.filter((n) => !listedIds.has(Number(n.id)));
            const addVal = addNpcByPc[pc.id] || "";
            return (
              <div key={`pc-${pc.id}`} style={CARD}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: "#f3f4f6" }}>
                  {pcDisplayName(pc)}
                </div>
                {rows.length === 0 ? (
                  <div style={{ color: "#6b7280", marginBottom: 6 }}>—</div>
                ) : (
                  rows.map(({ npc, serverValue }) => {
                    const key = `npc-pc:${npc.id}:${pc.id}`;
                    return (
                      <StandingStepperRow
                        key={key}
                        thumbSrc={getCharacterPortraitSrc(npc)}
                        label={npc.name || npc.stand_name || `NPC ${npc.id}`}
                        value={getValue(key, serverValue)}
                        editable={isGM}
                        onDelta={(d) => applyDelta(key, serverValue, d)}
                      />
                    );
                  })
                )}
                {isGM && addable.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      marginTop: 6,
                      alignItems: "center",
                    }}
                  >
                    <select
                      value={addVal}
                      onChange={(e) =>
                        setAddNpcByPc((p) => ({
                          ...p,
                          [pc.id]: e.target.value,
                        }))
                      }
                      style={{
                        flex: 1,
                        fontSize: 11,
                        background: "#0d1117",
                        color: "#e5e7eb",
                        border: "1px solid #374151",
                        borderRadius: 4,
                        padding: "2px 4px",
                        minWidth: 0,
                      }}
                    >
                      <option value="">Add NPC standing…</option>
                      {addable.map((n) => (
                        <option key={n.id} value={String(n.id)}>
                          {n.name || n.stand_name || `NPC ${n.id}`}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!addVal}
                      onClick={() => {
                        const npc = npcList.find(
                          (n) => String(n.id) === String(addVal),
                        );
                        if (!npc) return;
                        setValue(`npc-pc:${npc.id}:${pc.id}`, 0);
                        setAddNpcByPc((p) => ({ ...p, [pc.id]: "" }));
                      }}
                      style={{
                        fontSize: 10,
                        padding: "3px 8px",
                        background: "#4338ca",
                        color: "#fff",
                        border: "none",
                        borderRadius: 4,
                        cursor: addVal ? "pointer" : "default",
                        opacity: addVal ? 1 : 0.5,
                        fontFamily: "inherit",
                      }}
                    >
                      Add
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ ...sectionLbl, color: "#9ca3af", marginBottom: 8 }}>
        Faction vs faction
      </div>
      {factionList.length === 0 ? (
        <div style={{ fontSize: 12, color: "#6b7280" }}>No factions.</div>
      ) : (
        <div style={GRID}>
          {factionList.map((fac) => {
            const { next } = seedFactionStatusFromCampaign(
              fac.faction_status,
              factionList,
              fac.id,
            );
            const rows = Object.entries(next)
              .map(([name, value]) => ({
                name,
                serverValue: clampStandingValue(value),
              }))
              .sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
              );
            if (!isGM && fac.visible_to_players === false) return null;
            return (
              <div key={`fac-${fac.id}`} style={CARD}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: "#f3f4f6" }}>
                  {fac.name || `Faction ${fac.id}`}
                </div>
                {rows.length === 0 ? (
                  <div style={{ color: "#6b7280" }}>—</div>
                ) : (
                  rows.map((row) => {
                    const peer = factionList.find(
                      (f) => String(f.name || "").trim() === row.name,
                    );
                    const key = `fac:${fac.id}:${row.name}`;
                    const see = resolveSee(fac, row.name);
                    if (!isGM && !see) return null;
                    return (
                      <StandingStepperRow
                        key={key}
                        thumbSrc={factionThumbSrc(peer)}
                        label={row.name}
                        value={getValue(key, row.serverValue)}
                        editable={isGM}
                        onDelta={(d) => applyDelta(key, row.serverValue, d)}
                        seeVisible={isGM ? see : null}
                        onSeeChange={
                          isGM
                            ? (v) => void toggleSee(fac, row.name, v)
                            : null
                        }
                        seeDisabled={seeBusy}
                      />
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

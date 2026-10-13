import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  factionAPI,
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
import StandingStepperRow from "./StandingStepperRow";

const lbl = { fontSize: 10, color: "#9ca3af", textTransform: "uppercase" };

function factionThumb(fac) {
  if (!fac || typeof fac !== "object") return null;
  const fromUpload = resolveMediaUrl(fac.image || "");
  if (fromUpload) return fromUpload;
  const url = String(fac.image_url || "").trim();
  return url || null;
}

function resolveFactionId(npc) {
  const raw = npc?.faction?.id ?? npc?.faction_id ?? npc?.faction ?? null;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compact Rep body for session/campaign NPC expand panels.
 */
export default function NpcExpandRepTab({
  npc,
  characters = [],
  crews = [],
  campaignFactions = [],
  readOnly = false,
  busy = false,
  onPatchNpc,
  onRefresh,
  onError,
}) {
  const npcRef = useRef(npc);
  const factionsRef = useRef(campaignFactions);
  npcRef.current = npc;
  factionsRef.current = campaignFactions;
  const [seeOverrides, setSeeOverrides] = useState({});
  const [seeBusy, setSeeBusy] = useState(false);

  const canEdit = !readOnly && !busy && typeof onPatchNpc === "function";

  const pcs = useMemo(
    () =>
      [...(characters || [])]
        .filter((c) => c?.id != null)
        .sort((a, b) =>
          String(pcDisplayName(a)).localeCompare(String(pcDisplayName(b)), undefined, {
            sensitivity: "base",
          }),
        ),
    [characters],
  );

  const crewList = useMemo(
    () =>
      [...(crews || [])]
        .filter((c) => c?.id != null)
        .sort((a, b) =>
          String(a.name || a.id).localeCompare(String(b.name || b.id), undefined, {
            sensitivity: "base",
          }),
        ),
    [crews],
  );

  const factionId = resolveFactionId(npc);
  const selfFaction = useMemo(
    () =>
      (campaignFactions || []).find((f) => Number(f.id) === Number(factionId)) ||
      null,
    [campaignFactions, factionId],
  );

  const peerRows = useMemo(() => {
    if (!selfFaction) return [];
    const { next } = seedFactionStatusFromCampaign(
      selfFaction.faction_status,
      campaignFactions,
      selfFaction.id,
    );
    return Object.entries(next)
      .map(([name, value]) => ({ name, serverValue: clampStandingValue(value) }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [selfFaction, campaignFactions]);

  const onCommit = useCallback(
    async (key, value) => {
      const parts = String(key).split(":");
      const kind = parts[0];
      const curNpc = npcRef.current;
      if (kind === "pc" || kind === "crew") {
        if (!curNpc?.id || typeof onPatchNpc !== "function") return;
        const field = kind === "pc" ? "pc_standing" : "crew_standing";
        const idKey = parts[1];
        const prev = normalizeStandingMap(curNpc[field]);
        // Merge any other in-flight optimistic keys for same field from latest only.
        await onPatchNpc({
          [field]: {
            ...prev,
            [String(idKey)]: clampStandingValue(value),
          },
        });
        return;
      }
      if (kind === "fac") {
        const otherName = parts.slice(1).join(":");
        const list = factionsRef.current || [];
        const self =
          list.find((f) => Number(f.id) === Number(resolveFactionId(curNpc))) ||
          null;
        if (!self?.id) return;
        const selfName = String(self.name || "").trim();
        const other = list.find(
          (f) => String(f.name || "").trim() === String(otherName || "").trim(),
        );
        if (!selfName || !other?.id) return;
        const prevSelf = normalizeFactionStatusMap(self.faction_status);
        const prevOther = normalizeFactionStatusMap(other.faction_status);
        const { statusA, statusB } = applySymmetricFactionStatus(
          selfName,
          otherName,
          value,
          prevSelf,
          prevOther,
        );
        await factionAPI.patchFaction(self.id, { faction_status: statusA });
        await syncReverseFactionStatuses({
          selfId: self.id,
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
        await onRefresh?.();
      }
    },
    [onPatchNpc, onRefresh],
  );

  const { getValue, applyDelta, saving, error } = useOptimisticStandingMap({
    onCommit,
  });

  useEffect(() => {
    if (error) onError?.(error);
  }, [error, onError]);

  const resolveSee = useCallback(
    (peerName) => {
      if (!selfFaction) return true;
      const okey = String(peerName);
      if (Object.prototype.hasOwnProperty.call(seeOverrides, okey)) {
        return !!seeOverrides[okey];
      }
      return peerStandingVisible(
        selfFaction.faction_status_visibility,
        peerName,
      );
    },
    [seeOverrides, selfFaction],
  );

  const toggleSee = useCallback(
    async (peerName, visible) => {
      if (!canEdit || !selfFaction?.id) return;
      const okey = String(peerName);
      setSeeOverrides((p) => ({ ...p, [okey]: !!visible }));
      setSeeBusy(true);
      onError?.(null);
      try {
        await patchFactionPeerVisibility({
          selfFaction,
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
        onError?.(e?.message || "Could not update standing visibility.");
      } finally {
        setSeeBusy(false);
      }
    },
    [canEdit, onError, onRefresh, selfFaction],
  );

  const pcStanding = normalizeStandingMap(npc?.pc_standing);
  const crewStanding = normalizeStandingMap(npc?.crew_standing);

  return (
    <div>
      <div style={{ ...lbl, marginBottom: 4 }}>Toward PCs</div>
      <p style={{ fontSize: 10, color: "#6b7280", margin: "0 0 8px", lineHeight: 1.35 }}>
        This NPC&apos;s standing toward each campaign PC (−3 to +3).
      </p>
      {pcs.length === 0 ? (
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 12 }}>No PCs.</div>
      ) : (
        <div style={{ marginBottom: 14, maxHeight: 200, overflowY: "auto" }}>
          {pcs.map((ch) => {
            const serverValue = pcStanding[String(ch.id)] ?? 0;
            const key = `pc:${ch.id}`;
            return (
              <StandingStepperRow
                key={key}
                thumbSrc={getCharacterPortraitSrc(ch)}
                label={pcDisplayName(ch)}
                value={getValue(key, serverValue)}
                editable={canEdit}
                onDelta={(d) => applyDelta(key, serverValue, d)}
              />
            );
          })}
        </div>
      )}

      <div style={{ ...lbl, marginBottom: 4 }}>Toward crews</div>
      <p style={{ fontSize: 10, color: "#6b7280", margin: "0 0 8px", lineHeight: 1.35 }}>
        Personal standing toward campaign crews (−3 to +3).
      </p>
      {crewList.length === 0 ? (
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 12 }}>No crews.</div>
      ) : (
        <div style={{ marginBottom: 14, maxHeight: 160, overflowY: "auto" }}>
          {crewList.map((c) => {
            const serverValue = crewStanding[String(c.id)] ?? 0;
            const key = `crew:${c.id}`;
            return (
              <StandingStepperRow
                key={key}
                label={c.name || `Crew ${c.id}`}
                value={getValue(key, serverValue)}
                editable={canEdit}
                onDelta={(d) => applyDelta(key, serverValue, d)}
              />
            );
          })}
        </div>
      )}

      {selfFaction ? (
        <>
          <div style={{ ...lbl, marginBottom: 4 }}>Faction vs faction</div>
          <p style={{ fontSize: 10, color: "#6b7280", margin: "0 0 8px", lineHeight: 1.35 }}>
            {selfFaction.name || "Faction"} standing toward other factions (synced both ways).
          </p>
          {peerRows.length === 0 ? (
            <div style={{ fontSize: 11, color: "#6b7280" }}>No peer factions.</div>
          ) : (
            <div style={{ maxHeight: 180, overflowY: "auto" }}>
              {peerRows.map((row) => {
                const peer = (campaignFactions || []).find(
                  (f) => String(f.name || "").trim() === row.name,
                );
                const key = `fac:${row.name}`;
                const see = resolveSee(row.name);
                if (!canEdit && !see) return null;
                return (
                  <StandingStepperRow
                    key={key}
                    thumbSrc={factionThumb(peer)}
                    label={row.name}
                    value={getValue(key, row.serverValue)}
                    editable={canEdit}
                    onDelta={(d) => applyDelta(key, row.serverValue, d)}
                    seeVisible={canEdit ? see : null}
                    onSeeChange={
                      canEdit
                        ? (v) => void toggleSee(row.name, v)
                        : null
                    }
                    seeDisabled={seeBusy}
                  />
                );
              })}
            </div>
          )}
        </>
      ) : (
        <p style={{ fontSize: 10, color: "#6b7280", margin: 0, lineHeight: 1.35 }}>
          Assign a campaign faction to edit faction-vs-faction standing from this NPC.
        </p>
      )}

      {saving ? (
        <div style={{ fontSize: 10, color: "#a78bfa", marginTop: 8 }}>Saving…</div>
      ) : null}
    </div>
  );
}

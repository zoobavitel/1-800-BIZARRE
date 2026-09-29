import React, { useEffect, useState } from "react";
import { crewAPI } from "../../features/character-sheet/services/api";
import {
  SessionPortraitThumb,
  entityPortraitSrc,
} from "../session/sessionShellUi";

/**
 * Session-style crew cards with inline autosave fields.
 */
export default function RosterCrewInlineSection({
  campaign,
  crews = [],
  S,
  onRefresh,
  onError,
  canManageCrew = true,
  crewForm = null,
  startCrewCreate,
  crewError = null,
  emptyMessage = null,
  showCreateWhenEmpty = true,
}) {
  const [crewDraftById, setCrewDraftById] = useState({});
  const [crewSavingId, setCrewSavingId] = useState(null);
  const [expandedCrewIds, setExpandedCrewIds] = useState({});

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
    onError?.(null);
    try {
      await crewAPI.patchCrew(crewId, partial);
      onRefresh?.();
    } catch (e) {
      onError?.(e.message || "Crew update failed");
    } finally {
      setCrewSavingId(null);
    }
  };

  const toggleCrew = (crewId) => {
    setExpandedCrewIds((p) => ({ ...p, [crewId]: !p[crewId] }));
  };

  if (!canManageCrew) return null;

  if ((crews || []).length === 0 && !crewForm) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 10 }}>
        {emptyMessage || "No crew yet."}{" "}
        {showCreateWhenEmpty && typeof startCrewCreate === "function" ? (
          <button
            type="button"
            onClick={startCrewCreate}
            style={{ ...S.btnPrimary, fontSize: 10, padding: "2px 8px" }}
          >
            + New Crew
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 12,
        marginBottom: 14,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {(crews || []).map((crew) => {
        const d = crewDraftById[crew.id] || {};
        const busy = crewSavingId === crew.id;
        const isOpen = !!expandedCrewIds[crew.id];
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
        const relRows = Array.isArray(crew.faction_relationships)
          ? crew.faction_relationships.map(
              (rel) =>
                `${rel.faction_name || rel.faction_id}: ${rel.reputation_value}`,
            )
          : [];
        const stashFilled = Array.isArray(crew.stash_slots)
          ? crew.stash_slots.filter(Boolean).length
          : null;

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
              role="button"
              tabIndex={0}
              onClick={() => toggleCrew(crew.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleCrew(crew.id);
                }
              }}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                cursor: "pointer",
              }}
            >
              <div
                style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}
              >
                <SessionPortraitThumb
                  src={entityPortraitSrc(crew)}
                  label={(d.name ?? crew.name) || `Crew ${crew.id}`}
                  size={48}
                  onClick={() => toggleCrew(crew.id)}
                />
                <span style={{ fontWeight: "bold", color: "#a78bfa", fontSize: 12 }}>
                  Crew · {(d.name ?? crew.name)?.trim() || `Crew ${crew.id}`}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {busy ? (
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>Saving…</span>
                ) : null}
                <span style={{ ...S.btnGhost, fontSize: 10, padding: "2px 8px" }}>
                  {isOpen ? "▾" : "▸"}
                </span>
              </div>
            </div>
            {isOpen ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: 10,
                    marginTop: 10,
                  }}
                >
                  <CrewField label="Name" busy={busy} S={S}>
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
                  </CrewField>
                  <CrewField label="Level" busy={busy} S={S}>
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
                  </CrewField>
                  <CrewField label="Hold" busy={busy} S={S}>
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
                  </CrewField>
                  <CrewField label="Rep" busy={busy} S={S}>
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
                  </CrewField>
                  <CrewField label="Wanted ★" busy={busy} S={S}>
                    <input
                      style={S.inp}
                      value={String(campaign?.wanted_stars ?? 0)}
                      readOnly
                      disabled
                    />
                    <span style={{ fontSize: 9, color: "#6b7280" }}>
                      Synced from campaign Wanted Level
                    </span>
                  </CrewField>
                  <CrewField label="Turf (0–6)" busy={busy} S={S}>
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
                  </CrewField>
                  <CrewField label="Coin" busy={busy} S={S}>
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
                  </CrewField>
                  <CrewField label="Stash" busy={busy} S={S}>
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
                  </CrewField>
                  <CrewField label="XP" busy={busy} S={S}>
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
                  </CrewField>
                  <CrewField label="Advancement pts" busy={busy} S={S}>
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
                        const n = parseInt(String(d.advancement_points).trim(), 10);
                        if (
                          !Number.isFinite(n) ||
                          n === crew.advancement_points
                        )
                          return;
                        patchCrewSnapshot(crew.id, { advancement_points: n });
                      }}
                      disabled={busy}
                    />
                  </CrewField>
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
      {crewError ? (
        <div style={{ ...S.err, fontSize: 11 }}>{crewError}</div>
      ) : null}
    </div>
  );
}

function CrewField({ label, children, S }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10, color: "#9ca3af" }}>{label}</span>
      {children}
    </label>
  );
}

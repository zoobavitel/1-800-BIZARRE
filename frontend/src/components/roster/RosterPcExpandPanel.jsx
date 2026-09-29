import React, { useCallback, useEffect, useState } from "react";
import {
  characterAPI,
  hasPlaybook,
  playbookToDisplay,
} from "../../features/character-sheet/services/api";
import { ArmorChargeBoxes } from "../../features/character-sheet/components/CharacterSheetArmorPanel";
import { buildRouteHref, handleSpaNavClick } from "../../utils/spaNavigation";
import NpcsStandCoin from "../NpcsStandCoin";
import { NestedTabBar } from "../session/sessionShellUi";
import {
  COMPACT_HARM_FIELDS,
  COMPACT_HARM_DETRIMENT,
  COMPACT_HARM_DETRIMENT_IDLE,
  EMPTY_HARM_PAYLOAD,
  compactHarmActiveDetriments,
  compactHarmFieldStyle,
  harmDraftFromApiCharacter,
  harmPayloadFromDraft,
  rosterStandArmorMaxFromDurabilityGrade,
} from "./rosterHarmUtils";
import {
  RosterPcInfoFields,
  RosterPcStressTraumaStrip,
  rosterPcInfoDraftFromCharacter,
  rosterPcInfoPayloadFromDraft,
  rosterPcInfoPayloadEqual,
  rosterPcStressCount,
  rosterPcTraumaLabel,
} from "./rosterPcInfoUtils";
import { rosterExpandPanelChrome } from "./rosterShared";
import SessionPcActionDotsReadout from "./SessionPcActionDotsReadout";
import {
  gradesFromCharacterStand,
  readoutsFromGrades,
  rosterCharacterNoteSections,
  rosterFormatInventoryLine,
  rosterHeritageAbilityLines,
  rosterPcLoadSummary,
  rosterPcSheetNotes,
  rosterPlaybookAbilityGroups,
  stepGrade,
} from "./rosterPcExpandReadouts";

const CAMPAIGN_PC_TABS = [
  { id: "info", label: "Info" },
  { id: "harm", label: "Harm" },
  { id: "actions", label: "Actions" },
  { id: "playbook", label: "Playbook" },
  { id: "notes", label: "Notes" },
  { id: "items", label: "Items" },
];

const lbl = { fontSize: 10, color: "#9ca3af", textTransform: "uppercase" };

/**
 * Session-style PC expand panel for campaign rosters (harm + armor + membership actions).
 */
export default function RosterPcExpandPanel({
  mode = "campaign",
  children = null,
  character,
  summaryCharacter,
  S,
  meta = {},
  campaign,
  user,
  isGM,
  onClose,
  onNavigateToCharacter,
  onUnassignCharacter,
  onRemovePlayerFromCampaign,
  onRefresh,
  onCharactersRefresh,
  onError,
  readOnly = false,
}) {
  const full = character || summaryCharacter;
  const charId = full?.id;
  const [activeTab, setActiveTab] = useState("harm");
  const [harmDraft, setHarmDraft] = useState(() => harmDraftFromApiCharacter(full));
  const [infoDraft, setInfoDraft] = useState(() =>
    rosterPcInfoDraftFromCharacter(full),
  );
  const [busy, setBusy] = useState(false);
  const [notesDraft, setNotesDraft] = useState(() => rosterPcSheetNotes(full));
  const [notesDirty, setNotesDirty] = useState(false);

  useEffect(() => {
    const ch = character || summaryCharacter;
    setHarmDraft(harmDraftFromApiCharacter(ch));
    setInfoDraft(rosterPcInfoDraftFromCharacter(ch));
    setNotesDraft(rosterPcSheetNotes(ch));
    setNotesDirty(false);
  }, [character, summaryCharacter]);

  const patchHarmFromDraft = useCallback(async () => {
    if (readOnly || !charId) return;
    setBusy(true);
    onError?.(null);
    try {
      await characterAPI.patchCharacter(charId, harmPayloadFromDraft(harmDraft));
      await onCharactersRefresh?.();
      onRefresh?.();
    } catch (e) {
      onError?.(e.message || "Failed to save harm");
    } finally {
      setBusy(false);
    }
  }, [charId, harmDraft, onCharactersRefresh, onRefresh, onError, readOnly]);

  const confirmResetHarm = useCallback(async () => {
    if (readOnly || !charId) return;
    const nm =
      full?.true_name || full?.name || full?.alias || `PC ${charId}`;
    if (
      !window.confirm(
        `Clear all harm (levels 1–4) for ${nm}? This saves immediately to the character sheet.`,
      )
    ) {
      return;
    }
    setBusy(true);
    onError?.(null);
    try {
      let body = await characterAPI.patchCharacter(charId, EMPTY_HARM_PAYLOAD);
      if (!body || typeof body !== "object") {
        body = await characterAPI.getCharacter(charId);
      }
      setHarmDraft(harmDraftFromApiCharacter(body));
      await onCharactersRefresh?.();
      onRefresh?.();
    } catch (e) {
      onError?.(e.message || "Failed to reset harm");
    } finally {
      setBusy(false);
    }
  }, [charId, full, onCharactersRefresh, onRefresh, onError, readOnly]);

  const handleArmorUsedChange = useCallback(
    async (field, nextUsed, max) => {
      if (readOnly || !charId) return;
      const cap = Math.max(0, Math.floor(Number(max) || 0));
      const next = Math.max(0, Math.min(cap, Math.floor(Number(nextUsed) || 0)));
      setBusy(true);
      onError?.(null);
      try {
        await characterAPI.patchCharacter(charId, { [field]: next });
        await onCharactersRefresh?.();
        onRefresh?.();
      } catch (e) {
        onError?.(e.message || "Could not update armor uses.");
      } finally {
        setBusy(false);
      }
    },
    [charId, onCharactersRefresh, onRefresh, onError, readOnly],
  );

  const commitInfo = useCallback(
    async (overrideDraft) => {
      if (readOnly || !charId) return;
      const server = rosterPcInfoPayloadFromDraft(
        rosterPcInfoDraftFromCharacter(full),
      );
      const payload = rosterPcInfoPayloadFromDraft(overrideDraft || infoDraft);
      if (rosterPcInfoPayloadEqual(payload, server)) {
        return;
      }
      setBusy(true);
      onError?.(null);
      try {
        await characterAPI.patchCharacter(charId, payload);
        await onCharactersRefresh?.();
        onRefresh?.();
      } catch (e) {
        onError?.(e.message || "Could not update character info.");
      } finally {
        setBusy(false);
      }
    },
    [
      charId,
      full,
      infoDraft,
      onCharactersRefresh,
      onRefresh,
      onError,
      readOnly,
    ],
  );

  const handleStressChange = useCallback(
    async (nextStress) => {
      if (readOnly || !charId) return;
      const n = Math.max(0, Math.min(9, Math.floor(Number(nextStress) || 0)));
      setBusy(true);
      onError?.(null);
      try {
        await characterAPI.patchCharacter(charId, { stress: n });
        await onCharactersRefresh?.();
        onRefresh?.();
      } catch (e) {
        onError?.(e.message || "Could not update stress.");
      } finally {
        setBusy(false);
      }
    },
    [charId, onCharactersRefresh, onRefresh, onError, readOnly],
  );

  const saveNotes = useCallback(async () => {
    if (readOnly || !charId) return;
    const server = rosterPcSheetNotes(full);
    const next = String(notesDraft ?? "");
    if (server === next) {
      setNotesDirty(false);
      return;
    }
    setBusy(true);
    onError?.(null);
    try {
      await characterAPI.patchCharacter(charId, { background_note2: next });
      setNotesDirty(false);
      await onCharactersRefresh?.();
      onRefresh?.();
    } catch (e) {
      onError?.(e.message || "Could not update notes.");
    } finally {
      setBusy(false);
    }
  }, [
    charId,
    full,
    notesDraft,
    onCharactersRefresh,
    onRefresh,
    onError,
    readOnly,
  ]);

  const handleStandStep = useCallback(
    async (key, delta) => {
      if (readOnly || !charId || !full) return;
      const grades = gradesFromCharacterStand(full);
      const canSRank = full.gm_can_have_s_rank_stand_stats === true;
      const nextLetter = stepGrade(grades[key], delta);
      if (nextLetter === grades[key]) return;
      if (delta > 0 && !canSRank && grades[key] === "A") return;
      setBusy(true);
      onError?.(null);
      try {
        if (delta < 0) {
          await characterAPI.gmForceStandStat(charId, {
            stand_stat: key,
            direction: "down",
          });
        } else {
          const res = await characterAPI.gmForceStandStat(charId, {
            stand_stat: key,
            xp_track: "playbook",
          });
          if (res?.pending_stand_a_reward) {
            const stat = String(
              res.pending_stand_a_reward.stand_stat || key,
            ).toUpperCase();
            onError?.(
              `Stand Coin ${stat} is now A. Player must pick B→A abilities on their character sheet.`,
            );
          }
        }
        await onCharactersRefresh?.();
        onRefresh?.();
      } catch (e) {
        onError?.(e.message || "Could not update Stand Coin.");
      } finally {
        setBusy(false);
      }
    },
    [charId, full, onCharactersRefresh, onRefresh, onError, readOnly],
  );

  if (!full?.id) return null;

  const grades = gradesFromCharacterStand(full);
  const standArmorMax = rosterStandArmorMaxFromDurabilityGrade(grades.durability);
  const standArmorUsed = Math.max(0, Math.floor(Number(full.stand_armor_used) || 0));
  const hasPhyArmor = !!full.has_physical_armor_item;
  const phyArmorMax = Math.min(
    6,
    Math.max(0, Math.floor(Number(full.physical_armor_bonus_charges) || 0)),
  );
  const phyArmorUsed = Math.min(
    6,
    Math.max(0, Math.floor(Number(full.physical_armor_used) || 0)),
  );
  const isStandUser = hasPlaybook(
    full.playbook,
    full.secondary_playbook ?? full.secondaryPlaybook,
    "Stand",
  );
  const traumaLabel = rosterPcTraumaLabel(full);
  const stressCount = rosterPcStressCount(full);

  const canUnassign =
    !readOnly &&
    ((meta.role === "GM" && user?.id === campaign?.gm?.id) ||
      (meta.role === "Player" &&
        ((isGM && meta.user?.id !== campaign?.gm?.id) ||
          meta.user?.id === user?.id)));

  if (mode === "session" && children) {
    return (
      <div className="session-pc-expand-panel" style={rosterExpandPanelChrome}>
        <button
          type="button"
          className="session-expand-close"
          aria-label="Close PC panel"
          title="Close"
          onClick={onClose}
        >
          ×
        </button>
        {children}
      </div>
    );
  }

  return (
    <div className="session-pc-expand-panel" style={rosterExpandPanelChrome}>
      <button
        type="button"
        className="session-expand-close"
        aria-label="Close PC panel"
        title="Close"
        onClick={onClose}
      >
        ×
      </button>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        <span style={{ fontWeight: "bold", color: "var(--hftf-text-cream)", fontSize: 12 }}>
          {meta.user?.username || "—"}
        </span>
        {meta.role ? (
          <span
            style={{
              fontSize: 10,
              padding: "2px 8px",
              borderRadius: 9999,
              fontWeight: "bold",
              background: meta.role === "GM" ? "#78350f" : "var(--accent)",
              color: "#fff",
            }}
          >
            {meta.role}
          </span>
        ) : null}
      </div>
      <NestedTabBar tabs={CAMPAIGN_PC_TABS} active={activeTab} onChange={setActiveTab} />
      {typeof onNavigateToCharacter === "function" ? (
        <a
          href={buildRouteHref("character", { characterId: full.id })}
          onClick={(e) =>
            handleSpaNavClick(e, () => onNavigateToCharacter(full.id))
          }
          style={{
            ...S.btnGhost,
            fontSize: 10,
            marginTop: 4,
            marginBottom: 8,
            display: "inline-block",
            textDecoration: "none",
          }}
        >
          Open sheet
        </a>
      ) : null}

      {activeTab === "info" ? (
        <RosterPcInfoFields
          draft={infoDraft}
          setDraft={setInfoDraft}
          onCommit={commitInfo}
          readOnly={readOnly}
          busy={busy}
          S={S}
          traumaLabel={traumaLabel}
          character={full}
          campaign={campaign}
        />
      ) : null}

      {activeTab === "harm" ? (
        <>
          <RosterPcStressTraumaStrip
            stress={stressCount}
            traumaLabel={traumaLabel}
            readOnly={readOnly}
            busy={busy}
            onStressChange={handleStressChange}
            S={S}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <div style={{ ...lbl, marginBottom: 0 }}>Harm (compact)</div>
            <button
              type="button"
              onClick={confirmResetHarm}
              style={{ ...S.btnGhost, fontSize: 10 }}
              disabled={busy || readOnly}
            >
              Reset harm
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
              fontSize: 10,
            }}
          >
            {COMPACT_HARM_FIELDS.map(([key, label, gridColumn]) => (
              <input
                key={`${charId}-${key}`}
                value={harmDraft[key] || ""}
                onChange={(e) =>
                  setHarmDraft((prev) => ({ ...prev, [key]: e.target.value }))
                }
                onBlur={patchHarmFromDraft}
                placeholder={label}
                disabled={busy || readOnly}
                readOnly={readOnly}
                title={COMPACT_HARM_DETRIMENT[key] || label}
                style={{
                  ...S.inp,
                  fontSize: 10,
                  padding: "4px 6px",
                  minWidth: 0,
                  ...compactHarmFieldStyle(key, harmDraft[key]),
                  ...(gridColumn ? { gridColumn } : {}),
                }}
              />
            ))}
          </div>
          <div
            style={{
              fontSize: 9,
              color: "#9ca3af",
              lineHeight: 1.35,
              marginTop: 4,
            }}
          >
            {(() => {
              const active = compactHarmActiveDetriments(harmDraft);
              return active.length > 0 ? (
                <>
                  <span style={{ color: "#fbbf24", fontWeight: 600 }}>
                    Active:{" "}
                  </span>
                  {active.join(" · ")}
                </>
              ) : (
                COMPACT_HARM_DETRIMENT_IDLE
              );
            })()}
          </div>
          <div style={{ ...lbl, marginTop: 10 }}>Armor uses</div>
          <div style={{ display: "grid", gap: 8, fontSize: 10, color: "#9ca3af" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ minWidth: 52 }}>Physical</span>
              {hasPhyArmor && phyArmorMax > 0 ? (
                <span
                  style={{
                    opacity: busy || readOnly ? 0.5 : 1,
                    pointerEvents: busy || readOnly ? "none" : "auto",
                  }}
                >
                  <ArmorChargeBoxes
                    count={phyArmorMax}
                    used={phyArmorUsed}
                    onToggleAt={(i, spent) =>
                      handleArmorUsedChange(
                        "physical_armor_used",
                        spent ? i : i + 1,
                        phyArmorMax,
                      )
                    }
                    spentColor="#0d1117"
                    activeColor="#b45309"
                    borderColor="#4b5563"
                    spendTitle="Click to spend physical armor"
                    restoreTitle="Used — click to restore"
                  />
                </span>
              ) : (
                <span style={{ color: "#52525b" }}>—</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ minWidth: 52 }}>Stand</span>
              {isStandUser && standArmorMax > 0 ? (
                <span
                  style={{
                    opacity: busy || readOnly ? 0.5 : 1,
                    pointerEvents: busy || readOnly ? "none" : "auto",
                  }}
                >
                  <ArmorChargeBoxes
                    count={standArmorMax}
                    used={standArmorUsed}
                    onToggleAt={(i, spent) =>
                      handleArmorUsedChange(
                        "stand_armor_used",
                        spent ? i : i + 1,
                        standArmorMax,
                      )
                    }
                    spentColor="#0d1117"
                    activeColor="#0d1117"
                    borderColor="#4b5563"
                    showCheck
                    spendTitle="Click to spend Stand armor"
                    restoreTitle="Used — click to restore"
                  />
                </span>
              ) : (
                <span style={{ color: "#52525b" }}>—</span>
              )}
            </div>
          </div>
        </>
      ) : null}

      {activeTab === "actions" ? (
        <div>
          {(() => {
            const heritageName =
              full.heritage_details?.name ||
              full.heritage_name ||
              full.heritage ||
              "—";
            const heritageLines = rosterHeritageAbilityLines(full);
            return (
              <>
                <div style={lbl}>Heritage</div>
                <div style={{ fontSize: 11, color: "#e5e7eb", marginBottom: 6 }}>
                  {heritageName}
                </div>
                {heritageLines.length > 0 ? (
                  <ul
                    style={{
                      margin: "0 0 10px",
                      paddingLeft: 16,
                      fontSize: 10,
                      color: "#9ca3af",
                      lineHeight: 1.35,
                    }}
                  >
                    {heritageLines.map((h, i) => (
                      <li key={`herit-${full.id}-${i}`}>
                        {h.kind === "detriment" ? "− " : "+ "}
                        {h.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div
                    style={{
                      fontSize: 10,
                      color: "#52525b",
                      marginBottom: 10,
                    }}
                  >
                    No heritage abilities on payload
                  </div>
                )}
              </>
            );
          })()}
          <div style={{ marginTop: 4, marginBottom: 8 }}>
            <SessionPcActionDotsReadout
              actionDots={full.action_dots || full.actionDots}
            />
          </div>
        </div>
      ) : null}

      {activeTab === "playbook" ? (
        <div>
          {isStandUser ? (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <NpcsStandCoin
                grades={grades}
                readouts={readoutsFromGrades(grades)}
                onStep={(k, d) => {
                  if (readOnly || busy) return;
                  void handleStandStep(k, d);
                }}
                variant="pc"
                pcMaxGrade={
                  full.gm_can_have_s_rank_stand_stats === true ? "S" : "A"
                }
                readOnly={readOnly || busy}
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
              Stand Coin hidden — {playbookToDisplay(full.playbook)} playbook
              (not a Stand user).
            </div>
          )}
          {(() => {
            const groups = rosterPlaybookAbilityGroups(full);
            if (!groups.length) {
              return (
                <div
                  style={{
                    fontSize: 10,
                    color: "#52525b",
                    marginTop: 8,
                  }}
                >
                  No playbook abilities on payload
                </div>
              );
            }
            return groups.map((g) => (
              <div key={`pb-${full.id}-${g.label}`} style={{ marginTop: 8 }}>
                <div style={lbl}>{g.label}</div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 16,
                    fontSize: 10,
                    color: "#9ca3af",
                    lineHeight: 1.35,
                  }}
                >
                  {g.items.map((name, i) => (
                    <li key={`pb-item-${full.id}-${g.label}-${i}`}>{name}</li>
                  ))}
                </ul>
              </div>
            ));
          })()}
        </div>
      ) : null}

      {activeTab === "notes" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={lbl}>Notes (PC sheet)</div>
          {readOnly ? (
            <div
              style={{
                fontSize: 11,
                color: "#e5e7eb",
                whiteSpace: "pre-wrap",
                lineHeight: 1.45,
              }}
            >
              {rosterPcSheetNotes(full).trim() || "—"}
            </div>
          ) : (
            <>
              <textarea
                value={notesDraft}
                onChange={(e) => {
                  setNotesDraft(e.target.value);
                  setNotesDirty(true);
                }}
                placeholder="Notes…"
                rows={4}
                disabled={busy}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  fontSize: 11,
                  lineHeight: 1.35,
                  padding: "6px 8px",
                  background: "#010409",
                  color: "#e5e7eb",
                  border: "1px solid #30363d",
                  borderRadius: 6,
                }}
              />
              <button
                type="button"
                style={{ ...S.btnPrimary, fontSize: 10, alignSelf: "flex-start" }}
                disabled={busy || !notesDirty}
                onClick={() => void saveNotes()}
              >
                Save notes
              </button>
            </>
          )}
          {(() => {
            const sections = rosterCharacterNoteSections(full);
            if (!sections.length) return null;
            return (
              <details style={{ marginTop: 4 }}>
                <summary
                  style={{
                    fontSize: 10,
                    color: "#9ca3af",
                    cursor: "pointer",
                  }}
                >
                  Background / appearance / vice
                </summary>
                {sections.map((s) => (
                  <div key={s.label} style={{ marginTop: 6 }}>
                    <div style={lbl}>{s.label}</div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#d1d5db",
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.35,
                      }}
                    >
                      {s.text}
                    </div>
                  </div>
                ))}
              </details>
            );
          })()}
        </div>
      ) : null}

      {activeTab === "items" ? (
        <div>
          {(() => {
            const loadSummary = rosterPcLoadSummary(full, null);
            const invLines = (
              Array.isArray(full.inventory) ? full.inventory : []
            )
              .map(rosterFormatInventoryLine)
              .filter(Boolean);
            return (
              <>
                <div style={lbl}>Load</div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#e5e7eb",
                    marginBottom: 8,
                    lineHeight: 1.35,
                  }}
                >
                  <strong
                    style={{
                      color:
                        loadSummary.bandMax != null &&
                        loadSummary.used > loadSummary.bandMax
                          ? "#f85149"
                          : "#e5e7eb",
                    }}
                  >
                    {loadSummary.used}
                  </strong>
                  {loadSummary.derivedBand
                    ? ` · ${loadSummary.bandLabel || loadSummary.derivedBand}`
                    : " · —"}
                  {loadSummary.bandMax != null
                    ? ` (cap ${loadSummary.bandMax})`
                    : null}
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
              </>
            );
          })()}
        </div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
        {canUnassign && typeof onUnassignCharacter === "function" ? (
          <button
            type="button"
            style={{
              ...S.btn,
              fontSize: 10,
              background: "#7f1d1d",
              color: "#fca5a5",
            }}
            onClick={() => onUnassignCharacter(full.id)}
          >
            Remove character
          </button>
        ) : null}
        {meta.showRemovePlayer &&
        typeof onRemovePlayerFromCampaign === "function" ? (
          <button
            type="button"
            style={{
              ...S.btn,
              fontSize: 10,
              background: "#7f1d1d",
              color: "#fca5a5",
            }}
            onClick={() =>
              onRemovePlayerFromCampaign(meta.user.id, meta.user.username)
            }
          >
            Remove from campaign
          </button>
        ) : null}
      </div>
    </div>
  );
}

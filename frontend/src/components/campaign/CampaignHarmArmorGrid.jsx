import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  characterAPI,
  hasPlaybook,
} from "../../features/character-sheet/services/api";
import { ArmorChargeBoxes } from "../../features/character-sheet/components/CharacterSheetArmorPanel";
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
} from "../roster/rosterHarmUtils";
import {
  RosterPcStressTraumaStrip,
  rosterPcStressCount,
  rosterPcTraumaLabel,
  stressMaxFromCharacter,
} from "../roster/rosterPcInfoUtils";

const lbl = { fontSize: 10, color: "#9ca3af", textTransform: "uppercase" };
const GRADES = ["F", "D", "C", "B", "A", "S"];

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

function CampaignPcHarmCard({
  character,
  S,
  readOnly = false,
  onRefresh,
  onError,
}) {
  const charId = character?.id;
  const [harmDraft, setHarmDraft] = useState(() =>
    harmDraftFromApiCharacter(character),
  );
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setHarmDraft(harmDraftFromApiCharacter(character));
  }, [character]);

  const name =
    character?.true_name || character?.name || character?.alias || `PC ${charId}`;
  const stress = rosterPcStressCount(character);
  const stressMax = stressMaxFromCharacter(character);
  const traumaLabel = rosterPcTraumaLabel(character);
  const grades = rawStandToGrades(
    character?.stand || character?.stand_coin_stats || character?.coin_stats,
  );
  const standArmorMax = rosterStandArmorMaxFromDurabilityGrade(grades.durability);
  const standArmorUsed = Math.max(
    0,
    Math.floor(Number(character?.stand_armor_used) || 0),
  );
  const hasPhyArmor = !!character?.has_physical_armor_item;
  const phyArmorMax = Math.min(
    6,
    Math.max(
      0,
      Math.floor(Number(character?.physical_armor_bonus_charges) || 0),
    ),
  );
  const phyArmorUsed = Math.min(
    6,
    Math.max(0, Math.floor(Number(character?.physical_armor_used) || 0)),
  );
  const isStandUser = hasPlaybook(
    character?.playbook,
    character?.secondary_playbook ?? character?.secondaryPlaybook,
    "Stand",
  );

  const patchHarm = useCallback(async () => {
    if (readOnly || !charId) return;
    setBusy(true);
    onError?.(null);
    try {
      await characterAPI.patchCharacter(charId, harmPayloadFromDraft(harmDraft));
      await onRefresh?.();
    } catch (e) {
      onError?.(e?.message || "Failed to save harm");
    } finally {
      setBusy(false);
    }
  }, [charId, harmDraft, onRefresh, onError, readOnly]);

  const resetHarm = useCallback(async () => {
    if (readOnly || !charId) return;
    if (
      !window.confirm(
        `Clear all harm (levels 1–4) for ${name}? This saves immediately to the character sheet.`,
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
      await onRefresh?.();
    } catch (e) {
      onError?.(e?.message || "Failed to reset harm");
    } finally {
      setBusy(false);
    }
  }, [charId, name, onRefresh, onError, readOnly]);

  const patchStress = useCallback(
    async (n) => {
      if (readOnly || !charId) return;
      setBusy(true);
      onError?.(null);
      try {
        await characterAPI.patchCharacter(charId, {
          stress: Math.max(0, Math.min(stressMax, Math.floor(Number(n) || 0))),
        });
        await onRefresh?.();
      } catch (e) {
        onError?.(e?.message || "Could not update stress.");
      } finally {
        setBusy(false);
      }
    },
    [charId, onRefresh, onError, readOnly, stressMax],
  );

  const patchArmor = useCallback(
    async (field, nextUsed, max) => {
      if (readOnly || !charId) return;
      const cap = Math.max(0, Math.floor(Number(max) || 0));
      const next = Math.max(0, Math.min(cap, Math.floor(Number(nextUsed) || 0)));
      setBusy(true);
      onError?.(null);
      try {
        await characterAPI.patchCharacter(charId, { [field]: next });
        await onRefresh?.();
      } catch (e) {
        onError?.(e?.message || "Could not update armor uses.");
      } finally {
        setBusy(false);
      }
    },
    [charId, onRefresh, onError, readOnly],
  );

  if (!charId) return null;

  return (
    <div
      style={{
        border: "1px solid #374151",
        borderRadius: 8,
        padding: 10,
        background: "#0b1220",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 12,
            color: "#e5e7eb",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={name}
        >
          {name}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {!readOnly ? (
            <button
              type="button"
              onClick={resetHarm}
              style={{ ...S.btnGhost, fontSize: 10 }}
              disabled={busy}
            >
              Reset harm
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            style={{ ...S.btnGhost, fontSize: 10, padding: "2px 8px" }}
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
        </div>
      </div>
      {!collapsed ? (
        <>
          <RosterPcStressTraumaStrip
            stress={stress}
            stressMax={stressMax}
            traumaLabel={traumaLabel}
            readOnly={readOnly}
            busy={busy}
            onStressChange={patchStress}
            S={S}
          />
          <div style={{ ...lbl, marginBottom: 4 }}>Harm (compact)</div>
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
                onBlur={patchHarm}
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
              marginTop: 2,
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
          <div style={{ ...lbl, marginTop: 4 }}>Armor uses</div>
          <div
            style={{
              display: "grid",
              gap: 6,
              fontSize: 10,
              color: "#9ca3af",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
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
                      patchArmor(
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
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
                      patchArmor(
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
      ) : (
        <div style={{ fontSize: 10, color: "#9ca3af" }}>
          Stress {stress}/9
          {traumaLabel && traumaLabel !== "—" ? ` · Trauma: ${traumaLabel}` : ""}
        </div>
      )}
    </div>
  );
}

/** Owner user id on a character row (nested user, user_id, or scalar user). */
export function characterOwnerUserId(character) {
  if (!character || typeof character !== "object") return null;
  if (character.user != null && typeof character.user === "object") {
    const n = Number(character.user.id);
    return Number.isFinite(n) ? n : null;
  }
  if (character.user_id != null && character.user_id !== "") {
    const n = Number(character.user_id);
    return Number.isFinite(n) ? n : null;
  }
  if (character.user != null && character.user !== "") {
    const n = Number(character.user);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * True when the viewer may edit this PC's harm/armor on the campaign grid.
 * GM (or forced readOnly=false path) edits all; players only their own.
 */
export function harmCardEditable({ isGM, userId, character, forceReadOnly }) {
  if (forceReadOnly) return false;
  if (isGM) return true;
  const owner = characterOwnerUserId(character);
  const uid = userId != null && userId !== "" ? Number(userId) : null;
  return (
    owner != null &&
    uid != null &&
    Number.isFinite(uid) &&
    Number(owner) === uid
  );
}

/**
 * Campaign / session-style Harm+Armor cards in a responsive columns×rows grid.
 *
 * @param {object} props
 * @param {boolean} [props.readOnly] — force all cards read-only (legacy)
 * @param {boolean} [props.isGM]
 * @param {number|string|null} [props.userId] — logged-in user; players edit own PC only
 */
export default function CampaignHarmArmorGrid({
  characters = [],
  S,
  readOnly = false,
  isGM = false,
  userId = null,
  onRefresh,
  onError,
}) {
  const list = useMemo(
    () =>
      [...(characters || [])].sort((a, b) =>
        String(a.true_name || a.name || "")
          .localeCompare(String(b.true_name || b.name || ""), undefined, {
            sensitivity: "base",
          }),
      ),
    [characters],
  );

  if (!list.length) {
    return (
      <div style={{ fontSize: 12, color: "#6b7280" }}>No PCs.</div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 12,
        alignItems: "start",
      }}
    >
      {list.map((ch) => (
        <CampaignPcHarmCard
          key={ch.id}
          character={ch}
          S={S}
          readOnly={
            !harmCardEditable({
              isGM,
              userId,
              character: ch,
              forceReadOnly: readOnly,
            })
          }
          onRefresh={onRefresh}
          onError={onError}
        />
      ))}
    </div>
  );
}

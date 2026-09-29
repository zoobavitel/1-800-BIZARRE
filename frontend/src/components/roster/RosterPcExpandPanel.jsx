import React, { useCallback, useEffect, useState } from "react";
import {
  characterAPI,
  hasPlaybook,
} from "../../features/character-sheet/services/api";
import { ArmorChargeBoxes } from "../../features/character-sheet/components/CharacterSheetArmorPanel";
import { buildRouteHref, handleSpaNavClick } from "../../utils/spaNavigation";
import { NestedTabBar } from "../session/sessionShellUi";
import {
  COMPACT_HARM_FIELDS,
  EMPTY_HARM_PAYLOAD,
  compactHarmFieldStyle,
  harmDraftFromApiCharacter,
  harmPayloadFromDraft,
  rosterStandArmorMaxFromDurabilityGrade,
} from "./rosterHarmUtils";
import { rosterExpandPanelChrome } from "./rosterShared";

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

const CAMPAIGN_PC_TABS = [
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
}) {
  const full = character || summaryCharacter;
  const charId = full?.id;
  const [activeTab, setActiveTab] = useState("harm");
  const [harmDraft, setHarmDraft] = useState(() => harmDraftFromApiCharacter(full));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHarmDraft(harmDraftFromApiCharacter(character || summaryCharacter));
  }, [character, summaryCharacter]);

  const patchHarmFromDraft = useCallback(async () => {
    if (!charId) return;
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
  }, [charId, harmDraft, onCharactersRefresh, onRefresh, onError]);

  const confirmResetHarm = useCallback(async () => {
    if (!charId) return;
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
  }, [charId, full, onCharactersRefresh, onRefresh, onError]);

  const handleArmorUsedChange = useCallback(
    async (field, nextUsed, max) => {
      if (!charId) return;
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
    [charId, onCharactersRefresh, onRefresh, onError],
  );

  if (!full?.id) return null;

  const grades = rawStandToGrades(full.stand_coin_stats);
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

  const canUnassign =
    (meta.role === "GM" && user?.id === campaign?.gm?.id) ||
    (meta.role === "Player" &&
      ((isGM && meta.user?.id !== campaign?.gm?.id) ||
        meta.user?.id === user?.id));

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

      {activeTab === "harm" ? (
        <>
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
              disabled={busy}
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
                disabled={busy}
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
          <div style={{ ...lbl, marginTop: 10 }}>Armor uses</div>
          <div style={{ display: "grid", gap: 8, fontSize: 10, color: "#9ca3af" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ minWidth: 52 }}>Physical</span>
              {hasPhyArmor && phyArmorMax > 0 ? (
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
              ) : (
                <span style={{ color: "#52525b" }}>—</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ minWidth: 52 }}>Stand</span>
              {isStandUser && standArmorMax > 0 ? (
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
              ) : (
                <span style={{ color: "#52525b" }}>—</span>
              )}
            </div>
          </div>
        </>
      ) : null}

      {activeTab === "actions" ? (
        <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.45 }}>
          Action dots and heritage details are on the full character sheet.
        </div>
      ) : null}

      {activeTab === "playbook" ? (
        <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.45 }}>
          Stand coin and playbook abilities are on the full character sheet.
        </div>
      ) : null}

      {activeTab === "notes" ? (
        <div
          style={{
            fontSize: 11,
            color: "#e5e7eb",
            whiteSpace: "pre-wrap",
            lineHeight: 1.45,
          }}
        >
          {full.notes?.trim() || "—"}
        </div>
      ) : null}

      {activeTab === "items" ? (
        <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.45 }}>
          Inventory and loadout are on the full character sheet.
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

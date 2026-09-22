import React from "react";
import AvatarCropModal from "../AvatarCropModal";

/**
 * Inline faction create/edit form for Campaign Management.
 * Rendered below the matching CampaignFactionPanel when editing,
 * or at the list bottom when creating (no id yet).
 */
const CampaignFactionEditor = ({
  factionForm,
  setFactionForm,
  factionError,
  factionImagePreview,
  factionPreviewError,
  setFactionPreviewError,
  factionCropOpen,
  setFactionCropOpen,
  campaignNPCs,
  factionAddNpcId,
  setFactionAddNpcId,
  onSave,
  onCancel,
  onAddNpc,
  onRemoveNpc,
  S,
}) => {
  if (!factionForm) return null;

  const editorId = factionForm.id
    ? `faction-editor-${factionForm.id}`
    : "faction-editor-new";

  return (
    <div
      id={editorId}
      style={{
        border: "1px solid var(--hftf-purple)",
        borderLeft: "4px solid var(--hftf-purple)",
        borderRadius: "4px",
        padding: "12px",
        marginTop: "8px",
        background: "var(--hftf-deep)",
      }}
    >
      <span style={S.lbl}>
        {factionForm.id ? "EDIT FACTION" : "CREATE FACTION"}
      </span>
      {factionError && (
        <div style={{ ...S.err, marginBottom: "8px" }}>{factionError}</div>
      )}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "flex-start",
          marginBottom: "10px",
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <span
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              display: "block",
              marginBottom: "4px",
            }}
          >
            Preview
          </span>
          {factionImagePreview && !factionPreviewError ? (
            <img
              src={factionImagePreview}
              alt=""
              crossOrigin="anonymous"
              onError={() => setFactionPreviewError(true)}
              onLoad={() => setFactionPreviewError(false)}
              style={{
                width: 96,
                height: 96,
                objectFit: "cover",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--hftf-deep)",
              }}
            />
          ) : (
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--hftf-deep)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-dim)",
                fontSize: 28,
                fontWeight: "bold",
              }}
              aria-hidden="true"
            >
              {(factionForm.name || "F").trim().charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <span
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              display: "block",
              marginBottom: "4px",
            }}
          >
            Faction image
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{
              fontSize: "11px",
              color: "var(--hftf-text-cream)",
              maxWidth: "100%",
            }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setFactionForm((p) => ({
                ...p,
                imageFile: file,
              }));
              setFactionPreviewError(false);
            }}
          />
          <div style={{ ...S.row, marginTop: 6, gap: 6 }}>
            <button
              type="button"
              disabled={!factionImagePreview || factionPreviewError}
              onClick={() => setFactionCropOpen(true)}
              style={{
                ...S.btnGhost,
                fontSize: "10px",
                opacity:
                  !factionImagePreview || factionPreviewError ? 0.5 : 1,
              }}
            >
              Crop
            </button>
            {(factionForm.image || factionForm.imageFile) && (
              <button
                type="button"
                onClick={() =>
                  setFactionForm((p) => ({
                    ...p,
                    image: null,
                    imageFile: null,
                  }))
                }
                style={{
                  ...S.btnGhost,
                  fontSize: "10px",
                }}
              >
                Clear image
              </button>
            )}
          </div>
          {factionCropOpen &&
          factionImagePreview &&
          !factionPreviewError ? (
            <AvatarCropModal
              imageSrc={factionImagePreview}
              onCancel={() => setFactionCropOpen(false)}
              onApply={(file) => {
                setFactionForm((p) => ({
                  ...p,
                  imageFile: file,
                }));
                setFactionCropOpen(false);
                setFactionPreviewError(false);
              }}
            />
          ) : null}
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        <div>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Name
          </span>
          <input
            style={S.inp}
            value={factionForm.name}
            onChange={(e) =>
              setFactionForm((p) => ({ ...p, name: e.target.value }))
            }
          />
        </div>
        <div>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Type
          </span>
          <input
            style={S.inp}
            value={factionForm.faction_type}
            onChange={(e) =>
              setFactionForm((p) => ({
                ...p,
                faction_type: e.target.value,
              }))
            }
            placeholder="e.g. Criminal Syndicate"
          />
        </div>
        <div>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Tier
          </span>
          <input
            style={{ ...S.inp, width: "80px" }}
            type="number"
            value={factionForm.level}
            onChange={(e) =>
              setFactionForm((p) => ({
                ...p,
                level: parseInt(e.target.value, 10) || 0,
              }))
            }
          />
        </div>
        <div>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Hold
          </span>
          <select
            style={S.select}
            value={factionForm.hold}
            onChange={(e) =>
              setFactionForm((p) => ({ ...p, hold: e.target.value }))
            }
          >
            <option value="weak">Weak</option>
            <option value="strong">Strong</option>
          </select>
        </div>
        <div>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Reputation
          </span>
          <input
            style={{ ...S.inp, width: "80px" }}
            type="number"
            value={factionForm.reputation}
            onChange={(e) =>
              setFactionForm((p) => ({
                ...p,
                reputation: parseInt(e.target.value, 10) || 0,
              }))
            }
          />
        </div>
      </div>
      <div style={{ marginBottom: "8px" }}>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          Notes
        </span>
        <textarea
          style={{
            ...S.inp,
            height: "50px",
            resize: "vertical",
            border: "1px solid var(--border)",
            background: "var(--hftf-deep)",
            padding: "6px",
          }}
          value={factionForm.notes}
          onChange={(e) =>
            setFactionForm((p) => ({ ...p, notes: e.target.value }))
          }
        />
      </div>
      {factionForm.id && (
        <div
          style={{
            marginBottom: "12px",
            padding: "8px",
            background: "var(--hftf-deep)",
            borderRadius: "4px",
            border: "1px solid var(--border)",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              display: "block",
              marginBottom: "6px",
            }}
          >
            NPCs in this faction
          </span>
          {(factionForm.npcs || []).map((n) => (
            <div
              key={n.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "4px 0",
                fontSize: "12px",
              }}
            >
              <span>{n.name || n.stand_name || `NPC ${n.id}`}</span>
              <button
                onClick={() => onRemoveNpc(n.id)}
                style={{
                  ...S.btn,
                  fontSize: "10px",
                  padding: "2px 6px",
                  background: "#7f1d1d",
                  color: "#fca5a5",
                }}
              >
                Remove
              </button>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginTop: "8px",
              alignItems: "center",
            }}
          >
            <select
              style={{ ...S.select, flex: 1 }}
              value={factionAddNpcId}
              onChange={(e) => setFactionAddNpcId(e.target.value)}
            >
              <option value="">Add an NPC...</option>
              {campaignNPCs
                .filter(
                  (n) =>
                    !(factionForm.npcs || []).some((fn) => fn.id === n.id),
                )
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name || n.stand_name || `NPC ${n.id}`}
                  </option>
                ))}
            </select>
            <button
              onClick={onAddNpc}
              style={S.btnPrimary}
              disabled={!factionAddNpcId}
            >
              Add
            </button>
          </div>
        </div>
      )}
      <div style={S.row}>
        <button onClick={onSave} style={S.btnPrimary}>
          Save
        </button>
        <button onClick={onCancel} style={S.btnGhost}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default CampaignFactionEditor;

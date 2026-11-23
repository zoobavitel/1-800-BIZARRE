import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ClockAudiencePicker from "./ClockAudiencePicker";

const SIZE_PRESETS = [4, 6, 8, 12];

const btn = {
  background: "transparent",
  border: "1px solid var(--border, #374151)",
  borderRadius: "4px",
  color: "var(--text-primary, #e5e7eb)",
  cursor: "pointer",
  fontSize: "12px",
  padding: "4px 10px",
};

const label = {
  color: "var(--text-muted, #9ca3af)",
  display: "block",
  fontSize: "11px",
  marginBottom: "3px",
};

/**
 * Edit a clock after it's made: name, size, who sees it, delete. Nothing
 * changes until Save. Delete asks once more.
 *
 * onSave gets { name, segments, audience: { all, ids } }.
 */
export default function ClockEditPopover({
  clock,
  audience = { all: false, ids: [] },
  players = [],
  noneLabel = "GM only",
  allLabel = "All players",
  customSize = true,
  deleteLabel = "Delete",
  onSave,
  onDelete,
  onCancel,
}) {
  const [name, setName] = useState(clock?.name ?? "");
  const [segments, setSegments] = useState(Number(clock?.segments) || 4);
  const [who, setWho] = useState(audience);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const trimmed = name.trim();
  const sizes = SIZE_PRESETS.includes(segments) || customSize
    ? SIZE_PRESETS
    : [...SIZE_PRESETS, segments].sort((a, b) => a - b);

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel?.();
      }}
      style={{
        alignItems: "center",
        background: "rgba(0, 0, 0, 0.55)",
        display: "flex",
        inset: 0,
        justifyContent: "center",
        padding: "16px",
        position: "fixed",
        zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit clock"
        style={{
          background: "var(--bg-card, #111827)",
          border: "1px solid var(--border, #374151)",
          borderRadius: "8px",
          boxSizing: "border-box",
          color: "var(--text-primary, #e5e7eb)",
          display: "grid",
          gap: "12px",
          maxHeight: "90vh",
          maxWidth: "360px",
          overflowY: "auto",
          padding: "14px",
          width: "100%",
        }}
      >
        <div style={{ fontSize: "13px", fontWeight: 700 }}>Edit clock</div>
        <div>
          <label htmlFor="clock-edit-name" style={label}>
            Name
          </label>
          <input
            id="clock-edit-name"
            autoFocus
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              background: "transparent",
              border: "1px solid var(--border, #374151)",
              borderRadius: "4px",
              boxSizing: "border-box",
              color: "inherit",
              fontSize: "13px",
              padding: "5px 7px",
              width: "100%",
            }}
          />
        </div>
        <div>
          <span style={label}>Size</span>
          <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {sizes.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={segments === n}
                onClick={() => setSegments(n)}
                style={{
                  ...btn,
                  background: segments === n ? "var(--sheet-label, #1e3a5f)" : "transparent",
                  color: segments === n ? "var(--bg-card, #fff)" : btn.color,
                }}
              >
                {n}
              </button>
            ))}
            {customSize ? (
              <input
                type="number"
                min={1}
                max={12}
                aria-label="Custom size"
                value={segments}
                onChange={(e) =>
                  setSegments(Math.max(1, Math.min(12, Math.floor(Number(e.target.value)) || 1)))
                }
                style={{
                  background: "transparent",
                  border: "1px solid var(--border, #374151)",
                  borderRadius: "4px",
                  color: "inherit",
                  fontSize: "12px",
                  padding: "4px",
                  width: "48px",
                }}
              />
            ) : null}
          </div>
        </div>
        <ClockAudiencePicker
          idPrefix="clock-edit"
          players={players}
          noneLabel={noneLabel}
          allLabel={allLabel}
          value={who}
          onChange={setWho}
        />
        <div style={{ alignItems: "center", display: "flex", gap: "6px" }}>
          {onDelete ? (
            <button
              type="button"
              onClick={() => (confirming ? onDelete() : setConfirming(true))}
              style={{ ...btn, borderColor: "#7f1d1d", color: "#f87171" }}
            >
              {confirming ? `Confirm ${deleteLabel.toLowerCase()}` : deleteLabel}
            </button>
          ) : null}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onCancel} style={btn}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!trimmed}
            onClick={() => onSave?.({ name: trimmed, segments, audience: who })}
            style={{
              ...btn,
              background: "var(--sheet-label, #1e3a5f)",
              color: "var(--bg-card, #fff)",
              cursor: trimmed ? "pointer" : "not-allowed",
              opacity: trimmed ? 1 : 0.5,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

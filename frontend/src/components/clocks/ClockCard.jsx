import React from "react";
import ProgressClock from "../ProgressClock";

const badge = {
  border: "1px solid var(--border, #374151)",
  borderRadius: "3px",
  color: "var(--text-muted, #9ca3af)",
  fontSize: "9px",
  lineHeight: 1.4,
  maxWidth: "100%",
  overflow: "hidden",
  padding: "0 4px",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

/**
 * One clock tile: name, clock, fill, who made it and who sees it. Editing
 * lives in ClockEditPopover, opened from the ⋯ button.
 *
 * creator: label for the maker ("YOU", "GM", a username), or null.
 * audience: { icon, text, title } from clockAudienceBadge, or null.
 */
export default function ClockCard({
  name,
  segments,
  filled,
  completed = false,
  creator = null,
  audience = null,
  canTick = false,
  onTick,
  canEdit = false,
  onEdit,
  size = 44,
}) {
  return (
    <div
      style={{
        background: "var(--bg-card, #111827)",
        border: `1px solid ${completed ? "#16a34a" : "var(--border, #374151)"}`,
        borderRadius: "6px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "3px",
        minWidth: 0,
        opacity: completed ? 0.8 : 1,
        padding: "5px 6px",
        textAlign: "center",
      }}
    >
      <div style={{ alignItems: "center", display: "flex", gap: "4px", minWidth: 0 }}>
        <span
          title={name}
          style={{
            color: "var(--text-primary, #e5e7eb)",
            flex: 1,
            fontSize: "11px",
            fontWeight: 600,
            minWidth: 0,
            overflow: "hidden",
            textAlign: "left",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name || "Clock"}
        </span>
        {canEdit ? (
          <button
            type="button"
            aria-label={`Edit ${name || "clock"}`}
            title="Edit clock"
            onClick={onEdit}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted, #9ca3af)",
              cursor: "pointer",
              flexShrink: 0,
              fontSize: "14px",
              lineHeight: 1,
              padding: "0 2px",
            }}
          >
            ⋯
          </button>
        ) : null}
      </div>
      <div style={{ display: "flex", justifyContent: "center", minWidth: 0 }}>
        <ProgressClock
          size={size}
          segments={segments}
          filled={filled}
          interactive={canTick}
          onClick={canTick ? onTick : null}
        />
      </div>
      <div style={{ color: "var(--text-muted, #9ca3af)", fontSize: "10px" }}>
        {completed ? "✓ " : ""}
        {filled}/{segments}
      </div>
      {creator || audience ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", justifyContent: "center" }}>
          {creator ? (
            <span style={badge} title={`Made by ${creator}`}>
              {creator}
            </span>
          ) : null}
          {audience ? (
            <span style={badge} title={audience.title}>
              {audience.icon} {audience.text}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

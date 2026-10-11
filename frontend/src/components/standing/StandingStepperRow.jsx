import React from "react";
import HomeCardThumb from "../home/HomeCardThumb";
import {
  clampStandingValue,
  formatSignedStanding,
  standingValueColor,
} from "../../utils/standingMaps";

/**
 * Thumb + label + optional − / value / + for −3…+3 standing.
 * Prefer `onDelta` for snappy rapid clicks; `onChange(absolute)` remains supported.
 */
export default function StandingStepperRow({
  thumbSrc = null,
  label,
  value,
  editable = false,
  disabled = false,
  onChange,
  onDelta,
  /** When set, show GM "See" checkbox for player visibility of this edge. */
  seeVisible = null,
  onSeeChange = null,
  seeDisabled = false,
  style,
}) {
  const n = clampStandingValue(value ?? 0);
  const signed = formatSignedStanding(n);
  const color = standingValueColor(n);
  const showSee = typeof onSeeChange === "function" && seeVisible != null;

  const bump = (delta) => {
    if (typeof onDelta === "function") {
      onDelta(delta);
      return;
    }
    onChange?.(clampStandingValue(n + delta));
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 6,
        minWidth: 0,
        ...style,
      }}
    >
      <HomeCardThumb
        src={thumbSrc}
        label={label}
        style={{
          width: 28,
          height: 28,
          borderRadius: 4,
          overflow: "hidden",
          flexShrink: 0,
          background: "#111827",
          border: "1px solid #374151",
          fontSize: 12,
        }}
      />
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>
        <div
          style={{
            color: "#d1d5db",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 12,
          }}
          title={label}
        >
          {label}
        </div>
      </div>
      {showSee ? (
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            flexShrink: 0,
            fontSize: 10,
            color: "#9ca3af",
            cursor: disabled || seeDisabled ? "default" : "pointer",
          }}
          title="Players can see this standing"
        >
          <input
            type="checkbox"
            checked={!!seeVisible}
            disabled={disabled || seeDisabled}
            onChange={(e) => onSeeChange(!!e.target.checked)}
          />
          See
        </label>
      ) : null}
      {editable ? (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            disabled={disabled || n <= -3}
            onClick={() => bump(-1)}
            style={{
              fontSize: 11,
              padding: "1px 6px",
              background: "#7f1d1d",
              color: "#fca5a5",
              border: "1px solid #991b1b",
              borderRadius: 4,
              cursor: disabled || n <= -3 ? "default" : "pointer",
              opacity: disabled || n <= -3 ? 0.5 : 1,
              fontFamily: "inherit",
            }}
            aria-label={`Decrease standing for ${label}`}
          >
            −
          </button>
          <span
            style={{
              display: "inline-block",
              width: 28,
              textAlign: "center",
              fontWeight: 700,
              fontSize: 13,
              color,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {signed}
          </span>
          <button
            type="button"
            disabled={disabled || n >= 3}
            onClick={() => bump(1)}
            style={{
              fontSize: 11,
              padding: "1px 6px",
              background: "#14532d",
              color: "#86efac",
              border: "1px solid #166534",
              borderRadius: 4,
              cursor: disabled || n >= 3 ? "default" : "pointer",
              opacity: disabled || n >= 3 ? 0.5 : 1,
              fontFamily: "inherit",
            }}
            aria-label={`Increase standing for ${label}`}
          >
            +
          </button>
        </div>
      ) : (
        <div
          style={{
            flexShrink: 0,
            color,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
          }}
        >
          {signed != null ? signed : "—"}
        </div>
      )}
    </div>
  );
}

import React from "react";

const POS_ORDER = ["controlled", "risky", "desperate"];
const POS_LABELS = {
  controlled: "Controlled",
  risky: "Risky",
  desperate: "Desperate",
};

const EFFECT_ORDER = ["limited", "standard", "extreme"];
const EFFECT_LETTER = { limited: "L", standard: "S", extreme: "E" };

const shapeClip = {
  limited: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  standard:
    "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
  extreme: "inset(8%)",
};

/**
 * Stacked position blocks (active tier highlighted).
 */
export function PositionStack({ activePosition, readOnly = true }) {
  const ap = (activePosition || "risky").toLowerCase();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 120,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#9ca3af",
          fontWeight: 600,
          letterSpacing: "0.06em",
        }}
      >
        POSITION
      </div>
      {POS_ORDER.map((p) => {
        const on = ap === p;
        return (
          <div
            key={p}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              textAlign: "center",
              background: on
                ? p === "controlled"
                  ? "#166534"
                  : p === "desperate"
                    ? "#991b1b"
                    : "#854d0e"
                : "#374151",
              color: on ? "#fff" : "#6b7280",
              border: on
                ? `1px solid ${p === "controlled" ? "#22c55e" : p === "desperate" ? "#f87171" : "#eab308"}`
                : "1px solid #4b5563",
              cursor: readOnly ? "default" : "pointer",
            }}
          >
            {POS_LABELS[p]}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Effect tiers as shaped badges with L / S / E letters.
 */
export function EffectShapes({ activeEffect, readOnly = true }) {
  const ae = (activeEffect || "standard").toLowerCase();
  const normalized = ae === "greater" ? "extreme" : ae;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 100,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#9ca3af",
          fontWeight: 600,
          letterSpacing: "0.06em",
        }}
      >
        EFFECT
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        {EFFECT_ORDER.map((tier) => {
          const on = normalized === tier;
          const fill = on ? "#7c3aed" : "#374151";
          const letterColor = on ? "#fff" : "#6b7280";
          return (
            <div
              key={tier}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: fill,
                  clipPath: shapeClip[tier],
                  color: letterColor,
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: readOnly ? "default" : "pointer",
                }}
              >
                {EFFECT_LETTER[tier]}
              </div>
              <span style={{ fontSize: 9, color: on ? "#c4b5fd" : "#6b7280" }}>
                {tier === "extreme"
                  ? "Extreme"
                  : tier === "standard"
                    ? "Standard"
                    : "Limited"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HistoryBranchIcon({ size = 18, color = "#a78bfa" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="12" cy="18" r="3" />
      <path d="M6 9v1a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v1" />
    </svg>
  );
}

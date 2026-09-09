import React, { useRef } from "react";
import {
  clampClockFilled,
  clockWedgeCount,
  clockWedgeFillColor,
} from "../features/character-sheet/utils/progressClockSegments";

const arrowBtnStyle = {
  background: "none",
  border: "none",
  color: "#6b7280",
  cursor: "pointer",
  fontSize: "12px",
  padding: "0 1px",
  lineHeight: 1,
  flexShrink: 0,
};

/**
 * Compact progress-clock ring. Filled wedges: red → orange → yellow → green.
 * Optional −/+ arrows when interactive + onClick.
 */
const ProgressClock = ({
  size = 80,
  segments = 4,
  filled = 0,
  onClick = null,
  interactive = false,
}) => {
  const n = clockWedgeCount(segments);
  const fill = clampClockFilled(filled, n);
  // Optimistic cursor so rapid +/− before React re-paints still steps 0→1→2…
  // instead of repeating the same absolute target (causes flicker with hydrate).
  const fillRef = useRef(fill);
  if (fillRef.current !== fill) fillRef.current = fill;
  const commitFilled = (next) => {
    if (!onClick) return;
    const clamped = clampClockFilled(next, n);
    fillRef.current = clamped;
    onClick(clamped);
  };
  const r = size / 2 - 4,
    cx = size / 2,
    cy = size / 2;
  const sa = 360 / n;
  const showArrows = interactive && onClick;
  const svg = (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      {Array.from({ length: n }, (_, i) => {
        const a1 = ((i * sa - 90) * Math.PI) / 180;
        const a2 = (((i + 1) * sa - 90) * Math.PI) / 180;
        const x1 = cx + r * Math.cos(a1),
          y1 = cy + r * Math.sin(a1);
        const x2 = cx + r * Math.cos(a2),
          y2 = cy + r * Math.sin(a2);
        return (
          <path
            key={i}
            d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${sa > 180 ? 1 : 0} 1 ${x2} ${y2} Z`}
            fill={i < fill ? clockWedgeFillColor(i, n) : "transparent"}
            stroke="#6b7280"
            strokeWidth="1"
            style={{ cursor: interactive ? "pointer" : "default" }}
            onClick={
              interactive && onClick
                ? () => {
                    const cur = fillRef.current;
                    commitFilled(i < cur ? i : i + 1);
                  }
                : undefined
            }
          />
        );
      })}
    </svg>
  );
  if (showArrows) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "1px",
          minWidth: 0,
          maxWidth: "100%",
        }}
      >
        <button
          type="button"
          style={arrowBtnStyle}
          onClick={() => commitFilled(fillRef.current - 1)}
          title="Decrease filled ticks"
        >
          −
        </button>
        {svg}
        <button
          type="button"
          style={arrowBtnStyle}
          onClick={() => commitFilled(fillRef.current + 1)}
          title="Increase filled ticks"
        >
          +
        </button>
      </div>
    );
  }
  return svg;
};

export default ProgressClock;

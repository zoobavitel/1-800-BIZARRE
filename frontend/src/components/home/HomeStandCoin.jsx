import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const CX = 100;
const CY = 100;
const R_OUTER = 92;
const R_RING = 88;
const R_LABEL = 78;
const R_DATA_MAX = 68;
const R_DATA_MIN = 14;

/** SRD_DEV: wedge rolls — top = Power, then clockwise Precision, Speed */
const RADAR_STATS = [
  {
    key: "power",
    label: "Power",
    grade: "D",
    blurb:
      "Physical destructive power — parallel dice when fiction calls for a Stand strike.",
  },
  {
    key: "precision",
    label: "Precision",
    grade: "B",
    blurb:
      "Accuracy and control — parallel dice for fine manipulation or ranged pressure.",
  },
  {
    key: "speed",
    label: "Speed",
    grade: "B",
    blurb:
      "Conflict position and mobility — parallel dice when quickness decides position.",
  },
];

/**
 * SRD_DEV: Range / Development are passive (no wedge pool).
 * Durability uses a dice pool (0–4) for resistance / armor, not a wedge grade badge.
 */
const DURABILITY = {
  key: "durability",
  label: "Durability",
  /** Demo pool capped at 4 (same cap as Grade A/S on sheet). */
  dicePool: 4,
  blurb:
    "Dice pool only (no wedge letter): absorbs harm to your Stand, drives resist rolls and Stand armor. PC stress track stays 9 — Durability does not add boxes. Upgrade via Stand Coin wedges on your sheet—not shown on this radar.",
};

const RADAR_VERTEX_COUNT = RADAR_STATS.length;

const GRADE_RADIUS = {
  F: 0.08,
  D: 0.28,
  C: 0.44,
  B: 0.6,
  A: 0.78,
  S: 0.94,
};

function polar(cx, cy, r, angleRad) {
  return [cx + r * Math.cos(angleRad), cy + r * Math.sin(angleRad)];
}

function wedgePath(i) {
  const center = -Math.PI / 2 + (i * 2 * Math.PI) / RADAR_VERTEX_COUNT;
  const halfArc = Math.PI / RADAR_VERTEX_COUNT;
  const a0 = center - halfArc;
  const a1 = center + halfArc;
  const [x0, y0] = polar(CX, CY, R_OUTER, a0);
  const [x1, y1] = polar(CX, CY, R_OUTER, a1);
  const largeArc = 0;
  return `M ${CX} ${CY} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R_OUTER} ${R_OUTER} 0 ${largeArc} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

function statAngle(i) {
  return -Math.PI / 2 + (i * 2 * Math.PI) / RADAR_VERTEX_COUNT;
}

function polygonPoints() {
  return RADAR_STATS.map((s, i) => {
    const t = GRADE_RADIUS[s.grade] ?? GRADE_RADIUS.D;
    const r = R_DATA_MIN + t * (R_DATA_MAX - R_DATA_MIN);
    const [x, y] = polar(CX, CY, r, statAngle(i));
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

export default function HomeStandCoin() {
  const rootRef = useRef(null);
  const [hoveredWedge, setHoveredWedge] = useState(null);
  const [durabilityHovered, setDurabilityHovered] = useState(false);
  const [pinned, setPinned] = useState(null);

  const pinOrHoverKey = useMemo(() => {
    if (pinned != null) return pinned;
    if (hoveredWedge != null) return hoveredWedge;
    return durabilityHovered ? DURABILITY.key : null;
  }, [pinned, hoveredWedge, durabilityHovered]);

  const active = useMemo(() => {
    const k = pinOrHoverKey;
    if (!k) return null;
    if (k === DURABILITY.key) return { ...DURABILITY, isDurability: true };
    return RADAR_STATS.find((s) => s.key === k) ?? null;
  }, [pinOrHoverKey]);

  useEffect(() => {
    if (pinned == null) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setPinned(null);
      }
    };
    document.addEventListener("pointerdown", onDoc, true);
    return () => document.removeEventListener("pointerdown", onDoc, true);
  }, [pinned]);

  const onWedgeClick = useCallback((key) => {
    setPinned((p) => (p === key ? null : key));
  }, []);

  const onWedgeKey = useCallback(
    (e, key) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onWedgeClick(key);
      }
    },
    [onWedgeClick],
  );

  const onDurabilityClick = useCallback(() => {
    setPinned((p) => (p === DURABILITY.key ? null : DURABILITY.key));
  }, []);

  const gradeRings = useMemo(
    () =>
      ["F", "D", "C", "B", "A", "S"].map((g) => {
        const t = GRADE_RADIUS[g];
        const r = R_DATA_MIN + t * (R_DATA_MAX - R_DATA_MIN);
        return { g, r };
      }),
    [],
  );

  const announce = active
    ? active.isDurability
      ? `${active.label}, ${active.dicePool} of 4 dice pool. ${active.blurb}`
      : `${active.label}, grade ${active.grade}. ${active.blurb}`
    : "Stand coin: three wedge rolls (Power, Precision, Speed); durability dice below. Hover or tap for details.";

  const wedgeActiveKey =
    typeof pinOrHoverKey === "string" && pinOrHoverKey !== DURABILITY.key
      ? pinOrHoverKey
      : null;

  return (
    <div className="home-stand-coin" ref={rootRef}>
      <span className="home-stand-coin-sr" aria-live="polite">
        {announce}
      </span>
      <div className="home-stand-coin-header">
        <div className="home-stand-coin-kicker">Stand coin</div>
        <div className="home-stand-coin-name">Example stand</div>
      </div>
      <div className="home-stand-coin-main">
        <svg
          className="home-stand-coin-svg"
          viewBox="0 0 200 200"
          role="img"
          aria-labelledby="home-stand-coin-title"
        >
          <title id="home-stand-coin-title">
            Demo stand coin (SRD_DEV): three wedge action grades Power, Precision,
            and Speed; durability is a separate 0–4 dice pool marker under the radar.
          </title>
          <defs>
            <clipPath id="home-stand-coin-clip">
              <circle cx={CX} cy={CY} r={R_RING} />
            </clipPath>
          </defs>

          <circle
            cx={CX}
            cy={CY}
            r={R_OUTER}
            fill="var(--bg2, #0d0814)"
            stroke="var(--p1)"
            strokeWidth="3"
          />
          {gradeRings.map(({ g, r }) => (
            <circle
              key={g}
              cx={CX}
              cy={CY}
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="0.35"
              opacity={0.6}
            />
          ))}

          <g clipPath="url(#home-stand-coin-clip)">
            {RADAR_STATS.map((_, i) => {
              const a = statAngle(i);
              const [xe, ye] = polar(CX, CY, R_RING - 1, a);
              return (
                <line
                  key={`axis-${i}`}
                  x1={CX}
                  y1={CY}
                  x2={xe}
                  y2={ye}
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="0.6"
                  opacity={0.8}
                />
              );
            })}
            <polygon
              points={polygonPoints()}
              fill="var(--p1)"
              fillOpacity={0.45}
              stroke="var(--p2)"
              strokeWidth="1.2"
              strokeOpacity={0.9}
            />
          </g>

          {Array.from({ length: 24 }, (_, t) => {
            const ang = (t * Math.PI) / 12;
            const [ix, iy] = polar(CX, CY, R_OUTER - 2, ang);
            const [ox, oy] = polar(CX, CY, R_OUTER + 3, ang);
            return (
              <line
                key={`tick-${t}`}
                x1={ix}
                y1={iy}
                x2={ox}
                y2={oy}
                stroke="rgba(255,255,255,0.45)"
                strokeWidth={t % 2 === 0 ? 1.1 : 0.5}
                opacity={0.7}
              />
            );
          })}

          {RADAR_STATS.map((s, i) => {
            const a = statAngle(i);
            const [lx, ly] = polar(CX, CY, R_LABEL, a);
            const deg = (a * 180) / Math.PI + 90;
            const hot = wedgeActiveKey === s.key;
            return (
              <g key={s.key}>
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${deg}, ${lx}, ${ly})`}
                  className="home-stand-coin-label"
                  fill="rgba(255,255,255,0.75)"
                  style={{
                    fontSize: 7.5,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 400,
                  }}
                >
                  {s.label.toUpperCase()}
                </text>
                <text
                  x={polar(CX, CY, R_LABEL - 12, a)[0]}
                  y={polar(CX, CY, R_LABEL - 12, a)[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="var(--p2)"
                  style={{
                    fontSize: 9,
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                  }}
                >
                  {s.grade}
                </text>
                {hot && (
                  <circle
                    cx={
                      polar(
                        CX,
                        CY,
                        R_DATA_MIN +
                          (GRADE_RADIUS[s.grade] ?? 0.5) *
                            (R_DATA_MAX - R_DATA_MIN),
                        a,
                      )[0]
                    }
                    cy={
                      polar(
                        CX,
                        CY,
                        R_DATA_MIN +
                          (GRADE_RADIUS[s.grade] ?? 0.5) *
                            (R_DATA_MAX - R_DATA_MIN),
                        a,
                      )[1]
                    }
                    r={4}
                    fill="var(--p2)"
                    fillOpacity={0.9}
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth="0.75"
                  />
                )}
              </g>
            );
          })}

          {RADAR_STATS.map((s, i) => {
            const isHot = hoveredWedge === s.key || pinned === s.key;
            return (
              <path
                key={`hit-${s.key}`}
                d={wedgePath(i)}
                fill={isHot ? "var(--p1)" : "#0d0814"}
                fillOpacity={isHot ? 0.25 : 0.001}
                stroke="none"
                style={{ cursor: "pointer" }}
                role="button"
                tabIndex={0}
                aria-label={`${s.label}, grade ${s.grade}`}
                onMouseEnter={() => setHoveredWedge(s.key)}
                onMouseLeave={() => setHoveredWedge(null)}
                onFocus={() => setHoveredWedge(s.key)}
                onBlur={() => setHoveredWedge(null)}
                onClick={() => onWedgeClick(s.key)}
                onKeyDown={(e) => onWedgeKey(e, s.key)}
              />
            );
          })}
        </svg>
        <button
          type="button"
          className={`home-stand-coin-durability${pinned === DURABILITY.key ? " is-selected" : ""}`}
          aria-pressed={pinned === DURABILITY.key}
          aria-label={`${DURABILITY.label}, dice pool ${DURABILITY.dicePool} of 4`}
          onClick={onDurabilityClick}
          onMouseEnter={() => setDurabilityHovered(true)}
          onMouseLeave={() => setDurabilityHovered(false)}
          onFocus={() => setDurabilityHovered(true)}
          onBlur={() => setDurabilityHovered(false)}
        >
          <span className="home-stand-coin-durability-label">
            {DURABILITY.label}
          </span>
          <span className="home-stand-coin-durability-dots" aria-hidden="true">
            {[1, 2, 3, 4].map((d) => (
              <span
                key={d}
                className={
                  d <= DURABILITY.dicePool
                    ? "home-stand-coin-dur-dot is-on"
                    : "home-stand-coin-dur-dot"
                }
              />
            ))}
          </span>
        </button>
        <div className="home-stand-coin-readout">
          <div className="home-stand-coin-readout-stack">
            <div
              className={`home-stand-coin-readout-panel${active ? " is-inactive" : ""}`}
              aria-hidden={!!active}
            >
              <span className="home-stand-coin-readout-hint">
                Hover or tap a wedge (F–S) or Durability (0–4 dice). Range and
                Development are narrative passives—not on this chart.
              </span>
            </div>
            <div
              className={`home-stand-coin-readout-panel${active ? "" : " is-inactive"}`}
              aria-hidden={!active}
            >
              <span className="home-stand-coin-readout-stat">
                {active?.label ?? "\u00a0"}
              </span>
              {active?.isDurability ? (
                <>
                  <span
                    className="home-stand-coin-readout-grade home-stand-coin-readout-grade--dice"
                    aria-hidden="true"
                  >
                    <span className="home-stand-coin-readout-dotline">
                      {[1, 2, 3, 4].map((d) => (
                        <span
                          key={d}
                          className={
                            d <= active.dicePool
                              ? "home-stand-coin-read-dot is-on"
                              : "home-stand-coin-read-dot"
                          }
                        />
                      ))}
                    </span>
                  </span>
                  <span className="home-stand-coin-readout-dice-caption">
                    {active.dicePool} / 4 dice pool
                  </span>
                </>
              ) : (
                <span className="home-stand-coin-readout-grade">
                  {active?.grade ?? "\u00a0"}
                </span>
              )}
              <span className="home-stand-coin-readout-blurb">
                {active?.blurb ?? "\u00a0"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const CX = 100;
const CY = 100;
const R_OUTER = 92;
const R_RING = 88;
const R_LABEL = 78;
const R_DATA_MAX = 68;
const R_DATA_MIN = 14;

/** SRD order: top = Power, then clockwise */
const STATS = [
  {
    key: 'power',
    label: 'Power',
    grade: 'D',
    blurb: 'Physical destructive power.',
  },
  {
    key: 'speed',
    label: 'Speed',
    grade: 'B',
    blurb: 'Initiative and mobility.',
  },
  {
    key: 'range',
    label: 'Range',
    grade: 'A',
    blurb: 'Operational distance of the stand and its abilities.',
  },
  {
    key: 'durability',
    label: 'Durability',
    grade: 'A',
    blurb: 'Resistance and armor.',
  },
  {
    key: 'precision',
    label: 'Precision',
    grade: 'B',
    blurb: 'Accuracy and control.',
  },
  {
    key: 'development',
    label: 'Development',
    grade: 'C',
    blurb: 'Growth potential.',
  },
];

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
  const center = (-Math.PI / 2 + (i * Math.PI) / 3);
  const a0 = center - Math.PI / 6;
  const a1 = center + Math.PI / 6;
  const [x0, y0] = polar(CX, CY, R_OUTER, a0);
  const [x1, y1] = polar(CX, CY, R_OUTER, a1);
  const largeArc = 0;
  return `M ${CX} ${CY} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R_OUTER} ${R_OUTER} 0 ${largeArc} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

function statAngle(i) {
  return -Math.PI / 2 + (i * Math.PI) / 3;
}

function polygonPoints() {
  return STATS.map((s, i) => {
    const t = GRADE_RADIUS[s.grade] ?? GRADE_RADIUS.D;
    const r = R_DATA_MIN + t * (R_DATA_MAX - R_DATA_MIN);
    const [x, y] = polar(CX, CY, r, statAngle(i));
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

export default function HomeStandCoin() {
  const rootRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [pinned, setPinned] = useState(null);

  const activeKey = pinned ?? hovered;
  const active = STATS.find((s) => s.key === activeKey) ?? null;

  useEffect(() => {
    if (pinned == null) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setPinned(null);
      }
    };
    document.addEventListener('pointerdown', onDoc, true);
    return () => document.removeEventListener('pointerdown', onDoc, true);
  }, [pinned]);

  const onWedgeClick = useCallback((key) => {
    setPinned((p) => (p === key ? null : key));
  }, []);

  const onWedgeKey = useCallback(
    (e, key) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onWedgeClick(key);
      }
    },
    [onWedgeClick]
  );

  const gradeRings = useMemo(
    () =>
      ['F', 'D', 'C', 'B', 'A', 'S'].map((g) => {
        const t = GRADE_RADIUS[g];
        const r = R_DATA_MIN + t * (R_DATA_MAX - R_DATA_MIN);
        return { g, r };
      }),
    []
  );

  const announce = active
    ? `${active.label}, grade ${active.grade}. ${active.blurb}`
    : 'Stand coin: hover or focus a segment for stat details. Tap outside to clear selection.';

  return (
    <div className="home-stand-coin" ref={rootRef}>
      <span className="home-stand-coin-sr" aria-live="polite">
        {announce}
      </span>
      <div className="home-stand-coin-header">
        <div className="home-stand-coin-kicker">Stand coin</div>
        <div className="home-stand-coin-name">Example stand</div>
      </div>
      <div className="home-stand-coin-readout">
        {active ? (
          <>
            <span className="home-stand-coin-readout-stat">{active.label}</span>
            <span className="home-stand-coin-readout-grade">{active.grade}</span>
            <span className="home-stand-coin-readout-blurb">{active.blurb}</span>
          </>
        ) : (
          <span className="home-stand-coin-readout-hint">
            Hover or tap a segment to see each stat and grade (F–S).
          </span>
        )}
      </div>
      <svg
        className="home-stand-coin-svg"
        viewBox="0 0 200 200"
        role="img"
        aria-labelledby="home-stand-coin-title"
      >
        <title id="home-stand-coin-title">
          Demo stand coin with six stats: Power, Speed, Range, Durability, Precision, and Development.
          Grades from F to S.
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
          fill="var(--light-bg-card, #e0d4ab)"
          stroke="var(--light-text)"
          strokeWidth="3"
        />
        {gradeRings.map(({ g, r }) => (
          <circle
            key={g}
            cx={CX}
            cy={CY}
            r={r}
            fill="none"
            stroke="var(--light-text)"
            strokeWidth="0.35"
            opacity={0.22}
          />
        ))}

        <g clipPath="url(#home-stand-coin-clip)">
          {STATS.map((_, i) => {
            const a = statAngle(i);
            const [xe, ye] = polar(CX, CY, R_RING - 1, a);
            return (
              <line
                key={`axis-${i}`}
                x1={CX}
                y1={CY}
                x2={xe}
                y2={ye}
                stroke="var(--light-text)"
                strokeWidth="0.6"
                opacity={0.35}
              />
            );
          })}
          <polygon
            points={polygonPoints()}
            fill="var(--stripe-3)"
            fillOpacity={0.38}
            stroke="var(--stripe-2)"
            strokeWidth="1.2"
            strokeOpacity={0.85}
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
              stroke="var(--light-text)"
              strokeWidth={t % 2 === 0 ? 1.1 : 0.5}
              opacity={0.55}
            />
          );
        })}

        {STATS.map((s, i) => {
          const a = statAngle(i);
          const [lx, ly] = polar(CX, CY, R_LABEL, a);
          const deg = (a * 180) / Math.PI + 90;
          const isActive = activeKey === s.key;
          return (
            <g key={s.key}>
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${deg}, ${lx}, ${ly})`}
                className="home-stand-coin-label"
                fill="var(--light-text)"
                style={{ fontSize: 7.5, fontFamily: 'var(--font-heading)', fontWeight: 700 }}
              >
                {s.label.toUpperCase()}
              </text>
              <text
                x={polar(CX, CY, R_LABEL - 12, a)[0]}
                y={polar(CX, CY, R_LABEL - 12, a)[1]}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="var(--orange)"
                style={{ fontSize: 9, fontFamily: 'var(--font-display)', fontWeight: 700 }}
              >
                {s.grade}
              </text>
              {isActive && (
                <circle
                  cx={polar(CX, CY, R_DATA_MIN + (GRADE_RADIUS[s.grade] ?? 0.5) * (R_DATA_MAX - R_DATA_MIN), a)[0]}
                  cy={polar(CX, CY, R_DATA_MIN + (GRADE_RADIUS[s.grade] ?? 0.5) * (R_DATA_MAX - R_DATA_MIN), a)[1]}
                  r={4}
                  fill="var(--orange)"
                  fillOpacity={0.9}
                  stroke="var(--light-text)"
                  strokeWidth="0.75"
                />
              )}
            </g>
          );
        })}

        {STATS.map((s, i) => {
          const isHot = hovered === s.key || pinned === s.key;
          return (
            <path
              key={`hit-${s.key}`}
              d={wedgePath(i)}
              fill={isHot ? 'var(--orange)' : '#1a1610'}
              fillOpacity={isHot ? 0.14 : 0.001}
              stroke="none"
              style={{ cursor: 'pointer' }}
              role="button"
              tabIndex={0}
              aria-label={`${s.label}, grade ${s.grade}`}
              onMouseEnter={() => setHovered(s.key)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(s.key)}
              onBlur={() => setHovered(null)}
              onClick={() => onWedgeClick(s.key)}
              onKeyDown={(e) => onWedgeKey(e, s.key)}
            />
          );
        })}
      </svg>
    </div>
  );
}

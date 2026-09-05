import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

/** Six-axis playable chart (legacy sheet layout). Hero HomeStandCoin matches this six-wedge radar; copy there calls out SRD_DEV parallel pools. */
const CX = 100;
const CY = 100;
const R_OUTER = 92;
const R_RING = 88;
const R_LABEL = 78;
const R_DATA_MAX = 68;
const R_DATA_MIN = 14;

const GRADE_RADIUS = {
  F: 0.08,
  D: 0.28,
  C: 0.44,
  B: 0.6,
  A: 0.78,
  S: 0.94,
};

const STAT_ORDER = [
  { key: "power", label: "Power" },
  { key: "speed", label: "Speed" },
  { key: "range", label: "Range" },
  { key: "durability", label: "Durability" },
  { key: "precision", label: "Precision" },
  { key: "development", label: "Development" },
];

function polar(cx, cy, r, angleRad) {
  return [cx + r * Math.cos(angleRad), cy + r * Math.sin(angleRad)];
}

function wedgePath(i) {
  const center = -Math.PI / 2 + (i * Math.PI) / 3;
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

function polygonPointsForGrades(grades) {
  return STAT_ORDER.map((s, i) => {
    const g = grades[s.key] ?? "D";
    const t = GRADE_RADIUS[g] ?? GRADE_RADIUS.D;
    const r = R_DATA_MIN + t * (R_DATA_MAX - R_DATA_MIN);
    const [x, y] = polar(CX, CY, r, statAngle(i));
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

const P1 = "var(--hftf-purple)";
const P2 = "var(--hftf-gold)";
const BG2 = "var(--hftf-deep)";

/**
 * Stand coin radar matching the homepage asset; wedges adjust grades via parent.
 * @param {Object} props
 * @param {{ power: string, speed: string, range: string, durability: string, precision: string, development: string }} props.grades
 * @param {Record<string, string>} props.readouts — per-stat summary under the coin
 * @param {(statKey: string, delta: 1 | -1) => void} props.onStep
 * @param {boolean} [props.readOnly=false] — when true, wedges do not change grades (view-only).
 * @param {"npc" | "pc"} [props.variant="npc"] — PC adjusts default copy (grade cap A vs S).
 * @param {"A" | "S"} [props.pcMaxGrade="A"] — when variant is "pc", hints and aria use this as top grade.
 * @param {Record<string, string | { grade: string, blocked?: boolean }>} [props.plannedGrades] — plan-mode ghost grade per axis.
 */
export default function NpcsStandCoin({
  grades,
  readouts,
  onStep,
  readOnly = false,
  variant = "npc",
  pcMaxGrade = "A",
  plannedGrades = null,
}) {
  const reactId = useId().replace(/:/g, "");
  const clipId = `npc-stand-coin-clip-${reactId}`;
  const rootRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [pinned, setPinned] = useState(null);

  const activeKey = pinned ?? hovered;
  const activeMeta = STAT_ORDER.find((s) => s.key === activeKey) ?? null;
  const activeGrade = activeMeta ? grades[activeMeta.key] ?? "D" : null;
  const activeBlurb = activeMeta ? readouts[activeMeta.key] ?? "" : "";

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

  const gradeRings = useMemo(
    () =>
      ["F", "D", "C", "B", "A", "S"].map((g) => {
        const t = GRADE_RADIUS[g];
        const r = R_DATA_MIN + t * (R_DATA_MAX - R_DATA_MIN);
        return { g, r };
      }),
    [],
  );

  const polygonPoints = useMemo(
    () => polygonPointsForGrades(grades),
    [grades],
  );

  const plannedMarkers = useMemo(() => {
    if (!plannedGrades || typeof plannedGrades !== "object") return [];
    return STAT_ORDER.map((s, i) => {
      const raw = plannedGrades[s.key];
      if (raw == null || raw === "") return null;
      const letter =
        typeof raw === "string"
          ? raw
          : String(raw.grade || raw.to_grade || "").trim();
      if (!letter || GRADE_RADIUS[letter] == null) return null;
      const blocked =
        typeof raw === "object" &&
        Boolean(raw.blocked || raw.blocked_reason || raw.blockedReason);
      const t = GRADE_RADIUS[letter];
      const r = R_DATA_MIN + t * (R_DATA_MAX - R_DATA_MIN);
      const [x, y] = polar(CX, CY, r, statAngle(i));
      return { key: s.key, letter, blocked, x, y };
    }).filter(Boolean);
  }, [plannedGrades]);

  const bump = useCallback(
    (key, delta) => {
      if (readOnly) return;
      onStep(key, delta);
      setPinned(key);
    },
    [onStep, readOnly],
  );

  const onWedgeClick = useCallback(
    (e, key) => {
      e.preventDefault();
      bump(key, e.shiftKey ? -1 : 1);
    },
    [bump],
  );

  const onWedgeContext = useCallback(
    (e, key) => {
      e.preventDefault();
      bump(key, -1);
    },
    [bump],
  );

  const onWedgeKey = useCallback(
    (e, key) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (e.shiftKey) bump(key, -1);
        else bump(key, 1);
      }
    },
    [bump],
  );

  const topLetter = variant === "pc" ? pcMaxGrade : "S";
  const idleAnnounce = readOnly
    ? variant === "pc"
      ? "Stand coin is locked after chargen."
      : "Stand coin (read-only)."
    : "Stand coin: left-click a wedge to raise its grade; right-click or Shift-click to lower. Shift+Enter or Shift+Space lowers.";
  const emptyStateLines = readOnly
    ? variant === "pc"
      ? "Stand coin is locked after chargen. Fill playbook (10) or bank 10 in Available XP, then Take advance / level up for +1 grade."
      : "Stand coin is view-only here. Open the full NPC sheet to edit, or ask the GM if this NPC is not yours."
    : variant === "pc"
      ? "Hover or focus a wedge for grade rules."
      : "Left-click a segment to raise its grade (F→S). Right-click or Shift-click to lower. Shift+Enter / Shift+Space on a focused wedge lowers one step.";
  const svgDefaultAria = readOnly
    ? "Stand coin: six stats (read-only)"
    : variant === "pc"
      ? `Stand coin: six stats, grades F through ${topLetter}`
      : "Stand coin: six stats, grades F through S";
  const wedgeSuffix =
    variant === "pc"
      ? ` Maximum grade ${topLetter} for this character.`
      : "";

  const announce = activeMeta
    ? `${activeMeta.label}, grade ${activeGrade}. ${activeBlurb}`
    : idleAnnounce;

  return (
    <div
      ref={rootRef}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
        width: "100%",
        maxWidth: "280px",
        margin: "0 auto 4px",
        userSelect: "none",
        pointerEvents: readOnly ? "none" : "auto",
        opacity: readOnly ? 0.92 : 1,
      }}
    >
      <span style={SR_ONLY} role="status" aria-live="polite" aria-atomic="true">
        {announce}
      </span>
      <div
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: "4px",
          background: "rgba(76, 29, 149, 0.12)",
          border: "1px solid var(--hftf-border)",
          minHeight: "7.5rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          boxSizing: "border-box",
        }}
      >
        {!activeMeta ? (
          <span style={{ fontSize: "10px", lineHeight: 1.4, color: "var(--text-dim)" }}>
            {emptyStateLines}
          </span>
        ) : (
          <>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--hftf-text-dim)",
              }}
            >
              {activeMeta.label}
            </span>
            <span
              style={{
                fontFamily: "Bebas Neue, Oswald, sans-serif",
                fontSize: "26px",
                lineHeight: 1,
                color: P2,
              }}
            >
              {activeGrade}
            </span>
            <span
              style={{
                fontSize: "10px",
                lineHeight: 1.35,
                color: "var(--text-muted)",
                maxWidth: "240px",
                maxHeight: "3.6em",
                overflowY: "auto",
              }}
            >
              {activeBlurb || "\u00a0"}
            </span>
          </>
        )}
      </div>

      <svg
        viewBox="0 0 200 200"
        role="img"
        aria-label={svgDefaultAria}
        style={{
          width: "100%",
          maxWidth: "240px",
          height: "auto",
          display: "block",
          borderRadius: "50%",
          boxShadow: "0 6px 24px rgba(0,0,0,0.45)",
        }}
      >
        <defs>
          <clipPath id={clipId}>
            <circle cx={CX} cy={CY} r={R_RING} />
          </clipPath>
        </defs>

        <circle
          cx={CX}
          cy={CY}
          r={R_OUTER}
          fill={BG2}
          stroke={P1}
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

        <g clipPath={`url(#${clipId})`}>
          {STAT_ORDER.map((_, i) => {
            const a = statAngle(i);
            const [xe, ye] = polar(CX, CY, R_RING - 1, a);
            return (
              <line
                key={`axis-${STAT_ORDER[i].key}`}
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
            points={polygonPoints}
            fill={P1}
            fillOpacity={0.45}
            stroke={P2}
            strokeWidth="1.2"
            strokeOpacity={0.9}
          />
          {plannedMarkers.map((m) => (
            <circle
              key={`planned-${m.key}`}
              cx={m.x}
              cy={m.y}
              r={5.5}
              fill="none"
              stroke={m.blocked ? "#b91c1c" : "var(--sheet-ghost)"}
              strokeWidth={1.4}
              strokeDasharray="3.5 2.5"
              opacity={0.95}
            >
              <title>
                {m.blocked
                  ? `Planned ${m.key} → ${m.letter} (blocked)`
                  : `Planned ${m.key} → ${m.letter}`}
              </title>
            </circle>
          ))}
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

        {STAT_ORDER.map((s, i) => {
          const g = grades[s.key] ?? "D";
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
                fill="rgba(255,255,255,0.75)"
                style={{
                  fontSize: 7.5,
                  fontFamily: "monospace",
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
                fill={P2}
                style={{
                  fontSize: 9,
                  fontFamily: "Bebas Neue, Oswald, sans-serif",
                  fontWeight: 700,
                }}
              >
                {g}
              </text>
              {isActive && (
                <circle
                  cx={
                    polar(
                      CX,
                      CY,
                      R_DATA_MIN +
                        (GRADE_RADIUS[g] ?? 0.5) * (R_DATA_MAX - R_DATA_MIN),
                      a,
                    )[0]
                  }
                  cy={
                    polar(
                      CX,
                      CY,
                      R_DATA_MIN +
                        (GRADE_RADIUS[g] ?? 0.5) * (R_DATA_MAX - R_DATA_MIN),
                      a,
                    )[1]
                  }
                  r={4}
                  fill={P2}
                  fillOpacity={0.9}
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth="0.75"
                />
              )}
            </g>
          );
        })}

        {STAT_ORDER.map((s, i) => {
          const isHot = hovered === s.key || pinned === s.key;
          const g = grades[s.key] ?? "D";
          return (
            <path
              key={`hit-${s.key}`}
              d={wedgePath(i)}
              fill={isHot ? P1 : "var(--hftf-deep)"}
              fillOpacity={isHot ? 0.28 : 0.001}
              stroke="none"
              style={{ cursor: readOnly ? "default" : "pointer" }}
              role={readOnly ? "presentation" : "button"}
              tabIndex={readOnly ? -1 : 0}
              aria-label={
                readOnly
                  ? `${s.label}, grade ${g} (read-only)`
                  : `${s.label}, grade ${g}. Left-click to raise, right-click or Shift-click to lower.${wedgeSuffix}`
              }
              aria-disabled={readOnly ? "true" : undefined}
              onMouseEnter={() => !readOnly && setHovered(s.key)}
              onMouseLeave={() => !readOnly && setHovered(null)}
              onFocus={() => !readOnly && setHovered(s.key)}
              onBlur={() => !readOnly && setHovered(null)}
              onClick={(e) => !readOnly && onWedgeClick(e, s.key)}
              onContextMenu={(e) => !readOnly && onWedgeContext(e, s.key)}
              onKeyDown={(e) => !readOnly && onWedgeKey(e, s.key)}
            />
          );
        })}
      </svg>
    </div>
  );
}

const SR_ONLY = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

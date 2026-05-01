import React from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const CHART_FONT = "'Share Tech Mono', monospace";
const TICK = {
  fill: "rgba(234, 222, 183, 0.55)",
  fontSize: 9,
  fontFamily: CHART_FONT,
};
const GRID = { stroke: "rgba(234, 222, 183, 0.12)" };

const defaultScatter = {
  points: [],
  rowLabels: [],
  xDomain: [0, 1],
};

function truncLabelImpl(s, max = 14) {
  if (!s) return "";
  const t = String(s);
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/**
 * @param {{ points: object[], rowLabels: string[], xDomain: [number, number], truncLabel?: (s:string,n?:number)=>string }} data
 */
export default function HomeSessionScatterChart({
  data = defaultScatter,
  loading = false,
}) {
  const points = Array.isArray(data?.points) ? data.points : [];
  const rowLabels = Array.isArray(data?.rowLabels) ? data.rowLabels : [];
  const xDomain = Array.isArray(data?.xDomain)
    ? data.xDomain
    : defaultScatter.xDomain;

  const hasPoints = points.length > 0;
  const yMax = Math.max(0, rowLabels.length - 1);
  const yTicks = rowLabels.map((_, i) => i);
  const chartHeight = Math.min(
    240,
    Math.max(128, 40 + Math.max(rowLabels.length, 1) * 22),
  );

  const aria = hasPoints
    ? `Scatter of ${points.length} session(s) over the last 12 months by date (proposed date when set).`
    : "No session history with dates in the selected range.";

  const xTickFmt = (ms) => {
    if (ms == null || Number.isNaN(Number(ms))) return "";
    return new Date(ms).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
  };

  return (
    <div
      className="home-chart home-chart-scatter"
      role="img"
      aria-label={aria}
    >
      <div className="home-chart-title">Sessions over time</div>
      {loading ? (
        <div className="home-chart-placeholder">Loading…</div>
      ) : (
        <>
          {!hasPoints && (
            <div className="home-chart-empty">No dated sessions yet</div>
          )}
          <div
            className={
              hasPoints
                ? "home-chart-inner"
                : "home-chart-inner home-chart-inner-dim"
            }
          >
            <ResponsiveContainer width="100%" height={chartHeight}>
              <ScatterChart
                margin={{ top: 6, right: 6, left: 4, bottom: 2 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={GRID.stroke}
                  vertical={false}
                />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={xDomain}
                  tickFormatter={xTickFmt}
                  tick={TICK}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(234,222,183,0.2)" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={
                    rowLabels.length === 0
                      ? [0, 1]
                      : [-0.35, yMax + 0.35]
                  }
                  ticks={rowLabels.length === 0 ? [0] : yTicks}
                  tickFormatter={(v) =>
                    rowLabels.length === 0
                      ? "—"
                      : truncLabelImpl(rowLabels[v] || "", 12)
                  }
                  tick={TICK}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(234,222,183,0.2)" }}
                  width={86}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0]?.payload;
                    if (!p) return null;
                    return (
                      <div
                        style={{
                          background: "#1a1610",
                          border: "1px solid rgba(234,222,183,0.25)",
                          borderRadius: 0,
                          fontSize: 10,
                          fontFamily: CHART_FONT,
                          color: "#eadeb7",
                          padding: "6px 8px",
                        }}
                      >
                        <div style={{ color: "rgba(234,222,183,0.85)" }}>
                          {p.campaignName}
                        </div>
                        <div style={{ fontWeight: 600 }}>{p.sessionName}</div>
                        <div style={{ color: "rgba(234,222,183,0.65)" }}>
                          {new Date(p.x).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={points}
                  isAnimationActive={hasPoints}
                  shape={(props) => {
                    const { cx, cy, payload } = props;
                    if (cx == null || cy == null || !payload) return null;
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill={payload.fill}
                        stroke="rgba(234,222,183,0.55)"
                        strokeWidth={1}
                      />
                    );
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

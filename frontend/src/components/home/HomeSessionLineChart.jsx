import React from "react";
import {
  LineChart,
  Line,
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

/**
 * @param {{ label: string, count: number }[]} data
 */
export default function HomeSessionLineChart({ data = [], loading = false }) {
  const hasPoints = Array.isArray(data) && data.some((d) => d.count > 0);
  const aria = hasPoints
    ? `Sessions per month over the last ${data.length} months.`
    : "No session history with dates in the selected range.";

  return (
    <div className="home-chart home-chart-line" role="img" aria-label={aria}>
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
            <ResponsiveContainer width="100%" height={120}>
              <LineChart
                data={data}
                margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={GRID.stroke}
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={TICK}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(234,222,183,0.2)" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={TICK}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(234,222,183,0.2)" }}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1a1610",
                    border: "1px solid rgba(234,222,183,0.25)",
                    borderRadius: 0,
                    fontSize: 10,
                    fontFamily: CHART_FONT,
                    color: "#eadeb7",
                  }}
                  labelStyle={{ color: "rgba(234,222,183,0.7)" }}
                  formatter={(v) => [v, "Sessions"]}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Sessions"
                  stroke="#e6b422"
                  strokeWidth={2}
                  dot={{
                    r: 2,
                    fill: "#d97b2a",
                    stroke: "#eadeb7",
                    strokeWidth: 1,
                  }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={hasPoints}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

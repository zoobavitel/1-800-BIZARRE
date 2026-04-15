import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const CHART_FONT = "'Share Tech Mono', monospace";
const TICK = {
  fill: "rgba(255, 255, 255, 0.25)",
  fontSize: 8,
  fontFamily: CHART_FONT,
};
const GRID = { stroke: "rgba(255, 255, 255, 0.1)" };

function CountOnlyTooltip({ active, payload }) {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  const value = payload[0]?.value;
  return (
    <div
      style={{
        background: "#0d0814",
        border: "1px solid rgba(108, 57, 137, 0.4)",
        borderRadius: 0,
        fontSize: 10,
        fontFamily: CHART_FONT,
        color: "#f0e6c8",
        padding: "8px 10px",
      }}
    >
      <div style={{ color: "rgba(255, 255, 255, 0.7)" }}>Count</div>
      <div style={{ marginTop: 2, fontSize: 12, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

/**
 * @param {{ name: string, value: number, fill: string }[]} data
 */
export default function HomeStatsBarChart({ data = [], loading = false }) {
  const aria = `Snapshot counts: ${(data || [])
    .map((d) => `${d.name} ${d.value}`)
    .join(", ")}.`;

  return (
    <div className="home-chart home-chart-bar" role="img" aria-label={aria}>
      <div className="home-chart-title">Your counts</div>
      {loading ? (
        <div className="home-chart-placeholder">Loading…</div>
      ) : (
        <div className="home-chart-inner">
          <ResponsiveContainer width="100%" height={120}>
            <BarChart
              data={data}
              margin={{ top: 4, right: 4, left: -18, bottom: 2 }}
              barCategoryGap="18%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={GRID.stroke}
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={TICK}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.15)" }}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={48}
              />
              <YAxis
                tick={TICK}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.15)" }}
                allowDecimals={false}
                width={28}
              />
              <Tooltip content={<CountOnlyTooltip />} />
              <Bar dataKey="value" radius={[1, 1, 0, 0]} isAnimationActive>
                {(data || []).map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

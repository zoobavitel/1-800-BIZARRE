import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const CHART_FONT = "'Share Tech Mono', monospace";
const TICK = { fill: 'rgba(234, 222, 183, 0.55)', fontSize: 8, fontFamily: CHART_FONT };
const GRID = { stroke: 'rgba(234, 222, 183, 0.12)' };

/**
 * @param {{ name: string, value: number, fill: string }[]} data
 */
export default function HomeStatsBarChart({ data = [], loading = false }) {
  const aria = `Snapshot counts: ${(data || [])
    .map((d) => `${d.name} ${d.value}`)
    .join(', ')}.`;

  return (
    <div className="home-chart home-chart-bar" role="img" aria-label={aria}>
      <div className="home-chart-title">Your counts</div>
      {loading ? (
        <div className="home-chart-placeholder">Loading…</div>
      ) : (
        <div className="home-chart-inner">
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 2 }} barCategoryGap="18%">
              <CartesianGrid strokeDasharray="3 3" stroke={GRID.stroke} vertical={false} />
              <XAxis
                dataKey="name"
                tick={TICK}
                tickLine={false}
                axisLine={{ stroke: 'rgba(234,222,183,0.2)' }}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={48}
              />
              <YAxis
                tick={TICK}
                tickLine={false}
                axisLine={{ stroke: 'rgba(234,222,183,0.2)' }}
                allowDecimals={false}
                width={28}
              />
              <Tooltip
                contentStyle={{
                  background: '#1a1610',
                  border: '1px solid rgba(234,222,183,0.25)',
                  borderRadius: 0,
                  fontSize: 10,
                  fontFamily: CHART_FONT,
                  color: '#eadeb7',
                }}
                labelFormatter={(label) => label}
                formatter={(value) => [value, 'Count']}
              />
              <Bar dataKey="value" radius={[1, 1, 0, 0]} isAnimationActive>
                {(data || []).map((entry, i) => (
                  <Cell key={`cell-${entry.name}-${i}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

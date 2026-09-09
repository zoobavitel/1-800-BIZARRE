/**
 * Optional k6 twin of saturday-table.mjs (HTTP roll bursts only).
 * Stock k6 cannot hold SSE + roll on one VU cleanly; prefer:
 *   npm run test:load:saturday
 * for the real SSE+burst gate. This script stress-checks roll-action alone.
 *
 *   k6 run -e PERF_SEED_JSON=/tmp/bizarre-perf-seed-target.json \
 *          -e PERF_API_BASE_URL=http://127.0.0.1:8000 \
 *          scripts/perf/k6/saturday-table.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Trend } from "k6/metrics";

const rollTrend = new Trend("roll_action_ms");

const seedPath = __ENV.PERF_SEED_JSON || "/tmp/bizarre-perf-seed-target.json";
const players = new SharedArray("players", () => {
  const seed = JSON.parse(open(seedPath));
  const list = [];
  for (const t of seed.tables || []) {
    for (const p of t.players || []) {
      list.push({
        token: p.token,
        character_id: p.character_id,
        session_id: t.session_id,
      });
    }
  }
  return list;
});

const base = (__ENV.PERF_API_BASE_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);
const root = base.endsWith("/api") ? base : `${base}/api`;

export const options = {
  scenarios: {
    saturday_bursts: {
      executor: "per-vu-iterations",
      vus: Math.min(10, players.length || 1),
      iterations: 1,
      maxDuration: "3m",
    },
  },
  thresholds: {
    roll_action_ms: ["p(95)<1500"],
    http_req_failed: ["rate<0.05"],
  },
};

export default function () {
  const me = players[(__VU - 1) % players.length];
  const headers = {
    Authorization: `Token ${me.token}`,
    "Content-Type": "application/json",
  };
  for (let burst = 0; burst < 3; burst++) {
    sleep(20 + Math.random() * 20);
    for (let i = 0; i < 4; i++) {
      const res = http.post(
        `${root}/characters/${me.character_id}/roll-action/`,
        JSON.stringify({ action: "hunt", session_id: me.session_id }),
        { headers, tags: { name: "roll-action" } },
      );
      rollTrend.add(res.timings.duration);
      check(res, { "roll 200": (r) => r.status === 200 });
      sleep(2);
    }
  }
}

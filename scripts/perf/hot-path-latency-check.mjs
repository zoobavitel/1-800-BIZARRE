/**
 * Hot-path API latency: authenticated roll-action + session GET p95 budgets.
 * Requires PERF_SEED_JSON from `manage.py seed_perf_tables`.
 */
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import {
  apiRoot,
  assertSafePerfTarget,
  percentile,
} from "./perf-common.mjs";

const base = process.env.PERF_API_BASE_URL || "http://127.0.0.1:8000";
assertSafePerfTarget(base);

const seedPath =
  process.env.PERF_SEED_JSON || "/tmp/bizarre-perf-seed-floor.json";
const rollBudget = Number(process.env.PERF_ROLL_P95_MS || 800);
const sessionBudget = Number(process.env.PERF_SESSION_P95_MS || 600);
const samples = Math.max(3, Number(process.env.PERF_HOTPATH_SAMPLES || 5));

const seed = JSON.parse(readFileSync(seedPath, "utf8"));
const table = seed.tables?.[0];
const player = table?.players?.[0];
if (!table || !player) {
  throw new Error(`Seed file missing table/player: ${seedPath}`);
}

const root = apiRoot(base);
const headers = {
  Authorization: `Token ${player.token}`,
  "Content-Type": "application/json",
};

async function timed(fn) {
  const start = performance.now();
  const result = await fn();
  return { ms: performance.now() - start, result };
}

const rollMs = [];
const sessionMs = [];

for (let i = 0; i < samples; i++) {
  const roll = await timed(async () => {
    const res = await fetch(
      `${root}/characters/${player.character_id}/roll-action/`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "hunt",
          session_id: table.session_id,
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`roll-action HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json();
  });
  rollMs.push(roll.ms);

  const sess = await timed(async () => {
    const res = await fetch(`${root}/sessions/${table.session_id}/`, {
      headers: { Authorization: `Token ${player.token}` },
    });
    if (!res.ok) {
      throw new Error(`session GET HTTP ${res.status}`);
    }
    return res.json();
  });
  sessionMs.push(sess.ms);
}

rollMs.sort((a, b) => a - b);
sessionMs.sort((a, b) => a - b);
const rollP95 = percentile(rollMs, 95);
const sessionP95 = percentile(sessionMs, 95);

console.log(
  `Hot-path roll-action p95=${rollP95.toFixed(1)}ms (budget ${rollBudget}ms) samples=${samples}`,
);
console.log(
  `Hot-path session GET p95=${sessionP95.toFixed(1)}ms (budget ${sessionBudget}ms)`,
);

if (rollP95 > rollBudget) {
  throw new Error(
    `roll-action p95 ${rollP95.toFixed(1)}ms > ${rollBudget}ms`,
  );
}
if (sessionP95 > sessionBudget) {
  throw new Error(
    `session GET p95 ${sessionP95.toFixed(1)}ms > ${sessionBudget}ms`,
  );
}

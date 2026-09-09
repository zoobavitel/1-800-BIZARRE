/**
 * Saturday-table capacity gate (priority B).
 *
 * Realistic profile: each player holds SSE open for the whole run, long
 * silences, then short conflict bursts of roll-action (+ light session GET).
 * Continuous hammer is NOT the default.
 *
 * Tiers: floor=5, target=10, stretch=18 concurrent players.
 * Never point at production (see perf-common.mjs).
 *
 * Usage:
 *   manage.py seed_perf_tables --tier target --reset --output /tmp/bizarre-perf-seed-target.json
 *   PERF_SEED_JSON=/tmp/... npm run test:load:saturday
 *   PERF_LOAD_TIER=stretch npm run test:load:saturday:stretch
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

const tier = (process.env.PERF_LOAD_TIER || "target").toLowerCase();
const TIER_PLAYERS = { floor: 5, target: 10, stretch: 18 };
const wantPlayers = TIER_PLAYERS[tier];
if (!wantPlayers) {
  throw new Error(`Unknown PERF_LOAD_TIER=${tier} (floor|target|stretch)`);
}

const seedPath =
  process.env.PERF_SEED_JSON || `/tmp/bizarre-perf-seed-${tier}.json`;
const durationMs = Number(process.env.PERF_LOAD_DURATION_MS || 120_000);
const idleMinMs = Number(process.env.PERF_IDLE_MIN_MS || 20_000);
const idleMaxMs = Number(process.env.PERF_IDLE_MAX_MS || 40_000);
const burstMs = Number(process.env.PERF_BURST_MS || 10_000);
const burstGapMs = Number(process.env.PERF_BURST_GAP_MS || 2_000);
const rollBudget = Number(process.env.PERF_ROLL_P95_MS || 1500);
const recoveryMs = Number(process.env.PERF_RECOVERY_MS || 30_000);
const allowFailGraceful = tier === "stretch";

const seed = JSON.parse(readFileSync(seedPath, "utf8"));
const clients = [];
for (const table of seed.tables || []) {
  for (const p of table.players || []) {
    clients.push({
      campaignId: table.campaign_id,
      sessionId: table.session_id,
      gmToken: table.gm?.token,
      ...p,
    });
  }
}
if (clients.length < wantPlayers) {
  throw new Error(
    `Seed has ${clients.length} players; need ${wantPlayers} for tier=${tier}. ` +
      `Re-seed: manage.py seed_perf_tables --tier ${tier} --reset`,
  );
}
const roster = clients.slice(0, wantPlayers);
const root = apiRoot(base);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function jitter(min, max) {
  return min + Math.random() * (max - min);
}

function openSse(client) {
  const url = `${root}/campaigns/${client.campaignId}/events/?token=${encodeURIComponent(client.token)}`;
  const started = performance.now();
  const ac = new AbortController();
  let connected = false;
  let heartbeats = 0;
  let lastHb = started;
  let dropped = false;

  const done = fetch(url, {
    headers: { Accept: "text/event-stream" },
    signal: ac.signal,
  }).then(async (res) => {
    if (!res.ok || !res.body) {
      dropped = true;
      throw new Error(`SSE HTTP ${res.status}`);
    }
    connected = true;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { value, done: eof } = await reader.read();
        if (eof) {
          dropped = true;
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        if (buffer.includes("heartbeat") || buffer.includes(": ") || buffer.includes("connected")) {
          heartbeats += 1;
          lastHb = performance.now();
          buffer = buffer.slice(-400);
        }
      }
    } finally {
      connected = false;
      try {
        reader.releaseLock();
      } catch {
        /* ignore */
      }
    }
  }).catch((err) => {
    connected = false;
    dropped = true;
    if (err?.name !== "AbortError") throw err;
  });

  return {
    client,
    ac,
    get connected() {
      return connected && !dropped;
    },
    get heartbeats() {
      return heartbeats;
    },
    get hbGapMs() {
      return performance.now() - lastHb;
    },
    lifetimeMs() {
      return performance.now() - started;
    },
    close() {
      connected = false;
      ac.abort();
    },
    done,
  };
}

async function rollOnce(client) {
  const t0 = performance.now();
  let ok = false;
  let status = 0;
  try {
    const res = await fetch(
      `${root}/characters/${client.character_id}/roll-action/`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${client.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "hunt",
          session_id: client.sessionId,
        }),
      },
    );
    status = res.status;
    ok = res.ok;
    if (res.ok) await res.json().catch(() => null);
  } catch {
    ok = false;
  }
  return { ms: performance.now() - t0, ok, status };
}

async function sessionGet(client) {
  const t0 = performance.now();
  try {
    const res = await fetch(`${root}/sessions/${client.sessionId}/`, {
      headers: { Authorization: `Token ${client.token}` },
    });
    return { ms: performance.now() - t0, ok: res.ok, status: res.status };
  } catch {
    return { ms: performance.now() - t0, ok: false, status: 0 };
  }
}

async function playClient(client, streamsByUser, endAt) {
  const rollSamples = [];
  const errors = [];
  while (performance.now() < endAt) {
    await sleep(jitter(idleMinMs, idleMaxMs));
    if (performance.now() >= endAt) break;
    const burstEnd = Math.min(endAt, performance.now() + burstMs);
    while (performance.now() < burstEnd) {
      const r = await rollOnce(client);
      rollSamples.push(r.ms);
      if (!r.ok) errors.push(`roll:${r.status}`);
      const s = await sessionGet(client);
      if (!s.ok) errors.push(`session:${s.status}`);
      await sleep(burstGapMs);
    }
  }
  return { rollSamples, errors, sseOk: streamsByUser.get(client.username)?.connected };
}

console.log(
  `Saturday load: tier=${tier} players=${roster.length} duration=${durationMs}ms base=${base}`,
);

const streams = roster.map(openSse);
const byUser = new Map(roster.map((c, i) => [c.username, streams[i]]));
await sleep(2500);

const openAtStart = streams.filter((s) => s.connected).length;
if (openAtStart < roster.length) {
  for (const s of streams) s.close();
  throw new Error(
    `SSE open at start ${openAtStart}/${roster.length} — cannot run capacity gate`,
  );
}

const endAt = performance.now() + durationMs;
const results = await Promise.all(
  roster.map((c) => playClient(c, byUser, endAt)),
);

const openAtEnd = streams.filter((s) => s.connected).length;
const lifetimes = streams.map((s) => s.lifetimeMs());
for (const s of streams) s.close();
await Promise.race([
  Promise.allSettled(streams.map((s) => s.done)),
  sleep(5000),
]);

const allRolls = results.flatMap((r) => r.rollSamples).sort((a, b) => a - b);
const allErrors = results.flatMap((r) => r.errors);
const rollP95 = percentile(allRolls, 95);
lifetimes.sort((a, b) => a - b);
const medianLife = percentile(lifetimes, 50);

console.log(
  `Results: sse_open_end=${openAtEnd}/${roster.length} sse_median_lifetime_ms=${medianLife.toFixed(0)}`,
);
console.log(
  `Results: rolls=${allRolls.length} roll_p95_ms=${rollP95.toFixed(1)} errors=${allErrors.length}`,
);
if (allErrors.length) {
  console.log(`Error sample: ${allErrors.slice(0, 8).join(", ")}`);
}

let failed = false;
const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  failed = true;
};

if (tier === "floor" || tier === "target") {
  if (openAtEnd < roster.length) {
    fail(`SSE dropped under ${tier}: ${openAtEnd}/${roster.length}`);
  }
  if (allErrors.length > 0) {
    fail(`${allErrors.length} HTTP errors under ${tier} (want 0)`);
  }
  if (allRolls.length && rollP95 > rollBudget) {
    fail(`roll p95 ${rollP95.toFixed(1)}ms > ${rollBudget}ms`);
  }
}

if (tier === "stretch") {
  // Must fail gracefully: after shedding SSE load, API recovers.
  console.log(`Stretch recovery probe (${recoveryMs}ms)...`);
  await sleep(2000);
  const probeStart = performance.now();
  let recovered = false;
  while (performance.now() - probeStart < recoveryMs) {
    const c = roster[0];
    const r = await rollOnce(c);
    if (r.ok && r.ms < rollBudget * 2) {
      recovered = true;
      console.log(
        `Recovered: roll ok in ${r.ms.toFixed(0)}ms after ${(performance.now() - probeStart).toFixed(0)}ms`,
      );
      break;
    }
    await sleep(1000);
  }
  if (!recovered) {
    fail(
      "Stretch did not recover within window — possible thread deadlock / hung worker",
    );
  } else if (!allowFailGraceful) {
    // unreachable
  } else {
    console.log(
      "Stretch: graceful degradation path OK (errors during peak are allowed).",
    );
  }
}

if (failed) {
  process.exitCode = 1;
  throw new Error(`Saturday load gate failed for tier=${tier}`);
}

console.log(`PASS saturday-table tier=${tier}`);
process.exit(0);

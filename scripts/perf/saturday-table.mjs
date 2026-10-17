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
  summarize,
} from "./perf-common.mjs";

const base = process.env.PERF_API_BASE_URL || "http://127.0.0.1:8000";
assertSafePerfTarget(base);

const tier = (process.env.PERF_LOAD_TIER || "target").toLowerCase();
const TIER_PLAYERS = { floor: 5, target: 10, stretch: 18, ramp: 40 };
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
const warmupMs = Number(process.env.PERF_WARMUP_MS || 0);
const rampStepMs = Number(process.env.PERF_RAMP_STEP_MS || 60_000);
const rampStepPlayers = Number(process.env.PERF_RAMP_STEP_PLAYERS || 5);
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

const PNG = Uint8Array.from(
  Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fccfc0500f000485018084a98c210000000049454e44ae426082",
    "hex",
  ),
);

function openSse(client) {
  const url = `${root}/campaigns/${client.campaignId}/events/?token=${encodeURIComponent(client.token)}`;
  const started = performance.now();
  const ac = new AbortController();
  let connected = false;
  let heartbeats = 0;
  let lastHb = started;
  let reconnects = 0;
  const events = [];

  function takeEvents(buffer) {
    const parts = buffer.split("\n\n");
    const rest = parts.pop() ?? "";
    for (const block of parts) {
      if (block.includes("heartbeat") || block.includes(": ") || block.includes("connected")) {
        heartbeats += 1;
        lastHb = performance.now();
      }
      const dataLine = block.split("\n").find((line) => line.startsWith("data:"));
      if (!dataLine) continue;
      try {
        const payload = JSON.parse(dataLine.slice(5).trim());
        if (payload?.type === "campaign_update") {
          events.push({ t: performance.now(), reason: String(payload.reason || "") });
        }
      } catch {
        /* comment or partial frame */
      }
    }
    return rest.slice(-400);
  }

  const done = (async () => {
    const decoder = new TextDecoder();
    while (!ac.signal.aborted) {
      let res;
      try {
        res = await fetch(url, {
          headers: { Accept: "text/event-stream" },
          signal: ac.signal,
        });
      } catch (err) {
        if (err?.name === "AbortError" || ac.signal.aborted) return;
        reconnects += 1;
        await sleep(300);
        continue;
      }
      if (!res.ok || !res.body) {
        reconnects += 1;
        await sleep(300);
        continue;
      }
      connected = true;
      const reader = res.body.getReader();
      let buffer = "";
      try {
        while (!ac.signal.aborted) {
          const { value, done: eof } = await reader.read();
          if (eof) break;
          buffer += decoder.decode(value, { stream: true });
          buffer = takeEvents(buffer);
        }
      } catch (err) {
        if (err?.name !== "AbortError" && !ac.signal.aborted) reconnects += 1;
      } finally {
        connected = false;
        try {
          reader.releaseLock();
        } catch {
          /* ignore */
        }
      }
      if (ac.signal.aborted) return;
      // Server closes each stream around SSE_STREAM_MAX_SECONDS. Reconnect.
      reconnects += 1;
      await sleep(200);
    }
  })();

  return {
    client,
    events,
    get connected() {
      return connected;
    },
    get heartbeats() {
      return heartbeats;
    },
    get reconnects() {
      return reconnects;
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

let liveStreams = [];

async function timed(path, options) {
  const t0 = performance.now();
  try {
    const res = await fetch(path, options);
    if (res.body) await res.arrayBuffer().catch(() => null);
    return { ms: performance.now() - t0, ok: res.ok, status: res.status, sentAt: t0 };
  } catch {
    return { ms: performance.now() - t0, ok: false, status: 0, sentAt: t0 };
  }
}

function authHeaders(client, extra = {}) {
  return { Authorization: `Token ${client.token}`, ...extra };
}

async function rollOnce(client) {
  return timed(`${root}/characters/${client.character_id}/roll-action/`, {
    method: "POST",
    headers: authHeaders(client, { "Content-Type": "application/json" }),
    body: JSON.stringify({ action: "hunt", session_id: client.sessionId }),
  });
}

async function sessionGet(client) {
  return timed(`${root}/sessions/${client.sessionId}/`, {
    headers: authHeaders(client),
  });
}

async function characterGet(client) {
  return timed(`${root}/characters/${client.character_id}/`, {
    headers: authHeaders(client),
  });
}

async function campaignGet(client) {
  return timed(`${root}/campaigns/${client.campaignId}/`, {
    headers: authHeaders(client),
  });
}

async function uploadPortrait(client) {
  const body = new FormData();
  body.append("image", new Blob([PNG], { type: "image/png" }), "perf.png");
  return timed(`${root}/characters/${client.character_id}/`, {
    method: "PATCH",
    headers: authHeaders(client),
    body,
  });
}

async function fanoutDelays(client, sentAt) {
  const others = liveStreams.filter(
    (stream) =>
      stream.client.campaignId === client.campaignId &&
      stream.client.username !== client.username,
  );
  const deadline = sentAt + 5000;
  const waits = others.map(async (other) => {
    while (performance.now() < deadline) {
      const hit = other.events.find(
        (event) => event.t >= sentAt && event.reason === "roll",
      );
      if (hit) return hit.t - sentAt;
      await sleep(25);
    }
    return null;
  });
  const all = await Promise.all(waits);
  const delays = all.filter((delay) => delay != null);
  return { delays, missing: all.length - delays.length };
}

async function playClient(client, endAt) {
  const samples = {
    roll: [],
    session: [],
    character: [],
    campaign: [],
    portrait: [],
    fanout: [],
  };
  const errors = [];
  while (performance.now() < endAt) {
    await sleep(jitter(idleMinMs, idleMaxMs));
    if (performance.now() >= endAt) break;
    const burstEnd = Math.min(endAt, performance.now() + burstMs);
    let uploaded = false;
    while (performance.now() < burstEnd) {
      const calls = [
        ["roll", () => rollOnce(client)],
        ["session", () => sessionGet(client)],
        ["character", () => characterGet(client)],
        ["campaign", () => campaignGet(client)],
      ];
      if (!uploaded) {
        calls.push(["portrait", () => uploadPortrait(client)]);
        uploaded = true;
      }
      for (const [name, run] of calls) {
        if (performance.now() >= burstEnd) break;
        const result = await run();
        samples[name].push(result.ms);
        if (!result.ok) errors.push(`${name}:${result.status}`);
        if (name === "roll" && result.ok) {
          const fan = await fanoutDelays(client, result.sentAt);
          samples.fanout.push(...fan.delays);
          if (fan.missing) errors.push(`fanout:timeout:${fan.missing}`);
        }
        await sleep(burstGapMs);
      }
    }
  }
  return { samples, errors };
}

console.log(
  `Saturday load: tier=${tier} players=${roster.length} duration=${durationMs}ms base=${base}`,
);

const streams = [];
liveStreams = streams;

function attach(clients) {
  for (const client of clients) {
    const stream = openSse(client);
    streams.push(stream);
  }
}

const firstWave = tier === "ramp" ? roster.slice(0, rampStepPlayers) : roster;
attach(firstWave);
await sleep(2500);

const openAtStart = streams.filter((s) => s.connected).length;
if (openAtStart < firstWave.length) {
  for (const s of streams) s.close();
  throw new Error(
    `SSE open at start ${openAtStart}/${firstWave.length} — cannot run capacity gate`,
  );
}

if (warmupMs > 0) {
  console.log(`Warm-up ${warmupMs}ms (not recorded)`);
  const warmUntil = performance.now() + warmupMs;
  await Promise.all(firstWave.map((client) => playClient(client, warmUntil)));
}

const recordedStart = performance.now();
const endAt = recordedStart + durationMs;
const results = [];

if (tier === "ramp") {
  let playing = firstWave.slice();
  while (performance.now() < endAt && playing.length <= roster.length) {
    const waveEnd = Math.min(endAt, performance.now() + rampStepMs);
    console.log(`Ramp: players=${playing.length}`);
    results.push(
      ...(await Promise.all(playing.map((client) => playClient(client, waveEnd)))),
    );
    if (playing.length >= roster.length || performance.now() >= endAt) break;
    const next = roster.slice(playing.length, playing.length + rampStepPlayers);
    if (!next.length) break;
    attach(next);
    await sleep(1500);
    playing = playing.concat(next);
  }
} else {
  results.push(...(await Promise.all(roster.map((client) => playClient(client, endAt)))));
}

const recordedMs = performance.now() - recordedStart;

const openAtEnd = streams.filter((s) => s.connected).length;
const lifetimes = streams.map((s) => s.lifetimeMs());
for (const s of streams) s.close();
await Promise.race([
  Promise.allSettled(streams.map((s) => s.done)),
  sleep(5000),
]);

const allErrors = results.flatMap((r) => r.errors);
const reconnects = streams.reduce((sum, stream) => sum + stream.reconnects, 0);
lifetimes.sort((a, b) => a - b);
const medianLife = percentile(lifetimes, 50);
const expectedOpen = tier === "ramp" ? streams.length : roster.length;

function report(name) {
  const samples = results.flatMap((r) => r.samples[name] || []);
  const stats = summarize(samples, recordedMs);
  console.log(
    `Results: ${name} n=${stats.n} p50=${stats.p50.toFixed(1)} p95=${stats.p95.toFixed(1)} p99=${stats.p99.toFixed(1)} max=${stats.max.toFixed(1)} rps=${stats.rps.toFixed(2)}`,
  );
  return stats;
}

console.log(
  `Results: sse_open_end=${openAtEnd}/${expectedOpen} sse_median_lifetime_ms=${medianLife.toFixed(0)} sse_reconnects=${reconnects}`,
);
const rollStats = report("roll");
const fanoutStats = report("fanout");
report("session");
report("character");
report("campaign");
report("portrait");
const rollP95 = rollStats.p95;
const httpErrors = allErrors.filter((entry) => !entry.startsWith("fanout:"));
const fanoutMisses = allErrors.filter((entry) => entry.startsWith("fanout:"));
const fanoutMissedDeliveries = fanoutMisses.reduce((sum, entry) => {
  const count = Number(entry.split(":")[2] || 0);
  return sum + (Number.isFinite(count) ? count : 0);
}, 0);
console.log(`Results: fanout_missed_deliveries=${fanoutMissedDeliveries}`);
if (httpErrors.length || fanoutMisses.length) {
  console.log(
    `Error sample: ${[...httpErrors, ...fanoutMisses].slice(0, 8).join(", ")}`,
  );
}

let failed = false;
const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  failed = true;
};

if (tier === "floor" || tier === "target") {
  if (openAtEnd < expectedOpen) {
    fail(`SSE dropped under ${tier}: ${openAtEnd}/${expectedOpen}`);
  }
  if (httpErrors.length > 0) {
    fail(`${httpErrors.length} HTTP errors under ${tier} (want 0)`);
  }
  if (rollStats.n && rollP95 > rollBudget) {
    fail(`roll p95 ${rollP95.toFixed(1)}ms > ${rollBudget}ms`);
  }
  if (fanoutStats.n && fanoutStats.p95 > rollBudget) {
    fail(`fanout p95 ${fanoutStats.p95.toFixed(1)}ms > ${rollBudget}ms`);
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

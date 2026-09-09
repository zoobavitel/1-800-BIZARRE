/**
 * Merge-gate SSE gauge: hold N concurrent streams, report open count + median
 * lifetime, and run one roll while streams are held (thread-pool pressure).
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
const holdMs = Number(process.env.PERF_SSE_HOLD_MS || 60_000);
const minOpen = Number(process.env.PERF_SSE_MIN_OPEN || 5);
const rollBudget = Number(process.env.PERF_ROLL_P95_MS || 800);

const seed = JSON.parse(readFileSync(seedPath, "utf8"));
const clients = [];
for (const table of seed.tables || []) {
  for (const p of table.players || []) {
    clients.push({
      campaignId: table.campaign_id,
      sessionId: table.session_id,
      ...p,
    });
  }
}
if (clients.length < minOpen) {
  throw new Error(
    `Need ≥${minOpen} seeded players for SSE gauge; got ${clients.length}. ` +
      `Run: manage.py seed_perf_tables --tier floor --reset`,
  );
}

const root = apiRoot(base);
const slice = clients.slice(0, minOpen);

function openSse(client) {
  const url = `${root}/campaigns/${client.campaignId}/events/?token=${encodeURIComponent(client.token)}`;
  const started = performance.now();
  const ac = new AbortController();
  let heartbeats = 0;
  let connected = false;
  let buffer = "";

  const done = fetch(url, {
    headers: { Accept: "text/event-stream" },
    signal: ac.signal,
  }).then(async (res) => {
    if (!res.ok) {
      throw new Error(`SSE HTTP ${res.status} for campaign ${client.campaignId}`);
    }
    if (!res.body) {
      throw new Error("SSE response has no body");
    }
    connected = true;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { value, done: eof } = await reader.read();
        if (eof) break;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.includes("heartbeat") || buffer.includes("connected")) {
          heartbeats += 1;
          buffer = buffer.slice(-200);
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
    if (err?.name !== "AbortError") throw err;
  });

  return {
    client,
    ac,
    started,
    get connected() {
      return connected;
    },
    get heartbeats() {
      return heartbeats;
    },
    close() {
      const lifetime = performance.now() - started;
      connected = false;
      ac.abort();
      return lifetime;
    },
    done,
  };
}

console.log(
  `SSE gauge: opening ${slice.length} streams for ${holdMs}ms against ${base}`,
);

const streams = slice.map(openSse);
await new Promise((r) => setTimeout(r, 2000));

const openNow = streams.filter((s) => s.connected).length;
if (openNow < minOpen) {
  for (const s of streams) s.ac.abort();
  throw new Error(`Only ${openNow}/${minOpen} SSE streams connected`);
}

// One roll while streams pin threads
const roller = slice[0];
const rollStart = performance.now();
const rollRes = await fetch(
  `${root}/characters/${roller.character_id}/roll-action/`,
  {
    method: "POST",
    headers: {
      Authorization: `Token ${roller.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "hunt",
      session_id: roller.sessionId,
    }),
  },
);
const rollMs = performance.now() - rollStart;
if (!rollRes.ok) {
  for (const s of streams) s.ac.abort();
  throw new Error(
    `roll-action under SSE load failed HTTP ${rollRes.status} in ${rollMs.toFixed(0)}ms`,
  );
}

await new Promise((r) => setTimeout(r, Math.max(0, holdMs - 2000)));

const stillOpen = streams.filter((s) => s.connected).length;
const lifetimes = streams.map((s) => s.close());
await Promise.race([
  Promise.allSettled(streams.map((s) => s.done)),
  new Promise((r) => setTimeout(r, 5000)),
]);

lifetimes.sort((a, b) => a - b);
const medianLifetime = percentile(lifetimes, 50);

console.log(
  `SSE gauge: concurrent_open=${stillOpen} (want ≥${minOpen}) median_lifetime_ms=${medianLifetime.toFixed(0)} heartbeats≈${streams.reduce((n, s) => n + s.heartbeats, 0)}`,
);
console.log(
  `SSE gauge: roll_under_load_ms=${rollMs.toFixed(1)} (budget ${rollBudget}ms)`,
);

if (stillOpen < minOpen) {
  throw new Error(
    `SSE streams dropped early: ${stillOpen}/${minOpen} still open at end`,
  );
}
if (rollMs > rollBudget) {
  throw new Error(
    `roll-action under SSE load ${rollMs.toFixed(1)}ms > ${rollBudget}ms`,
  );
}

process.exit(0);

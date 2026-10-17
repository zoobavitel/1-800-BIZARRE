import assert from "node:assert/strict";
import { test } from "node:test";
import {
  nextReconnectDelay,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  STREAM_LIVED_MS,
} from "./campaignEventsReconnect.mjs";

test("instant error after connected backs off", () => {
  const now = 1_000_000;
  const result = nextReconnectDelay({
    attempt: 0,
    openedAt: now,
    now,
    sawHeartbeat: false,
  });
  assert.equal(result.delayMs, RECONNECT_BASE_MS);
  assert.equal(result.nextAttempt, 1);
});

test("error after a heartbeat waits 3 seconds and resets attempt", () => {
  const now = 1_000_000;
  const result = nextReconnectDelay({
    attempt: 4,
    openedAt: now,
    now,
    sawHeartbeat: true,
  });
  assert.equal(result.delayMs, RECONNECT_BASE_MS);
  assert.equal(result.nextAttempt, 0);
});

test("repeated instant errors climb to the 60 second cap", () => {
  let attempt = 0;
  const now = 5_000_000;
  const delays = [];
  for (let i = 0; i < 8; i += 1) {
    const result = nextReconnectDelay({
      attempt,
      openedAt: now,
      now,
      sawHeartbeat: false,
    });
    delays.push(result.delayMs);
    attempt = result.nextAttempt;
  }
  assert.deepEqual(delays.slice(0, 5), [3000, 6000, 12000, 24000, 48000]);
  assert.equal(delays[5], RECONNECT_MAX_MS);
  assert.equal(delays[6], RECONNECT_MAX_MS);
  assert.equal(delays[7], RECONNECT_MAX_MS);
});

test("open longer than a few seconds reconnects at the base delay", () => {
  const now = 9_000_000;
  const result = nextReconnectDelay({
    attempt: 3,
    openedAt: now - STREAM_LIVED_MS - 1,
    now,
    sawHeartbeat: false,
  });
  assert.equal(result.delayMs, RECONNECT_BASE_MS);
  assert.equal(result.nextAttempt, 0);
});

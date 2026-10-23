import { test } from "node:test";
import assert from "node:assert/strict";
import { pickSessionPanelRefetches } from "./sessionPanelSseRouting.mjs";

test("empty burst does nothing", () => {
  assert.deepEqual(pickSessionPanelRefetches([]), []);
});

test("clock alone is clocks-only", () => {
  assert.deepEqual(pickSessionPanelRefetches(["progress_clock"]), [
    "progress_clock",
  ]);
});

test("clock with a roll keeps both", () => {
  assert.deepEqual(pickSessionPanelRefetches(["roll", "progress_clock"]), [
    "roll",
    "progress_clock",
  ]);
  assert.deepEqual(pickSessionPanelRefetches(["progress_clock", "group_action"]), [
    "group_action",
    "progress_clock",
  ]);
});

test("roll alone skips clocks", () => {
  assert.deepEqual(pickSessionPanelRefetches(["roll"]), ["roll"]);
});

test("clock with a session save takes the light path, not clocks-only", () => {
  assert.deepEqual(pickSessionPanelRefetches(["progress_clock", "session"]), [
    "session",
  ]);
});

test("heavy reason wins and already includes clocks", () => {
  assert.deepEqual(
    pickSessionPanelRefetches(["progress_clock", "roll", "crew"]),
    ["crew"],
  );
});

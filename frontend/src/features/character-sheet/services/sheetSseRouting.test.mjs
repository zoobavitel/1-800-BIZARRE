import { test } from "node:test";
import assert from "node:assert/strict";
import { routeSheetEvents } from "./sheetSseRouting.mjs";

test("other player's character save costs nothing", () => {
  const r = routeSheetEvents([{ reason: "character", character_id: 9 }], [1]);
  assert.deepEqual(r, { full: false, characterIds: [], rolls: false, ownRolls: false, groupActions: false, clocks: false });
});

test("open character save refetches only that character", () => {
  const r = routeSheetEvents(
    [
      { reason: "character", character_id: 1 },
      { reason: "experience_tracker", character_id: 1 },
      { reason: "character", character_id: 2 },
    ],
    [1, 2, 3],
  );
  assert.equal(r.full, false);
  assert.deepEqual(r.characterIds.sort(), [1, 2]);
});

test("roll on another character only bumps rolls", () => {
  const r = routeSheetEvents(
    [{ reason: "roll", character_id: 9, session_id: 4 }],
    [1],
  );
  assert.deepEqual(r, {
    full: false,
    characterIds: [],
    rolls: true,
    ownRolls: false,
    groupActions: false,
    clocks: false,
  });
});

test("npc and faction are ignored", () => {
  const r = routeSheetEvents([{ reason: "npc" }, { reason: "faction" }], [1]);
  assert.deepEqual(r, { full: false, characterIds: [], rolls: false, ownRolls: false, groupActions: false, clocks: false });
});

test("campaign, reconnect, and unscoped events force full sync", () => {
  for (const ev of [
    { reason: "campaign" },
    { reason: "update" },
    { reason: "character" },
  ]) {
    assert.equal(routeSheetEvents([ev], [1]).full, true);
  }
});

test("own roll refetches that character and its rolls", () => {
  const r = routeSheetEvents(
    [
      { reason: "roll", character_id: 1, session_id: 4 },
      { reason: "character", character_id: 1 },
    ],
    [1],
  );
  assert.deepEqual(r, {
    full: false,
    characterIds: [1],
    rolls: true,
    ownRolls: true,
    groupActions: false,
    clocks: false,
  });
});

test("own XP tracker change counts as own rolls", () => {
  const r = routeSheetEvents(
    [{ reason: "experience_tracker", character_id: 1 }],
    [1],
  );
  assert.equal(r.ownRolls, true);
  assert.deepEqual(r.characterIds, [1]);
});

test("group action and session changes refresh group actions", () => {
  for (const reason of ["group_action", "session"]) {
    const r = routeSheetEvents([{ reason, session_id: 4 }], [1]);
    assert.equal(r.full, false);
    assert.equal(r.groupActions, true);
    assert.equal(r.ownRolls, false);
  }
});

test("crew change forces full sync", () => {
  const r = routeSheetEvents([{ reason: "crew" }], [1]);
  assert.equal(r.full, true);
});

test("campaign, crew, or faction clock refreshes clocks, not every sheet", () => {
  const r = routeSheetEvents([{ reason: "progress_clock" }], [1]);
  assert.deepEqual(r, {
    full: false,
    characterIds: [],
    rolls: false,
    ownRolls: false,
    groupActions: false,
    clocks: true,
  });
});

test("another player's party clock refreshes clocks only", () => {
  const r = routeSheetEvents(
    [{ reason: "progress_clock", character_id: 9 }],
    [1],
  );
  assert.equal(r.full, false);
  assert.equal(r.clocks, true);
  assert.deepEqual(r.characterIds, []);
});

test("open character's own clock refetches that character only", () => {
  const r = routeSheetEvents(
    [{ reason: "progress_clock", character_id: 1 }],
    [1],
  );
  assert.equal(r.clocks, false);
  assert.deepEqual(r.characterIds, [1]);
});

test("clock with a roll keeps both", () => {
  const r = routeSheetEvents(
    [{ reason: "progress_clock" }, { reason: "roll", character_id: 9, session_id: 4 }],
    [1],
  );
  assert.equal(r.clocks, true);
  assert.equal(r.rolls, true);
});

test("full sync wins over clocks", () => {
  const r = routeSheetEvents(
    [{ reason: "progress_clock" }, { reason: "campaign" }],
    [1],
  );
  assert.equal(r.full, true);
  assert.equal(r.clocks, false);
});

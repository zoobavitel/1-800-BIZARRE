import {
  changedKeys,
  createSerialSaveQueue,
  pickKeys,
  rebaseDraft,
  sessionFactionDraft,
  sessionFactionPatch,
} from "./factionAutosave";

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("changedKeys", () => {
  test("lists only fields that differ, comparing arrays and objects by value", () => {
    const baseline = { name: "A", contacts: [1, 2], status: { B: 1 } };
    const draft = { name: "A", contacts: [1, 2], status: { B: 2 } };
    expect(changedKeys(draft, baseline)).toEqual(["status"]);
  });

  test("with no baseline every field counts as changed", () => {
    expect(changedKeys({ a: 1, b: 2 }, null)).toEqual(["a", "b"]);
  });
});

describe("pickKeys", () => {
  test("copies only the named keys that exist", () => {
    expect(pickKeys({ a: 1, b: 2 }, ["b", "c"])).toEqual({ b: 2 });
  });
});

describe("rebaseDraft", () => {
  test("keeps local edits and takes the server value for the rest", () => {
    const baseline = { name: "Old", notes: "x", level: "1" };
    const local = { name: "Typed", notes: "x", level: "1" };
    const server = { name: "Old", notes: "changed elsewhere", level: "2" };
    expect(rebaseDraft(local, baseline, server)).toEqual({
      name: "Typed",
      notes: "changed elsewhere",
      level: "2",
    });
  });

  test("with no local draft the server copy wins", () => {
    expect(rebaseDraft(undefined, undefined, { name: "S" })).toEqual({ name: "S" });
  });
});

describe("createSerialSaveQueue", () => {
  test("never runs two saves for one key at once and queues one follow-up", async () => {
    const gates = [];
    let running = 0;
    let maxRunning = 0;
    const save = jest.fn(async () => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      const gate = deferred();
      gates.push(gate);
      await gate.promise;
      running -= 1;
    });
    const queue = createSerialSaveQueue(save);

    const first = queue.request(7);
    expect(queue.isSaving(7)).toBe(true);
    queue.request(7);
    queue.request("7");
    expect(save).toHaveBeenCalledTimes(1);

    gates[0].resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(2);

    gates[1].resolve();
    await first;
    expect(save).toHaveBeenCalledTimes(2);
    expect(maxRunning).toBe(1);
    expect(queue.isSaving(7)).toBe(false);
  });

  test("different keys save in parallel", async () => {
    const gate = deferred();
    const save = jest.fn(() => gate.promise);
    const queue = createSerialSaveQueue(save);
    queue.request(1);
    queue.request(2);
    expect(save).toHaveBeenCalledTimes(2);
    gate.resolve();
  });

  test("a throw ends the run so the next request starts fresh", async () => {
    const save = jest
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    const queue = createSerialSaveQueue(save);
    await expect(queue.request(1)).rejects.toThrow("offline");
    expect(queue.isSaving(1)).toBe(false);
    await queue.request(1);
    expect(save).toHaveBeenCalledTimes(2);
  });
});

describe("session faction drafts", () => {
  test("the draft carries the server's hidden-from-players flags", () => {
    const draft = sessionFactionDraft({
      id: 3,
      name: "Passione",
      players_see_tier: false,
      players_see_hold: false,
      players_see_reputation: false,
      players_see_notes: false,
      players_see_npcs: false,
    });
    expect(draft.players_see_tier).toBe(false);
    expect(draft.players_see_hold).toBe(false);
    expect(draft.players_see_reputation).toBe(false);
    expect(draft.players_see_notes).toBe(false);
    expect(draft.players_see_npcs).toBe(false);
  });

  test("a name edit sends only the name, not the visibility flags", () => {
    const server = sessionFactionDraft({ id: 3, name: "A", players_see_tier: false });
    const draft = { ...server, name: " B " };
    const body = sessionFactionPatch(draft, changedKeys(draft, server));
    expect(body).toEqual({ name: "B" });
  });

  test("numbers and JSON text are converted for the API", () => {
    const draft = sessionFactionDraft({});
    draft.level = "3";
    draft.faction_status = '{"Gang": -1}';
    expect(sessionFactionPatch(draft, ["level", "faction_status"])).toEqual({
      level: 3,
      faction_status: { Gang: -1 },
    });
  });

  test("bad JSON throws", () => {
    expect(() => sessionFactionPatch({ contacts: "[" }, ["contacts"])).toThrow(
      SyntaxError,
    );
  });
});

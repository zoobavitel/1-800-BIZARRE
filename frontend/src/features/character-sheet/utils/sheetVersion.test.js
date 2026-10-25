import {
  MAX_SILENT_RETRIES,
  SheetConflictError,
  SheetSaveRetryError,
  conflictingUnits,
  editedUnits,
  isSameOrNewerVersion,
  pickUnits,
  runVersionedSheetPatch,
  silentRetryDelayMs,
  stableStringify,
  unitLabels,
} from "./sheetVersion";

const BASE_BODY = {
  true_name: "Giorno",
  rival: "Dio",
  background_note: "old",
  standard_abilities: [1, 2],
  hamon_ability_ids: [],
  heritage: 3,
  selected_benefits: [7],
  harm_level1_used: false,
  harm_level1_name: "",
};

function conflict(current) {
  const err = new Error("conflict");
  err.status = 409;
  err.data = { code: "version_conflict", current };
  return err;
}

function counter(start = 0) {
  let n = start;
  return { get: () => n, set: (v) => { n = v; } };
}

describe("stableStringify", () => {
  test("ignores key order", () => {
    expect(stableStringify({ a: 1, b: { c: 2, d: 3 } })).toBe(
      stableStringify({ b: { d: 3, c: 2 }, a: 1 }),
    );
  });
  test("keeps array order", () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });
});

describe("editedUnits", () => {
  test("a field the user changed is edited", () => {
    const local = { ...BASE_BODY, rival: "Diavolo" };
    expect(editedUnits(local, BASE_BODY, BASE_BODY)).toEqual(["rival"]);
  });

  test("an old value the sheet did not refresh is not an edit", () => {
    // Base moved (someone else set rival); the sheet still shows the clean value.
    const base = { ...BASE_BODY, rival: "Diavolo" };
    expect(editedUnits(BASE_BODY, BASE_BODY, base)).toEqual([]);
  });

  test("a server value the sheet took is not an edit", () => {
    const base = { ...BASE_BODY, rival: "Diavolo" };
    const local = { ...BASE_BODY, rival: "Diavolo" };
    expect(editedUnits(local, BASE_BODY, base)).toEqual([]);
  });

  test("units compare as a whole and send together", () => {
    const local = { ...BASE_BODY, hamon_ability_ids: [9] };
    const units = editedUnits(local, BASE_BODY, BASE_BODY);
    expect(units).toEqual(["abilities"]);
    expect(pickUnits(local, units)).toEqual({
      standard_abilities: [1, 2],
      hamon_ability_ids: [9],
    });
  });

  test("without a clean copy, a difference from the base counts", () => {
    const local = { ...BASE_BODY, rival: "Diavolo" };
    expect(editedUnits(local, null, BASE_BODY)).toEqual(["rival"]);
  });
});

describe("conflictingUnits", () => {
  test("server change to an edited field conflicts", () => {
    const local = { ...BASE_BODY, rival: "Diavolo" };
    const current = { ...BASE_BODY, rival: "Pucci" };
    expect(conflictingUnits(["rival"], local, BASE_BODY, current)).toEqual([
      "rival",
    ]);
  });

  test("server reaching the same value is not a conflict", () => {
    const local = { ...BASE_BODY, rival: "Diavolo" };
    const current = { ...BASE_BODY, rival: "Diavolo" };
    expect(conflictingUnits(["rival"], local, BASE_BODY, current)).toEqual([]);
  });

  test("server change to another field is not a conflict", () => {
    const local = { ...BASE_BODY, rival: "Diavolo" };
    const current = { ...BASE_BODY, background_note: "new" };
    expect(conflictingUnits(["rival"], local, BASE_BODY, current)).toEqual([]);
  });
});

describe("silentRetryDelayMs", () => {
  test("backs off about 250, 500, 1000 ms with jitter", () => {
    expect(silentRetryDelayMs(0, () => 0.5)).toBe(250);
    expect(silentRetryDelayMs(1, () => 0.5)).toBe(500);
    expect(silentRetryDelayMs(2, () => 0.5)).toBe(1000);
    expect(silentRetryDelayMs(5, () => 0.5)).toBe(1000);
    expect(silentRetryDelayMs(0, () => 0)).toBe(125);
    expect(silentRetryDelayMs(0, () => 0.999)).toBe(375);
  });
});

describe("isSameOrNewerVersion", () => {
  test("never moves the base backwards", () => {
    expect(isSameOrNewerVersion(5, 4)).toBe(false);
    expect(isSameOrNewerVersion(5, 5)).toBe(true);
    expect(isSameOrNewerVersion(undefined, 1)).toBe(true);
    expect(isSameOrNewerVersion(5, undefined)).toBe(false);
  });
});

describe("unitLabels", () => {
  test("merges units that share a label", () => {
    expect(unitLabels(["harm1a", "harm2b", "rival"])).toEqual(["Harm", "Rival"]);
  });
});

describe("runVersionedSheetPatch", () => {
  const baseRaw = { id: 1, version: 4 };
  const bodyFromRaw = (raw) => raw.body;

  function setup({ local, responses, retries = counter() }) {
    const sent = [];
    const adopted = [];
    const sleeps = [];
    const patch = jest.fn(async (body) => {
      sent.push(body);
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return next;
    });
    const run = () =>
      runVersionedSheetPatch({
        localBody: local,
        cleanBody: BASE_BODY,
        base: { raw: baseRaw, body: BASE_BODY },
        bodyFromRaw,
        patch,
        adopt: (raw) => adopted.push(raw.version),
        retries,
        sleep: async (ms) => {
          sleeps.push(ms);
        },
        random: () => 0.5,
      });
    return { run, sent, adopted, sleeps, patch, retries };
  }

  test("sends only edited units with the base version", async () => {
    const local = { ...BASE_BODY, rival: "Diavolo" };
    const { run, sent, adopted } = setup({
      local,
      responses: [{ id: 1, version: 5 }],
    });
    const out = await run();
    expect(sent).toEqual([{ rival: "Diavolo", version: 4 }]);
    expect(adopted).toEqual([5]);
    expect(out.saved.version).toBe(5);
  });

  test("no edits means no request", async () => {
    const { run, patch } = setup({ local: BASE_BODY, responses: [] });
    const out = await run();
    expect(patch).not.toHaveBeenCalled();
    expect(out.skipped).toBe(true);
  });

  test("a 409 on another field rebases and retries with the new version", async () => {
    const local = { ...BASE_BODY, rival: "Diavolo" };
    const current = {
      id: 1,
      version: 6,
      body: { ...BASE_BODY, background_note: "GM wrote this" },
    };
    const { run, sent, adopted, sleeps, retries } = setup({
      local,
      responses: [conflict(current), { id: 1, version: 7 }],
    });
    await run();
    expect(sent).toEqual([
      { rival: "Diavolo", version: 4 },
      { rival: "Diavolo", version: 6 },
    ]);
    expect(adopted).toEqual([6, 7]);
    expect(sleeps).toEqual([250]);
    expect(retries.get()).toBe(0);
  });

  test("a 409 on an edited field throws a conflict and sends nothing more", async () => {
    const local = { ...BASE_BODY, rival: "Diavolo" };
    const current = { id: 1, version: 6, body: { ...BASE_BODY, rival: "Pucci" } };
    const { run, sent, adopted } = setup({
      local,
      responses: [conflict(current)],
    });
    const err = await run().catch((e) => e);
    expect(err).toBeInstanceOf(SheetConflictError);
    expect(err.units).toEqual(["rival"]);
    expect(err.labels).toEqual(["Rival"]);
    expect(sent).toHaveLength(1);
    expect(adopted).toEqual([6]);
  });

  test("after the cap it stops with a retry status, not a conflict", async () => {
    const local = { ...BASE_BODY, rival: "Diavolo" };
    const busy = (v) =>
      conflict({ id: 1, version: v, body: { ...BASE_BODY, background_note: `n${v}` } });
    const { run, sent, sleeps, retries } = setup({
      local,
      responses: [busy(5), busy(6), busy(7), busy(8)],
    });
    const err = await run().catch((e) => e);
    expect(err).toBeInstanceOf(SheetSaveRetryError);
    expect(sent).toHaveLength(MAX_SILENT_RETRIES + 1);
    expect(sleeps).toEqual([250, 500, 1000]);
    expect(retries.get()).toBe(MAX_SILENT_RETRIES);
  });

  test("the retry count carries across saves until one succeeds", async () => {
    const local = { ...BASE_BODY, rival: "Diavolo" };
    const busy = conflict({
      id: 1,
      version: 9,
      body: { ...BASE_BODY, background_note: "x" },
    });
    const capped = setup({
      local,
      responses: [busy],
      retries: counter(MAX_SILENT_RETRIES),
    });
    await expect(capped.run()).rejects.toBeInstanceOf(SheetSaveRetryError);
    expect(capped.sent).toHaveLength(1);

    const ok = setup({
      local,
      responses: [{ id: 1, version: 10 }],
      retries: capped.retries,
    });
    await ok.run();
    expect(ok.retries.get()).toBe(0);
  });

  test("a retry drops units the server already matches", async () => {
    const local = { ...BASE_BODY, rival: "Diavolo", background_note: "mine" };
    const current = {
      id: 1,
      version: 6,
      body: { ...BASE_BODY, rival: "Diavolo", appearance: "tall" },
    };
    const { run, sent } = setup({
      local,
      responses: [conflict(current), { id: 1, version: 7 }],
    });
    await run();
    expect(sent[1]).toEqual({ background_note: "mine", version: 6 });
  });

  test("other errors pass through untouched", async () => {
    const local = { ...BASE_BODY, rival: "Diavolo" };
    const boom = new Error("Missing required benefits: [x]");
    boom.status = 400;
    const { run } = setup({ local, responses: [boom] });
    await expect(run()).rejects.toBe(boom);
  });

  test("excluded units are not sent", async () => {
    const local = { ...BASE_BODY, rival: "Diavolo", background_note: "mine" };
    const sent = [];
    await runVersionedSheetPatch({
      localBody: local,
      cleanBody: BASE_BODY,
      base: { raw: baseRaw, body: BASE_BODY },
      bodyFromRaw,
      patch: async (body) => {
        sent.push(body);
        return { id: 1, version: 5 };
      },
      adopt: () => {},
      retries: counter(),
      excludeUnits: ["rival"],
    });
    expect(sent).toEqual([{ background_note: "mine", version: 4 }]);
  });
});

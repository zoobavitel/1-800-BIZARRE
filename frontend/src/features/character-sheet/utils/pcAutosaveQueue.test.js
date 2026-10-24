import {
  markPcAutosaveBusyCollision,
  takePcAutosavePending,
  schedulePcPendingResaveDrain,
} from "./pcAutosaveQueue";

describe("pcAutosaveQueue", () => {
  test("idle save is not skipped and does not mark pending", () => {
    const pending = { current: false };
    expect(markPcAutosaveBusyCollision(false, pending)).toBe(false);
    expect(pending.current).toBe(false);
  });

  test("busy save is skipped and marks pendingResaveRef", () => {
    const pending = { current: false };
    expect(markPcAutosaveBusyCollision(true, pending)).toBe(true);
    expect(pending.current).toBe(true);
  });

  test("takePcAutosavePending clears the flag once", () => {
    const pending = { current: true };
    expect(takePcAutosavePending(pending)).toBe(true);
    expect(pending.current).toBe(false);
    expect(takePcAutosavePending(pending)).toBe(false);
  });

  test("drain calls buildPayload at drain time, not when busy was marked", () => {
    const pending = { current: false };
    const saving = { current: true };
    let buildCalls = 0;
    let draft = { stress: 9 };

    const buildPayload = () => {
      buildCalls += 1;
      return { ...draft };
    };

    // Collision while save in flight — must not snapshot payload yet.
    expect(markPcAutosaveBusyCollision(true, pending)).toBe(true);
    expect(buildCalls).toBe(0);

    draft = { stress: 0 }; // local edit after busy mark
    saving.current = false;

    const saved = [];
    const scheduled = [];
    expect(
      schedulePcPendingResaveDrain({
        pendingResaveRef: pending,
        savingRef: saving,
        buildPayload,
        runSaveWithPayload: (payload) => {
          saved.push(payload);
        },
        schedule: (fn) => {
          scheduled.push(fn);
        },
      }),
    ).toBe(true);

    expect(buildCalls).toBe(0); // still not until drain runs
    expect(saved).toEqual([]);

    scheduled.forEach((fn) => fn());

    expect(buildCalls).toBe(1);
    expect(saved).toEqual([{ stress: 0 }]);
    expect(pending.current).toBe(false);
  });

  test("drain does not reuse a payload object captured at busy time", () => {
    const pending = { current: false };
    const saving = { current: false };
    const capturedAtBusy = { stress: 9, note: "stale" };
    let live = { stress: 9, note: "stale" };

    markPcAutosaveBusyCollision(true, pending);
    // Stash what a buggy drain might have frozen at busy time (must not be used).
    const frozen = { ...live };
    expect(frozen).toEqual(capturedAtBusy);

    live = { stress: 0, note: "cleared" };

    const saved = [];
    schedulePcPendingResaveDrain({
      pendingResaveRef: pending,
      savingRef: saving,
      buildPayload: () => ({ ...live }),
      runSaveWithPayload: (payload) => {
        saved.push(payload);
      },
      schedule: (fn) => fn(),
    });

    expect(saved).toHaveLength(1);
    expect(saved[0]).toEqual({ stress: 0, note: "cleared" });
    expect(saved[0]).not.toEqual(capturedAtBusy);
    expect(saved[0]).not.toBe(frozen);
  });

  test("drain re-marks pending if saving again when callback fires", () => {
    const pending = { current: true };
    const saving = { current: true };
    let buildCalls = 0;

    schedulePcPendingResaveDrain({
      pendingResaveRef: pending,
      savingRef: saving,
      buildPayload: () => {
        buildCalls += 1;
        return { v: 1 };
      },
      runSaveWithPayload: () => {},
      schedule: (fn) => fn(),
    });

    expect(buildCalls).toBe(0);
    expect(pending.current).toBe(true);
  });

  test("onPendingTaken runs when pending is consumed", () => {
    const pending = { current: true };
    const saving = { current: false };
    let taken = 0;
    schedulePcPendingResaveDrain({
      pendingResaveRef: pending,
      savingRef: saving,
      buildPayload: () => ({}),
      runSaveWithPayload: () => {},
      onPendingTaken: () => {
        taken += 1;
      },
      schedule: (fn) => fn(),
    });
    expect(taken).toBe(1);
  });
});

describe("shouldDropAbortedSaveResult", () => {
  const { shouldDropAbortedSaveResult } = require("./pcAutosaveQueue");
  const aborted = () => {
    const c = new AbortController();
    c.abort();
    return c.signal;
  };

  test("keeps a create reply even when aborted, so the new id is not lost", () => {
    expect(shouldDropAbortedSaveResult(null, aborted())).toBe(false);
    expect(shouldDropAbortedSaveResult(undefined, aborted())).toBe(false);
    expect(shouldDropAbortedSaveResult("", aborted())).toBe(false);
  });

  test("drops an aborted update reply", () => {
    expect(shouldDropAbortedSaveResult(35, aborted())).toBe(true);
  });

  test("keeps any reply that was not aborted", () => {
    expect(shouldDropAbortedSaveResult(35, new AbortController().signal)).toBe(
      false,
    );
    expect(shouldDropAbortedSaveResult(35, undefined)).toBe(false);
    expect(shouldDropAbortedSaveResult(null, undefined)).toBe(false);
  });
});

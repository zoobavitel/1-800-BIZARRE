import {
  markNpcAutosaveBusyCollision,
  takeNpcAutosavePending,
} from "./npcAutosaveGate";

describe("npcAutosaveGate", () => {
  test("idle save is not skipped and does not mark pending", () => {
    const pending = { current: false };
    expect(markNpcAutosaveBusyCollision(false, pending)).toBe(false);
    expect(pending.current).toBe(false);
  });

  test("busy save is skipped and marks pending", () => {
    const pending = { current: false };
    expect(markNpcAutosaveBusyCollision(true, pending)).toBe(true);
    expect(pending.current).toBe(true);
  });

  test("takeNpcAutosavePending clears the flag once", () => {
    const pending = { current: true };
    expect(takeNpcAutosavePending(pending)).toBe(true);
    expect(pending.current).toBe(false);
    expect(takeNpcAutosavePending(pending)).toBe(false);
  });
});

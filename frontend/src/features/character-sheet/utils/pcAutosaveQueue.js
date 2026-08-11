/**
 * PC sheet autosave busy-collision queue (mirrors NPC gate; keeps pendingResaveRef name).
 * Drain always invokes buildPayload at follow-up time — never a payload captured when busy.
 */

import {
  markNpcAutosaveBusyCollision,
  takeNpcAutosavePending,
} from "./npcAutosaveGate";

/** @returns {boolean} true if this attempt should be skipped (busy) */
export function markPcAutosaveBusyCollision(isSaving, pendingResaveRef) {
  return markNpcAutosaveBusyCollision(isSaving, pendingResaveRef);
}

/** @returns {boolean} true if a follow-up save should run now */
export function takePcAutosavePending(pendingResaveRef) {
  return takeNpcAutosavePending(pendingResaveRef);
}

/**
 * After an in-flight save finishes: if pending, schedule follow-up with a fresh buildPayload().
 * Does not capture/store payload at busy-mark time.
 *
 * @param {object} opts
 * @param {{ current: boolean }} opts.pendingResaveRef
 * @param {{ current: boolean }} opts.savingRef
 * @param {() => object} opts.buildPayload — called only when drain runs
 * @param {(payload: object) => void | Promise<void>} opts.runSaveWithPayload
 * @param {() => void} [opts.onPendingTaken] — e.g. bump draftGen before schedule
 * @param {(fn: () => void) => void} [opts.schedule] — default setTimeout(0)
 * @returns {boolean} true if a drain was scheduled
 */
export function schedulePcPendingResaveDrain({
  pendingResaveRef,
  savingRef,
  buildPayload,
  runSaveWithPayload,
  onPendingTaken,
  schedule = (fn) => {
    window.setTimeout(fn, 0);
  },
}) {
  if (!takePcAutosavePending(pendingResaveRef)) return false;
  onPendingTaken?.();
  schedule(() => {
    if (savingRef.current) {
      pendingResaveRef.current = true;
      return;
    }
    const payload = buildPayload();
    void runSaveWithPayload(payload);
  });
  return true;
}

/**
 * NPC sheet autosave: if a debounced save fires while another save is in flight,
 * mark pending so the in-flight save can schedule a follow-up with the latest payload.
 * Without this, paste/edits during a slow PUT are dropped forever.
 */

/** @returns {boolean} true if this attempt should be skipped (busy) */
export function markNpcAutosaveBusyCollision(isSaving, pendingRef) {
  if (!isSaving) return false;
  pendingRef.current = true;
  return true;
}

/** @returns {boolean} true if a follow-up save should run now */
export function takeNpcAutosavePending(pendingRef) {
  if (!pendingRef.current) return false;
  pendingRef.current = false;
  return true;
}

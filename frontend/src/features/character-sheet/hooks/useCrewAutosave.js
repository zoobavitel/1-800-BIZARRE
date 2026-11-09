import { useEffect, useRef } from "react";

/**
 * Debounced crew autosave.
 *
 * `payload` is rebuilt on every render. The effect keys on its JSON so a new
 * object with the same values doesn't save.
 *
 * `syncedKeyRef` holds the JSON of the values the server has: set it when the
 * crew loads, and this hook updates it after each save. Matching values are
 * never sent. Before this, every crew save broadcast a crew event, every tab
 * refetched the crew, and the refetch set the same values again, which saved
 * again: a loop every ~2 s with no edit.
 */
export function useCrewAutosave({
  crewId,
  hydratedRef,
  payload,
  syncedKeyRef,
  save,
  delayMs = 900,
}) {
  const saveRef = useRef(save);
  saveRef.current = save;
  const key = JSON.stringify(payload);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  useEffect(() => {
    if (!hydratedRef.current || !crewId) return undefined;
    if (key === syncedKeyRef.current) return undefined;
    const t = setTimeout(() => {
      Promise.resolve(saveRef.current(payloadRef.current))
        .then(() => {
          syncedKeyRef.current = key;
        })
        .catch(() => {});
    }, delayMs);
    return () => clearTimeout(t);
  }, [crewId, key, delayMs, hydratedRef, syncedKeyRef]);
}

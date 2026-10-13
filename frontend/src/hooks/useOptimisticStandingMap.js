import { useCallback, useEffect, useRef, useState } from "react";
import { clampStandingValue } from "../utils/standingMaps";
import { createStandingCommitScheduler } from "../utils/standingCommitScheduler";

/**
 * Optimistic −3…+3 standing overlays with debounced coalesced commits.
 *
 * @param {{ onCommit: (key: string, value: number) => Promise<void>, debounceMs?: number }} opts
 */
export default function useOptimisticStandingMap({
  onCommit,
  debounceMs = 120,
} = {}) {
  const [overrides, setOverrides] = useState({});
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState(null);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const schedulerRef = useRef(null);
  if (!schedulerRef.current) {
    schedulerRef.current = createStandingCommitScheduler({
      debounceMs,
      commit: async (key, value) => {
        await onCommitRef.current?.(key, value);
      },
    });
  }

  useEffect(() => {
    const scheduler = schedulerRef.current;
    return () => {
      scheduler?.dispose();
      schedulerRef.current = null;
    };
  }, []);

  const getValue = useCallback(
    (key, serverValue) => {
      const k = String(key);
      if (Object.prototype.hasOwnProperty.call(overrides, k)) {
        return clampStandingValue(overrides[k]);
      }
      return clampStandingValue(serverValue ?? 0);
    },
    [overrides],
  );

  const setValue = useCallback((key, next) => {
    const k = String(key);
    const clamped = clampStandingValue(next);
    setError(null);
    setOverrides((prev) => ({ ...prev, [k]: clamped }));

    setPendingCount((c) => c + 1);
    const p = schedulerRef.current.schedule(k, clamped);
    void p
      .then((result) => {
        if (result?.ok) {
          setOverrides((prev) => {
            if (!Object.prototype.hasOwnProperty.call(prev, k)) return prev;
            if (prev[k] !== result.value) return prev;
            const nextMap = { ...prev };
            delete nextMap[k];
            return nextMap;
          });
        }
      })
      .catch((e) => {
        setOverrides((prev) => {
          const nextMap = { ...prev };
          delete nextMap[k];
          return nextMap;
        });
        setError(e?.message || "Standing update failed");
      })
      .finally(() => {
        setPendingCount((c) => Math.max(0, c - 1));
      });
  }, []);

  const applyDelta = useCallback(
    (key, serverValue, delta) => {
      const cur = getValue(key, serverValue);
      setValue(key, cur + Number(delta || 0));
    },
    [getValue, setValue],
  );

  return {
    getValue,
    setValue,
    applyDelta,
    overrides,
    pendingCount,
    saving: pendingCount > 0,
    error,
    setError,
  };
}

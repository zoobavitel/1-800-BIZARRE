/**
 * Coalesce rapid standing commits per key (debounce → one commit with latest value).
 * Pure scheduler for unit tests; React hook wraps this.
 */
export function createStandingCommitScheduler({
  commit,
  debounceMs = 120,
} = {}) {
  if (typeof commit !== "function") {
    throw new Error("createStandingCommitScheduler requires commit()");
  }
  const timers = new Map();
  const gens = new Map();
  const latest = new Map();
  /** @type {Map<string, Array<{gen: number, resolve: Function, reject: Function}>>} */
  const waiters = new Map();
  let disposed = false;

  const clearTimer = (key) => {
    const t = timers.get(key);
    if (t != null) {
      clearTimeout(t);
      timers.delete(key);
    }
  };

  const settleSuperseded = (key, currentGen) => {
    const list = waiters.get(key) || [];
    const keep = [];
    for (const w of list) {
      if (w.gen !== currentGen) {
        w.resolve({ skipped: true, key, gen: w.gen });
      } else {
        keep.push(w);
      }
    }
    waiters.set(key, keep);
  };

  return {
    /** Schedule commit of `value` for `key`. Returns Promise of flush result. */
    schedule(key, value) {
      if (disposed) {
        return Promise.resolve({ skipped: true, reason: "disposed" });
      }
      const k = String(key);
      const gen = (gens.get(k) || 0) + 1;
      gens.set(k, gen);
      latest.set(k, value);
      clearTimer(k);
      settleSuperseded(k, gen);

      return new Promise((resolve, reject) => {
        const list = waiters.get(k) || [];
        list.push({ gen, resolve, reject });
        waiters.set(k, list);

        const timer = setTimeout(async () => {
          timers.delete(k);
          const pending = waiters.get(k) || [];
          waiters.set(
            k,
            pending.filter((w) => w.gen === gen),
          );
          const mine = (waiters.get(k) || []).filter((w) => w.gen === gen);
          waiters.set(
            k,
            (waiters.get(k) || []).filter((w) => w.gen !== gen),
          );

          if (disposed || gens.get(k) !== gen) {
            for (const w of mine) {
              w.resolve({ skipped: true, key: k, gen });
            }
            return;
          }
          const v = latest.get(k);
          try {
            await commit(k, v);
            if (gens.get(k) !== gen) {
              for (const w of mine) {
                w.resolve({ skipped: true, key: k, gen, value: v });
              }
              return;
            }
            for (const w of mine) {
              w.resolve({ ok: true, key: k, gen, value: v });
            }
          } catch (e) {
            if (gens.get(k) !== gen) {
              for (const w of mine) {
                w.resolve({ skipped: true, key: k, gen, error: e });
              }
              return;
            }
            for (const w of mine) {
              w.reject(e);
            }
          }
        }, debounceMs);
        timers.set(k, timer);
      });
    },

    /** Current generation for key (for stale-response checks). */
    generation(key) {
      return gens.get(String(key)) || 0;
    },

    latest(key) {
      return latest.get(String(key));
    },

    dispose() {
      disposed = true;
      for (const k of [...timers.keys()]) clearTimer(k);
      for (const [k, list] of waiters.entries()) {
        for (const w of list) {
          w.resolve({ skipped: true, key: k, reason: "disposed" });
        }
      }
      waiters.clear();
    },
  };
}

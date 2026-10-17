export const RECONNECT_BASE_MS = 3000;
export const RECONNECT_MAX_MS = 60000;
/** Open longer than this counts as a lived stream, even with no heartbeat yet. */
export const STREAM_LIVED_MS = 5000;

/**
 * Delay before the next EventSource open.
 * A stream that only got the opening `connected` frame backs off.
 * A heartbeat, or a stream that stayed open, waits {@link RECONNECT_BASE_MS}
 * and clears the attempt counter.
 *
 * @param {{ attempt: number, openedAt: number, now: number, sawHeartbeat: boolean }} state
 * @returns {{ delayMs: number, nextAttempt: number }}
 */
export function nextReconnectDelay({ attempt, openedAt, now, sawHeartbeat }) {
  const livedMs = openedAt > 0 ? now - openedAt : 0;
  const lived = Boolean(sawHeartbeat) || livedMs > STREAM_LIVED_MS;
  if (lived) {
    return { delayMs: RECONNECT_BASE_MS, nextAttempt: 0 };
  }
  const safeAttempt = Number.isFinite(attempt) && attempt > 0 ? attempt : 0;
  const delayMs = Math.min(
    RECONNECT_MAX_MS,
    RECONNECT_BASE_MS * 2 ** Math.min(safeAttempt, 5),
  );
  return { delayMs, nextAttempt: safeAttempt + 1 };
}

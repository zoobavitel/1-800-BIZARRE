/**
 * Subscribe to server-sent campaign updates (position/effect, rolls, character saves).
 * Uses DRF token in the query string because EventSource cannot send Authorization headers.
 *
 * On error, reconnects with backoff instead of closing forever —
 * Firefox / extensions can drop the stream; permanent close left panels stale until reload.
 * A stream that dies before a heartbeat, or before it has been open a few seconds,
 * backs off (3s, 6s, … 60s). A stream that lived waits 3s. Never reconnect at 0ms:
 * that loop burned the gunicorn request cap.
 *
 * Returns an unsubscribe function with `getLastEventAt()` attached so callers can skip
 * redundant poll sync while the stream is healthy (server sends heartbeat data events ~15s
 * and closes the stream after ~30–55s). We reconnect ourselves: a completed HTTP
 * response does not always trigger native EventSource retry.
 */
import { getApiBaseUrl } from "../../../config/apiConfig";
import { nextReconnectDelay } from "./campaignEventsReconnect.mjs";

/**
 * @param {number} campaignId
 * @param {{ onUpdate?: (reason?: string, event?: object) => void }} handlers
 *   `event` is the raw message; it may carry `character_id` / `session_id`.
 * @returns {(() => void) & { getLastEventAt?: () => number }}
 */
export function subscribeCampaignEvents(campaignId, { onUpdate } = {}) {
  const base = getApiBaseUrl();
  const token =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("authToken")
      : null;
  if (!campaignId || !base || !token) {
    const noop = () => {};
    noop.getLastEventAt = () => 0;
    return noop;
  }
  const url = `${base.replace(/\/+$/, "")}/campaigns/${campaignId}/events/?token=${encodeURIComponent(token)}`;

  let es = null;
  let reconnectTimer = null;
  let attempt = 0;
  let closed = false;
  let lastEventAt = 0;
  let sawConnected = false;
  let openedAt = 0;
  let sawHeartbeat = false;

  const touchTraffic = () => {
    lastEventAt = Date.now();
  };

  const clearReconnect = () => {
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (closed) return;
    clearReconnect();
    const decision = nextReconnectDelay({
      attempt,
      openedAt,
      now: Date.now(),
      sawHeartbeat,
    });
    attempt = decision.nextAttempt;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, decision.delayMs);
  };

  const connect = () => {
    if (closed) return;
    if (es) {
      try {
        es.close();
      } catch {
        /* ignore */
      }
      es = null;
    }
    openedAt = Date.now();
    sawHeartbeat = false;
    let next;
    try {
      next = new EventSource(url);
    } catch {
      scheduleReconnect();
      return;
    }
    es = next;
    next.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const prevEventAt = lastEventAt;
        if (
          data &&
          (data.type === "campaign_update" ||
            data.type === "connected" ||
            data.type === "heartbeat")
        ) {
          touchTraffic();
        }
        if (data && data.type === "connected") {
          // Catch events lost in the reconnect gap (poll is skipped while SSE looks healthy).
          // A routine rollover (server closes every ~45s, we reopen in ~3s) leaves
          // a short gap. Refetching on each one made every client pull all sheets
          // every 45s, so only refetch when the gap was long enough to miss a lot.
          if (
            sawConnected &&
            Date.now() - prevEventAt > RECONNECT_REFETCH_GAP_MS
          ) {
            onUpdate?.("update", { reason: "update" });
          }
          sawConnected = true;
        }
        if (data && data.type === "campaign_update") {
          onUpdate?.(data.reason || "update", data);
        }
        // Opening frame is not proof the stream lived. Reset only after a heartbeat.
        if (data && data.type === "heartbeat") {
          sawHeartbeat = true;
          attempt = 0;
        }
      } catch {
        /* ignore */
      }
    };
    next.onerror = () => {
      try {
        next.close();
      } catch {
        /* ignore */
      }
      if (es === next) es = null;
      scheduleReconnect();
    };
  };

  connect();

  const unsubscribe = () => {
    closed = true;
    clearReconnect();
    if (es) {
      try {
        es.close();
      } catch {
        /* ignore */
      }
      es = null;
    }
  };
  unsubscribe.getLastEventAt = () => lastEventAt;
  return unsubscribe;
}

/** Reconnect gaps longer than this (ms) trigger a catch-up refetch. Heartbeat is ~15s. */
const RECONNECT_REFETCH_GAP_MS = 20000;

/** Skip interval poll when SSE delivered traffic within this window (ms). */
export const SSE_HEALTH_SKIP_POLL_MS = 35000;

/**
 * @param {(() => void) & { getLastEventAt?: () => number } | null | undefined} unsub
 * @returns {boolean}
 */
export function isCampaignSseHealthy(unsub) {
  const at = unsub?.getLastEventAt?.();
  if (!at) return false;
  return Date.now() - at < SSE_HEALTH_SKIP_POLL_MS;
}

/**
 * Subscribe to server-sent campaign updates (position/effect, rolls, character saves).
 * Uses DRF token in the query string because EventSource cannot send Authorization headers.
 *
 * On error, reconnects with exponential backoff (capped) instead of closing forever —
 * Firefox / extensions can drop the stream; permanent close left panels stale until reload.
 *
 * Returns an unsubscribe function with `getLastEventAt()` attached so callers can skip
 * redundant poll sync while the stream is healthy (server sends heartbeat data events ~15s
 * and closes the stream after ~30–55s). We reconnect ourselves: a completed HTTP
 * response does not always trigger native EventSource retry.
 */
import { getApiBaseUrl } from "../../../config/apiConfig";

const RECONNECT_BASE_MS = 3000;
const RECONNECT_MAX_MS = 60000;

/**
 * @param {number} campaignId
 * @param {{ onUpdate?: (reason?: string) => void }} handlers
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
    const delay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * 2 ** Math.min(attempt, 5),
    );
    attempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
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
          if (sawConnected) {
            onUpdate?.("update");
          }
          sawConnected = true;
        }
        if (data && data.type === "campaign_update") {
          onUpdate?.(data.reason || "update");
        }
        // Successful traffic: reset backoff so transient blips recover quickly.
        if (
          data &&
          (data.type === "campaign_update" ||
            data.type === "connected" ||
            data.type === "heartbeat")
        ) {
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
      const healthy = lastEventAt > 0 && Date.now() - lastEventAt < 60000;
      if (healthy) {
        // Do not trust native retry after a clean HTTP end (Firefox often stays CLOSED).
        attempt = 0;
        if (closed) return;
        clearReconnect();
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, 0);
        return;
      }
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

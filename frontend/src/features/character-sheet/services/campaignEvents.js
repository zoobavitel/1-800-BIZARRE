/**
 * Subscribe to server-sent campaign updates (position/effect, rolls, character saves).
 * Uses DRF token in the query string because EventSource cannot send Authorization headers.
 *
 * On error, reconnects with exponential backoff (capped) instead of closing forever —
 * Firefox / extensions can drop the stream; permanent close left panels stale until reload.
 */
import { getApiBaseUrl } from "../../../config/apiConfig";

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

/**
 * @param {number} campaignId
 * @param {{ onUpdate?: () => void }} handlers
 * @returns {() => void} unsubscribe
 */
export function subscribeCampaignEvents(campaignId, { onUpdate } = {}) {
  const base = getApiBaseUrl();
  const token =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("authToken")
      : null;
  if (!campaignId || !base || !token) {
    return () => {};
  }
  const url = `${base.replace(/\/+$/, "")}/campaigns/${campaignId}/events/?token=${encodeURIComponent(token)}`;

  let es = null;
  let reconnectTimer = null;
  let attempt = 0;
  let closed = false;

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
        if (data && data.type === "campaign_update") {
          onUpdate?.();
        }
        // Successful traffic: reset backoff so transient blips recover quickly.
        if (data && (data.type === "campaign_update" || data.type === "connected")) {
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

  return () => {
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
}

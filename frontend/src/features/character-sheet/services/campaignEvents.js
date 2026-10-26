/**
 * Subscribe to server-sent campaign updates (position/effect, rolls, character saves).
 * EventSource cannot send an Authorization header, so each connect first POSTs
 * (with the normal token header) for a one-use ticket and opens the stream with
 * ?ticket=. The login token never goes in a URL, where access logs record it.
 * A ticket works once: every reconnect, including after a 401, gets a new one.
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
 *
 * The server caps live streams per user and campaign. A stream a newer one
 * replaced gets `{"type": "evicted"}` and ends. Reconnecting then would evict
 * another of this user's streams, which would reconnect too, round and round.
 * So an evicted stream stays closed until this tab is looked at again (it
 * becomes visible or the window gets focus), then reconnects and catches up.
 * Until then the stream reads unhealthy after SSE_HEALTH_SKIP_POLL_MS and the
 * caller's interval poll takes over, which also covers an evicted tab that is
 * already in front and gets no wake event.
 *
 * Events carry an id (PR 6). A reconnect sends the last id seen as
 * `?last_event_id=` and a server that says `"replay": true` in its connected
 * frame first replays what was missed, so no gap refetch is needed. When it
 * can't (the id is too old), it sends `{"type": "resync"}` and the caller
 * refetches everything. A server without replay keeps the old gap refetch.
 */
import { getApiBaseUrl } from "../../../config/apiConfig";
import { nextReconnectDelay } from "./campaignEventsReconnect.mjs";
import { reportUnauthorized } from "../../../utils/authSession";

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
  const campaignUrl = `${base.replace(/\/+$/, "")}/campaigns/${campaignId}/events`;

  /** One-use stream ticket, or null when the POST fails. */
  const fetchTicket = async () => {
    try {
      const authToken =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("authToken")
          : null;
      if (!authToken) return null;
      const res = await fetch(`${campaignUrl}/ticket/`, {
        method: "POST",
        headers: { Authorization: `Token ${authToken}` },
      });
      if (!res.ok) {
        // An expired or revoked login token: end the session, not just the stream.
        reportUnauthorized(res.status, authToken);
        return null;
      }
      const body = await res.json();
      return typeof body?.ticket === "string" && body.ticket ? body.ticket : null;
    } catch {
      return null;
    }
  };

  let es = null;
  let reconnectTimer = null;
  let attempt = 0;
  let closed = false;
  let lastEventAt = 0;
  let sawConnected = false;
  let openedAt = 0;
  let sawHeartbeat = false;
  // Bumped by each connect and by unsubscribe, so a ticket that arrives late
  // for an older connect is dropped instead of opening a second stream.
  let connectGen = 0;
  // A newer stream replaced this one; wait for the tab to be looked at.
  let evicted = false;
  // The first stream after an evict always refetches: its gap is unknown.
  let catchUpOnConnect = false;
  // Last numbered event seen, and the one this connection asked to resume from.
  let lastEventId = null;
  let resumedFrom = null;

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

  const connect = async () => {
    if (closed) return;
    const gen = ++connectGen;
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
    const ticket = await fetchTicket();
    if (closed || gen !== connectGen) return;
    if (!ticket) {
      // No fallback to ?token=: back off and ask for a ticket again.
      scheduleReconnect();
      return;
    }
    let next;
    resumedFrom = lastEventId;
    const resume = resumedFrom
      ? `&last_event_id=${encodeURIComponent(resumedFrom)}`
      : "";
    try {
      next = new EventSource(
        `${campaignUrl}/?ticket=${encodeURIComponent(ticket)}${resume}`,
      );
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
          // The server replays from resumedFrom, or says resync: no
          // refetch needed here.
          const replays = data.replay === true && resumedFrom != null;
          if (
            !replays &&
            (catchUpOnConnect ||
              (sawConnected &&
                Date.now() - prevEventAt > RECONNECT_REFETCH_GAP_MS))
          ) {
            onUpdate?.("update", { reason: "update" });
          }
          catchUpOnConnect = false;
          sawConnected = true;
          // A fresh stream starts from the server's newest id, so the next
          // reconnect can replay even if no event arrives on this one.
          if (resumedFrom == null && typeof data.cursor === "string" && data.cursor) {
            lastEventId = data.cursor;
          }
        }
        if (data && data.type === "evicted") {
          evicted = true;
          clearReconnect();
          try {
            next.close();
          } catch {
            /* ignore */
          }
          if (es === next) es = null;
          return;
        }
        if (data && data.type === "campaign_update") {
          if (typeof data.id === "string" && data.id) lastEventId = data.id;
          onUpdate?.(data.reason || "update", data);
        }
        if (data && data.type === "resync") {
          // Missed events are gone from the server's buffer. Drop the old id
          // (or take the server's newest), or every later reconnect would
          // resync and refetch again.
          lastEventId =
            typeof data.cursor === "string" && data.cursor ? data.cursor : null;
          onUpdate?.("update", { reason: "update" });
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
    // Always close on error. EventSource would otherwise retry the same URL,
    // and the ticket in it is already spent.
    next.onerror = () => {
      try {
        next.close();
      } catch {
        /* ignore */
      }
      if (es === next) es = null;
      // The server closes an evicted stream right after the frame.
      if (evicted) return;
      scheduleReconnect();
    };
  };

  const wakeAfterEvict = () => {
    if (closed || !evicted) return;
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      return;
    }
    evicted = false;
    catchUpOnConnect = true;
    attempt = 0;
    connect();
  };
  const onVisibilityChange = () => wakeAfterEvict();
  const onFocus = () => wakeAfterEvict();
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibilityChange);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("focus", onFocus);
  }

  connect();

  const unsubscribe = () => {
    closed = true;
    connectGen += 1;
    clearReconnect();
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", onFocus);
    }
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

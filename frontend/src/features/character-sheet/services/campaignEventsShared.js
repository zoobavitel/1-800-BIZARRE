/**
 * One campaign event stream per browser, shared by its tabs (PR 5b).
 *
 * Every tab used to open its own stream, and each stream holds a server
 * thread. Now the tabs of one browser elect a leader with the Web Locks API
 * (one exclusive lock per API host and campaign). The leader opens the real
 * stream (subscribeCampaignEvents) and relays every update to the other tabs
 * over a BroadcastChannel. When the leader tab closes, the browser frees the
 * lock and the next waiting tab takes over at once, then refetches once
 * because events in the hand-off gap are unknown.
 *
 * A tab that is put away (pagehide, or freeze on mobile) gives up the lock,
 * or its place in line, so a frozen tab never holds the stream for everyone.
 * It gets back in line on pageshow or resume.
 *
 * Followers read their health from the leader: it posts its stream's last
 * traffic time every few seconds. If the leader goes quiet, followers read
 * unhealthy after SSE_HEALTH_SKIP_POLL_MS and their interval poll takes over,
 * so a missed hand-off is never worse than polling.
 *
 * Without Web Locks or BroadcastChannel each tab keeps its own stream.
 */
import { getApiBaseUrl } from "../../../config/apiConfig";
import { subscribeCampaignEvents } from "./campaignEvents";

/** How often the leader tells followers its stream's last traffic time. */
const HEALTH_POST_MS = 5000;

const browserLocks = () =>
  typeof navigator !== "undefined" && navigator.locks ? navigator.locks : null;
const browserChannel = () =>
  typeof BroadcastChannel !== "undefined" ? BroadcastChannel : null;

/**
 * Same contract as subscribeCampaignEvents: returns an unsubscribe function
 * with getLastEventAt() for isCampaignSseHealthy.
 *
 * @param {number} campaignId
 * @param {{ onUpdate?: (reason?: string, event?: object) => void }} handlers
 * @param {object} [env] test seams: locks, BroadcastChannel, subscribe,
 *   target (window events), docTarget (document events), apiBase
 */
export function subscribeCampaignEventsShared(
  campaignId,
  handlers = {},
  env = {},
) {
  const locks = "locks" in env ? env.locks : browserLocks();
  const Channel =
    "BroadcastChannel" in env ? env.BroadcastChannel : browserChannel();
  const subscribe = env.subscribe || subscribeCampaignEvents;
  const target =
    env.target || (typeof window !== "undefined" ? window : null);
  const docTarget =
    env.docTarget ||
    env.target ||
    (typeof document !== "undefined" ? document : null);
  const apiBase = env.apiBase ?? getApiBaseUrl();
  if (!campaignId || !locks || !Channel || !target || !apiBase) {
    return subscribe(campaignId, handlers);
  }

  const name = `bizarre-campaign-events:${apiBase}:${campaignId}`;
  const channel = new Channel(name);
  let closed = false;
  let paused = false;
  let isLeader = false;
  let stream = null;
  let releaseLock = null;
  let pending = null;
  let healthTimer = null;
  let lastEventAt = 0;
  // Heard from (or was) a leader, so taking over means a hand-off gap.
  let sawLeader = false;

  const deliver = (reason, event) => {
    if (!closed) handlers.onUpdate?.(reason, event);
  };

  const post = (msg) => {
    try {
      channel.postMessage(msg);
    } catch {
      /* closed channel */
    }
  };

  const postHealth = () => {
    const at = stream?.getLastEventAt?.() || 0;
    if (at > lastEventAt) lastEventAt = at;
    post({ kind: "health", lastEventAt: at });
  };

  channel.onmessage = (e) => {
    const msg = e?.data || {};
    if (closed) return;
    if (msg.kind === "hello") {
      if (isLeader) postHealth();
      return;
    }
    if (isLeader) return;
    if (msg.kind === "health") {
      sawLeader = true;
      if (typeof msg.lastEventAt === "number" && msg.lastEventAt > 0) {
        lastEventAt = msg.lastEventAt;
      }
      return;
    }
    if (msg.kind === "event") {
      sawLeader = true;
      if (typeof msg.at === "number") lastEventAt = Math.max(lastEventAt, msg.at);
      deliver(msg.reason, msg.event);
    }
  };

  const lead = () =>
    new Promise((resolve) => {
      if (closed || paused) {
        resolve();
        return;
      }
      isLeader = true;
      releaseLock = resolve;
      const tookOver = sawLeader;
      sawLeader = true;
      stream = subscribe(campaignId, {
        onUpdate: (reason, event) => {
          lastEventAt = Date.now();
          deliver(reason, event);
          post({ kind: "event", reason, event, at: lastEventAt });
        },
      });
      postHealth();
      healthTimer = setInterval(postHealth, HEALTH_POST_MS);
      if (tookOver) {
        const catchUp = { reason: "update" };
        deliver("update", catchUp);
        post({ kind: "event", reason: "update", event: catchUp, at: Date.now() });
      }
    });

  const requestLeadership = () => {
    if (closed || paused || pending || isLeader) return;
    const ac = new AbortController();
    pending = ac;
    Promise.resolve(
      locks.request(name, { signal: ac.signal }, () => {
        if (pending === ac) pending = null;
        return lead();
      }),
    )
      .catch(() => {})
      .finally(() => {
        if (pending === ac) pending = null;
      });
  };

  const resign = () => {
    if (healthTimer) clearInterval(healthTimer);
    healthTimer = null;
    if (stream) {
      try {
        stream();
      } catch {
        /* ignore */
      }
      stream = null;
    }
    isLeader = false;
    const release = releaseLock;
    releaseLock = null;
    release?.();
  };

  const pause = () => {
    paused = true;
    if (pending) {
      pending.abort();
      pending = null;
    }
    if (isLeader) resign();
  };

  const resume = () => {
    if (!paused || closed) return;
    paused = false;
    requestLeadership();
  };

  target.addEventListener("pagehide", pause);
  target.addEventListener("pageshow", resume);
  docTarget.addEventListener("freeze", pause);
  docTarget.addEventListener("resume", resume);

  requestLeadership();
  post({ kind: "hello" });

  const unsubscribe = () => {
    if (closed) return;
    closed = true;
    target.removeEventListener("pagehide", pause);
    target.removeEventListener("pageshow", resume);
    docTarget.removeEventListener("freeze", pause);
    docTarget.removeEventListener("resume", resume);
    if (pending) {
      pending.abort();
      pending = null;
    }
    resign();
    try {
      channel.close();
    } catch {
      /* ignore */
    }
  };
  unsubscribe.getLastEventAt = () =>
    Math.max(lastEventAt, (isLeader && stream?.getLastEventAt?.()) || 0);
  return unsubscribe;
}

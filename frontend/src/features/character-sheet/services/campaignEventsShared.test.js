import { subscribeCampaignEventsShared } from "./campaignEventsShared";

/** navigator.locks: exclusive, FIFO, AbortSignal on pending requests. */
class FakeLocks {
  constructor() {
    this.held = new Map();
    this.queues = new Map();
  }

  request(name, options, callback) {
    const cb = typeof options === "function" ? options : callback;
    const signal = typeof options === "function" ? undefined : options?.signal;
    return new Promise((resolve, reject) => {
      const entry = { cb, resolve, reject, signal };
      if (signal?.aborted) {
        reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        return;
      }
      signal?.addEventListener("abort", () => {
        const q = this.queues.get(name) || [];
        const i = q.indexOf(entry);
        if (i >= 0) {
          q.splice(i, 1);
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        }
      });
      const q = this.queues.get(name) || [];
      q.push(entry);
      this.queues.set(name, q);
      this._grant(name);
    });
  }

  _grant(name) {
    if (this.held.get(name)) return;
    const q = this.queues.get(name) || [];
    const next = q.shift();
    if (!next) return;
    this.held.set(name, true);
    Promise.resolve()
      .then(() => next.cb({ name }))
      .then(next.resolve, next.reject)
      .finally(() => {
        this.held.set(name, false);
        this._grant(name);
      });
  }
}

/** BroadcastChannel: every other channel object with the same name gets it. */
function makeBus() {
  const channels = new Set();
  class FakeChannel {
    constructor(name) {
      this.name = name;
      this.onmessage = null;
      this.closed = false;
      channels.add(this);
    }

    postMessage(data) {
      for (const ch of channels) {
        if (ch === this || ch.closed || ch.name !== this.name) continue;
        Promise.resolve().then(() => ch.onmessage?.({ data }));
      }
    }

    close() {
      this.closed = true;
      channels.delete(this);
    }
  }
  return FakeChannel;
}

/** One fake browser tab: its own window events, sharing locks and bus. */
function makeTab(shared) {
  const target = new EventTarget();
  const onUpdate = jest.fn();
  const unsub = subscribeCampaignEventsShared(
    7,
    { onUpdate },
    {
      locks: shared.locks,
      BroadcastChannel: shared.Channel,
      target,
      apiBase: "https://api.example.test/api",
      subscribe: shared.subscribe,
    },
  );
  return { target, onUpdate, unsub };
}

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

describe("subscribeCampaignEventsShared (PR 5b)", () => {
  let shared;

  beforeEach(() => {
    jest.useFakeTimers();
    const streams = [];
    shared = {
      locks: new FakeLocks(),
      Channel: makeBus(),
      streams,
      subscribe: jest.fn((campaignId, { onUpdate }) => {
        const stream = { campaignId, onUpdate, closed: false, lastEventAt: 0 };
        const unsub = () => {
          stream.closed = true;
        };
        unsub.getLastEventAt = () => stream.lastEventAt;
        streams.push(stream);
        return unsub;
      }),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const live = () => shared.streams.filter((s) => !s.closed);

  test("several tabs share one stream and every tab gets each event", async () => {
    const a = makeTab(shared);
    const b = makeTab(shared);
    const c = makeTab(shared);
    await flush();
    expect(live()).toHaveLength(1);

    live()[0].onUpdate("roll", { reason: "roll", character_id: 3 });
    await flush();
    for (const tab of [a, b, c]) {
      expect(tab.onUpdate).toHaveBeenCalledWith(
        "roll",
        expect.objectContaining({ character_id: 3 }),
      );
    }
  });

  test("when the leader tab closes another takes over and catches up", async () => {
    const a = makeTab(shared);
    const b = makeTab(shared);
    await flush();
    const first = live()[0];
    a.unsub();
    await flush();
    expect(first.closed).toBe(true);
    expect(live()).toHaveLength(1);
    // Events in the hand-off gap are unknown: refetch once.
    expect(b.onUpdate).toHaveBeenCalledWith("update", { reason: "update" });
  });

  test("the first leader does not refetch on start", async () => {
    const a = makeTab(shared);
    await flush();
    expect(a.onUpdate).not.toHaveBeenCalled();
  });

  test("a leader that is hidden away (pagehide) hands over and comes back as a follower", async () => {
    const a = makeTab(shared);
    makeTab(shared);
    await flush();
    const first = live()[0];
    a.target.dispatchEvent(new Event("pagehide"));
    await flush();
    expect(first.closed).toBe(true);
    expect(live()).toHaveLength(1);

    a.target.dispatchEvent(new Event("pageshow"));
    await flush();
    expect(live()).toHaveLength(1);
  });

  test("a frozen tab gives up its place in line", async () => {
    const a = makeTab(shared);
    const b = makeTab(shared);
    const c = makeTab(shared);
    await flush();
    const queued = () =>
      (shared.locks.queues.get(
        "bizarre-campaign-events:https://api.example.test/api:7",
      ) || []).length;
    expect(queued()).toBe(2);
    b.target.dispatchEvent(new Event("freeze"));
    await flush();
    // A frozen tab can't run a granted lock callback, so it must leave the line.
    expect(queued()).toBe(1);
    a.unsub();
    await flush();
    // c takes over, not the frozen b.
    expect(live()).toHaveLength(1);
    expect(c.onUpdate).toHaveBeenCalledWith("update", { reason: "update" });
    // b only hears the relayed catch-up, it did not take the lock.
    b.target.dispatchEvent(new Event("resume"));
    await flush();
    expect(live()).toHaveLength(1);
    c.unsub();
    await flush();
    // Back in line after resume, b is next.
    expect(live()).toHaveLength(1);
  });

  test("followers read healthy while the leader's stream is", async () => {
    makeTab(shared);
    const b = makeTab(shared);
    await flush();
    const leader = live()[0];
    leader.lastEventAt = Date.now();
    jest.advanceTimersByTime(5000);
    await flush();
    const at = b.unsub.getLastEventAt();
    expect(at).toBeGreaterThan(0);
    // Leader goes silent: the follower's last event time stops moving.
    jest.advanceTimersByTime(36_000);
    await flush();
    expect(Date.now() - b.unsub.getLastEventAt()).toBeGreaterThan(35_000);
  });

  test("without Web Locks each tab keeps its own stream", async () => {
    const onUpdate = jest.fn();
    subscribeCampaignEventsShared(
      7,
      { onUpdate },
      { locks: null, BroadcastChannel: shared.Channel, subscribe: shared.subscribe, target: new EventTarget(), apiBase: "x" },
    );
    subscribeCampaignEventsShared(
      7,
      { onUpdate },
      { locks: null, BroadcastChannel: shared.Channel, subscribe: shared.subscribe, target: new EventTarget(), apiBase: "x" },
    );
    await flush();
    expect(live()).toHaveLength(2);
  });

  test("a follower unsubscribing leaves the leader alone", async () => {
    const a = makeTab(shared);
    const b = makeTab(shared);
    await flush();
    b.unsub();
    await flush();
    expect(live()).toHaveLength(1);
    live()[0].onUpdate("roll", { reason: "roll" });
    await flush();
    expect(a.onUpdate).toHaveBeenCalledWith("roll", { reason: "roll" });
    expect(b.onUpdate).not.toHaveBeenCalled();
  });

  test("other campaigns get their own stream", async () => {
    makeTab(shared);
    subscribeCampaignEventsShared(
      8,
      { onUpdate: jest.fn() },
      { locks: shared.locks, BroadcastChannel: shared.Channel, subscribe: shared.subscribe, target: new EventTarget(), apiBase: "https://api.example.test/api" },
    );
    await flush();
    expect(live().map((s) => s.campaignId).sort()).toEqual([7, 8]);
  });
});

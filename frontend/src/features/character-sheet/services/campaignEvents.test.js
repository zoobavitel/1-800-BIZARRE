import { subscribeCampaignEvents } from "./campaignEvents";

jest.mock("../../../config/apiConfig", () => ({
  getApiBaseUrl: () => "https://api.example.test/api",
}));

class FakeEventSource {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.closed = false;
    this.onmessage = null;
    this.onerror = null;
    FakeEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }
}

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

const ticketResponse = (ticket) => ({
  ok: true,
  json: async () => ({ ticket }),
});

describe("subscribeCampaignEvents tickets", () => {
  let unsub;

  beforeEach(() => {
    jest.useFakeTimers();
    FakeEventSource.instances = [];
    global.EventSource = FakeEventSource;
    localStorage.setItem("authToken", "secret-login-token");
    let n = 0;
    global.fetch = jest.fn(async () => {
      n += 1;
      return ticketResponse(`t${n}`);
    });
  });

  afterEach(() => {
    unsub?.();
    unsub = null;
    jest.useRealTimers();
    localStorage.clear();
    delete global.fetch;
    delete global.EventSource;
  });

  test("opens the stream with a ticket, never the login token", async () => {
    unsub = subscribeCampaignEvents(7, { onUpdate: () => {} });
    await flush();

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.example.test/api/campaigns/7/events/ticket/",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Token secret-login-token" },
      }),
    );
    expect(FakeEventSource.instances).toHaveLength(1);
    const { url } = FakeEventSource.instances[0];
    expect(url).toBe("https://api.example.test/api/campaigns/7/events/?ticket=t1");
    expect(url).not.toContain("secret-login-token");
  });

  test("a rejected stream gets a fresh ticket, never the spent URL", async () => {
    unsub = subscribeCampaignEvents(7, { onUpdate: () => {} });
    await flush();
    const first = FakeEventSource.instances[0];

    // A spent or expired ticket: the server answers 401 and EventSource errors.
    first.onerror();
    expect(first.closed).toBe(true);
    jest.advanceTimersByTime(60_000);
    await flush();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.instances[1].url).toContain("?ticket=t2");
    expect(FakeEventSource.instances[1].url).not.toBe(first.url);
  });

  test("a failed ticket POST backs off and never falls back to ?token=", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce(ticketResponse("t-ok"));
    unsub = subscribeCampaignEvents(7, { onUpdate: () => {} });
    await flush();

    expect(FakeEventSource.instances).toHaveLength(0);
    jest.advanceTimersByTime(60_000);
    await flush();

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toContain("?ticket=t-ok");
    expect(FakeEventSource.instances[0].url).not.toContain("token=");
  });

  test("unsubscribe while the ticket is in flight opens no stream", async () => {
    let release;
    global.fetch = jest.fn(
      () =>
        new Promise((resolve) => {
          release = () => resolve(ticketResponse("late"));
        }),
    );
    unsub = subscribeCampaignEvents(7, { onUpdate: () => {} });
    unsub();
    release();
    await flush();

    expect(FakeEventSource.instances).toHaveLength(0);
  });
});

describe("subscribeCampaignEvents eviction (PR 5a)", () => {
  let unsub;
  let visibility;

  const send = (es, data) => es.onmessage({ data: JSON.stringify(data) });
  const setVisible = (v) => {
    visibility = v;
    document.dispatchEvent(new Event("visibilitychange"));
  };

  beforeEach(() => {
    jest.useFakeTimers();
    FakeEventSource.instances = [];
    global.EventSource = FakeEventSource;
    localStorage.setItem("authToken", "secret-login-token");
    visibility = "hidden";
    jest
      .spyOn(document, "visibilityState", "get")
      .mockImplementation(() => visibility);
    let n = 0;
    global.fetch = jest.fn(async () => {
      n += 1;
      return ticketResponse(`t${n}`);
    });
  });

  afterEach(() => {
    unsub?.();
    unsub = null;
    jest.restoreAllMocks();
    jest.useRealTimers();
    localStorage.clear();
    delete global.fetch;
    delete global.EventSource;
  });

  async function evictedStream(onUpdate = () => {}) {
    unsub = subscribeCampaignEvents(7, { onUpdate });
    await flush();
    const es = FakeEventSource.instances[0];
    send(es, { type: "connected" });
    send(es, { type: "evicted" });
    // The server closes the response right after the frame.
    es.onerror?.();
    return es;
  }

  test("an evicted stream closes and does not reconnect on its own", async () => {
    const es = await evictedStream();
    expect(es.closed).toBe(true);

    jest.advanceTimersByTime(10 * 60_000);
    await flush();
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("the tab becoming visible reconnects once and catches up", async () => {
    const onUpdate = jest.fn();
    await evictedStream(onUpdate);
    onUpdate.mockClear();

    setVisible("visible");
    window.dispatchEvent(new Event("focus"));
    await flush();
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.instances[1].url).toContain("?ticket=t2");

    send(FakeEventSource.instances[1], { type: "connected" });
    expect(onUpdate).toHaveBeenCalledWith("update", { reason: "update" });
  });

  test("window focus reconnects an evicted stream", async () => {
    await evictedStream();
    // Visible without a visibilitychange (e.g. the tab was already in front).
    visibility = "visible";
    window.dispatchEvent(new Event("focus"));
    await flush();
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  test("becoming hidden does not reconnect", async () => {
    await evictedStream();
    setVisible("hidden");
    await flush();
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  test("focus on a live stream opens no second stream", async () => {
    unsub = subscribeCampaignEvents(7, { onUpdate: () => {} });
    await flush();
    send(FakeEventSource.instances[0], { type: "connected" });
    window.dispatchEvent(new Event("focus"));
    setVisible("visible");
    await flush();
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  test("after an evict the stream reads unhealthy at 35 s, so polling resumes", async () => {
    const { isCampaignSseHealthy } = require("./campaignEvents");
    await evictedStream();
    expect(isCampaignSseHealthy(unsub)).toBe(true);
    jest.advanceTimersByTime(36_000);
    expect(isCampaignSseHealthy(unsub)).toBe(false);
  });

  test("unsubscribe stops wake events from reconnecting", async () => {
    await evictedStream();
    unsub();
    unsub = null;
    window.dispatchEvent(new Event("focus"));
    await flush();
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});

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

import { fetchWithGetRetry } from "./api";

describe("fetchWithGetRetry", () => {
  const originalFetch = global.fetch;
  const networkError = () =>
    new TypeError("NetworkError when attempting to fetch resource.");

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("retries a GET once after a network error", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(networkError())
      .mockResolvedValueOnce({ ok: true });

    const response = await fetchWithGetRetry("https://x.test/api/campaigns/", {}, { delayMs: 0 });

    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("gives up after one retry", async () => {
    global.fetch = jest.fn(() => Promise.reject(networkError()));

    await expect(
      fetchWithGetRetry("https://x.test/api/campaigns/", {}, { delayMs: 0 }),
    ).rejects.toThrow("NetworkError");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("does not retry a POST", async () => {
    global.fetch = jest.fn(() => Promise.reject(networkError()));

    await expect(
      fetchWithGetRetry("https://x.test/api/rolls/", { method: "POST" }, { delayMs: 0 }),
    ).rejects.toThrow("NetworkError");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("does not retry an abort", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    global.fetch = jest.fn(() => Promise.reject(abort));

    await expect(
      fetchWithGetRetry("https://x.test/api/campaigns/", {}, { delayMs: 0 }),
    ).rejects.toBe(abort);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("returns an HTTP error response without retrying", async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 502 }));

    const response = await fetchWithGetRetry("https://x.test/api/campaigns/", {}, { delayMs: 0 });

    expect(response.status).toBe(502);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

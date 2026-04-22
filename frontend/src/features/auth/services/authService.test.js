/**
 * @jest-environment jsdom
 */

import { authAPI } from "./authService";

jest.mock("../../../config/apiConfig", () => ({
  requireApiBaseUrl: () => "http://localhost:8000/api",
}));

describe("authAPI", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("updateProfile sends flat body for UserProfileSerializer", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ username: "tester", theme: "dark" }),
    });

    await authAPI.updateProfile({
      signature: "—",
      theme: "dark",
      display_title: "GM",
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/user-profiles/update/");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      signature: "—",
      theme: "dark",
      display_title: "GM",
    });
  });

  test("getProfile returns first array element", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => [{ username: "a", theme: "dark" }],
    });

    const p = await authAPI.getProfile();
    expect(p).toEqual({ username: "a", theme: "dark" });
  });

  test("getProfile uses results[0] when paginated", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ username: "b", theme: "dark" }],
      }),
    });

    const p = await authAPI.getProfile();
    expect(p).toEqual({ username: "b", theme: "dark" });
  });
});

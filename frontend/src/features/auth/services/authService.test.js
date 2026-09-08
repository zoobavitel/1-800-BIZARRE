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

  test("updateProfile sends multipart FormData when avatarFile present", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ username: "tester", avatar: "/media/avatars/a.png" }),
    });
    const file = new File(["x"], "a.png", { type: "image/png" });

    await authAPI.updateProfile({
      avatarFile: file,
      theme: "dark",
      avatar_url: "",
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/user-profiles/update/");
    expect(init.method).toBe("PUT");
    expect(init.body instanceof FormData).toBe(true);
    expect(init.headers?.["Content-Type"]).toBeUndefined();
    expect(init.body.get("avatar") instanceof File).toBe(true);
    expect(init.body.get("theme")).toBe("dark");
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

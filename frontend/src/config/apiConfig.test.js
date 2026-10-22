/**
 * @jest-environment jsdom
 */

import { getApiBaseUrl, requireApiBaseUrl, setApiBaseUrl } from "./apiConfig";

describe("apiConfig local default", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("blank Game server resolves to 127.0.0.1 (not localhost)", () => {
    expect(getApiBaseUrl()).toBe("http://127.0.0.1:8000/api");
    expect(requireApiBaseUrl()).toBe("http://127.0.0.1:8000/api");
  });

  test("rewrites stored localhost loopback to 127.0.0.1", () => {
    setApiBaseUrl("http://localhost:8000/api");
    expect(getApiBaseUrl()).toBe("http://127.0.0.1:8000/api");
  });

  test("rewrites stored [::1] loopback to 127.0.0.1", () => {
    setApiBaseUrl("http://[::1]:8000/api");
    expect(getApiBaseUrl()).toBe("http://127.0.0.1:8000/api");
  });

  test("drops a stored ngrok URL and uses the default host", () => {
    localStorage.setItem("apiBaseUrl", "https://example.ngrok-free.dev/api");
    expect(getApiBaseUrl()).toBe("http://127.0.0.1:8000/api");
    expect(localStorage.getItem("apiBaseUrl")).toBeNull();
  });
});

describe("apiConfig with a baked public host", () => {
  const BAKED = "https://api.example.com/api";
  let api;

  beforeEach(() => {
    localStorage.clear();
    process.env.REACT_APP_API_URL = BAKED;
    jest.isolateModules(() => {
      api = require("./apiConfig");
    });
  });

  const original = process.env.REACT_APP_API_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.REACT_APP_API_URL;
    else process.env.REACT_APP_API_URL = original;
  });

  test("drops a stored Tailscale Funnel URL and uses the baked host", () => {
    localStorage.setItem(
      "apiBaseUrl",
      "https://bizarre-api.tailnet.ts.net/api",
    );
    expect(api.getApiBaseUrl()).toBe(BAKED);
    expect(localStorage.getItem("apiBaseUrl")).toBeNull();
  });

  test("keeps a stored custom server that is not a retired host", () => {
    localStorage.setItem("apiBaseUrl", "https://my-server.example.org/api");
    expect(api.getApiBaseUrl()).toBe("https://my-server.example.org/api");
  });

  test("uses the baked host when nothing is stored", () => {
    expect(api.getApiBaseUrl()).toBe(BAKED);
  });
});

describe("apiConfig without a baked host", () => {
  const saved = process.env.REACT_APP_API_URL;
  let api;

  beforeEach(() => {
    localStorage.clear();
    delete process.env.REACT_APP_API_URL;
    jest.isolateModules(() => {
      api = require("./apiConfig");
    });
  });

  afterEach(() => {
    if (saved !== undefined) process.env.REACT_APP_API_URL = saved;
  });

  test("keeps a stored Tailscale Funnel URL (it is the only server known)", () => {
    localStorage.setItem(
      "apiBaseUrl",
      "https://bizarre-api.tailnet.ts.net/api",
    );
    expect(api.getApiBaseUrl()).toBe("https://bizarre-api.tailnet.ts.net/api");
  });
});

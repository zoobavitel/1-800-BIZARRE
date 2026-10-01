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
});

import { AUTH_EXPIRED_EVENT, reportUnauthorized } from "./authSession";

describe("reportUnauthorized", () => {
  let fired;
  const onExpired = () => {
    fired += 1;
  };

  beforeEach(() => {
    fired = 0;
    localStorage.setItem("authToken", "current");
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
  });

  afterEach(() => {
    window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
    localStorage.clear();
  });

  test("a 401 for the stored token ends the session", () => {
    expect(reportUnauthorized(401, "current")).toBe(true);
    expect(fired).toBe(1);
  });

  test("other statuses do nothing", () => {
    for (const status of [400, 403, 404, 500]) {
      expect(reportUnauthorized(status, "current")).toBe(false);
    }
    expect(fired).toBe(0);
  });

  test("a late 401 for a token a newer sign-in replaced is ignored", () => {
    expect(reportUnauthorized(401, "old")).toBe(false);
    expect(fired).toBe(0);
  });

  test("a 401 for a request sent without a token is ignored", () => {
    expect(reportUnauthorized(401, null)).toBe(false);
    expect(fired).toBe(0);
  });
});

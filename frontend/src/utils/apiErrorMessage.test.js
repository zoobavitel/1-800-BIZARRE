import { getApiErrorMessage } from "./apiErrorMessage";

describe("getApiErrorMessage", () => {
  it("surfaces apply-level-up error and busy-retry copy", () => {
    expect(
      getApiErrorMessage(
        { error: "Not enough XP on playbook track (have 0, need 10)." },
        400,
        "Bad Request",
      ),
    ).toBe("Not enough XP on playbook track (have 0, need 10).");
    expect(
      getApiErrorMessage(
        {
          error:
            "Could not apply the advance because the sheet is still saving. Wait a moment and confirm again.",
        },
        503,
        "Service Unavailable",
      ),
    ).toContain("sheet is still saving");
  });
});

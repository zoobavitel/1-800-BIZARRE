import { createStandingCommitScheduler } from "./standingCommitScheduler";

describe("createStandingCommitScheduler", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test("rapid schedule coalesces to one commit with latest value", async () => {
    const commits = [];
    const scheduler = createStandingCommitScheduler({
      debounceMs: 120,
      commit: async (key, value) => {
        commits.push({ key, value });
      },
    });

    const p1 = scheduler.schedule("crew:1:2", 1);
    const p2 = scheduler.schedule("crew:1:2", 2);
    const p3 = scheduler.schedule("crew:1:2", 3);

    jest.advanceTimersByTime(120);
    const results = await Promise.all([p1, p2, p3]);

    expect(commits).toEqual([{ key: "crew:1:2", value: 3 }]);
    expect(results.filter((r) => r.ok).length).toBe(1);
    expect(results.filter((r) => r.skipped).length).toBe(2);

    scheduler.dispose();
  });

  test("separate keys commit independently", async () => {
    const commits = [];
    const scheduler = createStandingCommitScheduler({
      debounceMs: 50,
      commit: async (key, value) => {
        commits.push({ key, value });
      },
    });

    const a = scheduler.schedule("a", 1);
    const b = scheduler.schedule("b", -2);
    jest.advanceTimersByTime(50);
    await Promise.all([a, b]);

    expect(commits).toEqual(
      expect.arrayContaining([
        { key: "a", value: 1 },
        { key: "b", value: -2 },
      ]),
    );
    expect(commits).toHaveLength(2);
    scheduler.dispose();
  });
});

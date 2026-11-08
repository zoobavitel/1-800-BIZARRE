import { act, renderHook } from "@testing-library/react";
import { useCrewAutosave } from "./useCrewAutosave";

const crew = (over = {}) => ({ coin: 2, rep: 0, notes: "n", ...over });

function setup(initialPayload, { syncedKey } = {}) {
  const save = jest.fn(() => Promise.resolve());
  const hydratedRef = { current: true };
  const syncedKeyRef = {
    current: syncedKey === undefined ? JSON.stringify(initialPayload) : syncedKey,
  };
  const utils = renderHook(
    ({ payload }) =>
      useCrewAutosave({ crewId: 1, hydratedRef, payload, syncedKeyRef, save }),
    { initialProps: { payload: initialPayload } },
  );
  return { save, syncedKeyRef, ...utils };
}

const flush = async (ms = 1000) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
};

describe("useCrewAutosave", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("values just loaded from the server are not saved back", async () => {
    const { save } = setup(crew());
    await flush();
    expect(save).not.toHaveBeenCalled();
  });

  test("a refetch with the same values does not save (the loop)", async () => {
    const { save, rerender } = setup(crew());
    for (let i = 0; i < 5; i += 1) {
      rerender({ payload: crew() });
      await flush();
    }
    expect(save).not.toHaveBeenCalled();
  });

  test("an edit saves once, and the same values after it don't save again", async () => {
    const { save, rerender, syncedKeyRef } = setup(crew());
    rerender({ payload: crew({ coin: 3 }) });
    await flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith(crew({ coin: 3 }));
    expect(syncedKeyRef.current).toBe(JSON.stringify(crew({ coin: 3 })));
    rerender({ payload: crew({ coin: 3 }) });
    await flush();
    expect(save).toHaveBeenCalledTimes(1);
  });

  test("not hydrated yet: nothing saves", async () => {
    const save = jest.fn(() => Promise.resolve());
    renderHook(() =>
      useCrewAutosave({
        crewId: 1,
        hydratedRef: { current: false },
        payload: crew({ coin: 4 }),
        syncedKeyRef: { current: null },
        save,
      }),
    );
    await flush();
    expect(save).not.toHaveBeenCalled();
  });

  test("a failed save is retried on the next change", async () => {
    const { save, rerender, syncedKeyRef } = setup(crew());
    save.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    rerender({ payload: crew({ coin: 3 }) });
    await flush();
    expect(syncedKeyRef.current).toBe(JSON.stringify(crew()));
    rerender({ payload: crew({ coin: 4 }) });
    await flush();
    expect(save).toHaveBeenCalledTimes(2);
  });
});

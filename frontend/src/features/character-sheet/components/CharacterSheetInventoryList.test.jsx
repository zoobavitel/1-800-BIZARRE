import React from "react";
import { render } from "@testing-library/react";
import CharacterSheetInventoryList from "./CharacterSheetInventoryList";
import { equipmentAPI } from "../services/api";

jest.mock("../services/api", () => {
  const actual = jest.requireActual("../services/api");
  return { ...actual, equipmentAPI: { list: jest.fn(() => Promise.resolve([])) } };
});

// The batch test (2026-11-01) saw 13,049 session PATCHes from one tab: the
// load-save effect re-ran on every render while the session copy was stale,
// and sent the same body each time.
describe("CharacterSheetInventoryList session load save", () => {
  // CRA's resetMocks clears the factory's implementation before each test,
  // and a sheet with no campaign now loads the SRD list (#274).
  beforeEach(() => {
    equipmentAPI.list.mockResolvedValue([]);
  });

  const inventory = [{ id: "item-1", name: "Waluigi", load: 1 }];
  const staleEntry = { band: "normal", carried_ids: [] };

  const props = (onLoadoutChange) => ({
    inventory,
    onChange: () => {},
    loadoutEntry: staleEntry,
    onLoadoutChange,
    activeSessionId: 1,
    characterId: 1,
  });

  test("sends one save while the session copy stays stale across renders", () => {
    const onLoadoutChange = jest.fn();
    const { rerender } = render(<CharacterSheetInventoryList {...props(onLoadoutChange)} />);
    for (let i = 0; i < 5; i += 1) {
      // A new but equal stale entry each render, as the parent builds it.
      rerender(
        <CharacterSheetInventoryList
          {...props(onLoadoutChange)}
          loadoutEntry={{ ...staleEntry }}
          inventory={inventory.map((x) => ({ ...x }))}
        />,
      );
    }
    expect(onLoadoutChange).toHaveBeenCalledTimes(1);
    expect(onLoadoutChange.mock.calls[0][0]).toMatchObject({
      band: "light",
      carried_ids: ["item-1"],
    });
  });

  test("sends again when the load really changes", () => {
    const onLoadoutChange = jest.fn();
    const { rerender } = render(<CharacterSheetInventoryList {...props(onLoadoutChange)} />);
    rerender(
      <CharacterSheetInventoryList
        {...props(onLoadoutChange)}
        inventory={[...inventory, { id: "item-2", name: "Crowbar", load: 2 }]}
      />,
    );
    expect(onLoadoutChange).toHaveBeenCalledTimes(2);
    expect(onLoadoutChange.mock.calls[1][0].carried_ids).toEqual(["item-1", "item-2"]);
  });

  test("sends nothing when the session copy already matches", () => {
    const onLoadoutChange = jest.fn();
    render(
      <CharacterSheetInventoryList
        {...props(onLoadoutChange)}
        loadoutEntry={{ band: "light", carried_ids: ["item-1"] }}
      />,
    );
    expect(onLoadoutChange).not.toHaveBeenCalled();
  });
});

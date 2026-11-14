/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import CharacterSheetInventoryList from "./CharacterSheetInventoryList";
import { equipmentAPI } from "../services/api";

jest.mock("../services/api", () => ({
  ...jest.requireActual("../services/api"),
  equipmentAPI: { list: jest.fn() },
}));

const customRow = {
  id: "row-1",
  name: "Lucky Coin",
  detail: "Shiny",
  category: "gear",
  load: 0,
  quality: 0,
  coin_value: null,
  catalog_id: null,
  is_armor: false,
  armor_kind: "",
};

function renderSheet(props) {
  return render(
    <CharacterSheetInventoryList
      inventory={[customRow]}
      readOnly={false}
      onChange={jest.fn()}
      loadoutEntry={{}}
      onLoadoutChange={jest.fn()}
      campaignId={3}
      {...props}
    />,
  );
}

describe("making homebrew from a sheet item (S8)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    equipmentAPI.list.mockResolvedValue([]);
  });

  it.each([
    ["Save Lucky Coin as homebrew", false],
    ["Publish Lucky Coin as homebrew", true],
  ])("%s, then links the row to the homebrew item", async (label, isPublic) => {
    const onChange = jest.fn();
    const onShareItem = jest.fn().mockResolvedValue({ id: 99, scope: "SHARED" });
    renderSheet({ onChange, onShareItem });

    fireEvent.click(screen.getByRole("button", { name: label }));

    await waitFor(() =>
      expect(onShareItem).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Lucky Coin" }),
        { public: isPublic },
      ),
    );
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const row = onChange.mock.calls[0][0].find((r) => r.id === "row-1");
    expect(row.catalog_id).toBe(99);
  });

  it("offers no homebrew buttons without the owner handler or on a catalog item", () => {
    const { unmount } = renderSheet({});
    expect(screen.queryByRole("button", { name: /homebrew/ })).toBeNull();
    unmount();

    renderSheet({ inventory: [{ ...customRow, catalog_id: 5 }], onShareItem: jest.fn() });
    expect(screen.queryByRole("button", { name: /homebrew/ })).toBeNull();
  });

  it("labels shared items in Add Item search with who shared them", async () => {
    equipmentAPI.list.mockResolvedValue([
      { id: 7, name: "Grappling Gun", category: "tools", load_slots: 1, quality: 1, scope: "SHARED", created_by_username: "player1" },
    ]);
    renderSheet({});
    await waitFor(() => expect(equipmentAPI.list).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Add Item" }));
    const option = await screen.findByRole("option", { name: /Grappling Gun/ });
    expect(option).toHaveTextContent("Shared by player1");
  });
});

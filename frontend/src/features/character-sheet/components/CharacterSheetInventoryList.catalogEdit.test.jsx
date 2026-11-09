/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import CharacterSheetInventoryList from "./CharacterSheetInventoryList";
import { equipmentAPI } from "../services/api";

jest.mock("../services/api", () => ({
  ...jest.requireActual("../services/api"),
  equipmentAPI: {
    list: jest.fn(() => Promise.resolve([])),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    fromKitItem: jest.fn(),
    publishToSite: jest.fn(),
  },
}));

// A Crowbar the player added from the SRD catalog (catalog item 2).
const crowbarRow = {
  id: "row-1",
  name: "Crowbar",
  detail: "SRD kit",
  category: "tools",
  load: 1,
  quality: 1,
  coin_value: null,
  catalog_id: 2,
  is_armor: false,
  armor_kind: "",
};

function renderSheet(onChange) {
  render(
    <CharacterSheetInventoryList
      inventory={[crowbarRow]}
      readOnly={false}
      onChange={onChange}
      loadoutEntry={{}}
      onLoadoutChange={jest.fn()}
    />,
  );
}

function savedRow(onChange) {
  expect(onChange).toHaveBeenCalledTimes(1);
  const rows = onChange.mock.calls[0][0];
  return rows.find((r) => r.id === "row-1");
}

describe("editing a catalog item on a sheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // CRA's resetMocks clears the factory's implementation before each test,
    // and a sheet with no campaign loads the SRD list (#274).
    equipmentAPI.list.mockResolvedValue([]);
  });

  it("turns a renamed catalog item into a custom item and never writes to the catalog", () => {
    const onChange = jest.fn();
    renderSheet(onChange);

    fireEvent.click(screen.getByRole("button", { name: "Edit Crowbar" }));
    fireEvent.change(screen.getByLabelText("Item name"), {
      target: { value: "Bent Crowbar" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save custom item" }));

    const row = savedRow(onChange);
    expect(row.name).toBe("Bent Crowbar");
    expect(row.catalog_id).toBeNull();
    for (const write of ["create", "update", "delete", "fromKitItem", "publishToSite"]) {
      expect(equipmentAPI[write]).not.toHaveBeenCalled();
    }
  });

  it("keeps the catalog link when the edit changes nothing", () => {
    const onChange = jest.fn();
    renderSheet(onChange);

    fireEvent.click(screen.getByRole("button", { name: "Edit Crowbar" }));
    fireEvent.click(screen.getByRole("button", { name: "Save custom item" }));

    expect(savedRow(onChange).catalog_id).toBe(2);
  });
});

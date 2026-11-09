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

const crowbar = {
  id: 2,
  name: "Crowbar",
  description: "SRD kit",
  category: "tools",
  load_slots: 1,
  quality: 1,
  scope: "TEMPLATE",
};

function renderList(props) {
  return render(
    <CharacterSheetInventoryList
      inventory={[]}
      readOnly={false}
      onChange={jest.fn()}
      loadoutEntry={{}}
      onLoadoutChange={jest.fn()}
      {...props}
    />,
  );
}

describe("CharacterSheetInventoryList catalog search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    equipmentAPI.list.mockResolvedValue([crowbar]);
  });

  it("a sheet with no campaign can search the SRD template catalog", async () => {
    renderList({ campaignId: null });

    await waitFor(() =>
      expect(equipmentAPI.list).toHaveBeenCalledWith({ scope: "TEMPLATE" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add Item" }));
    expect(await screen.findByRole("option", { name: /Crowbar/ })).toBeInTheDocument();
  });

  it("a sheet in a campaign still loads that campaign's enabled catalog", async () => {
    renderList({ campaignId: 3 });

    await waitFor(() =>
      expect(equipmentAPI.list).toHaveBeenCalledWith({
        campaign: 3,
        available_for_campaign: true,
      }),
    );
  });
});

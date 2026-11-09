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

const coin = {
  id: 61, name: "Lucky Coin", description: "Shiny", category: "gear", load_slots: 0, quality: 0,
  scope: "SHARED", created_by_username: "player1", homebrew_source: "mine",
};
const charm = {
  id: 62, name: "GM Charm", description: "", category: "gear", load_slots: 1, quality: 1,
  scope: "SHARED", created_by_username: "gm", homebrew_source: "gm",
};

function renderSheet(props) {
  return render(
    <CharacterSheetInventoryList
      inventory={[]}
      readOnly={false}
      onChange={jest.fn()}
      loadoutEntry={{}}
      onLoadoutChange={jest.fn()}
      campaignId={3}
      characterId={12}
      {...props}
    />,
  );
}

describe("Add owned homebrew item (S10)", () => {
  beforeAll(() => {
    // jsdom here has no global crypto; new rows use crypto.randomUUID.
    if (typeof globalThis.crypto === "undefined") {
      globalThis.crypto = require("crypto").webcrypto;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    equipmentAPI.list.mockImplementation((params) =>
      Promise.resolve(params?.homebrew === "owned" ? [coin, charm] : []),
    );
  });

  it("lists the owner's homebrew and the GM's, and adds one as a linked row", async () => {
    const onChange = jest.fn();
    renderSheet({ onChange });
    fireEvent.click(screen.getByRole("button", { name: "Add owned homebrew item" }));

    await waitFor(() =>
      expect(equipmentAPI.list).toHaveBeenCalledWith({ homebrew: "owned", character: 12 }),
    );
    expect(await screen.findByRole("option", { name: /Lucky Coin/ })).toHaveTextContent("by player1");
    expect(screen.getByRole("option", { name: /GM Charm/ })).toHaveTextContent("from your GM");

    fireEvent.click(screen.getByRole("option", { name: /Lucky Coin/ }));
    const added = onChange.mock.calls[0][0];
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ name: "Lucky Coin", catalog_id: 61 });
  });

  it("isn't offered on a read-only sheet or before the sheet is saved", () => {
    const { unmount } = renderSheet({ readOnly: true });
    expect(screen.queryByRole("button", { name: "Add owned homebrew item" })).toBeNull();
    unmount();
    renderSheet({ characterId: null });
    expect(screen.queryByRole("button", { name: "Add owned homebrew item" })).toBeNull();
  });

  it("Add Item doesn't ask for homebrew", async () => {
    renderSheet({});
    await waitFor(() =>
      expect(equipmentAPI.list).toHaveBeenCalledWith({ campaign: 3, available_for_campaign: true }),
    );
    expect(equipmentAPI.list).not.toHaveBeenCalledWith(expect.objectContaining({ homebrew: "owned" }));
  });
});

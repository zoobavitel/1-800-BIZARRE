/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import MySharedItems from "./MySharedItems";
import { equipmentAPI } from "../services/api";

jest.mock("../services/api", () => ({
  ...jest.requireActual("../services/api"),
  equipmentAPI: { list: jest.fn(), update: jest.fn(), unpublish: jest.fn(), publish: jest.fn() },
}));

const coin = {
  id: 99, name: "Lucky Coin", description: "Shiny", category: "gear",
  load_slots: 0, quality: 0, scope: "SHARED", is_public: true,
};

describe("My creations (S8)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    equipmentAPI.list.mockResolvedValue([coin]);
    equipmentAPI.unpublish.mockResolvedValue({ ...coin, is_public: false });
    equipmentAPI.update.mockResolvedValue({ ...coin, name: "Luckier Coin" });
  });

  it("lists only my shared items", async () => {
    render(<MySharedItems />);
    expect(await screen.findByText("Lucky Coin")).toBeInTheDocument();
    expect(equipmentAPI.list).toHaveBeenCalledWith({ scope: "SHARED", mine: true });
  });

  it("unpublishes a published item", async () => {
    render(<MySharedItems />);
    fireEvent.click(await screen.findByRole("button", { name: "Unpublish Lucky Coin" }));
    await waitFor(() => expect(equipmentAPI.unpublish).toHaveBeenCalledWith(99));
  });

  it("publishes a private item", async () => {
    equipmentAPI.list.mockResolvedValue([{ ...coin, is_public: false }]);
    render(<MySharedItems />);
    expect(await screen.findByText(/private/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publish Lucky Coin" }));
    await waitFor(() => expect(equipmentAPI.publish).toHaveBeenCalledWith(99));
  });

  it("edits an item's name", async () => {
    render(<MySharedItems />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit Lucky Coin" }));
    fireEvent.change(screen.getByLabelText("Shared item name"), { target: { value: "Luckier Coin" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(equipmentAPI.update).toHaveBeenCalledWith(99, expect.objectContaining({ name: "Luckier Coin" })),
    );
  });
});

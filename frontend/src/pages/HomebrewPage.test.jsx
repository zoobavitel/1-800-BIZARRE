/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import HomebrewPage from "./HomebrewPage";
import { equipmentAPI } from "../features/character-sheet/services/api";

jest.mock("../features/character-sheet/services/api", () => ({
  ...jest.requireActual("../features/character-sheet/services/api"),
  equipmentAPI: { list: jest.fn(), share: jest.fn(), publish: jest.fn(), unpublish: jest.fn(), update: jest.fn() },
}));

const crowbar = {
  id: 2, name: "Crowbar", description: "SRD kit", category: "tools",
  load_slots: 1, quality: 1, scope: "TEMPLATE",
};

describe("Homebrew page: make homebrew (S8)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    equipmentAPI.list.mockResolvedValue([crowbar]);
    equipmentAPI.share.mockResolvedValue({ id: 50, name: "Lamp", scope: "SHARED", is_public: false });
  });

  it("creates an item from scratch as private homebrew", async () => {
    render(<HomebrewPage tab="create" />);
    fireEvent.change(screen.getByLabelText("Homebrew item name"), { target: { value: "Lamp" } });
    fireEvent.click(screen.getByRole("button", { name: "Save as homebrew" }));
    await waitFor(() =>
      expect(equipmentAPI.share).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Lamp", public: false }),
      ),
    );
    expect(equipmentAPI.share.mock.calls[0][0]).not.toHaveProperty("template");
    expect(await screen.findByText(/in My creations/)).toBeInTheDocument();
  });

  it("publishes a new item straight away", async () => {
    render(<HomebrewPage tab="create" />);
    fireEvent.change(screen.getByLabelText("Homebrew item name"), { target: { value: "Lamp" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish as homebrew" }));
    await waitFor(() =>
      expect(equipmentAPI.share).toHaveBeenCalledWith(expect.objectContaining({ public: true })),
    );
  });

  it("starts from an existing item as a template", async () => {
    render(<HomebrewPage tab="create" />);
    fireEvent.change(screen.getByLabelText("Start from an existing item"), { target: { value: "Crow" } });
    fireEvent.click(await screen.findByRole("button", { name: "Use Crowbar as template" }));
    expect(screen.getByLabelText("Homebrew item name")).toHaveValue("Crowbar");
    expect(screen.getByLabelText("Homebrew item description")).toHaveValue("SRD kit");
    fireEvent.change(screen.getByLabelText("Homebrew item name"), { target: { value: "Bent Crowbar" } });
    fireEvent.click(screen.getByRole("button", { name: "Save as homebrew" }));
    await waitFor(() =>
      expect(equipmentAPI.share).toHaveBeenCalledWith(
        expect.objectContaining({ template: 2, name: "Bent Crowbar", public: false }),
      ),
    );
  });

  it("lists my creations on their own tab", async () => {
    render(<HomebrewPage tab="creations" />);
    await waitFor(() => expect(equipmentAPI.list).toHaveBeenCalledWith({ scope: "SHARED", mine: true }));
  });
});

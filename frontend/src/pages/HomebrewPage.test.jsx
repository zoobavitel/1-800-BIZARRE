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
  equipmentAPI: {
    list: jest.fn(), share: jest.fn(), publish: jest.fn(), unpublish: jest.fn(), update: jest.fn(),
    collect: jest.fn(), uncollect: jest.fn(),
  },
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
    await waitFor(() => expect(equipmentAPI.list).toHaveBeenCalledWith({ homebrew: "mine" }));
  });
});

describe("Homebrew page: find homebrew (S9)", () => {
  const lantern = {
    id: 60, name: "Odd Lantern", description: "Glows near Stands", category: "gear",
    load_slots: 1, quality: 2, scope: "SHARED", is_public: true,
    created_by_username: "player1", in_my_collection: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    equipmentAPI.list.mockResolvedValue([lantern]);
    equipmentAPI.collect.mockResolvedValue({ ...lantern, in_my_collection: true });
    equipmentAPI.uncollect.mockResolvedValue({ ...lantern, in_my_collection: false });
  });

  it("shows homebrew types, with only Items live for now", () => {
    render(<HomebrewPage />);
    expect(screen.getByRole("button", { name: "Items" })).toBeEnabled();
    for (const kind of ["Heritages", "Standard abilities", "Spin abilities", "Hamon abilities"]) {
      expect(screen.getByRole("button", { name: `${kind} (coming later)` })).toBeDisabled();
    }
  });

  it("opens on Browse and searches published homebrew", async () => {
    render(<HomebrewPage query="lantern" />);
    await waitFor(() =>
      expect(equipmentAPI.list).toHaveBeenCalledWith({ homebrew: "browse", q: "lantern" }),
    );
    expect(await screen.findByText("Odd Lantern")).toBeInTheDocument();
    expect(screen.getByText(/by player1/)).toBeInTheDocument();
    expect(screen.getByLabelText("Search homebrew items")).toHaveValue("lantern");
  });

  it("adds a result to my collection and removes it again", async () => {
    render(<HomebrewPage tab="browse" />);
    fireEvent.click(await screen.findByRole("button", { name: "Add Odd Lantern to my collection" }));
    await waitFor(() => expect(equipmentAPI.collect).toHaveBeenCalledWith(60));
    fireEvent.click(await screen.findByRole("button", { name: "Remove Odd Lantern from my collection" }));
    await waitFor(() => expect(equipmentAPI.uncollect).toHaveBeenCalledWith(60));
  });

  it("uses a result as a template for a new item", async () => {
    render(<HomebrewPage tab="browse" />);
    fireEvent.click(await screen.findByRole("button", { name: "Use Odd Lantern as template" }));
    expect(await screen.findByLabelText("Homebrew item name")).toHaveValue("Odd Lantern");
    expect(screen.getByText(/Starting from Odd Lantern/)).toBeInTheDocument();
  });

  it("lists my collection on its own tab", async () => {
    render(<HomebrewPage tab="collection" />);
    await waitFor(() => expect(equipmentAPI.list).toHaveBeenCalledWith({ homebrew: "collection" }));
    expect(await screen.findByRole("button", { name: "Remove Odd Lantern from my collection" })).toBeInTheDocument();
  });
});

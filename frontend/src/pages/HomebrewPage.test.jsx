/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import HomebrewPage from "./HomebrewPage";
import {
  campaignAPI,
  characterAPI,
  equipmentAPI,
} from "../features/character-sheet/services/api";

jest.mock("../features/character-sheet/services/api", () => ({
  ...jest.requireActual("../features/character-sheet/services/api"),
  equipmentAPI: {
    list: jest.fn(), share: jest.fn(), publish: jest.fn(), unpublish: jest.fn(), update: jest.fn(),
    collect: jest.fn(), uncollect: jest.fn(), addToCharacter: jest.fn(), setCampaignAccess: jest.fn(),
  },
  characterAPI: { getCharacters: jest.fn() },
  campaignAPI: { getCampaigns: jest.fn() },
}));

jest.mock("../features/auth", () => ({
  useAuth: () => ({ user: { id: 7, username: "player1" } }),
}));

beforeEach(() => {
  characterAPI.getCharacters.mockResolvedValue([]);
  campaignAPI.getCampaigns.mockResolvedValue([]);
});

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

describe("Homebrew page: use homebrew (S10)", () => {
  const coin = {
    id: 99, name: "Lucky Coin", description: "", category: "gear", load_slots: 0, quality: 0,
    scope: "SHARED", is_public: false, created_by_username: "player1", is_mine: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    equipmentAPI.list.mockResolvedValue([coin]);
    equipmentAPI.addToCharacter.mockResolvedValue({ character: 12 });
    equipmentAPI.setCampaignAccess.mockResolvedValue({ enabled: true });
    characterAPI.getCharacters.mockResolvedValue([{ id: 12, true_name: "Player One PC", user_id: 7 }]);
    campaignAPI.getCampaigns.mockResolvedValue([
      { id: 3, name: "My Table", gm: { id: 7 } },
      { id: 4, name: "Someone Else's Table", gm: { id: 8 } },
    ]);
  });

  it("adds one of my creations to one of my sheets", async () => {
    render(<HomebrewPage tab="creations" />);
    await waitFor(() => expect(characterAPI.getCharacters).toHaveBeenCalledWith({ mine: true }));
    fireEvent.change(await screen.findByLabelText("Sheet for Lucky Coin"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Lucky Coin to the sheet" }));
    await waitFor(() => expect(equipmentAPI.addToCharacter).toHaveBeenCalledWith(99, 12));
    expect(await screen.findByText(/Added to Player One PC/)).toBeInTheDocument();
  });

  it("turns one of my creations on for a campaign I run, and only lists those", async () => {
    render(<HomebrewPage tab="creations" />);
    const select = await screen.findByLabelText("Campaign for Lucky Coin");
    await screen.findByRole("option", { name: "My Table" });
    expect(screen.queryByRole("option", { name: "Someone Else's Table" })).toBeNull();
    fireEvent.change(select, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Use Lucky Coin in the campaign" }));
    await waitFor(() => expect(equipmentAPI.setCampaignAccess).toHaveBeenCalledWith(99, 3, true));
  });

  it("offers the same actions on my collection", async () => {
    render(<HomebrewPage tab="collection" />);
    expect(await screen.findByLabelText("Sheet for Lucky Coin")).toBeInTheDocument();
  });
});

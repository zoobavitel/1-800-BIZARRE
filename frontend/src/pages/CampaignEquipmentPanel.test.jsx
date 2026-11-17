/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CampaignEquipmentPanel } from "./CampaignManagement";
import { campaignAPI, equipmentAPI } from "../features/character-sheet";
import { useAuth } from "../features/auth";

jest.mock("../features/character-sheet", () => ({
  ...jest.requireActual("../features/character-sheet"),
  equipmentAPI: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    setCampaignAccess: jest.fn(),
    clearCampaignAccess: jest.fn(),
    share: jest.fn(),
    copyToCampaign: jest.fn(),
  },
  campaignAPI: { patchCampaign: jest.fn() },
}));

jest.mock("../features/auth", () => ({
  ...jest.requireActual("../features/auth"),
  useAuth: jest.fn(),
}));

const GM = { id: 7, username: "gm", is_staff: false };
const PLAYER = { id: 8, username: "player1", is_staff: false };
const campaign = { id: 3, name: "Test Table", gm: { id: GM.id } };
const lockpicks = {
  id: 41,
  name: "GM Lockpicks",
  description: "Fine tools",
  category: "other",
  load_slots: 1,
  quality: 1,
  coin_value: null,
  scope: "CAMPAIGN",
  campaign: campaign.id,
  created_by: GM.id,
  available_when_adding: true,
};

describe("CampaignEquipmentPanel: GM edits a campaign catalog item", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    equipmentAPI.list.mockResolvedValue([lockpicks]);
    equipmentAPI.update.mockResolvedValue({ ...lockpicks, name: "Master Lockpicks" });
  });

  it("opens the item filled in and saves the rename with PATCH, not a new item", async () => {
    useAuth.mockReturnValue({ user: GM });
    render(<CampaignEquipmentPanel campaign={campaign} />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit GM Lockpicks" }));

    const name = screen.getByPlaceholderText("Name");
    expect(name).toHaveValue("GM Lockpicks");
    expect(screen.getByPlaceholderText("Description")).toHaveValue("Fine tools");

    fireEvent.change(name, { target: { value: "Master Lockpicks" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(equipmentAPI.update).toHaveBeenCalledTimes(1));
    expect(equipmentAPI.update).toHaveBeenCalledWith(
      41,
      expect.objectContaining({ name: "Master Lockpicks", category: "other" }),
    );
    expect(equipmentAPI.create).not.toHaveBeenCalled();
    // Scope and campaign are left alone, so an edit never moves the item.
    const sent = equipmentAPI.update.mock.calls[0][1];
    expect(sent).not.toHaveProperty("scope");
    expect(sent).not.toHaveProperty("campaign");
  });

  it("shows no Edit button to a player who didn't make the item", async () => {
    useAuth.mockReturnValue({ user: PLAYER });
    render(<CampaignEquipmentPanel campaign={campaign} />);

    await screen.findByText("GM Lockpicks");
    expect(screen.queryByRole("button", { name: "Edit GM Lockpicks" })).toBeNull();
  });
});

describe("CampaignEquipmentPanel: homebrew switch and shared pool (S11)", () => {
  const charm = {
    id: 62, name: "GM Charm", category: "gear", load_slots: 1, quality: 1, scope: "SHARED",
    created_by_username: "gm", is_mine: true,
  };
  const coin = {
    id: 61, name: "Player Coin", category: "gear", load_slots: 0, quality: 0, scope: "SHARED",
    created_by_username: "player1", is_mine: false,
  };
  const on = { ...campaign, homebrew_enabled: true };

  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ user: GM });
    equipmentAPI.list.mockImplementation((params) =>
      Promise.resolve(params?.homebrew === "campaign" ? [charm, coin] : [lockpicks]),
    );
    equipmentAPI.share.mockResolvedValue({ id: 78, scope: "SHARED" });
    equipmentAPI.copyToCampaign.mockResolvedValue({
      ...coin, id: 79, scope: "CAMPAIGN", campaign: campaign.id, created_by: GM.id,
    });
    campaignAPI.patchCampaign.mockResolvedValue({ ...campaign, homebrew_enabled: true });
  });

  it("starts off, hides the homebrew list, and the GM turns it on", async () => {
    render(<CampaignEquipmentPanel campaign={{ ...campaign, homebrew_enabled: false }} />);
    const box = await screen.findByRole("checkbox", { name: "Enable homebrew" });
    expect(box).not.toBeChecked();
    expect(screen.queryByText("Homebrew in this campaign")).toBeNull();
    expect(equipmentAPI.list).not.toHaveBeenCalledWith(expect.objectContaining({ homebrew: "campaign" }));

    fireEvent.click(box);
    await waitFor(() =>
      expect(campaignAPI.patchCampaign).toHaveBeenCalledWith(campaign.id, { homebrew_enabled: true }),
    );
    expect(await screen.findByText("Homebrew in this campaign")).toBeInTheDocument();
  });

  it("lists the table's shared pool, with who made each item and no block buttons", async () => {
    render(<CampaignEquipmentPanel campaign={on} />);
    await waitFor(() =>
      expect(equipmentAPI.list).toHaveBeenCalledWith({ homebrew: "campaign", campaign: campaign.id }),
    );
    expect(await screen.findByText(/by player1/)).toBeInTheDocument();
    expect(screen.getByText(/by gm/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Block|^Unblock|^Turn off/ })).toBeNull();
  });

  it("copies someone else's item into the library and opens the copy to edit", async () => {
    render(<CampaignEquipmentPanel campaign={on} />);
    fireEvent.click(await screen.findByRole("button", { name: "Copy Player Coin to my library and edit" }));
    await waitFor(() => expect(equipmentAPI.copyToCampaign).toHaveBeenCalledWith(61, campaign.id));
    expect(await screen.findByPlaceholderText("Name")).toHaveValue("Player Coin");
    expect(screen.queryByRole("button", { name: "Copy GM Charm to my library and edit" })).toBeNull();
  });

  it("links to the Homebrew page to find more", async () => {
    render(<CampaignEquipmentPanel campaign={on} />);
    expect(await screen.findByRole("link", { name: /Find more on the Homebrew page/ })).toHaveAttribute(
      "href",
      "#homebrew/browse",
    );
  });

  it("gives a player no switch and no homebrew list", async () => {
    useAuth.mockReturnValue({ user: PLAYER });
    render(<CampaignEquipmentPanel campaign={on} />);
    await screen.findByText("GM Lockpicks");
    expect(screen.queryByRole("checkbox", { name: "Enable homebrew" })).toBeNull();
    expect(screen.queryByText("Homebrew in this campaign")).toBeNull();
  });

  it.each([
    ["Save GM Lockpicks as homebrew", false],
    ["Publish GM Lockpicks as homebrew", true],
  ])("%s from the library", async (label, isPublic) => {
    render(<CampaignEquipmentPanel campaign={on} />);
    fireEvent.click(await screen.findByRole("button", { name: label }));
    await waitFor(() => expect(equipmentAPI.share).toHaveBeenCalledWith({ item: 41, public: isPublic }));
  });
});

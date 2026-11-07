/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CampaignEquipmentPanel } from "./CampaignManagement";
import { equipmentAPI } from "../features/character-sheet";
import { useAuth } from "../features/auth";

jest.mock("../features/character-sheet", () => ({
  ...jest.requireActual("../features/character-sheet"),
  equipmentAPI: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    setCampaignAccess: jest.fn(),
    share: jest.fn(),
    copyToCampaign: jest.fn(),
  },
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

describe("CampaignEquipmentPanel: public items (S8) and core catalog", () => {
  const shared = {
    id: 77, name: "Grappling Gun", description: "", category: "tools",
    load_slots: 1, quality: 1, scope: "SHARED", campaign: null,
    created_by: 50, created_by_username: "player1", is_public: true,
    enabled_for_campaign: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({ user: GM });
    equipmentAPI.list.mockResolvedValue([lockpicks, shared]);
    equipmentAPI.setCampaignAccess.mockResolvedValue({});
    equipmentAPI.share.mockResolvedValue({ id: 78, scope: "SHARED" });
    equipmentAPI.copyToCampaign.mockResolvedValue({
      ...shared, id: 79, scope: "CAMPAIGN", campaign: campaign.id, created_by: GM.id,
    });
  });

  it("lists public items off, with who shared them, and the GM turns one on", async () => {
    render(<CampaignEquipmentPanel campaign={campaign} />);
    expect(await screen.findByText(/Shared by player1/)).toBeInTheDocument();
    const box = screen.getByRole("checkbox", { name: /Grappling Gun/ });
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    await waitFor(() => expect(equipmentAPI.setCampaignAccess).toHaveBeenCalledWith(77, campaign.id, true));
  });

  it("copies a public item into the library and opens the copy to edit", async () => {
    render(<CampaignEquipmentPanel campaign={campaign} />);
    fireEvent.click(await screen.findByRole("button", { name: "Copy Grappling Gun to my library and edit" }));
    await waitFor(() => expect(equipmentAPI.copyToCampaign).toHaveBeenCalledWith(77, campaign.id));
    expect(await screen.findByPlaceholderText("Name")).toHaveValue("Grappling Gun");
    expect(equipmentAPI.update).not.toHaveBeenCalledWith(77, expect.anything());
  });

  it("makes a library item public", async () => {
    render(<CampaignEquipmentPanel campaign={campaign} />);
    fireEvent.click(await screen.findByRole("button", { name: "Make GM Lockpicks public" }));
    await waitFor(() => expect(equipmentAPI.share).toHaveBeenCalledWith({ item: 41 }));
  });

  it("gives a non-staff GM no Delete on a site item they published long ago", async () => {
    const oldSite = { ...lockpicks, id: 15, scope: "SITE", campaign: null, enabled_for_campaign: true };
    equipmentAPI.list.mockResolvedValue([oldSite]);
    render(<CampaignEquipmentPanel campaign={campaign} />);
    await screen.findByText(/Site: GM Lockpicks/);
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });
});

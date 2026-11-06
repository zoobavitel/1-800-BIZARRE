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

/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import CampaignShellPanels from "./CampaignShellPanels";
import { rollAPI, sessionAPI } from "../../features/character-sheet/services/api";
import { subscribeCampaignEventsShared } from "../../features/character-sheet/services/campaignEventsShared";

jest.mock("../../features/character-sheet/services/api", () => ({
  experienceTrackerAPI: { list: jest.fn().mockResolvedValue([]) },
  normalizeListResponse: (d) => (Array.isArray(d) ? d : d?.results || []),
  rollAPI: { getRolls: jest.fn() },
  sessionAPI: { getSessions: jest.fn().mockResolvedValue([]) },
}));
jest.mock("../../features/character-sheet/services/campaignEventsShared", () => ({
  subscribeCampaignEventsShared: jest.fn(),
}));
jest.mock("./CampaignHarmArmorGrid", () => () => null);
jest.mock("./ReputationStandingPanel", () => () => null);

const S = { card: {}, sectionLbl: {}, select: {}, btnGhost: {}, err: {} };
const pc = { id: 1, true_name: "Jolyne" };
const roll = (id, action) => ({ id, character: 1, action_name: action, results: [5], outcome: "PARTIAL_SUCCESS" });

describe("campaign Rolls tab live updates", () => {
  let onUpdate;
  const unsubscribe = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    sessionAPI.getSessions.mockResolvedValue([]);
    subscribeCampaignEventsShared.mockImplementation((_id, h) => {
      onUpdate = h.onUpdate;
      return unsubscribe;
    });
  });

  const openRolls = async () => {
    render(<CampaignShellPanels campaign={{ id: 9 }} S={S} characters={[pc]} />);
    fireEvent.click(screen.getByRole("tab", { name: "Rolls" }));
    await waitFor(() => expect(rollAPI.getRolls).toHaveBeenCalledTimes(1));
  };

  it("shows a new roll without a reload or a Loading flash", async () => {
    rollAPI.getRolls.mockResolvedValueOnce([]);
    await openRolls();
    await screen.findAllByText("No rolls.");
    let release;
    rollAPI.getRolls.mockReturnValueOnce(new Promise((r) => { release = r; }));
    act(() => onUpdate("roll", {}));
    await waitFor(() => expect(rollAPI.getRolls).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    await act(async () => release([roll(1, "wreck")]));
    expect(await screen.findByText(/wreck/i)).toBeInTheDocument();
  });

  it("ignores events that don't change the list", async () => {
    rollAPI.getRolls.mockResolvedValue([]);
    await openRolls();
    await screen.findAllByText("No rolls.");
    act(() => onUpdate("npc", {}));
    await new Promise((r) => setTimeout(r, 450));
    expect(rollAPI.getRolls).toHaveBeenCalledTimes(1);
  });
});

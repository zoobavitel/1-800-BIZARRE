/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";

import { NPCSheet } from "./NPCSheet";

// Every API call resolves empty; this test only checks what the sheet renders.
jest.mock("../features/character-sheet/services/api", () => {
  const actual = jest.requireActual("../features/character-sheet/services/api");
  const emptyApi = () =>
    new Proxy({}, { get: () => jest.fn(() => Promise.resolve([])) });
  return {
    ...actual,
    referenceAPI: emptyApi(),
    factionAPI: emptyApi(),
    sessionAPI: emptyApi(),
    rollAPI: emptyApi(),
    characterHistoryAPI: emptyApi(),
    experienceTrackerAPI: emptyApi(),
    xpHistoryAPI: emptyApi(),
    npcAPI: emptyApi(),
    equipmentAPI: emptyApi(),
  };
});

const npc = {
  id: 7,
  name: "Mine",
  creator: 5,
  campaign: 1,
  playbook: "STAND",
  notes: "creator notes",
  visible_to_players: true,
  players_see: { notes: false },
};

const gearButton = () =>
  screen.queryByTitle(/Visibility edit — click sections players may see/);

describe("NPC sheet visibility controls (NPC hidden data leak story)", () => {
  test("creator who is not the GM gets the visibility button", () => {
    render(
      <NPCSheet npc={npc} isGM={false} canEditVisibility readOnly={false} />,
    );
    expect(gearButton()).toBeInTheDocument();
  });

  test("creator sees their own hidden notes", () => {
    render(
      <NPCSheet npc={npc} isGM={false} canEditVisibility readOnly={false} />,
    );
    expect(screen.getByDisplayValue("creator notes")).toBeInTheDocument();
  });

  test("player (read-only) gets no visibility button", () => {
    render(<NPCSheet npc={npc} isGM={false} readOnly />);
    expect(gearButton()).not.toBeInTheDocument();
  });

  test("player sees no Stand coin until it is revealed", () => {
    const hidden = {
      ...npc,
      stand_coin_stats: {},
      vulnerability_clock_current: null,
      vulnerability_clock_max: null,
    };
    const { unmount } = render(<NPCSheet npc={hidden} isGM={false} readOnly />);
    expect(screen.queryByText("Stand Coin Stats")).not.toBeInTheDocument();
    unmount();
    const revealed = { ...hidden, stand_coin_stats: { POWER: "A" } };
    render(<NPCSheet npc={revealed} isGM={false} readOnly />);
    expect(screen.getByText("Stand Coin Stats")).toBeInTheDocument();
  });
});

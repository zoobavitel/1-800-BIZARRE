/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { NPCSheet } from "./NPCSheet";

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
  id: 22,
  name: "The Legendary Stalker",
  creator: 5,
  campaign: 1,
  playbook: "STAND",
  notes: "",
  visible_to_players: true,
};
const campaigns = [{ id: 1, gm: 5, crews: [], factions: [], sessions: [] }];

const settle = async (ms = 4000) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
};

describe("NPC autosave (S21: loading saves nothing)", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const mount = () => {
    const onSave = jest.fn(() => Promise.resolve({ id: 22 }));
    const view = render(
      <NPCSheet npc={npc} onSave={onSave} campaigns={campaigns} isGM user={{ id: 5 }} />,
    );
    return { onSave, ...view };
  };

  test("loading the sheet sends no save", async () => {
    const { onSave } = mount();
    await settle();
    await settle();
    expect(onSave).not.toHaveBeenCalled();
  });

  test("a click that changes nothing sends no save", async () => {
    const { onSave } = mount();
    await settle();
    fireEvent.pointerDown(screen.getByDisplayValue(npc.name));
    fireEvent.click(screen.getByDisplayValue(npc.name));
    await settle();
    expect(onSave).not.toHaveBeenCalled();
  });

  test("an edit after load saves once", async () => {
    const { onSave } = mount();
    await settle();
    fireEvent.change(screen.getByDisplayValue(npc.name), {
      target: { value: "Renamed" },
    });
    await settle();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].name).toBe("Renamed");
  });

  test("an edit made before the first autosave is not lost", async () => {
    const { onSave } = mount();
    fireEvent.change(screen.getByDisplayValue(npc.name), {
      target: { value: "Fast edit" },
    });
    await settle();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].name).toBe("Fast edit");
  });
});

/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import {
  filterRosterToInSession,
  manualRollCharacters,
  notInSessionPool,
  rollGoalForCharacter,
} from "./sessionShellUi";
import { SessionFactionToken, SessionNpcToken } from "./SessionTokenFaces";

describe("filterRosterToInSession", () => {
  const a1 = { id: 1, name: "A1" };
  const b1 = { id: 2, name: "B1" };
  const loner = { id: 3, name: "Loner" };
  const groups = {
    factionPairs: [
      [10, [a1]],
      [20, [b1]],
      [30, []],
    ],
    ungrouped: [loner],
  };

  it("keeps only In session faction tiles", () => {
    const out = filterRosterToInSession(groups, new Set([10]));
    expect(out.factionPairs.map(([id]) => id)).toEqual([10]);
  });

  it("keeps an NPC on the roster when its faction left the session", () => {
    const out = filterRosterToInSession(groups, new Set([10]));
    expect(out.ungrouped.map((n) => n.name)).toEqual(["B1", "Loner"]);
  });

  it("an empty session has no tiles", () => {
    const out = filterRosterToInSession({ factionPairs: [[30, []]], ungrouped: [] }, new Set());
    expect(out).toEqual({ factionPairs: [], ungrouped: [] });
  });
});

describe("notInSessionPool", () => {
  it("lists what isn't In session, by name", () => {
    const out = notInSessionPool(
      [{ id: 2, name: "Zeta" }, { id: 3, name: "alpha" }, { id: 1, name: "In" }],
      [{ id: 7, name: "Kept" }, { id: 8, name: "Out" }],
      new Set([1]),
      new Set([7]),
    );
    expect(out.factions.map((f) => f.name)).toEqual(["alpha", "Zeta"]);
    expect(out.npcs.map((n) => n.name)).toEqual(["Out"]);
  });
});

describe("NPC card eye", () => {
  const npc = { id: 1, name: "Hank", level: 1 };

  it("hides a visible NPC without opening its card", () => {
    const onToggle = jest.fn();
    const onOpen = jest.fn();
    render(
      <SessionNpcToken npc={npc} visibleToPlayers onToggleVisible={onToggle} onOpen={onOpen} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Hide Hank from players" }));
    expect(onToggle).toHaveBeenCalledWith(npc, false);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("marks a hidden NPC and can show it", () => {
    const onToggle = jest.fn();
    render(<SessionNpcToken npc={npc} visibleToPlayers={false} onToggleVisible={onToggle} />);
    expect(screen.getByText("Hidden")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show Hank to players" }));
    expect(onToggle).toHaveBeenCalledWith(npc, true);
  });

  it("players get no eye and no Hidden tag", () => {
    render(<SessionNpcToken npc={npc} />);
    expect(screen.queryByRole("button", { name: /from players|to players/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });

  it("a card that can't be dragged has no drag tooltip", () => {
    const { container } = render(<SessionNpcToken npc={npc} draggable={false} />);
    expect(container.querySelector(".npc-card")).not.toHaveAttribute("title");
  });
});

describe("faction card eye", () => {
  const faction = { id: 5, name: "Passione" };

  it("shows a hidden faction without expanding its card", () => {
    const onToggle = jest.fn();
    const onExpand = jest.fn();
    render(
      <SessionFactionToken
        faction={faction}
        visibleToPlayers={false}
        onToggleVisible={onToggle}
        onToggleExpand={onExpand}
      />,
    );
    expect(screen.getByText("Hidden")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show Passione to players" }));
    expect(onToggle).toHaveBeenCalledWith(faction, true);
    expect(onExpand).not.toHaveBeenCalled();
  });

  it("hides a visible faction", () => {
    const onToggle = jest.fn();
    render(<SessionFactionToken faction={faction} visibleToPlayers onToggleVisible={onToggle} />);
    fireEvent.click(screen.getByRole("button", { name: "Hide Passione from players" }));
    expect(onToggle).toHaveBeenCalledWith(faction, false);
  });

  it("players get no faction eye", () => {
    render(<SessionFactionToken faction={faction} />);
    expect(screen.queryByRole("button", { name: /from players|to players/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });
});

describe("rollGoalForCharacter", () => {
  const session = {
    roll_goal_label: "Open the door",
    roll_goal_by_character: { 2: "Watch the hall" },
  };

  it("uses a PC's own goal first", () => {
    expect(rollGoalForCharacter(session, 2)).toBe("Watch the hall");
  });

  it("falls back to the session goal", () => {
    expect(rollGoalForCharacter(session, 1)).toBe("Open the door");
  });

  it("is empty with no goal", () => {
    expect(rollGoalForCharacter({ roll_goal_by_character: { 1: "  " } }, 1)).toBe("");
    expect(rollGoalForCharacter(null, 1)).toBe("");
  });
});

describe("manualRollCharacters", () => {
  const roster = [{ id: 1, true_name: "Mine" }, { id: 2, true_name: "Theirs" }];
  const full = [{ id: 1, user: 7 }, { id: 2, user: 8 }];

  it("gives the GM every PC", () => {
    expect(manualRollCharacters(roster, full, { id: 3 }, true).map((c) => c.id)).toEqual([1, 2]);
  });

  it("gives a player only their own PC", () => {
    expect(manualRollCharacters(roster, full, { id: 7 }, false).map((c) => c.id)).toEqual([1]);
  });

  it("gives a player with no PC nothing", () => {
    expect(manualRollCharacters(roster, full, { id: 9 }, false)).toEqual([]);
  });
});

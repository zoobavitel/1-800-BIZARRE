/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import RosterAddCharacterTile from "./RosterAddCharacterTile";

const openMenu = () =>
  fireEvent.click(screen.getByRole("button", { name: /Add character/ }));

describe("RosterAddCharacterTile", () => {
  it("assigns the picked character and closes", async () => {
    const onAssign = jest.fn().mockResolvedValue();
    render(<RosterAddCharacterTile characters={[{ id: 7, true_name: "Jolyne" }]} onAssign={onAssign} />);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Jolyne" }));
    expect(onAssign).toHaveBeenCalledWith(7);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("offers create when there is nothing to pick", () => {
    const onCreate = jest.fn();
    render(<RosterAddCharacterTile characters={[]} onCreate={onCreate} />);
    openMenu();
    expect(screen.getByText("No free characters. Create one instead.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Create character" }));
    expect(onCreate).toHaveBeenCalled();
  });

  it("explains the one PC rule and offers no actions", () => {
    render(
      <RosterAddCharacterTile
        characters={[{ id: 7, true_name: "Jolyne" }]}
        existingCharacter={{ id: 1, true_name: "Jotaro" }}
        onCreate={jest.fn()}
      />,
    );
    openMenu();
    expect(screen.getByText(/You already have Jotaro/)).toBeInTheDocument();
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  });

  it("closes on Escape", () => {
    render(<RosterAddCharacterTile characters={[]} />);
    openMenu();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

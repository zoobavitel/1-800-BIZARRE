/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import ClockAudiencePicker from "./ClockAudiencePicker";

const players = [
  { id: 2, label: "player1 (Ace)" },
  { id: 3, label: "player2 (Two)" },
];

describe("Who sees this clock (PC private clocks)", () => {
  it("picks one player", () => {
    const onChange = jest.fn();
    render(
      <ClockAudiencePicker players={players} value={{ all: false, ids: [] }} onChange={onChange} />
    );
    fireEvent.click(screen.getByLabelText("player2 (Two)"));
    expect(onChange).toHaveBeenCalledWith({ all: false, ids: [3] });
  });

  it("GM only and All players are shortcuts", () => {
    const onChange = jest.fn();
    render(
      <ClockAudiencePicker players={players} value={{ all: false, ids: [3] }} onChange={onChange} />
    );
    fireEvent.click(screen.getByRole("button", { name: "All players" }));
    expect(onChange).toHaveBeenLastCalledWith({ all: true, ids: [] });
    fireEvent.click(screen.getByRole("button", { name: "GM only" }));
    expect(onChange).toHaveBeenLastCalledWith({ all: false, ids: [] });
  });

  it("unticking one player from All players keeps the others", () => {
    const onChange = jest.fn();
    render(
      <ClockAudiencePicker players={players} value={{ all: true, ids: [] }} onChange={onChange} />
    );
    expect(screen.getByLabelText("player1 (Ace)")).toBeChecked();
    fireEvent.click(screen.getByLabelText("player1 (Ace)"));
    expect(onChange).toHaveBeenCalledWith({ all: false, ids: [3] });
  });

  it("a player's own clock says Only me", () => {
    render(<ClockAudiencePicker players={players} noneLabel="Only me" />);
    expect(screen.getByRole("button", { name: "Only me" })).toHaveAttribute("aria-pressed", "true");
  });
});

/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import ClockCard from "./ClockCard";
import ClockEditPopover from "./ClockEditPopover";

const players = [
  { id: 2, label: "player1" },
  { id: 3, label: "player2" },
];
const clock = { id: 9, name: "Heist", segments: 6 };

describe("ClockEditPopover", () => {
  it("saves name, size and who sees it together", () => {
    const onSave = jest.fn();
    render(<ClockEditPopover clock={clock} players={players} onSave={onSave} onCancel={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: " Big heist " } });
    fireEvent.click(screen.getByRole("button", { name: "8" }));
    fireEvent.click(screen.getByLabelText("player2"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith({
      name: "Big heist",
      segments: 8,
      audience: { all: false, ids: [3] },
    });
  });

  it("won't save a blank name", () => {
    render(<ClockEditPopover clock={clock} onSave={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  " } });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("asks once more before deleting", () => {
    const onDelete = jest.fn();
    render(<ClockEditPopover clock={clock} onDelete={onDelete} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("has no delete button without permission", () => {
    render(<ClockEditPopover clock={clock} onCancel={jest.fn()} />);
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("Escape cancels", () => {
    const onCancel = jest.fn();
    render(<ClockEditPopover clock={clock} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("ClockCard", () => {
  it("shows who made it and who sees it", () => {
    render(
      <ClockCard
        name="Heist"
        segments={6}
        filled={2}
        creator="GM"
        audience={{ icon: "👥", text: "2", title: "2 players" }}
      />,
    );
    expect(screen.getByText("GM")).toBeInTheDocument();
    expect(screen.getByTitle("2 players")).toBeInTheDocument();
    expect(screen.getByText("2/6")).toBeInTheDocument();
  });

  it("only shows Edit when allowed", () => {
    const { rerender } = render(<ClockCard name="Heist" segments={6} filled={0} />);
    expect(screen.queryByRole("button", { name: "Edit Heist" })).not.toBeInTheDocument();
    const onEdit = jest.fn();
    rerender(<ClockCard name="Heist" segments={6} filled={0} canEdit onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Heist" }));
    expect(onEdit).toHaveBeenCalled();
  });
});

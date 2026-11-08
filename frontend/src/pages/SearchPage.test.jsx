/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import SearchPage from "./SearchPage";
import { searchAPI } from "../features/character-sheet/services/api";

jest.mock("../features/character-sheet/services/api", () => ({
  ...jest.requireActual("../features/character-sheet/services/api"),
  searchAPI: { globalSearch: jest.fn() },
}));

const homebrew = {
  type: "homebrew_item", id: 60, title: "Odd Lantern",
  subtitle: "Homebrew item · by player1", description: "", url: "/homebrew", campaign: null,
};
const character = {
  type: "character", id: 4, title: "Lantern Bearer", subtitle: "Human", description: "", campaign: null,
};

describe("site search: homebrew results (S9)", () => {
  beforeEach(() => {
    searchAPI.globalSearch.mockResolvedValue({ results: [homebrew, character] });
  });

  it("links a homebrew result to Browse with the item searched", async () => {
    render(<SearchPage />);
    fireEvent.change(screen.getByPlaceholderText(/Search/), { target: { value: "lantern" } });
    const link = await screen.findByRole("link", { name: /Odd Lantern/ }, { timeout: 2000 });
    expect(link).toHaveAttribute("href", "#homebrew/browse/Odd%20Lantern");
  });

  it("has a Homebrew filter that shows only homebrew", async () => {
    render(<SearchPage />);
    fireEvent.change(screen.getByPlaceholderText(/Search/), { target: { value: "lantern" } });
    await screen.findByRole("link", { name: /Lantern Bearer/ }, { timeout: 2000 });
    fireEvent.click(screen.getByRole("button", { name: "Homebrew" }));
    expect(screen.getByRole("link", { name: /Odd Lantern/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Lantern Bearer/ })).toBeNull();
  });
});

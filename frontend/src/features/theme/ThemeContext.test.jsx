/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./ThemeContext";

function ThemeProbe() {
  const { theme } = useTheme();
  return <span data-testid="theme-value">{theme}</span>;
}

describe("ThemeProvider (HFTF)", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    localStorage.removeItem("theme");
  });

  test("sets data-theme and localStorage to dark (HFTF)", async () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(localStorage.getItem("theme")).toBe("dark");
    });
    expect(screen.getByTestId("theme-value")).toHaveTextContent("dark");
  });
});

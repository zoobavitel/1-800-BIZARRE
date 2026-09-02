/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "../auth";
import { ThemeProvider, useTheme } from "./ThemeContext";

function ThemeProbe() {
  const { theme } = useTheme();
  return <span data-testid="theme-value">{theme}</span>;
}

function renderWithProviders(ui) {
  return render(<AuthProvider>{ui}</AuthProvider>);
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    localStorage.removeItem("theme");
  });

  test("defaults to dark when localStorage unset", async () => {
    renderWithProviders(
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

  test("restores theme from localStorage", async () => {
    localStorage.setItem("theme", "light");
    renderWithProviders(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("light");
      expect(localStorage.getItem("theme")).toBe("light");
    });
    expect(screen.getByTestId("theme-value")).toHaveTextContent("light");
  });

  test("restores cool_night from localStorage", async () => {
    localStorage.setItem("theme", "cool_night");
    renderWithProviders(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("cool_night");
      expect(localStorage.getItem("theme")).toBe("cool_night");
    });
    expect(screen.getByTestId("theme-value")).toHaveTextContent("cool_night");
  });
});

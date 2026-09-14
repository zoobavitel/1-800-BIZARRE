/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import AccountSettingsPage from "./AccountSettingsPage";
import { authAPI, useAuth } from "../features/auth";
import { useTheme } from "../features/theme/ThemeContext";

jest.mock("../features/auth", () => ({
  authAPI: {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
  },
  useAuth: jest.fn(),
}));

jest.mock("../features/theme/ThemeContext", () => ({
  useTheme: jest.fn(),
}));

jest.mock("../features/character-sheet/services/api", () => ({
  resolveMediaUrl: jest.fn((value) => value || ""),
}));

jest.mock("../components/AvatarCropModal", () => () => null);

describe("AccountSettingsPage avatar upload validation", () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: { username: "tester" } });
    useTheme.mockReturnValue({ theme: "dark", setTheme: jest.fn() });
    authAPI.getProfile.mockResolvedValue(null);
    authAPI.updateProfile.mockResolvedValue({});
    URL.createObjectURL = jest.fn((file) => `blob:${file.name}`);
    URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("rejects avatar files larger than 10 MB", async () => {
    render(<AccountSettingsPage />);
    const avatarFileInput = screen.getByLabelText("Avatar file");
    await waitFor(() => expect(authAPI.getProfile).toHaveBeenCalled());

    const oversized = new File(
      [new Uint8Array(10 * 1024 * 1024 + 1)],
      "oversized.png",
      { type: "image/png" },
    );

    fireEvent.change(avatarFileInput, { target: { files: [oversized] } });

    expect(
      screen.getByText("Avatar must be 10 MB or smaller."),
    ).toBeInTheDocument();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  test("accepts avatar files at or under 10 MB", async () => {
    render(<AccountSettingsPage />);
    const avatarFileInput = screen.getByLabelText("Avatar file");
    await waitFor(() => expect(authAPI.getProfile).toHaveBeenCalled());

    const allowed = new File([new Uint8Array(1024)], "allowed.png", {
      type: "image/png",
    });

    fireEvent.change(avatarFileInput, { target: { files: [allowed] } });

    expect(
      screen.queryByText("Avatar must be 10 MB or smaller."),
    ).not.toBeInTheDocument();
    expect(URL.createObjectURL).toHaveBeenCalledWith(allowed);
    expect(screen.queryByText("Preview")).not.toBeInTheDocument();
  });
});

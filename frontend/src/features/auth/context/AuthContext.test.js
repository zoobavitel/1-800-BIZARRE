import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
import { authAPI } from "../services/authService";
import {
  AUTH_EXPIRED_EVENT,
  SESSION_ENDED_MESSAGE,
} from "../../../utils/authSession";

jest.mock("../services/authService", () => ({
  authAPI: {
    getCurrentUser: jest.fn(),
    revokeToken: jest.fn(() => Promise.resolve()),
    logoutAllDevices: jest.fn(() => Promise.resolve()),
  },
}));

let auth;
function Probe() {
  auth = useAuth();
  return (
    <div>
      <span data-testid="signed-in">{String(auth.isAuthenticated)}</span>
      <span data-testid="note">{auth.sessionNote || ""}</span>
    </div>
  );
}

async function renderSignedIn() {
  localStorage.setItem("authToken", "tok-1");
  authAPI.getCurrentUser.mockResolvedValue({ id: 1, username: "zoob" });
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() =>
    expect(screen.getByTestId("signed-in").textContent).toBe("true"),
  );
}

afterEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

test("a rejected token signs out and shows a note", async () => {
  await renderSignedIn();
  act(() => {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  });
  expect(screen.getByTestId("signed-in").textContent).toBe("false");
  expect(screen.getByTestId("note").textContent).toBe(SESSION_ENDED_MESSAGE);
  expect(localStorage.getItem("authToken")).toBeNull();
});

test("clearError also clears the session note", async () => {
  await renderSignedIn();
  act(() => {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  });
  act(() => {
    auth.clearError();
  });
  expect(screen.getByTestId("note").textContent).toBe("");
});

test("logout revokes this device's token on the server", async () => {
  await renderSignedIn();
  act(() => {
    auth.logout();
  });
  expect(authAPI.revokeToken).toHaveBeenCalledWith("tok-1");
  expect(localStorage.getItem("authToken")).toBeNull();
  expect(screen.getByTestId("note").textContent).toBe("");
});

test("logout all devices signs out here after the server call", async () => {
  await renderSignedIn();
  await act(async () => {
    await auth.logoutAllDevices();
  });
  expect(authAPI.logoutAllDevices).toHaveBeenCalled();
  expect(screen.getByTestId("signed-in").textContent).toBe("false");
});

test("a failed logout all keeps the user signed in", async () => {
  await renderSignedIn();
  authAPI.logoutAllDevices.mockRejectedValueOnce(new Error("offline"));
  await act(async () => {
    await expect(auth.logoutAllDevices()).rejects.toThrow("offline");
  });
  expect(screen.getByTestId("signed-in").textContent).toBe("true");
});

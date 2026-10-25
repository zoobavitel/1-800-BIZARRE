import React, { createContext, useContext, useState, useEffect } from "react";
import { authAPI } from "../services/authService";
import {
  AUTH_EXPIRED_EVENT,
  SESSION_ENDED_MESSAGE,
} from "../../../utils/authSession";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("authToken"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  /** Shown on the sign-in page after the server ended the session. */
  const [sessionNote, setSessionNote] = useState(null);

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const userData = await authAPI.getCurrentUser();
          setUser(userData);
        } catch (err) {
          setToken(null);
          setUser(null);
          localStorage.removeItem("authToken");
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [token]);

  // The server rejected the stored token (expired, or revoked from another
  // device): sign out here and say why on the sign-in page.
  useEffect(() => {
    const onExpired = () => {
      localStorage.removeItem("authToken");
      setToken(null);
      setUser(null);
      setError(null);
      setSessionNote(SESSION_ENDED_MESSAGE);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const login = async (credentials) => {
    setLoading(true);
    setError(null);

    // Trim to avoid "Unable to log in" from accidental spaces
    const trimmed = {
      username: (credentials.username || "").trim(),
      password: (credentials.password || "").trim(),
    };

    try {
      const response = await authAPI.login(trimmed);
      const newToken = response.token;
      // Backend returns { token, user: { id, username, email } }; support legacy flat shape too
      const userData = response.user ?? {
        id: response.user_id,
        username: response.username,
        email: response.email ?? "",
      };

      setToken(newToken);
      setUser(userData);
      localStorage.setItem("authToken", newToken);
      // Drop stale #character/… (or other) hash so signing in lands on home,
      // not whatever page the previous user (or this user pre-logout) was on.
      if (typeof window !== "undefined") {
        window.location.hash = "";
      }

      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const signup = async (userData) => {
    setLoading(true);
    setError(null);

    // Trim to keep signup and login consistent (avoids login failures from accidental spaces)
    const trimmed = {
      username: (userData.username || "").trim(),
      password: (userData.password || "").trim(),
    };

    try {
      const response = await authAPI.signup(trimmed);
      const newToken = response.token;
      const userInfo = response.user ?? {
        id: response.user_id,
        username: response.username,
        email: response.email ?? "",
      };

      setToken(newToken);
      setUser(userInfo);
      localStorage.setItem("authToken", newToken);
      // Drop stale #character/… (or other) hash from a prior session so the app opens on home.
      if (typeof window !== "undefined") {
        window.location.hash = "";
      }

      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const clearLocalSession = () => {
    setToken(null);
    setUser(null);
    setError(null);
    localStorage.removeItem("authToken");
    // Reset the route so the next sign-in (this or another user) opens on
    // the home page instead of restoring the previous user's deep link.
    if (typeof window !== "undefined") {
      window.location.hash = "";
    }
  };

  // Sign out this device: revoke its token on the server, then clear it here.
  const logout = () => {
    const current = localStorage.getItem("authToken");
    clearLocalSession();
    void authAPI.revokeToken(current);
  };

  // Revoke every token this user has, then sign out here. Throws if the
  // server could not do it, so the caller can show the error.
  const logoutAllDevices = async () => {
    await authAPI.logoutAllDevices();
    clearLocalSession();
  };

  const isAuthenticated = !!token && !!user;

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    login,
    signup,
    logout,
    logoutAllDevices,
    sessionNote,
    clearError: () => {
      setError(null);
      setSessionNote(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

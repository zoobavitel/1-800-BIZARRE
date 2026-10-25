// Authentication service for user management

import { requireApiBaseUrl } from "../../../config/apiConfig";
import { getApiErrorMessage } from "../../../utils/apiErrorMessage";
import { reportUnauthorized } from "../../../utils/authSession";

function portraitFilenameForUpload(fileOrBlob) {
  if (
    fileOrBlob instanceof File &&
    fileOrBlob.name &&
    String(fileOrBlob.name).trim() !== ""
  ) {
    return fileOrBlob.name;
  }
  const mime = (fileOrBlob && fileOrBlob.type) || "";
  if (mime.includes("png")) return "portrait.png";
  if (mime.includes("gif")) return "portrait.gif";
  if (mime.includes("webp")) return "portrait.webp";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "portrait.jpg";
  return "portrait.jpg";
}

function isAvatarUploadPayload(v) {
  return (
    v != null &&
    (v instanceof File || (typeof Blob !== "undefined" && v instanceof Blob))
  );
}

// Helper function for API requests
const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem("authToken");
  const base = requireApiBaseUrl();
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const fullUrl = `${base}${path}`;

  const config = {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Token ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(fullUrl, config);

    if (!response.ok) {
      reportUnauthorized(response.status, token);
      const errorData = await response.json().catch(() => ({}));
      const message = getApiErrorMessage(
        errorData,
        response.status,
        response.statusText,
      );
      throw new Error(message);
    }

    return await response.json();
  } catch (error) {
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      throw new Error(
        "Could not reach game server. Check the Game server URL, ensure the host's backend is running, and try disabling ad blockers for this site.",
      );
    }
    throw error;
  }
};

const apiRequestMultipart = async (endpoint, formData, method = "PUT") => {
  const token = localStorage.getItem("authToken");
  const base = requireApiBaseUrl();
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const fullUrl = `${base}${path}`;
  const headers = {
    ...(token && { Authorization: `Token ${token}` }),
  };
  try {
    const response = await fetch(fullUrl, {
      method,
      headers,
      body: formData,
    });
    if (!response.ok) {
      reportUnauthorized(response.status, token);
      const errorData = await response.json().catch(() => ({}));
      const message = getApiErrorMessage(
        errorData,
        response.status,
        response.statusText,
      );
      throw new Error(message);
    }
    return await response.json();
  } catch (error) {
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      throw new Error(
        "Could not reach game server. Check the Game server URL, ensure the host's backend is running, and try disabling ad blockers for this site.",
      );
    }
    throw error;
  }
};

function buildProfileBody(profileData) {
  const data = profileData || {};
  const file = data.avatarFile;
  if (isAvatarUploadPayload(file)) {
    const fd = new FormData();
    fd.append("avatar", file, portraitFilenameForUpload(file));
    for (const [k, v] of Object.entries(data)) {
      if (k === "avatarFile" || k === "avatar") continue;
      if (v == null) continue;
      if (typeof v === "boolean" || typeof v === "number") {
        fd.append(k, String(v));
      } else if (typeof v === "object") {
        fd.append(k, JSON.stringify(v));
      } else {
        fd.append(k, v);
      }
    }
    return { multipart: true, body: fd };
  }
  const { avatarFile: _af, ...rest } = data;
  const jsonPayload = { ...rest };
  if (
    Object.prototype.hasOwnProperty.call(data, "avatar") &&
    data.avatar === null
  ) {
    jsonPayload.avatar = null;
  }
  return { multipart: false, body: JSON.stringify(jsonPayload) };
}

// Authentication API functions
export const authAPI = {
  // Login user
  login: (credentials) =>
    apiRequest("/accounts/login/", {
      method: "POST",
      body: JSON.stringify(credentials),
    }),

  // Register new user
  signup: (userData) =>
    apiRequest("/accounts/signup/", {
      method: "POST",
      body: JSON.stringify(userData),
    }),

  // Get current user info (for token validation and display)
  getCurrentUser: () => apiRequest("/accounts/me/"),

  // Get current user's profile (signature, theme, etc.)
  getProfile: () =>
    apiRequest("/user-profiles/").then((data) =>
      Array.isArray(data) ? data[0] : (data?.results?.[0] ?? data),
    ),

  // Change password (current + new + confirm)
  changePassword: ({ old_password, new_password, confirm_password }) =>
    apiRequest("/user-profiles/change-password/", {
      method: "POST",
      body: JSON.stringify({
        old_password,
        new_password,
        confirm_password,
      }),
    }),

  // Update current user's profile (JSON or multipart when avatarFile present)
  updateProfile: (profileData) => {
    const { multipart, body } = buildProfileBody(profileData);
    if (multipart) {
      return apiRequestMultipart("/user-profiles/update/", body, "PUT");
    }
    return apiRequest("/user-profiles/update/", {
      method: "PUT",
      body,
    });
  },

  // Logout (clear token)
  logout: () => {
    localStorage.removeItem("authToken");
  },

  /**
   * Revoke one login token on the server (this device only). Best effort:
   * the local sign-out happens even if this fails, e.g. offline or the token
   * already expired.
   */
  revokeToken: async (token) => {
    if (!token) return;
    try {
      const base = requireApiBaseUrl();
      await fetch(`${base}/accounts/logout/`, {
        method: "POST",
        headers: { Authorization: `Token ${token}` },
      });
    } catch {
      /* signed out locally anyway */
    }
  },

  /** Revoke every login token this user has, on all devices. Answers 204. */
  logoutAllDevices: async () => {
    const token = localStorage.getItem("authToken");
    const base = requireApiBaseUrl();
    const response = await fetch(`${base}/accounts/logoutall/`, {
      method: "POST",
      headers: token ? { Authorization: `Token ${token}` } : {},
    });
    // 401: this token was already revoked, so the user is signed out anyway.
    if (!response.ok && response.status !== 401) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        getApiErrorMessage(errorData, response.status, response.statusText),
      );
    }
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem("authToken");
  },
};

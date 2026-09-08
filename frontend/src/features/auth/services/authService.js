// Authentication service for user management

import { requireApiBaseUrl } from "../../../config/apiConfig";
import { getApiErrorMessage } from "../../../utils/apiErrorMessage";

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
      ...(fullUrl.includes("ngrok") && { "ngrok-skip-browser-warning": "1" }),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(fullUrl, config);

    if (!response.ok) {
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
    ...(fullUrl.includes("ngrok") && { "ngrok-skip-browser-warning": "1" }),
  };
  try {
    const response = await fetch(fullUrl, {
      method,
      headers,
      body: formData,
    });
    if (!response.ok) {
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

  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem("authToken");
  },
};

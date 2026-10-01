/**
 * Runtime API base URL for the game backend.
 * When playing remotely, the host runs the backend and shares a URL (e.g. ngrok).
 * Stored in localStorage so one deployment works for any server.
 */

const STORAGE_KEY = "apiBaseUrl";

/** Explicit REACT_APP_API_URL in .env wins. Otherwise local dev uses 127.0.0.1; production has no default (github.io must use Server URL / localStorage). */
const envApi = process.env.REACT_APP_API_URL;
const hasEnvApi = typeof envApi === "string" && envApi.trim() !== "";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
/** Prefer IPv4 loopback — `localhost` often resolves to ::1, which may hit another listener (e.g. IDE) instead of Django. */
const LOCAL_API_DEFAULT = "http://127.0.0.1:8000/api";

function getRuntimeDefaultBase() {
  if (hasEnvApi) return envApi.trim().replace(/\/+$/, "");
  if (typeof window === "undefined") {
    return process.env.NODE_ENV === "production" ? "" : LOCAL_API_DEFAULT;
  }

  const { protocol, hostname } = window.location;
  if (LOCAL_HOSTS.has(hostname)) {
    return LOCAL_API_DEFAULT;
  }

  // GitHub Pages is static only; there is no API on :8000 on this hostname.
  // Require the Game server URL (localStorage) or REACT_APP_API_URL at build time.
  if (hostname === "github.io" || hostname.endsWith(".github.io")) {
    return "";
  }

  // Same-host API (e.g. LAN or a domain that serves Django on port 8000).
  return `${protocol}//${hostname}:8000/api`;
}

/** Force https for ngrok (avoids SSL_ERROR_RX_RECORD_TOO_LONG from http://). */
function ensureHttpsForNgrok(url) {
  const lower = url.toLowerCase();
  if (
    (lower.includes("ngrok") || lower.includes("ngrok-free")) &&
    lower.startsWith("http://")
  ) {
    return "https://" + url.slice(7);
  }
  return url;
}

/** Map loopback hostname to 127.0.0.1 so IPv6 localhost does not steal :8000. */
function preferIpv4Loopback(url) {
  return url.replace(
    /^http:\/\/(localhost|\[::1\])(?=:\d+|\/|$)/i,
    "http://127.0.0.1",
  );
}

/** Ensure base URL ends with /api so paths like /accounts/login/ resolve correctly. */
function normalizeBaseUrl(url) {
  let trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed) return trimmed;
  trimmed = preferIpv4Loopback(ensureHttpsForNgrok(trimmed));
  const lower = trimmed.toLowerCase();
  if (lower === LOCAL_API_DEFAULT || lower.endsWith("/api")) return trimmed;
  return trimmed + "/api";
}

export function getApiBaseUrl() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored.trim() !== "") {
    return normalizeBaseUrl(stored);
  }
  const base = getRuntimeDefaultBase();
  // Normalize env default too (e.g. .env with localhost → 127.0.0.1).
  return base ? normalizeBaseUrl(base) : base;
}

/** Throws if no API base is configured (empty production default and no localStorage). */
export function requireApiBaseUrl() {
  const base = getApiBaseUrl();
  if (typeof base === "string" && base.trim()) {
    return base.trim();
  }
  throw new Error(
    "Game server URL is not set. On github.io, expand Server URL on the login page, enter your host’s API base (e.g. https://xxxx.ngrok-free.app/api), then sign in. Local play: http://127.0.0.1:8000/api",
  );
}

export function setApiBaseUrl(url) {
  const value = (url || "").trim().replace(/\/+$/, "");
  if (value) {
    localStorage.setItem(STORAGE_KEY, value);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function getStoredApiBaseUrl() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? stored.trim() : "";
}

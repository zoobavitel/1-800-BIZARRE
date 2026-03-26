/**
 * Runtime API base URL for the game backend.
 * When playing remotely, the host runs the backend and shares a URL (e.g. ngrok).
 * Stored in localStorage so one deployment works for any server.
 */

const STORAGE_KEY = 'apiBaseUrl';

/** Explicit REACT_APP_API_URL in .env wins. Otherwise dev uses localhost; production has no default (github.io must use Server URL / localStorage). */
const envApi = process.env.REACT_APP_API_URL;
const hasEnvApi = typeof envApi === 'string' && envApi.trim() !== '';
const DEFAULT_BASE = hasEnvApi
  ? envApi.trim().replace(/\/+$/, '')
  : process.env.NODE_ENV === 'production'
    ? ''
    : 'http://localhost:8000/api';

/** Force https for ngrok (avoids SSL_ERROR_RX_RECORD_TOO_LONG from http://). */
function ensureHttpsForNgrok(url) {
  const lower = url.toLowerCase();
  if ((lower.includes('ngrok') || lower.includes('ngrok-free')) && lower.startsWith('http://')) {
    return 'https://' + url.slice(7);
  }
  return url;
}

/** Ensure base URL ends with /api so paths like /accounts/login/ resolve correctly. */
function normalizeBaseUrl(url) {
  let trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) return trimmed;
  trimmed = ensureHttpsForNgrok(trimmed);
  const lower = trimmed.toLowerCase();
  if (lower === 'http://localhost:8000/api' || lower.endsWith('/api')) return trimmed;
  return trimmed + '/api';
}

export function getApiBaseUrl() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored.trim() !== '') {
    return normalizeBaseUrl(stored);
  }
  return DEFAULT_BASE;
}

/** Throws if no API base is configured (empty production default and no localStorage). */
export function requireApiBaseUrl() {
  const base = getApiBaseUrl();
  if (typeof base !== 'string' || !base.trim()) {
    throw new Error(
      'Game server URL is not set. On github.io, expand Server URL on the login page, enter your host’s API base (e.g. https://xxxx.ngrok-free.app/api), then sign in. Local play: http://127.0.0.1:8000/api'
    );
  }
  return base.trim();
}

export function setApiBaseUrl(url) {
  const value = (url || '').trim().replace(/\/+$/, '');
  if (value) {
    localStorage.setItem(STORAGE_KEY, value);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function getStoredApiBaseUrl() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? stored.trim() : '';
}

/**
 * Runtime API base URL for the game backend.
 * When playing remotely, the host runs the backend and shares a URL (e.g. ngrok).
 * Stored in localStorage so one deployment works for any server.
 */

const STORAGE_KEY = 'apiBaseUrl';
const DEFAULT_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:8000/api').replace(/\/+$/, '');

/** Ensure base URL ends with /api so paths like /accounts/login/ resolve correctly. */
function normalizeBaseUrl(url) {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) return trimmed;
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

/**
 * User-facing string from a DRF JSON error body.
 * Prefer `message` when the backend adds it (see app.api_exceptions + auth views).
 */
export function getApiErrorMessage(errorData, status, statusText) {
  if (!errorData || typeof errorData !== "object") {
    return `HTTP ${status}: ${statusText}`;
  }
  if (typeof errorData.message === "string" && errorData.message.trim()) {
    return errorData.message.trim();
  }
  if (
    Array.isArray(errorData.non_field_errors) &&
    errorData.non_field_errors[0]
  ) {
    return String(errorData.non_field_errors[0]);
  }
  if (errorData.detail) {
    return typeof errorData.detail === "string"
      ? errorData.detail
      : JSON.stringify(errorData.detail);
  }
  if (errorData.error) {
    return String(errorData.error);
  }
  const entries = Object.entries(errorData).filter(
    ([k, v]) => k !== "message" && v != null && v !== "",
  );
  if (entries.length > 0) {
    const parts = entries.map(([k, v]) => {
      const msg = Array.isArray(v)
        ? v[0]
        : typeof v === "object"
          ? JSON.stringify(v)
          : String(v);
      return `${k}: ${msg}`;
    });
    return parts.join("; ");
  }
  return `HTTP ${status}: ${statusText}`;
}

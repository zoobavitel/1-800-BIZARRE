/**
 * Login token lifecycle shared by every API helper.
 *
 * Tokens expire 30 days after their last use and can be revoked from another
 * device ("Log out of all devices"). The server then answers 401. Each request
 * helper calls reportUnauthorized(); AuthContext listens and sends the user to
 * the sign-in page with a note.
 */

export const AUTH_EXPIRED_EVENT = "bizarre:auth-expired";

export const SESSION_ENDED_MESSAGE = "Your session ended. Sign in again.";

function storedToken() {
  try {
    return typeof localStorage !== "undefined"
      ? localStorage.getItem("authToken")
      : null;
  } catch {
    return null;
  }
}

/**
 * Report a response status for a request sent with `sentToken`.
 *
 * Only a 401 for the token still in storage ends the session. A late 401 for
 * a token that a newer sign-in already replaced is ignored, and so is a 401
 * for a request sent without a token.
 *
 * @param {number} status HTTP status of the response
 * @param {string | null | undefined} sentToken token the request carried
 * @returns {boolean} true if the session was ended
 */
export function reportUnauthorized(status, sentToken) {
  if (status !== 401 || !sentToken) return false;
  if (storedToken() !== sentToken) return false;
  if (typeof window === "undefined") return false;
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  return true;
}

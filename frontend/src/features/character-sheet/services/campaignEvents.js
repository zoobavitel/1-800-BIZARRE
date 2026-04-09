/**
 * Subscribe to server-sent campaign updates (position/effect, rolls, character saves).
 * Uses DRF token in the query string because EventSource cannot send Authorization headers.
 */
import { getApiBaseUrl } from "../../../config/apiConfig";

/**
 * @param {number} campaignId
 * @param {{ onUpdate?: () => void }} handlers
 * @returns {() => void} unsubscribe
 */
export function subscribeCampaignEvents(campaignId, { onUpdate } = {}) {
  const base = getApiBaseUrl();
  const token =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("authToken")
      : null;
  if (!campaignId || !base || !token) {
    return () => {};
  }
  const url = `${base.replace(/\/+$/, "")}/campaigns/${campaignId}/events/?token=${encodeURIComponent(token)}`;
  let es;
  try {
    es = new EventSource(url);
  } catch {
    return () => {};
  }
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data && data.type === "campaign_update") {
        onUpdate?.();
      }
    } catch {
      /* ignore */
    }
  };
  es.onerror = () => {
    es.close();
  };
  return () => {
    es.close();
  };
}

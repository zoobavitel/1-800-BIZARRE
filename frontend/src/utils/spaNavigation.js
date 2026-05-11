function isModifiedClick(event) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey;
}

export function isPlainLeftClick(event) {
  return event.button === 0 && !isModifiedClick(event) && !event.defaultPrevented;
}

export function handleSpaNavClick(event, navigate) {
  if (!isPlainLeftClick(event)) return;
  event.preventDefault();
  if (typeof navigate === "function") navigate();
}

export function buildRouteHash(page, payload = {}) {
  if (page === "character") {
    return payload.characterId != null ? `character/${payload.characterId}` : "character";
  }
  if (page === "campaigns") {
    const cid = payload.campaignId ?? null;
    const sidNum =
      payload.sessionId != null ? Number(payload.sessionId) : Number.NaN;
    if (
      cid != null &&
      Number.isFinite(sidNum) &&
      sidNum > 0
    ) {
      return `campaigns/${cid}/session/${sidNum}`;
    }
    return cid != null ? `campaigns/${cid}` : "campaigns";
  }
  if (page === "abilities") {
    return payload.filter ? `abilities-${payload.filter}` : "abilities";
  }
  if (page === "character-options") return "character-options";
  if (page === "rules") {
    return payload.section ? `rules-${payload.section}` : "rules";
  }
  if (page === "npcs") {
    if (payload.npcId != null) return `npcs/${payload.npcId}`;
    if (payload.campaignId != null) return `npcs/new/${payload.campaignId}`;
    return "npcs";
  }
  if (!page || page === "home") return "";
  return page;
}

export function buildRouteHref(page, payload) {
  const hash = buildRouteHash(page, payload);
  return hash ? `#${hash}` : "#";
}

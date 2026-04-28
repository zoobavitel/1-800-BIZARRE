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
    return payload.campaignId != null ? `campaigns/${payload.campaignId}` : "campaigns";
  }
  if (page === "abilities") {
    return payload.filter ? `abilities-${payload.filter}` : "abilities";
  }
  if (page === "character-options") return "character-options";
  if (page === "rules") {
    return payload.section ? `rules-${payload.section}` : "rules";
  }
  if (page === "npcs") {
    return payload.npcId != null ? `npcs/${payload.npcId}` : "npcs";
  }
  if (!page || page === "home") return "";
  return page;
}

export function buildRouteHref(page, payload) {
  const hash = buildRouteHash(page, payload);
  return hash ? `#${hash}` : "#";
}

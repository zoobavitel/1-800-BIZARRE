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

export function slugifyCharacterHashSegment(name) {
  if (name == null) return "";
  const s = String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length > 80 ? s.slice(0, 80) : s;
}

/**
 * Hash path without leading `#`, e.g. `character/10-walter-white` or `character/10`.
 * @param {number|string|null|undefined} id
 * @param {string|undefined|null} trueName Character `name` / true_name
 */
export function characterHashFromIdAndName(id, trueName) {
  if (id == null || id === "") return "character";
  const slug = slugifyCharacterHashSegment(trueName);
  return slug ? `character/${id}-${slug}` : `character/${id}`;
}

export function buildRouteHash(page, payload = {}) {
  if (page === "character") {
    if (payload.characterId == null) return "character";
    const id = payload.characterId;
    const slugRaw = payload.characterSlug ?? payload.slug ?? null;
    const slug =
      typeof slugRaw === "string" && slugRaw.trim()
        ? slugifyCharacterHashSegment(slugRaw)
        : "";
    if (slug) return `character/${id}-${slug}`;
    return `character/${id}`;
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

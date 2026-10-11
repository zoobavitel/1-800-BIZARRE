/**
 * Sanitize faction_status JSON (name → −3…+3). Strips accidental {next,changed} wrappers.
 */
export function seedFactionStatusFromCampaign(
  existing,
  campaignFactions,
  selfFactionId,
) {
  const base = {};
  const raw =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? existing
      : {};
  const source =
    raw.next && typeof raw.next === "object" && !Array.isArray(raw.next)
      ? raw.next
      : raw;
  for (const [k, v] of Object.entries(source)) {
    if (k === "next" || k === "changed") continue;
    const name = String(k).trim();
    if (!name) continue;
    const n = Number(v);
    base[name] = Number.isFinite(n)
      ? Math.max(-3, Math.min(3, Math.trunc(n)))
      : 0;
  }
  let changed =
    Object.keys(base).length !==
      Object.keys(source).filter((k) => k !== "next" && k !== "changed")
        .length ||
    Object.keys(source).some((k) => k === "next" || k === "changed");
  for (const f of campaignFactions || []) {
    if (f == null || f.name == null) continue;
    if (
      selfFactionId != null &&
      selfFactionId !== "" &&
      Number(f.id) === Number(selfFactionId)
    ) {
      continue;
    }
    const name = String(f.name).trim();
    if (!name) continue;
    if (!(name in base)) {
      base[name] = 0;
      changed = true;
    }
  }
  return { next: base, changed };
}

export function normalizeFactionStatusMap(raw) {
  return seedFactionStatusFromCampaign(raw, [], null).next;
}

/** Peer name → bool. Missing key means visible (true). */
export function normalizeFactionStatusVisibility(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === "next" || k === "changed") continue;
    const name = String(k || "").trim();
    if (!name) continue;
    out[name] = !!v;
  }
  return out;
}

export function peerStandingVisible(visibilityMap, peerName) {
  const name = String(peerName || "").trim();
  if (!name) return false;
  const vis = normalizeFactionStatusVisibility(visibilityMap);
  if (!Object.prototype.hasOwnProperty.call(vis, name)) return true;
  return !!vis[name];
}

/**
 * Apply A↔B visibility so both faction_status_visibility maps stay symmetric.
 * visible null/undefined removes both keys (back to default-visible).
 */
export function applySymmetricFactionStatusVisibility(
  selfName,
  otherName,
  visible,
  visA,
  visB,
) {
  const a = normalizeFactionStatusVisibility(visA);
  const b = normalizeFactionStatusVisibility(visB);
  const self = String(selfName || "").trim();
  const other = String(otherName || "").trim();
  if (!self || !other || self === other) {
    return { visibilityA: a, visibilityB: b };
  }
  if (visible === null || visible === undefined) {
    const nextA = { ...a };
    const nextB = { ...b };
    delete nextA[other];
    delete nextB[self];
    return { visibilityA: nextA, visibilityB: nextB };
  }
  const flag = !!visible;
  return {
    visibilityA: { ...a, [other]: flag },
    visibilityB: { ...b, [self]: flag },
  };
}

/**
 * Apply A↔B standing so both faction_status maps stay symmetric.
 * value null/undefined removes both directions; otherwise clamps −3…+3.
 */
export function applySymmetricFactionStatus(
  selfName,
  otherName,
  value,
  statusA,
  statusB,
) {
  const a = normalizeFactionStatusMap(statusA);
  const b = normalizeFactionStatusMap(statusB);
  const self = String(selfName || "").trim();
  const other = String(otherName || "").trim();
  if (!self || !other || self === other) {
    return { statusA: a, statusB: b };
  }
  if (value === null || value === undefined) {
    const nextA = { ...a };
    const nextB = { ...b };
    delete nextA[other];
    delete nextB[self];
    return { statusA: nextA, statusB: nextB };
  }
  const n = Math.max(-3, Math.min(3, Math.trunc(Number(value) || 0)));
  return {
    statusA: { ...a, [other]: n },
    statusB: { ...b, [self]: n },
  };
}

function factionStatusMapsEqual(a, b) {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => a[k] === b[k]);
}

function visibilityMapsEqual(a, b) {
  const na = normalizeFactionStatusVisibility(a);
  const nb = normalizeFactionStatusVisibility(b);
  const ka = Object.keys(na);
  const kb = Object.keys(nb);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => na[k] === nb[k]);
}

/**
 * For each changed key in self's faction_status, GET other faction and PATCH
 * reverse entry so B→A matches A→B.
 */
export async function syncReverseFactionStatuses({
  selfId,
  selfName,
  statusMap,
  previousStatusMap,
  campaignFactions,
  getFaction,
  patchFaction,
}) {
  const self = String(selfName || "").trim();
  if (!self || selfId == null || selfId === "") return [];
  const curr = normalizeFactionStatusMap(statusMap);
  const prev =
    previousStatusMap && typeof previousStatusMap === "object"
      ? normalizeFactionStatusMap(previousStatusMap)
      : null;

  const names = new Set([
    ...Object.keys(curr),
    ...(prev ? Object.keys(prev) : []),
  ]);
  const updated = [];

  for (const otherName of names) {
    if (!otherName || otherName === self) continue;
    const currHas = Object.prototype.hasOwnProperty.call(curr, otherName);
    const prevHas = prev
      ? Object.prototype.hasOwnProperty.call(prev, otherName)
      : false;
    const currVal = currHas ? curr[otherName] : null;
    if (prev && prevHas && currHas && prev[otherName] === currVal) continue;
    if (prev && !prevHas && !currHas) continue;

    const other = (campaignFactions || []).find(
      (f) =>
        f != null &&
        String(f.name || "").trim() === otherName &&
        Number(f.id) !== Number(selfId),
    );
    if (!other?.id) continue;

    let otherStatus;
    try {
      const full = await getFaction(other.id);
      otherStatus = normalizeFactionStatusMap(full?.faction_status);
    } catch {
      otherStatus = normalizeFactionStatusMap(other.faction_status);
    }

    const { statusB } = applySymmetricFactionStatus(
      self,
      otherName,
      currHas ? currVal : null,
      curr,
      otherStatus,
    );
    if (factionStatusMapsEqual(statusB, otherStatus)) continue;

    try {
      const patched = await patchFaction(other.id, {
        faction_status: statusB,
      });
      updated.push(patched || { ...other, faction_status: statusB });
    } catch {
      // ignore per-faction reverse failures
    }
  }
  return updated;
}

/**
 * PATCH self + reverse peer visibility for one edge.
 */
export async function patchFactionPeerVisibility({
  selfFaction,
  otherName,
  visible,
  campaignFactions,
  getFaction,
  patchFaction,
}) {
  const selfName = String(selfFaction?.name || "").trim();
  const other = (campaignFactions || []).find(
    (f) => String(f.name || "").trim() === String(otherName || "").trim(),
  );
  if (!selfFaction?.id || !selfName || !other?.id) return null;
  const prevSelf = normalizeFactionStatusVisibility(
    selfFaction.faction_status_visibility,
  );
  const prevOther = normalizeFactionStatusVisibility(
    other.faction_status_visibility,
  );
  const { visibilityA, visibilityB } = applySymmetricFactionStatusVisibility(
    selfName,
    otherName,
    visible,
    prevSelf,
    prevOther,
  );
  await patchFaction(selfFaction.id, {
    faction_status_visibility: visibilityA,
  });
  await syncReverseFactionStatusVisibility({
    selfId: selfFaction.id,
    selfName,
    visibilityMap: visibilityA,
    previousVisibilityMap: prevSelf,
    campaignFactions,
    getFaction,
    patchFaction,
  });
  if (!visibilityMapsEqual(visibilityB, prevOther)) {
    await patchFaction(other.id, {
      faction_status_visibility: visibilityB,
    }).catch(() => {});
  }
  return { visibilityA, visibilityB };
}

/**
 * Sync reverse faction_status_visibility for changed peer keys.
 */
export async function syncReverseFactionStatusVisibility({
  selfId,
  selfName,
  visibilityMap,
  previousVisibilityMap,
  campaignFactions,
  getFaction,
  patchFaction,
}) {
  const self = String(selfName || "").trim();
  if (!self || selfId == null || selfId === "") return [];
  const curr = normalizeFactionStatusVisibility(visibilityMap);
  const prev =
    previousVisibilityMap && typeof previousVisibilityMap === "object"
      ? normalizeFactionStatusVisibility(previousVisibilityMap)
      : null;

  const names = new Set([
    ...Object.keys(curr),
    ...(prev ? Object.keys(prev) : []),
  ]);
  const updated = [];

  for (const otherName of names) {
    if (!otherName || otherName === self) continue;
    const currHas = Object.prototype.hasOwnProperty.call(curr, otherName);
    const prevHas = prev
      ? Object.prototype.hasOwnProperty.call(prev, otherName)
      : false;
    const currVal = currHas ? curr[otherName] : null;
    if (prev && prevHas && currHas && prev[otherName] === currVal) continue;
    if (prev && !prevHas && !currHas) continue;

    const other = (campaignFactions || []).find(
      (f) =>
        f != null &&
        String(f.name || "").trim() === otherName &&
        Number(f.id) !== Number(selfId),
    );
    if (!other?.id) continue;

    let otherVis;
    try {
      const full = await getFaction(other.id);
      otherVis = normalizeFactionStatusVisibility(
        full?.faction_status_visibility,
      );
    } catch {
      otherVis = normalizeFactionStatusVisibility(
        other.faction_status_visibility,
      );
    }

    const { visibilityB } = applySymmetricFactionStatusVisibility(
      self,
      otherName,
      currHas ? currVal : null,
      curr,
      otherVis,
    );
    if (visibilityMapsEqual(visibilityB, otherVis)) continue;

    try {
      const patched = await patchFaction(other.id, {
        faction_status_visibility: visibilityB,
      });
      updated.push(
        patched || { ...other, faction_status_visibility: visibilityB },
      );
    } catch {
      // ignore per-faction reverse failures
    }
  }
  return updated;
}

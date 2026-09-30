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

/** Clamp personal / crew / faction standing to −3…+3. */
export function clampStandingValue(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(-3, Math.min(3, Math.trunc(v)));
}

/** Normalize id→standing maps (pc_standing / crew_standing). Keys = digit strings. */
export function normalizeStandingMap(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const sk = String(k).trim();
    if (!sk || !/^\d+$/.test(sk)) continue;
    out[sk] = clampStandingValue(v);
  }
  return out;
}

export function formatSignedStanding(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  if (n > 0) return `+${n}`;
  return String(n);
}

export function standingTierLabel(v) {
  const n = clampStandingValue(v);
  if (n <= -3) return "War";
  if (n === -2) return "Hostile";
  if (n === -1) return "Interfering";
  if (n === 0) return "Neutral";
  if (n === 1) return "Helpful";
  if (n === 2) return "Friendly";
  return "Allied";
}

export function pcDisplayName(ch) {
  return ch?.true_name || ch?.name || ch?.alias || `PC ${ch?.id ?? "?"}`;
}

export function standingValueColor(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "#9ca3af";
  if (n > 0) return "#34d399";
  return "#f87171";
}

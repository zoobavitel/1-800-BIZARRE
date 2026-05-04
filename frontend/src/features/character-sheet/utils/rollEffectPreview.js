/**
 * Mirrors backend `normalize_effect` / `bump_effect` (roll_helpers.py) for UI preview.
 */

const EFFECT_ORDER = ["limited", "standard", "extreme"];

export function normalizeEffectTier(raw) {
  if (!raw) return "standard";
  const e = String(raw).trim().toLowerCase();
  if (e === "great" || e === "greater") return "extreme";
  if (EFFECT_ORDER.includes(e)) return e;
  return "standard";
}

/**
 * @param {string} effect normalized or raw tier
 * @param {number} steps integer steps (clamped to tier range)
 */
export function bumpEffectTier(effect, steps) {
  const eff = normalizeEffectTier(effect);
  const i = EFFECT_ORDER.indexOf(eff);
  const n = Number(steps) || 0;
  const j = Math.max(
    0,
    Math.min(EFFECT_ORDER.length - 1, i + n),
  );
  return EFFECT_ORDER[j];
}

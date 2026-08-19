/** ProgressClock model validators: max_segments 1–12. */

export const CLOCK_SEGMENTS_MIN = 1;
export const CLOCK_SEGMENTS_MAX = 12;
export const CLOCK_SEGMENTS_FALLBACK = 4;

/** Postgres integer PK ceiling; Date.now() temp ids are larger and must not be sent. */
export const PERSISTED_CLOCK_ID_MAX = 2147483647;

export function clampClockSegments(raw, fallback = CLOCK_SEGMENTS_FALLBACK) {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) {
    const fb = Math.round(Number(fallback));
    const base = Number.isFinite(fb) ? fb : CLOCK_SEGMENTS_FALLBACK;
    return Math.max(CLOCK_SEGMENTS_MIN, Math.min(CLOCK_SEGMENTS_MAX, base));
  }
  return Math.max(CLOCK_SEGMENTS_MIN, Math.min(CLOCK_SEGMENTS_MAX, n));
}

export function clampClockFilled(filled, segments) {
  const max = clampClockSegments(segments);
  const n = Math.round(Number(filled));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, n);
}

/** Wedge count for the ring — never snap 7 onto 8/12 BitD presets. */
export function clockWedgeCount(segments) {
  return clampClockSegments(segments);
}

export function isPersistedProgressClockId(id) {
  if (typeof id === "string" && id.trim() !== "" && !/^\d+$/.test(id.trim())) {
    return false;
  }
  const n = Number(id);
  return Number.isInteger(n) && n > 0 && n <= PERSISTED_CLOCK_ID_MAX;
}

export function normalizeSheetProgressClock(c) {
  if (!c || typeof c !== "object") return null;
  const segments = clampClockSegments(c.segments ?? c.max_segments);
  return {
    ...c,
    id: c.id,
    name: c.name ?? "",
    segments,
    max_segments: segments,
    filled: clampClockFilled(c.filled ?? c.filled_segments, segments),
    filled_segments: clampClockFilled(c.filled ?? c.filled_segments, segments),
    visible_to_party: Boolean(c.visible_to_party),
    visible_to_players: Boolean(c.visible_to_players),
    clock_type: c.clock_type,
    session: c.session,
    description: c.description ?? "",
    completed: Boolean(c.completed),
    created_by: c.created_by,
  };
}

export function serializeSheetProgressClocks(clocks) {
  if (!Array.isArray(clocks)) return [];
  return clocks
    .map((c) => {
      const n = normalizeSheetProgressClock(c);
      if (!n) return null;
      const row = {
        name: n.name || "Clock",
        clock_type: n.clock_type || "COUNTDOWN",
        max_segments: n.segments,
        segments: n.segments,
        filled_segments: n.filled,
        filled: n.filled,
        visible_to_party: n.visible_to_party,
        visible_to_players: n.visible_to_players,
        description: n.description || "",
        session: n.session ?? null,
      };
      if (isPersistedProgressClockId(n.id)) {
        row.id = Number(n.id);
      }
      return row;
    })
    .filter(Boolean);
}

import { isImageUploadPayload } from "../services/api";

/**
 * The sheet's "has anything changed since the last save?" key.
 *
 * Leaves out values the client fills in after the sheet opens, which are never
 * user edits: `hasXpAllocations` (from the XP history fetch) and each clock's
 * `clientKey` (a local id). With them in, opening a sheet showed
 * "Saving… / Saved" with no edit (2026-11-03).
 *
 * File stringifies as {}, which falsely matched "already saved", so a pending
 * upload is keyed by name, size and type.
 */
export function sheetPayloadDedupeKey(
  payload,
  { ignorePendingImageFile = false } = {},
) {
  const {
    lastModified,
    _fieldTouches,
    hasXpAllocations,
    ...rest
  } = payload || {};
  const file = rest.imageFile;
  let imageFileKey = null;
  if (!ignorePendingImageFile && isImageUploadPayload(file)) {
    imageFileKey = `pending:${file.name || "blob"}:${file.size}:${file.type || ""}`;
  }
  const clocks = Array.isArray(rest.clocks)
    ? rest.clocks.map((c) => {
        if (!c || typeof c !== "object") return c;
        const { clientKey, ...clock } = c;
        return clock;
      })
    : rest.clocks;
  return JSON.stringify({ ...rest, clocks, imageFile: imageFileKey });
}

/**
 * Baseline key with the heritage the reference list resolved after load.
 *
 * The sheet takes its baseline on open, before the heritage list loads, so the
 * baseline has `heritage: null`. Only that field is filled in, so an edit made
 * in the meantime still counts.
 */
export function withResolvedHeritage(baselineKey, heritage) {
  if (typeof heritage !== "number" || !Number.isFinite(heritage)) {
    return baselineKey;
  }
  let parsed;
  try {
    parsed = JSON.parse(baselineKey);
  } catch {
    return baselineKey;
  }
  if (!parsed || typeof parsed !== "object" || parsed.heritage != null) {
    return baselineKey;
  }
  return JSON.stringify({ ...parsed, heritage });
}

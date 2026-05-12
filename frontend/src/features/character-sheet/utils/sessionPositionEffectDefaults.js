import { normalizeEffectTier } from "./rollEffectPreview";

const VALID_POSITION = new Set(["controlled", "risky", "desperate"]);

function rowForCharacter(positionEffectByCharacter, characterId) {
  if (
    positionEffectByCharacter == null ||
    typeof positionEffectByCharacter !== "object" ||
    characterId == null
  ) {
    return null;
  }
  const row =
    positionEffectByCharacter[String(characterId)] ??
    positionEffectByCharacter[characterId];
  return row && typeof row === "object" ? row : null;
}

/**
 * Default Position / Effect for a PC from the same session payload as
 * `active_session_detail.position_effect_by_character` (GM bulk editor),
 * falling back to session-wide `default_position` / `default_effect`.
 *
 * @param {number|string|null|undefined} characterId
 * @param {null|undefined|{
 *   default_position?: string,
 *   default_effect?: string,
 *   position_effect_by_character?: Record<string, { position?: string, effect?: string }>,
 * }} activeSessionDetail
 * @returns {{ position: string, effect: string }}
 */
export function defaultPositionEffectFromSessionDetail(
  characterId,
  activeSessionDetail,
) {
  const asd =
    activeSessionDetail && typeof activeSessionDetail === "object"
      ? activeSessionDetail
      : null;
  const row = asd
    ? rowForCharacter(asd.position_effect_by_character, characterId)
    : null;
  let position = String(
    row?.position ?? asd?.default_position ?? "",
  )
    .trim()
    .toLowerCase();
  if (!VALID_POSITION.has(position)) position = "risky";
  const effect = normalizeEffectTier(
    row?.effect ?? asd?.default_effect ?? "standard",
  );
  return { position, effect };
}

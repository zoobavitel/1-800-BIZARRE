import { resolveMediaUrl } from "../features/character-sheet/services/api";

/** Portrait URL from a campaign roster row or transformed character. */
export function getCharacterPortraitSrc(character) {
  if (!character || typeof character !== "object") return null;
  const fromUpload = resolveMediaUrl(character.image || "");
  if (fromUpload) return fromUpload;
  const url = String(character.image_url ?? "").trim();
  return url || null;
}

function portraitForUserInCampaign(campaignCharacters, userId) {
  if (userId == null || !Array.isArray(campaignCharacters)) return null;
  const uid = Number(userId);
  if (!Number.isFinite(uid)) return null;
  const row = campaignCharacters.find((ch) => Number(ch?.user_id) === uid);
  return getCharacterPortraitSrc(row);
}

/**
 * Account avatar (upload or HTTPS URL), else PC portrait in this campaign.
 * @param {object|null|undefined} person — User with nested `profile`
 * @param {{ campaignCharacters?: object[] }} [options]
 */
export function getUserAvatarSrc(person, { campaignCharacters } = {}) {
  if (!person || typeof person !== "object") return null;

  const profile = person.profile;
  if (profile && profile.show_avatars === false) return null;

  const uploaded = typeof profile?.avatar === "string" ? profile.avatar.trim() : "";
  if (uploaded) {
    const resolved = resolveMediaUrl(uploaded);
    if (resolved) return resolved;
  }

  const avatarUrl =
    typeof profile?.avatar_url === "string" ? profile.avatar_url.trim() : "";
  if (avatarUrl) return avatarUrl;

  return portraitForUserInCampaign(campaignCharacters, person.id);
}

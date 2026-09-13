import React, { useEffect, useState } from "react";
import { resolveMediaUrl } from "../../features/character-sheet";
import { getUserAvatarSrc } from "../../utils/homeAvatar";

const SAFE_DATA_IMAGE_SRC =
  /^data:image\/(?:avif|gif|jpe?g|png|webp);base64,[a-z0-9+/=\s]+$/i;

function sanitizeImageSrc(src) {
  const value = typeof src === "string" ? src.trim() : "";
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("blob:")) return value;
  if (SAFE_DATA_IMAGE_SRC.test(value)) return value;
  return "";
}

export function getUserDisplayName(person) {
  const username = person?.username;
  return typeof username === "string" && username.trim()
    ? username.trim()
    : "Unknown";
}

/**
 * Home page campaign card with full-bleed background image and dark gradient scrim.
 * Falls back to dark solid card without thumbnail slot when image is absent or broken.
 */
export default function HomeCampaignCard({
  campaign,
  href,
  onClick,
  isGm = false,
  user = null,
}) {
  const [imageBroken, setImageBroken] = useState(false);

  const rawImage = campaign?.image;
  const resolvedSrc = rawImage ? resolveMediaUrl(rawImage) : "";
  const safeSrc = sanitizeImageSrc(resolvedSrc);

  useEffect(() => {
    setImageBroken(false);
  }, [rawImage]);

  const hasImage = Boolean(safeSrc) && !imageBroken;
  const inactive = campaign?.is_active === false;

  const roster = campaign?.campaign_characters || [];
  const players = Array.isArray(campaign?.players) ? campaign.players : [];
  const playerCount = players.length;
  const gmName = getUserDisplayName(campaign?.gm);
  const gmAvatarSrc = getUserAvatarSrc(campaign?.gm, {
    campaignCharacters: roster,
  });
  const myChar = roster.find((cc) => cc.user_id === user?.id);
  const playingAs = myChar?.true_name || null;
  const sessionCount = Array.isArray(campaign?.sessions)
    ? campaign.sessions.length
    : 0;
  const visiblePlayers = players.slice(0, 5);
  const extraPlayers = Math.max(players.length - visiblePlayers.length, 0);
  const live = campaign?.active_session_detail;

  const cardClasses = [
    "g-card",
    inactive ? "g-card-inactive" : "",
    hasImage ? "g-card-has-image" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <a
      href={href}
      className={cardClasses}
      onClick={onClick}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      {hasImage && (
        <div className="g-card-bg" aria-hidden="true">
          <img
            src={safeSrc}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageBroken(true)}
          />
        </div>
      )}
      {hasImage && <div className="g-card-scrim" aria-hidden="true" />}
      <div className="g-card-stripe" />
      <div className="g-card-body">
        <div className="g-card-info">
          <div className="g-card-header">
            <div className="g-card-name">{campaign?.name || "—"}</div>
            <div className="g-card-badges">
              <span
                className={`g-badge ${inactive ? "g-badge-inactive" : "g-badge-active"}`}
              >
                {inactive ? "Inactive" : "Active"}
              </span>
            </div>
          </div>
          <div className="g-card-gm-row">
            <span className="g-card-gm-label">GM</span>
            <div className={`g-card-gm-chip${isGm ? " is-self" : ""}`}>
              {gmAvatarSrc ? (
                <span className="g-card-user-avatar" aria-hidden="true">
                  <img src={gmAvatarSrc} alt="" />
                </span>
              ) : null}
              <span className="g-card-user-name">{gmName}</span>
            </div>
          </div>
          <div className="g-card-desc">{campaign?.description || "—"}</div>
          <div className="g-card-stats">
            <span>
              Players
              <span className="g-card-stat-val">{playerCount}</span>
            </span>
            <span>
              Sessions
              <span className="g-card-stat-val">{sessionCount}</span>
            </span>
            {playingAs && (
              <span>
                Playing as
                <span className="g-card-stat-val g-card-stat-accent">
                  {playingAs}
                </span>
              </span>
            )}
          </div>
          <div className="g-card-player-list">
            {visiblePlayers.length === 0 ? (
              <span className="g-card-player-empty">No players yet</span>
            ) : (
              visiblePlayers.map((player) => {
                const playerName = getUserDisplayName(player);
                const playerAvatarSrc = getUserAvatarSrc(player, {
                  campaignCharacters: roster,
                });
                return (
                  <span
                    key={player.id || playerName}
                    className="g-card-player-chip"
                  >
                    {playerAvatarSrc ? (
                      <span className="g-card-user-avatar" aria-hidden="true">
                        <img src={playerAvatarSrc} alt="" />
                      </span>
                    ) : null}
                    <span className="g-card-user-name">{playerName}</span>
                  </span>
                );
              })
            )}
            {extraPlayers > 0 && (
              <span className="g-card-player-chip g-card-player-chip-more">
                +{extraPlayers} more
              </span>
            )}
          </div>
          {live && !inactive && (
            <div className="g-session-live">
              {live.name ? `Session: ${live.name}` : "Session active"} — open
              campaign to join
            </div>
          )}
        </div>
      </div>
    </a>
  );
}

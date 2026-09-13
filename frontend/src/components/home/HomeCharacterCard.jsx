import React from "react";
import { getCharacterPortraitSrc } from "../../utils/homeAvatar";
import { buildRouteHref, handleSpaNavClick } from "../../utils/spaNavigation";
import HomeCardThumb from "./HomeCardThumb";
import HomeFullBleedBg, { useHomeCardImage } from "./HomeFullBleedBg";

/**
 * Home page PC card — full-bleed portrait when available, else thumb slot.
 */
export default function HomeCharacterCard({
  character,
  onEdit,
  onDelete,
}) {
  const portraitSrc = getCharacterPortraitSrc(character);
  const { hasImage, safeSrc, onError } = useHomeCardImage(portraitSrc);

  const cardClasses = ["p-card", hasImage ? "p-card-has-image" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cardClasses}
      role="button"
      tabIndex={0}
      onClick={() => onEdit?.(character)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit?.(character);
        }
      }}
    >
      {hasImage && <HomeFullBleedBg src={safeSrc} onError={onError} />}
      <div className="p-card-stripe" />
      {!hasImage && (
        <HomeCardThumb
          className="p-card-thumb"
          src={portraitSrc}
          label={character?.name}
        />
      )}
      <div className="p-card-body">
        <div className="p-card-info">
          <div className="p-card-name">{character?.name || "—"}</div>
          <div className="p-card-stand">
            「{character?.standName || "—"}」
          </div>
          <div className="p-card-tags">
            <span className="p-tag">
              {character?.heritageName || character?.heritage || "—"}
            </span>
            <span className="p-tag">{character?.playbook || "—"}</span>
            <span className="p-tag">Lv {character?.level ?? "—"}</span>
          </div>
        </div>
        <div className="p-card-actions">
          <a
            href={buildRouteHref("character", { characterId: character?.id })}
            className="p-card-btn p-card-btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              handleSpaNavClick(e, () => onEdit?.(character));
            }}
          >
            Edit
          </a>
          <button
            type="button"
            className="p-card-btn p-card-btn-delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(character?.id);
            }}
            aria-label="Delete character"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

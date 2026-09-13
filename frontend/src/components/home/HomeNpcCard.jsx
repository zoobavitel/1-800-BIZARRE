import React from "react";
import { getCharacterPortraitSrc } from "../../utils/homeAvatar";
import { buildRouteHref, handleSpaNavClick } from "../../utils/spaNavigation";
import HomeCardThumb from "./HomeCardThumb";
import HomeFullBleedBg, { useHomeCardImage } from "./HomeFullBleedBg";

/**
 * Home page NPC token card — 3:4 portrait slot; full-bleed when art exists.
 */
export default function HomeNpcCard({ npc, onEdit, onDelete }) {
  const portraitSrc = getCharacterPortraitSrc(npc);
  const { hasImage, safeSrc, onError } = useHomeCardImage(portraitSrc);
  const name = npc?.name || "NPC";

  const cardClasses = ["npc-card", hasImage ? "npc-card-has-image" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cardClasses}
      role="button"
      tabIndex={0}
      onClick={() => onEdit?.(npc?.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit?.(npc?.id);
        }
      }}
    >
      {hasImage && <HomeFullBleedBg src={safeSrc} onError={onError} />}
      <div className="npc-card-stripe" />
      <div className="p-card-media">
        {!hasImage && (
          <HomeCardThumb
            className="npc-card-thumb"
            src={portraitSrc}
            label={npc?.name}
          />
        )}
        <div className="p-card-actions">
          <a
            href={buildRouteHref("npcs", { npcId: npc?.id })}
            className="p-card-btn p-card-btn-primary p-card-btn-npc"
            onClick={(e) => {
              e.stopPropagation();
              handleSpaNavClick(e, () => onEdit?.(npc?.id));
            }}
            aria-label={`Edit ${name}`}
            title="Edit"
          >
            ✎
          </a>
          <button
            type="button"
            className="p-card-btn p-card-btn-delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(npc?.id);
            }}
            aria-label={`Delete ${name}`}
            title="Delete"
          >
            ×
          </button>
        </div>
      </div>
      <div className="npc-card-body">
        <div className="npc-card-info">
          <div className="npc-card-name">{npc?.name || "—"}</div>
          <div className="npc-card-stand">「{npc?.stand_name || "—"}」</div>
          <div className="npc-card-meta">
            <span className="p-tag">Lv {npc?.level ?? "—"}</span>
            <span className="p-tag">{npc?.role || "NPC"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

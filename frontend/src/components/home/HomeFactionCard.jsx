import React from "react";
import { resolveMediaUrl } from "../../features/character-sheet";
import HomeCardThumb from "./HomeCardThumb";
import HomeFullBleedBg, { useHomeCardImage } from "./HomeFullBleedBg";

function tierRoman(level) {
  const n = Number(level);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const map = ["I", "II", "III", "IV", "V", "VI"];
  return map[Math.min(n - 1, map.length - 1)] || String(n);
}

function holdLabel(hold) {
  if (!hold) return "—";
  return hold.charAt(0).toUpperCase() + hold.slice(1);
}

function factionStatusClass(rep) {
  const r = Number(rep);
  if (r <= -4) return "f-status-war";
  if (r < 0) return "f-status-hostile";
  if (r === 0) return "f-status-neutral";
  if (r >= 2) return "f-status-allied";
  return "f-status-neutral";
}

function factionStatusLabel(rep) {
  const r = Number(rep);
  if (r <= -4) return "WAR";
  if (r < 0) return "Hostile";
  if (r === 0) return "Neutral";
  if (r >= 2) return "Allied";
  return "Friendly";
}

/**
 * Home page faction card — vertical token (matches PC/NPC cards).
 * EDIT expands inline editor; DELETE removes. Actions live in body footer.
 */
export default function HomeFactionCard({
  faction,
  isExpanded = false,
  onToggle,
  onDelete,
}) {
  const resolved = resolveMediaUrl(faction?.image || faction?.image_url || "");
  const { hasImage, safeSrc, onError } = useHomeCardImage(resolved);
  const name = faction?.name || "faction";
  const rep = faction?.reputation ?? 0;
  const typeLabel = String(faction?.faction_type || "").trim() || "—";

  const cardClasses = [
    "f-card",
    hasImage ? "f-card-has-image" : "",
    isExpanded ? "is-expanded" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cardClasses}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={() => onToggle?.()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle?.();
        }
      }}
    >
      {hasImage && <HomeFullBleedBg src={safeSrc} onError={onError} />}
      <div className="f-card-stripe" />
      <div className="f-card-media">
        {!hasImage && (
          <HomeCardThumb
            className="f-card-thumb"
            src={resolved || null}
            label={faction?.name}
          />
        )}
      </div>
      <div className="f-card-body">
        <div className="f-card-name">{faction?.name || "—"}</div>
        <div className="f-card-type">{typeLabel}</div>
        <div className="f-card-tags">
          <span className="p-tag">Tier {tierRoman(faction?.level)}</span>
          <span className="p-tag">{holdLabel(faction?.hold)}</span>
          <span className="p-tag">
            Rep {rep > 0 ? "+" : ""}
            {rep}
          </span>
        </div>
        <div
          className={`f-card-status ${factionStatusClass(faction?.reputation)}`}
        >
          {factionStatusLabel(faction?.reputation)}
        </div>
        <div className="f-card-actions">
          <button
            type="button"
            className="f-card-btn f-card-btn-edit"
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.();
            }}
          >
            {isExpanded ? "Close" : "Edit"}
          </button>
          <button
            type="button"
            className="f-card-btn f-card-btn-delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(faction?.id);
            }}
            aria-label={`Delete ${name}`}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

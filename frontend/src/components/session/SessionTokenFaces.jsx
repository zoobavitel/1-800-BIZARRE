import React from "react";
import HomeCardThumb from "../home/HomeCardThumb";
import HomeFullBleedBg, { useHomeCardImage } from "../home/HomeFullBleedBg";
import { resolveMediaUrl } from "../../features/character-sheet/services/api";
import { getCharacterPortraitSrc } from "../../utils/homeAvatar";
import {
  NPC_DRAG_MIME,
  NPC_DRAG_SOURCE_MIME,
  NO_FACTION_DROP_KEY,
  AddNpcStripTile,
} from "./sessionShellUi";

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
 * Session faction face — Home `.f-card` markup + NPC strip / DnD / expand.
 * No home Edit/Delete.
 */
export function SessionFactionToken({
  faction,
  name,
  npcList = [],
  isExpanded = false,
  isDragOver = false,
  dropKey,
  onToggleExpand,
  onNpcThumbClick,
  onAddNpc,
  onDragOver,
  onDragLeave,
  onDrop,
  onNpcDragBegin,
  onNpcDragEnd,
  addDisabled = false,
}) {
  const resolved = resolveMediaUrl(faction?.image || faction?.image_url || "");
  const { hasImage, safeSrc, onError } = useHomeCardImage(resolved);
  const typeLabel = String(faction?.faction_type || "").trim() || "—";
  const rep = faction?.reputation ?? 0;
  const displayName = name || faction?.name || "Faction";

  const cardClasses = [
    "f-card",
    hasImage ? "f-card-has-image" : "",
    isExpanded ? "is-expanded" : "",
    isDragOver ? "session-token-drag-over" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cardClasses}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={() => onToggleExpand?.()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggleExpand?.();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver?.(e);
      }}
      onDragLeave={() => onDragLeave?.()}
      onDrop={(e) => onDrop?.(e)}
    >
      {hasImage && <HomeFullBleedBg src={safeSrc} onError={onError} />}
      <div className="f-card-stripe" />
      <div className="f-card-media">
        {!hasImage && (
          <HomeCardThumb
            className="f-card-thumb"
            src={resolved || null}
            label={displayName}
          />
        )}
      </div>
      <div className="f-card-body">
        <div className="f-card-name">{displayName}</div>
        <div className="f-card-type">{typeLabel}</div>
        <div className="f-card-tags">
          {faction?.level != null && faction?.level !== "" && (
            <span className="p-tag">Tier {tierRoman(faction?.level)}</span>
          )}
          {faction?.hold ? (
            <span className="p-tag">{holdLabel(faction?.hold)}</span>
          ) : null}
          {faction?.reputation != null && faction?.reputation !== "" && (
            <span className="p-tag">
              Rep {rep > 0 ? "+" : ""}
              {rep}
            </span>
          )}
        </div>
        {faction?.reputation != null && faction?.reputation !== "" ? (
          <div
            className={`f-card-status ${factionStatusClass(faction?.reputation)}`}
          >
            {factionStatusLabel(faction?.reputation)}
          </div>
        ) : null}
        <div className="f-card-npcs">
          {npcList.length} NPC{npcList.length === 1 ? "" : "s"}
        </div>
        <div
          className="session-faction-npc-strip"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {npcList.map((npc) => (
            <SessionNpcToken
              key={`strip-${npc.id}`}
              npc={npc}
              compact
              draggable
              sourceFactionKey={dropKey}
              onOpen={() => onNpcThumbClick?.(npc)}
              onDragBegin={onNpcDragBegin}
              onDragEnd={onNpcDragEnd}
            />
          ))}
          <AddNpcStripTile disabled={addDisabled} onClick={() => onAddNpc?.()} />
        </div>
        <div className="f-card-actions">
          <button
            type="button"
            className="f-card-btn f-card-btn-edit"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand?.();
            }}
          >
            {isExpanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Session NPC face — Home `.npc-card` (+ compact strip variant).
 */
export function SessionNpcToken({
  npc,
  compact = false,
  selected = false,
  draggable = false,
  sourceFactionKey = NO_FACTION_DROP_KEY,
  onOpen,
  onDragBegin,
  onDragEnd,
}) {
  const portraitSrc = getCharacterPortraitSrc(npc);
  const { hasImage, safeSrc, onError } = useHomeCardImage(portraitSrc);
  const name = npc?.name || "NPC";

  const onDragStart = (e) => {
    if (!draggable) return;
    e.stopPropagation();
    e.dataTransfer.setData(NPC_DRAG_MIME, String(npc.id));
    e.dataTransfer.setData(NPC_DRAG_SOURCE_MIME, String(sourceFactionKey));
    e.dataTransfer.setData("text/plain", String(npc.id));
    e.dataTransfer.effectAllowed = "move";
    onDragBegin?.();
  };

  if (compact) {
    return (
      <button
        type="button"
        className={`session-npc-strip-thumb${selected ? " is-selected" : ""}`}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={() => onDragEnd?.()}
        onClick={(e) => {
          e.stopPropagation();
          onOpen?.(npc);
        }}
        title={name}
      >
        <HomeCardThumb
          src={portraitSrc}
          label={name}
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: "bold",
            color: "#6b7280",
          }}
        />
      </button>
    );
  }

  const cardClasses = [
    "npc-card",
    hasImage ? "npc-card-has-image" : "",
    selected ? "is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cardClasses}
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={() => onDragEnd?.()}
      onClick={() => onOpen?.(npc)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.(npc);
        }
      }}
      title={draggable ? "Drag to another faction" : undefined}
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

/**
 * Session PC face — Home `.p-card` markup; expand instead of home edit/delete.
 */
export function SessionPcToken({
  character,
  name,
  isExpanded = false,
  onToggleExpand,
}) {
  const portraitSrc = getCharacterPortraitSrc(character);
  const { hasImage, safeSrc, onError } = useHomeCardImage(portraitSrc);
  const displayName =
    name || character?.true_name || character?.name || "character";
  const standLabel =
    character?.stand_name ||
    character?.standName ||
    character?.stand?.name ||
    "—";
  const heritage =
    character?.heritage_name ||
    character?.heritageName ||
    character?.heritage ||
    "—";

  const cardClasses = [
    "p-card",
    hasImage ? "p-card-has-image" : "",
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
      onClick={() => onToggleExpand?.()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggleExpand?.();
        }
      }}
    >
      {hasImage && <HomeFullBleedBg src={safeSrc} onError={onError} />}
      <div className="p-card-stripe" />
      <div className="p-card-media">
        {!hasImage && (
          <HomeCardThumb
            className="p-card-thumb"
            src={portraitSrc}
            label={displayName}
          />
        )}
      </div>
      <div className="p-card-body">
        <div className="p-card-info">
          <div className="p-card-name">{displayName}</div>
          <div className="p-card-stand">「{standLabel}」</div>
          <div className="p-card-tags">
            <span className="p-tag">{heritage}</span>
            <span className="p-tag">Lv {character?.level ?? "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from "react";
import HomeCardThumb from "../home/HomeCardThumb";
import { resolveMediaUrl } from "../../features/character-sheet/services/api";
import { getCharacterPortraitSrc } from "../../utils/homeAvatar";

export const SESSION_SHELL_TABS = [
  { id: "rosters", label: "Rosters" },
  { id: "crew", label: "Crew" },
  { id: "xp", label: "XP" },
  { id: "harm", label: "Harm / Armor" },
  { id: "rolls", label: "Rolls" },
  { id: "rep", label: "Rep" },
  { id: "scorecard", label: "Scorecard" },
];

export const NPC_DRAG_MIME = "application/x-hftf-npc-id";
export const NPC_DRAG_SOURCE_MIME = "application/x-hftf-npc-source-faction";
export const NO_FACTION_DROP_KEY = "none";

export const NPC_NESTED_TABS = [
  { id: "info", label: "Info" },
  { id: "abilities", label: "Abilities" },
  { id: "items", label: "Items" },
  { id: "clocks", label: "Clocks" },
  { id: "more", label: "More" },
];

export const PC_NESTED_TABS = [
  { id: "harm", label: "Harm" },
  { id: "actions", label: "Actions" },
  { id: "playbook", label: "Playbook" },
  { id: "clocks", label: "Clocks" },
  { id: "notes", label: "Notes" },
  { id: "items", label: "Items" },
  { id: "xp", label: "XP" },
  { id: "roll", label: "Roll" },
];

const tabBtn = (active) => ({
  fontSize: 11,
  fontWeight: active ? 700 : 500,
  padding: "6px 10px",
  borderRadius: 4,
  border: active ? "1px solid var(--hftf-purple, #7c3aed)" : "1px solid #374151",
  background: active ? "rgba(124, 58, 237, 0.2)" : "#161b22",
  color: active ? "#e9d5ff" : "#9ca3af",
  cursor: "pointer",
  fontFamily: "inherit",
  whiteSpace: "nowrap",
});

export function SessionShellTabBar({ tabs, active, onChange, leading = null }) {
  return (
    <div
      role="tablist"
      aria-label="Session panels"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        alignItems: "center",
        padding: "8px 12px 10px",
        borderBottom: "1px solid #30363d",
        marginBottom: 12,
        position: "sticky",
        top: 0,
        zIndex: 5,
        background: "var(--bg-primary, #0d1117)",
        boxSizing: "border-box",
      }}
    >
      {leading ? (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              alignItems: "center",
              paddingLeft: 4,
            }}
          >
            {leading}
          </div>
          <span
            aria-hidden
            style={{
              width: 1,
              alignSelf: "stretch",
              minHeight: 22,
              background: "#30363d",
              margin: "0 2px",
            }}
          />
        </>
      ) : null}
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          style={tabBtn(active === t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function NestedTabBar({ tabs, active, onChange }) {
  return (
    <div role="tablist" className="session-nested-tabs">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          className={`session-nested-tab${active === t.id ? " is-active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onChange(t.id);
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

const thumbSlot = {
  width: 36,
  height: 36,
  borderRadius: 6,
  overflow: "hidden",
  flexShrink: 0,
  border: "1px solid #374151",
  background: "#111827",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: 0,
};

/** Small portrait for NPC strip / crew face. */
export function SessionPortraitThumb({
  src,
  label,
  onClick,
  draggable,
  onDragStart,
  onDragEnd,
  title,
  size = 36,
}) {
  const resolved = src ? resolveMediaUrl(src) : null;
  return (
    <button
      type="button"
      draggable={!!draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      title={title || label}
      style={{
        ...thumbSlot,
        width: size,
        height: size,
        cursor: draggable ? "grab" : onClick ? "pointer" : "default",
      }}
    >
      <HomeCardThumb
        src={resolved}
        label={label}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: "bold",
          color: "#6b7280",
        }}
      />
    </button>
  );
}

export function factionImageSrc(faction) {
  return resolveMediaUrl(faction?.image || faction?.image_url || "") || null;
}

export function entityPortraitSrc(entity) {
  if (!entity) return null;
  return (
    getCharacterPortraitSrc(entity) ||
    resolveMediaUrl(entity.image || entity.image_url || "") ||
    null
  );
}

/** Square + tile for add-NPC into a faction. */
export function AddNpcStripTile({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      disabled={disabled}
      title="Add NPC to this faction"
      style={{
        ...thumbSlot,
        borderStyle: "dashed",
        color: "#9ca3af",
        fontSize: 18,
        fontWeight: 700,
        background: "#0d1117",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      +
    </button>
  );
}

/**
 * Compact `?` help control (sheet XP card pattern): toggles a right-aligned
 * popover; click outside / Escape closes. One instance owns its own open state.
 */
export function SessionHelpTip({ label, panelId, children }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointer = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const resolvedPanelId =
    panelId || `session-help-${String(label || "tip").replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        aria-label={label || "Help"}
        aria-expanded={open}
        aria-controls={resolvedPanelId}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          border: "1px solid #4b5563",
          background: open ? "#1f2937" : "#111827",
          color: "#9ca3af",
          fontSize: "12px",
          fontWeight: "bold",
          lineHeight: 1,
          padding: 0,
          cursor: "pointer",
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        ?
      </button>
      {open ? (
        <div
          id={resolvedPanelId}
          role="region"
          aria-label={label || "Help"}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 20,
            width: "min(340px, calc(100vw - 48px))",
            maxHeight: "min(420px, 70vh)",
            overflowY: "auto",
            padding: "10px 12px",
            background: "#0d1117",
            border: "1px solid #4b5563",
            borderRadius: "6px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
            fontSize: "10px",
            color: "#9ca3af",
            lineHeight: 1.45,
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

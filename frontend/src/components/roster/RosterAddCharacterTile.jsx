import React, { useEffect, useRef, useState } from "react";

const characterLabel = (ch) =>
  ch.true_name || ch.alias || `Character #${ch.id}`;

const menuItem = {
  background: "transparent",
  border: "1px solid transparent",
  borderRadius: 4,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 11,
  padding: "8px 10px",
  textAlign: "left",
  width: "100%",
};

/**
 * Last card in the PC roster: pick one of your characters for this campaign,
 * or make a new one.
 */
export default function RosterAddCharacterTile({
  characters = [],
  onAssign,
  onCreate,
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = async (id) => {
    setBusy(true);
    try {
      await onAssign?.(id);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className="session-add-npc-chooser"
      style={{ height: "100%", position: "relative", minWidth: 0 }}
    >
      <button
        type="button"
        className="f-card session-add-npc-tile"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        style={{
          alignItems: "center",
          borderStyle: "dashed",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          height: "100%",
          justifyContent: "center",
          minHeight: 120,
          padding: 10,
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: 22, color: "#6b7280", lineHeight: 1 }}>+</span>
        <span style={{ color: "#9ca3af", fontSize: 11, lineHeight: 1.3 }}>
          Add character
        </span>
        <span style={{ fontSize: 9, color: "#6b7280", lineHeight: 1.35 }}>
          Choose or create
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Add character"
          className="session-add-npc-chooser-menu"
          style={{
            background: "#111827",
            border: "1px solid #4b5563",
            borderRadius: 6,
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            left: 0,
            maxHeight: 240,
            minWidth: 180,
            overflowY: "auto",
            padding: 6,
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            zIndex: 50,
          }}
        >
          {characters.length === 0 ? (
            <div style={{ fontSize: 10, color: "#6b7280", padding: "6px 8px" }}>
              No free characters. Create one instead.
            </div>
          ) : (
            characters.map((ch) => (
              <button
                key={ch.id}
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => pick(ch.id)}
                style={{ ...menuItem, color: "#e5e7eb" }}
              >
                {characterLabel(ch)}
              </button>
            ))
          )}
          {typeof onCreate === "function" ? (
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                onCreate();
              }}
              style={{ ...menuItem, color: "#86efac" }}
            >
              Create character
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

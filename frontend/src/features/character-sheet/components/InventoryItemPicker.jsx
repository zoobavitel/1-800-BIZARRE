import React, { useMemo, useState } from "react";
import { catalogItemToKitRow } from "../utils/loadoutUtils";

/**
 * Compact equipment catalog picker for session roster (and reusable elsewhere).
 * Parent owns `equipmentAPI.list` once per page and passes `catalogItems`.
 */
export default function InventoryItemPicker({
  catalogItems = [],
  disabled = false,
  onPickRow,
  onPickCustomName,
  inputStyle = {},
  buttonStyle = {},
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const q = String(query || "").trim().toLowerCase();
  const matches = useMemo(() => {
    const list = Array.isArray(catalogItems) ? catalogItems : [];
    if (!q) return list.slice(0, 24);
    return list
      .filter((c) => {
        const hay = `${c.name || ""} ${c.description || ""} ${c.category || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 24);
  }, [catalogItems, q]);

  const commitCustom = () => {
    const name = String(query || "").trim();
    if (!name || disabled) return;
    onPickCustomName?.(name);
    setQuery("");
    setOpen(false);
  };

  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="search"
          value={query}
          disabled={disabled}
          placeholder="Catalog or new item…"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (matches.length === 1) {
                onPickRow?.(catalogItemToKitRow(matches[0]));
                setQuery("");
                setOpen(false);
              } else {
                commitCustom();
              }
            }
          }}
          style={{ ...inputStyle, flex: 1, minWidth: 0 }}
        />
        <button
          type="button"
          disabled={disabled || !String(query || "").trim()}
          onClick={commitCustom}
          style={buttonStyle}
        >
          Add
        </button>
      </div>
      {open && !disabled && (matches.length > 0 || q) ? (
        <div
          style={{
            position: "absolute",
            zIndex: 20,
            left: 0,
            right: 0,
            marginTop: 4,
            maxHeight: 160,
            overflowY: "auto",
            background: "#0d1117",
            border: "1px solid #374151",
            borderRadius: 6,
            fontSize: 11,
          }}
        >
          {matches.map((c) => (
            <button
              key={c.id ?? c.name}
              type="button"
              onClick={() => {
                onPickRow?.(catalogItemToKitRow(c));
                setQuery("");
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "6px 8px",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid #1f2937",
                color: "#e5e7eb",
                cursor: "pointer",
              }}
            >
              {c.name}
              {c.category ? (
                <span style={{ color: "#6b7280" }}> · {c.category}</span>
              ) : null}
            </button>
          ))}
          {q && matches.length === 0 ? (
            <div style={{ padding: "6px 8px", color: "#9ca3af" }}>
              No catalog match — Enter/Add creates custom “{query.trim()}”
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

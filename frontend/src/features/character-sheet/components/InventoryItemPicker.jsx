import React, { useMemo, useState } from "react";
import {
  ARMOR_KIND_OPTIONS,
  armorKindLabel,
  catalogItemToKitRow,
  newArmorItemDraft,
} from "../utils/loadoutUtils";

/** Map free-typed names to an armor kit row, or null. */
function armorRowFromTypedName(rawName) {
  const name = String(rawName || "").trim();
  if (!name) return null;
  const key = name.toLowerCase();
  if (key === "armor" || key === "standard armor" || key === "light armor") {
    return newArmorItemDraft({
      name: armorKindLabel("standard"),
      armor_kind: "standard",
      is_armor: true,
      load: 0,
    });
  }
  if (key === "heavy armor" || key === "heavy") {
    return newArmorItemDraft({
      name: armorKindLabel("heavy"),
      armor_kind: "heavy",
      is_armor: true,
      load: 0,
    });
  }
  if (key === "special armor" || key === "special") {
    return newArmorItemDraft({
      name: armorKindLabel("special"),
      armor_kind: "special",
      is_armor: false,
      load: 0,
    });
  }
  return null;
}

/**
 * Compact equipment catalog picker for session roster (and reusable elsewhere).
 * Parent owns `equipmentAPI.list` once per page and passes `catalogItems`.
 */
export default function InventoryItemPicker({
  catalogItems = [],
  disabled = false,
  allowArmor = false,
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

  const armorQuickMatches = useMemo(() => {
    if (!allowArmor) return [];
    const opts = ARMOR_KIND_OPTIONS;
    if (!q || q === "armor" || "armor".includes(q) || q.includes("armor")) {
      return opts.filter(
        (o) =>
          !q ||
          o.label.toLowerCase().includes(q) ||
          o.value.includes(q) ||
          q === "armor",
      );
    }
    return opts.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.includes(q),
    );
  }, [allowArmor, q]);

  const pickArmorKind = (kind) => {
    if (disabled) return;
    const label = armorKindLabel(kind);
    onPickRow?.(
      newArmorItemDraft({
        name: label,
        armor_kind: kind,
        is_armor: kind === "standard" || kind === "heavy",
        load: 0,
      }),
    );
    setQuery("");
    setOpen(false);
  };

  const commitCustom = () => {
    const name = String(query || "").trim();
    if (!name || disabled) return;
    if (allowArmor) {
      const armorRow = armorRowFromTypedName(name);
      if (armorRow) {
        onPickRow?.(armorRow);
        setQuery("");
        setOpen(false);
        return;
      }
    }
    onPickCustomName?.(name);
    setQuery("");
    setOpen(false);
  };

  const showDropdown =
    open &&
    !disabled &&
    (matches.length > 0 || armorQuickMatches.length > 0 || q);

  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="search"
          value={query}
          disabled={disabled}
          placeholder={
            allowArmor ? "Catalog, armor, or new item…" : "Catalog or new item…"
          }
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (matches.length === 1 && armorQuickMatches.length === 0) {
                onPickRow?.(catalogItemToKitRow(matches[0]));
                setQuery("");
                setOpen(false);
              } else if (
                armorQuickMatches.length === 1 &&
                matches.length === 0
              ) {
                pickArmorKind(armorQuickMatches[0].value);
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
      {showDropdown ? (
        <div
          style={{
            position: "absolute",
            zIndex: 20,
            left: 0,
            right: 0,
            marginTop: 4,
            maxHeight: 200,
            overflowY: "auto",
            background: "#0d1117",
            border: "1px solid #374151",
            borderRadius: 6,
            fontSize: 11,
          }}
        >
          {armorQuickMatches.length > 0 ? (
            <>
              <div
                style={{
                  padding: "4px 8px",
                  color: "#9ca3af",
                  fontSize: 10,
                  textTransform: "uppercase",
                  borderBottom: "1px solid #1f2937",
                }}
              >
                Armor
              </div>
              {armorQuickMatches.map((o) => (
                <button
                  key={`armor-${o.value}`}
                  type="button"
                  onClick={() => pickArmorKind(o.value)}
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
                  {o.label}
                  <span style={{ color: "#6b7280" }}>
                    {" "}
                    · {o.charges} chg · 0 load
                  </span>
                </button>
              ))}
            </>
          ) : null}
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
          {q && matches.length === 0 && armorQuickMatches.length === 0 ? (
            <div style={{ padding: "6px 8px", color: "#9ca3af" }}>
              No catalog match — Enter/Add creates custom “{query.trim()}”
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

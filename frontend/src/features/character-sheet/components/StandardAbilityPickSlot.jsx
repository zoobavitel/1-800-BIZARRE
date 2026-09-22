import React, { useState, useEffect, useRef, useMemo } from "react";
import AbilityPickerPopover from "./AbilityPickerPopover";

export const CATEGORY_LABELS = {
  aggression: "Aggression",
  endurance: "Endurance",
  cunning: "Cunning",
  awareness: "Awareness",
  presence: "Presence",
  teamwork: "Teamwork",
  adaptability: "Adaptability",
  stand_nature: "Stand Nature",
};

/** Standard ability ids already on the sheet (type === "standard"). */
export function ownedStandardIdsFromAbilities(abilities) {
  return new Set(
    (abilities || [])
      .filter((ab) => ab.type === "standard" && ab.id != null)
      .map((ab) => Number(ab.id))
      .filter((n) => Number.isFinite(n)),
  );
}

function toIdSet(ids) {
  const set = new Set();
  for (const raw of ids || []) {
    if (raw == null || raw === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n)) set.add(n);
  }
  return set;
}

function isStandardAbilityOption(a) {
  return (a.type || "").toLowerCase() === "standard" || !a.type;
}

/**
 * Controlled B→A (and similar) standard-ability pick slot:
 * search + click-to-preview description, then Use / Clear.
 */
export default function StandardAbilityPickSlot({
  value = "",
  onChange,
  options = [],
  excludeIds = [],
  ownedStandardIds = null,
  placeholder = "Pick standard…",
  btnStyle = null,
  inpStyle = null,
}) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const ownedSet = useMemo(() => {
    if (ownedStandardIds instanceof Set) return ownedStandardIds;
    return toIdSet(ownedStandardIds);
  }, [ownedStandardIds]);

  const excludeSet = useMemo(() => toIdSet(excludeIds), [excludeIds]);

  const valueId = value != null && value !== "" ? Number(value) : null;
  const valueAbility = useMemo(() => {
    if (!Number.isFinite(valueId)) return null;
    return (options || []).find((a) => Number(a.id) === valueId) || null;
  }, [options, valueId]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (e.target?.closest?.("[data-ability-picker-popover]")) return;
      if (wrapRef.current?.contains?.(e.target)) return;
      setOpen(false);
      setSearch("");
      setSelected(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const available = useMemo(() => {
    return (options || []).filter((a) => {
      if (!isStandardAbilityOption(a)) return false;
      const id = Number(a.id);
      if (!Number.isFinite(id)) return false;
      // Keep the currently selected value visible even if it would be filtered
      // (e.g. owned after apply, or exclude race) so the trigger label stays coherent.
      if (Number.isFinite(valueId) && id === valueId) return true;
      if (ownedSet.has(id)) return false;
      if (excludeSet.has(id)) return false;
      return true;
    });
  }, [options, ownedSet, excludeSet, valueId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return available;
    return available.filter(
      (a) =>
        (a.name || "").toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q) ||
        (CATEGORY_LABELS[a.category] || "").toLowerCase().includes(q),
    );
  }, [available, search]);

  const triggerLabel = valueAbility?.name || placeholder;

  const defaultBtn = {
    padding: "6px 10px",
    borderRadius: "4px",
    fontSize: "12px",
    cursor: "pointer",
    border: "1px solid #374151",
    background: "#1f2937",
    color: valueAbility ? "#e5e7eb" : "#9ca3af",
    fontFamily: "var(--font-mono, monospace)",
    width: "100%",
    textAlign: "left",
    boxSizing: "border-box",
  };
  const defaultInp = {
    border: "1px solid #374151",
    padding: "6px 10px",
    fontSize: "12px",
    width: "100%",
    boxSizing: "border-box",
    background: "#0f1419",
    color: "#e5e7eb",
    borderRadius: "4px",
    fontFamily: "var(--font-mono, monospace)",
  };

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative", width: "100%", marginBottom: 6 }}
    >
      <button
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
            setSearch("");
            setSelected(null);
          } else {
            setOpen(true);
            setSelected(valueAbility);
            setSearch("");
          }
        }}
        style={{ ...(btnStyle || defaultBtn) }}
      >
        {triggerLabel}
      </button>
      <AbilityPickerPopover open={open} anchorRef={wrapRef}>
        <input
          style={{ ...(inpStyle || defaultInp) }}
          placeholder="Search standard abilities…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelected(null);
          }}
          autoFocus
        />
        <div
          style={{
            marginTop: "0",
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            background: "#0f1419",
            border: "1px solid #1f2937",
            borderRadius: "4px",
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "12px",
                fontSize: "11px",
                color: "#6b7280",
              }}
            >
              No matching abilities
            </div>
          ) : (
            filtered.map((a) => (
              <div
                key={a.id}
                onClick={() => setSelected(a)}
                style={{
                  padding: "8px 10px",
                  cursor: "pointer",
                  fontSize: "12px",
                  borderBottom: "1px solid #1f2937",
                  background:
                    selected?.id === a.id ||
                    (selected == null && Number(a.id) === valueId)
                      ? "#374151"
                      : "transparent",
                  color: "#e5e7eb",
                }}
              >
                {a.name}
                {a.category ? (
                  <span
                    style={{
                      fontSize: "10px",
                      color: "#6b7280",
                      marginLeft: "6px",
                    }}
                  >
                    {CATEGORY_LABELS[a.category] || a.category}
                  </span>
                ) : null}
              </div>
            ))
          )}
        </div>
        {(selected || valueAbility) && (
          <div
            style={{
              marginTop: "8px",
              padding: "10px",
              background: "#1f2937",
              borderRadius: "4px",
              border: "1px solid #374151",
              fontSize: "11px",
            }}
          >
            <div style={{ fontWeight: "bold", marginBottom: "4px", color: "#e5e7eb" }}>
              {(selected || valueAbility).name}
            </div>
            {(selected || valueAbility).category ? (
              <span
                style={{
                  display: "inline-block",
                  padding: "1px 6px",
                  background: "#374151",
                  borderRadius: "4px",
                  fontSize: "10px",
                  marginBottom: "6px",
                  color: "#d1d5db",
                }}
              >
                {CATEGORY_LABELS[(selected || valueAbility).category] ||
                  (selected || valueAbility).category}
              </span>
            ) : null}
            {(selected || valueAbility).description ? (
              <div
                style={{
                  color: "#9ca3af",
                  lineHeight: "1.4",
                  marginTop: "4px",
                }}
              >
                {(selected || valueAbility).description}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginTop: "10px",
                justifyContent: "flex-end",
              }}
            >
              {valueAbility ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange?.("");
                    setOpen(false);
                    setSearch("");
                    setSelected(null);
                  }}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    cursor: "pointer",
                    border: "none",
                    background: "#374151",
                    color: "#e5e7eb",
                    fontFamily: "var(--font-mono, monospace)",
                  }}
                >
                  Clear
                </button>
              ) : null}
              <button
                type="button"
                disabled={!selected}
                onClick={() => {
                  if (!selected) return;
                  onChange?.(String(selected.id));
                  setOpen(false);
                  setSearch("");
                  setSelected(null);
                }}
                style={{
                  padding: "4px 10px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  cursor: selected ? "pointer" : "not-allowed",
                  border: "none",
                  background: selected ? "#7c3aed" : "#4b5563",
                  color: "#fff",
                  fontFamily: "var(--font-mono, monospace)",
                  opacity: selected ? 1 : 0.6,
                }}
              >
                Use
              </button>
            </div>
          </div>
        )}
      </AbilityPickerPopover>
    </div>
  );
}

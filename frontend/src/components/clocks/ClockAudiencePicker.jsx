import React from "react";

const segment = (on) => ({
  background: on ? "var(--sheet-label, #1e3a5f)" : "transparent",
  border: "none",
  color: on ? "var(--bg-card, #fff)" : "var(--text-primary, #e5e7eb)",
  flex: 1,
  padding: "4px 8px",
  fontSize: "11px",
  cursor: "pointer",
  whiteSpace: "nowrap",
});

/**
 * Who sees this clock (PC private clocks): "GM only" (or "Only me" for a
 * player's own clock), "All players", or a tick box per player. The GM and
 * the clock's creator always see it.
 *
 * value: { all: boolean, ids: number[] }; onChange gets the same shape.
 */
export default function ClockAudiencePicker({
  players = [],
  value = { all: false, ids: [] },
  onChange,
  noneLabel = "GM only",
  allLabel = "All players",
  disabled = false,
  idPrefix = "clock-audience",
}) {
  const ids = new Set((value?.ids || []).map(Number));
  const all = !!value?.all;
  const none = !all && ids.size === 0;
  const set = (next) => {
    if (!disabled && typeof onChange === "function") onChange(next);
  };
  const toggle = (id) => {
    const next = new Set(ids);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ all: false, ids: [...next] });
  };
  return (
    <div
      role="group"
      aria-label="Who sees this clock"
      style={{ display: "grid", gap: "5px", fontSize: "11px", minWidth: 0 }}
    >
      <span style={{ color: "var(--text-muted, #9ca3af)" }}>Who sees it</span>
      <div
        style={{
          border: "1px solid var(--border, #374151)",
          borderRadius: "4px",
          display: "flex",
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          style={segment(none)}
          aria-pressed={none}
          disabled={disabled}
          onClick={() => set({ all: false, ids: [] })}
        >
          {noneLabel}
        </button>
        <button
          type="button"
          style={{ ...segment(all), borderLeft: "1px solid var(--border, #374151)" }}
          aria-pressed={all}
          disabled={disabled}
          onClick={() => set({ all: true, ids: [] })}
        >
          {allLabel}
        </button>
      </div>
      {players.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px" }}>
          {players.map((p) => (
            <label
              key={p.id}
              htmlFor={`${idPrefix}-${p.id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                cursor: disabled ? "default" : "pointer",
              }}
            >
              <input
                id={`${idPrefix}-${p.id}`}
                type="checkbox"
                disabled={disabled}
                checked={all || ids.has(p.id)}
                onChange={() =>
                  all
                    ? set({ all: false, ids: players.filter((x) => x.id !== p.id).map((x) => x.id) })
                    : toggle(p.id)
                }
              />
              {p.label}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

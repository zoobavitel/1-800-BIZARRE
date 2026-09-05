/**
 * Advancement plan editor panel (vertical scroll OK).
 * Reorder / delete live here — not on the read-only strip.
 */
import React, { useState } from "react";

function rowLabel(item) {
  const p = item.payload || {};
  if (item.kind === "action_dot") return `+1 ${(p.action || "?").toUpperCase()}`;
  if (item.kind === "coin_grade") {
    const kids = p.a_grant_child_count ? ` ·${p.a_grant_child_count}` : "";
    return `${(p.stat || "?").toUpperCase()} ${p.from_grade || "?"}→${p.to_grade || "?"}${kids}`;
  }
  if (item.kind === "ability") return p.ability_name || `Ability #${p.ability_id}`;
  if (item.kind === "acquire_stand") return "Acquire Stand";
  return item.kind;
}

export default function AdvancementPlanPanel({
  open,
  onClose,
  items = [],
  canEdit = false,
  busy = false,
  onReorder,
  onDelete,
}) {
  const [trackFilter, setTrackFilter] = useState("all");
  if (!open) return null;

  const queued = (items || []).filter((i) => i.status === "queued" || !i.status);
  const tracks = ["all", "playbook", "insight", "prowess", "resolve", "heritage"];
  const visible =
    trackFilter === "all"
      ? queued
      : queued.filter((i) => i.track === trackFilter);

  const byTrack = {};
  for (const item of visible) {
    if (!byTrack[item.track]) byTrack[item.track] = [];
    byTrack[item.track].push(item);
  }
  for (const t of Object.keys(byTrack)) {
    byTrack[t].sort((a, b) => (a.order || 0) - (b.order || 0) || a.id - b.id);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "48px 12px 24px",
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label="Advancement plan"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 100%)",
          maxHeight: "80vh",
          overflow: "auto",
          background: "var(--bg-card)",
          border: "1px solid var(--sheet-ghost)",
          borderRadius: 6,
          padding: 16,
          fontFamily: "var(--font-mono, monospace)",
          color: "var(--text-primary)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <strong style={{ color: "var(--sheet-ghost-text)" }}>
            Advancement plan
          </strong>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontFamily: "var(--font-mono, monospace)",
              padding: "2px 8px",
            }}
          >
            Close
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {tracks.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTrackFilter(t)}
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono, monospace)",
                padding: "2px 8px",
                cursor: "pointer",
                border: "1px solid",
                borderColor:
                  trackFilter === t ? "var(--sheet-ghost)" : "var(--border)",
                background:
                  trackFilter === t ? "var(--hftf-deep)" : "var(--bg-header)",
                color:
                  trackFilter === t
                    ? "var(--sheet-ghost-text)"
                    : "var(--text-muted)",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {!queued.length ? (
          <div style={{ color: "var(--text-dim)", fontSize: 12 }}>
            Queue empty. Turn on Plan and click Coin wedges or ability buttons
            to add fills.
          </div>
        ) : null}

        {Object.keys(byTrack).map((track) => {
          const list = byTrack[track];
          return (
            <div key={track} style={{ marginBottom: 16 }}>
              <div
                style={{
                  color: "var(--sheet-ghost-text)",
                  fontSize: 11,
                  fontWeight: "bold",
                  marginBottom: 6,
                  textTransform: "uppercase",
                }}
              >
                {track}
              </div>
              {list.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span style={{ color: "var(--text-dim)", width: 20 }}>
                    {idx + 1}.
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        color: item.blocked_reason
                          ? "#fca5a5"
                          : "var(--text-primary)",
                        fontSize: 12,
                      }}
                    >
                      {rowLabel(item)}
                    </div>
                    {item.blocked_reason ? (
                      <div style={{ color: "#f87171", fontSize: 10 }}>
                        {item.blocked_reason}
                      </div>
                    ) : null}
                    {item.payload?.a_grant ? (
                      <div
                        style={{
                          color: "var(--sheet-ghost-text)",
                          fontSize: 10,
                        }}
                      >
                        A-grant: {item.payload.a_grant.branch}
                      </div>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        disabled={busy || idx === 0}
                        title="Move up"
                        onClick={() => {
                          const ids = list.map((x) => x.id);
                          if (idx <= 0) return;
                          const next = [...ids];
                          [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                          onReorder?.(track, next);
                        }}
                        style={btnStyle}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={busy || idx >= list.length - 1}
                        title="Move down"
                        onClick={() => {
                          const ids = list.map((x) => x.id);
                          if (idx >= ids.length - 1) return;
                          const next = [...ids];
                          [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                          onReorder?.(track, next);
                        }}
                        style={btnStyle}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        title="Remove"
                        onClick={() => onDelete?.(item.id)}
                        style={{ ...btnStyle, color: "#fca5a5" }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const btnStyle = {
  background: "var(--bg-header)",
  border: "1px solid var(--border)",
  color: "var(--hftf-text-dim)",
  cursor: "pointer",
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 11,
  padding: "2px 6px",
};

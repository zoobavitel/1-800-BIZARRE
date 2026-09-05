/**
 * Read-only advancement plan chip strip.
 * Fixed single-line height, flex-nowrap + overflow-x auto, sticky remaining-XP.
 * Tap opens editor panel. Never wraps.
 */
import React, { useMemo } from "react";

const TRACK_CAP = {
  insight: 5,
  prowess: 5,
  resolve: 5,
  heritage: 5,
  playbook: 10,
};

function chipLabel(item) {
  const p = item.payload || {};
  if (item.kind === "action_dot") {
    return `+1 ${(p.action || "?").toUpperCase()}`;
  }
  if (item.kind === "coin_grade") {
    const from = p.from_grade || "?";
    const to = p.to_grade || "?";
    const stat = (p.stat || "?").toUpperCase();
    const kids = p.a_grant_child_count;
    const suffix = kids ? ` ·${kids}` : "";
    return `${stat} ${from}→${to}${suffix}`;
  }
  if (item.kind === "ability") {
    return p.ability_name || `Ability #${p.ability_id || "?"}`;
  }
  if (item.kind === "acquire_stand") {
    return "Acquire Stand";
  }
  return item.kind || "plan";
}

/**
 * First legal queued item per track that would fire next (no blocked_reason),
 * plus remaining marks to fill that track.
 */
export function remainingXpForPlan(items, xpClocks) {
  const queued = (items || []).filter((i) => i.status === "queued" || !i.status);
  const byTrack = {};
  for (const item of queued) {
    const t = item.track;
    if (!byTrack[t]) byTrack[t] = [];
    byTrack[t].push(item);
  }
  for (const t of Object.keys(byTrack)) {
    byTrack[t].sort((a, b) => (a.order || 0) - (b.order || 0) || a.id - b.id);
  }
  // Prefer playbook then attributes for the sticky chip — first track with a legal head.
  const trackOrder = ["playbook", "insight", "prowess", "resolve", "heritage"];
  for (const track of trackOrder) {
    const list = byTrack[track];
    if (!list?.length) continue;
    const head = list.find((i) => !i.blocked_reason) || list[0];
    if (head.blocked_reason) continue;
    const cap = TRACK_CAP[track] || 5;
    const marks = Math.max(0, Math.floor(Number(xpClocks?.[track]) || 0));
    const need = Math.max(0, cap - marks);
    return {
      track,
      need,
      label:
        need === 0
          ? `${track} pending ready`
          : `${need} more ${track} XP`,
      itemId: head.id,
    };
  }
  return null;
}

export default function AdvancementPlanStrip({
  items = [],
  xpClocks = {},
  onOpenPanel,
}) {
  const queued = useMemo(
    () =>
      (items || [])
        .filter((i) => i.status === "queued" || !i.status)
        .slice()
        .sort(
          (a, b) =>
            String(a.track).localeCompare(String(b.track)) ||
            (a.order || 0) - (b.order || 0) ||
            (a.id || 0) - (b.id || 0),
        ),
    [items],
  );

  const remaining = useMemo(
    () => remainingXpForPlan(queued, xpClocks),
    [queued, xpClocks],
  );

  if (!queued.length) return null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenPanel?.()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenPanel?.();
        }
      }}
      title="Open advancement plan"
      style={{
        display: "flex",
        alignItems: "stretch",
        background: "var(--hftf-deep)",
        borderBottom: "1px solid var(--hftf-border)",
        height: 36,
        cursor: "pointer",
        position: "relative",
      }}
    >
      {remaining ? (
        <div
          style={{
            position: "sticky",
            left: 0,
            zIndex: 2,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            padding: "0 10px",
            background: "var(--hftf-panel)",
            borderRight: "1px solid var(--sheet-ghost)",
            color: "var(--sheet-ghost-text)",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 11,
            fontWeight: "bold",
            whiteSpace: "nowrap",
          }}
          title={remaining.label}
        >
          {remaining.label}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          flexWrap: "nowrap",
          overflowX: "auto",
          overflowY: "hidden",
          alignItems: "center",
          gap: 6,
          padding: "0 10px",
          flex: 1,
          minWidth: 0,
          WebkitMaskImage:
            "linear-gradient(to right, #000 0%, #000 calc(100% - 28px), transparent 100%)",
          maskImage:
            "linear-gradient(to right, #000 0%, #000 calc(100% - 28px), transparent 100%)",
        }}
      >
        {queued.map((item, idx) => {
          const label = chipLabel(item);
          const blocked = !!item.blocked_reason;
          return (
            <span
              key={item.id ?? `${item.track}-${idx}`}
              title={
                blocked
                  ? `${label} — ${item.blocked_reason}`
                  : `${idx + 1}. ${label} (${item.track})`
              }
              style={{
                flexShrink: 0,
                maxWidth: "14ch",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                padding: "3px 8px",
                borderRadius: 999,
                border: blocked
                  ? "1px dashed #b91c1c"
                  : "1px dashed var(--sheet-ghost)",
                color: blocked ? "#fca5a5" : "var(--sheet-ghost-text)",
                background: "transparent",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 11,
              }}
            >
              {idx + 1}. {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

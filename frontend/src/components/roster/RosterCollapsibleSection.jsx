import React from "react";

/** Card section with title + collapse toggle (session/campaign rosters). */
export default function RosterCollapsibleSection({
  title,
  collapsed,
  onToggleCollapsed,
  collapseExpandLabel = "Expand",
  collapseCollapseLabel = "Collapse",
  cardStyle = {},
  S,
  children,
  headerExtra = null,
  helpTip = null,
}) {
  return (
    <div style={{ ...S.card, marginBottom: 0, ...cardStyle }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span style={{ ...S.sectionLbl, marginBottom: 0, marginTop: 16 }}>
          {title}
        </span>
        {headerExtra}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
            marginLeft: headerExtra ? 0 : "auto",
          }}
        >
          {helpTip}
          <button
            type="button"
            onClick={onToggleCollapsed}
            style={{
              ...S.btnGhost,
              fontSize: 10,
              padding: "2px 8px",
              flexShrink: 0,
            }}
            title={collapsed ? collapseExpandLabel : collapseCollapseLabel}
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
        </div>
      </div>
      {!collapsed ? children : null}
    </div>
  );
}

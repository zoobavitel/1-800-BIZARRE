import React from "react";

/** Card section with title (campaign/session rosters). Column show/hide via Show NPC/PC. */
export default function RosterCollapsibleSection({
  title,
  cardStyle = {},
  S,
  children,
  headerExtra = null,
  helpTip = null,
}) {
  return (
    <div
      style={{
        ...S.card,
        marginBottom: 0,
        height: "100%",
        boxSizing: "border-box",
        ...cardStyle,
      }}
    >
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
        {helpTip ? (
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
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

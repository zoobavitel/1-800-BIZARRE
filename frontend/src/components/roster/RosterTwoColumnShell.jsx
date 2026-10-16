import React from "react";

/**
 * Campaign roster columns. Wide screens: NPCs left, PCs right.
 * At max-width 640px both columns stack, PCs first (see Home.css).
 */
export default function RosterTwoColumnShell({
  showLeftColumn = true,
  showSecondColumn = true,
  leftColumn = null,
  rightColumn = null,
}) {
  const showRight = showSecondColumn;
  const both = showLeftColumn && showRight;
  const className = both
    ? "campaign-roster-columns is-both"
    : "campaign-roster-columns";
  return (
    <div style={{ minWidth: 0 }}>
      <div className={className}>
        {showLeftColumn ? (
          <div className="campaign-roster-npc">{leftColumn}</div>
        ) : null}
        {showRight ? (
          <div className="campaign-roster-pc">{rightColumn}</div>
        ) : null}
      </div>
    </div>
  );
}

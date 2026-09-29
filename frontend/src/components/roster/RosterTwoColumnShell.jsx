import React from "react";
import { rosterTwoColumnGridStyle } from "./rosterShared";

/**
 * Two-column roster layout (Factions/NPCs | Players/Crew) used on campaign and session views.
 */
export default function RosterTwoColumnShell({
  showLeftColumn = true,
  showSecondColumn = true,
  leftColumn = null,
  rightColumn = null,
}) {
  const showRight = showSecondColumn;
  const both = showLeftColumn && showRight;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={rosterTwoColumnGridStyle(both)}>
        {showLeftColumn ? leftColumn : null}
        {showRight ? rightColumn : null}
      </div>
    </div>
  );
}

import React from "react";
import { rosterTwoColumnGridStyle } from "./rosterShared";

/**
 * Two-column roster layout (Factions/NPCs | Players/Crew) used on campaign and session views.
 */
export default function RosterTwoColumnShell({
  showSecondColumn = true,
  leftColumn = null,
  rightColumn = null,
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={rosterTwoColumnGridStyle(showSecondColumn)}>
        {leftColumn}
        {showSecondColumn ? rightColumn : null}
      </div>
    </div>
  );
}

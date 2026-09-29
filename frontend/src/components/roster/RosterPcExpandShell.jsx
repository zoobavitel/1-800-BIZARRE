import React from "react";
import { rosterExpandPanelChrome } from "./rosterShared";

/**
 * Floating expand panel chrome (close button + children). Used for full session GM tabs.
 */
export default function RosterPcExpandShell({
  onClose,
  children,
  className = "session-pc-expand-panel",
  style,
}) {
  return (
    <div
      className={className}
      style={{ ...rosterExpandPanelChrome, ...style }}
    >
      <button
        type="button"
        className="session-expand-close"
        aria-label="Close PC panel"
        title="Close"
        onClick={onClose}
      >
        ×
      </button>
      {children}
    </div>
  );
}

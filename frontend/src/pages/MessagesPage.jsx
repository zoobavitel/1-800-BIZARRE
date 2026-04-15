import React from "react";

const S = {
  page: {
    fontFamily: "monospace",
    fontSize: "13px",
    background: "var(--bg-page)",
    color: "var(--text-primary)",
    minHeight: "100vh",
  },
  hdr: {
    background: "var(--bg-header)",
    padding: "8px 16px",
    borderBottom: "1px solid var(--border)",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  content: { padding: "16px", maxWidth: "1000px", margin: "0 auto" },
  emptyState: {
    textAlign: "center",
    padding: "48px 16px",
    color: "var(--text-secondary)",
  },
};

export default function MessagesPage({ onBack }) {
  return (
    <div style={S.page}>
      <div style={S.hdr}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                padding: "6px 12px",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                background: "transparent",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontFamily: "monospace",
                fontSize: "12px",
              }}
            >
              ← Back
            </button>
          )}
          <span style={{ fontSize: "18px", fontWeight: "bold" }}>
            1(800)BIZARRE — MESSAGES
          </span>
        </div>
      </div>
      <div style={S.content}>
        <div style={S.emptyState}>No messages yet.</div>
      </div>
    </div>
  );
}

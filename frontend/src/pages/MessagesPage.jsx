import React from "react";

const S = {
  page: {
    fontFamily: "monospace",
    fontSize: "13px",
    background: "#000",
    color: "#fff",
    minHeight: "100vh",
  },
  content: { padding: "16px", maxWidth: "1000px", margin: "0 auto" },
  emptyState: { textAlign: "center", padding: "48px 16px", color: "#6b7280" },
};

export default function MessagesPage() {
  return (
    <div style={S.page}>
      <div style={S.content}>
        <div style={S.emptyState}>No messages yet.</div>
      </div>
    </div>
  );
}

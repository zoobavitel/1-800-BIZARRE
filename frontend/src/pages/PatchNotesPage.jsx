import React from "react";
import { PATCH_NOTES } from "../data/patchNotes";

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
  content: { padding: "16px", maxWidth: "800px", margin: "0 auto" },
  card: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    padding: "16px",
    marginBottom: "16px",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
    paddingBottom: "8px",
    borderBottom: "1px solid var(--border)",
  },
  date: { fontSize: "14px", fontWeight: "bold", color: "var(--text-primary)" },
  version: {
    background: "var(--border)",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    color: "var(--text-secondary)",
  },
  section: { marginBottom: "12px" },
  sectionTitle: {
    fontSize: "12px",
    fontWeight: "bold",
    color: "var(--hftf-burnt)",
    marginBottom: "4px",
  },
  list: {
    margin: 0,
    paddingLeft: "20px",
    color: "var(--text-secondary)",
    lineHeight: 1.6,
  },
  emptyState: {
    textAlign: "center",
    padding: "48px 16px",
    color: "var(--text-secondary)",
  },
};

export default function PatchNotesPage({ onBack }) {
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
            1(800) BIZARRE — PATCH NOTES
          </span>
        </div>
      </div>
      <div style={S.content}>
        {PATCH_NOTES.length === 0 ? (
          <div style={S.emptyState}>
            No patch notes yet. Patch notes are generated from git commits.
          </div>
        ) : (
          PATCH_NOTES.map((entry, i) => (
            <div key={entry.date + i} style={S.card}>
              <div style={S.cardHeader}>
                <span style={S.date}>{entry.date}</span>
                {entry.version && (
                  <span style={S.version}>{entry.version}</span>
                )}
              </div>
              {entry.sections.map((section) => (
                <div key={section.title} style={S.section}>
                  <div style={S.sectionTitle}>{section.title}</div>
                  <ul style={S.list}>
                    {section.items.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

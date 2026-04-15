import React from "react";
import { PATCH_NOTES } from "../data/patchNotes";

const S = {
  page: {
    fontFamily: "monospace",
    fontSize: "13px",
    background: "#000",
    color: "#fff",
    minHeight: "100vh",
  },
  content: { padding: "16px", maxWidth: "800px", margin: "0 auto" },
  card: {
    background: "#111827",
    border: "1px solid #374151",
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
    borderBottom: "1px solid #374151",
  },
  date: { fontSize: "14px", fontWeight: "bold", color: "#e2e8f0" },
  version: {
    background: "#374151",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    color: "#9ca3af",
  },
  section: { marginBottom: "12px" },
  sectionTitle: {
    fontSize: "12px",
    fontWeight: "bold",
    color: "#e07b39",
    marginBottom: "4px",
  },
  list: { margin: 0, paddingLeft: "20px", color: "#9ca3af", lineHeight: 1.6 },
  emptyState: { textAlign: "center", padding: "48px 16px", color: "#6b7280" },
};

export default function PatchNotesPage() {
  return (
    <div style={S.page}>
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

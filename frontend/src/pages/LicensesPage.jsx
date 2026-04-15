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
  content: { padding: "16px", maxWidth: "800px", margin: "0 auto" },
  card: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    padding: "16px",
    marginBottom: "16px",
  },
  sectionTitle: {
    fontSize: "12px",
    fontWeight: "bold",
    color: "var(--hftf-burnt)",
    marginBottom: "8px",
  },
  text: { color: "var(--text-secondary)", lineHeight: 1.6, fontSize: "13px" },
  link: { color: "var(--hftf-burnt)", textDecoration: "underline" },
};

export default function LicensesPage({ onBack }) {
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
            1(800) BIZARRE — LICENSES
          </span>
        </div>
      </div>
      <div style={S.content}>
        <div style={S.card}>
          <div style={S.sectionTitle}>
            Blades in the Dark / Forged in the Dark
          </div>
          <p style={S.text}>
            1(800)Bizarre uses mechanics from the Blades in the Dark SRD under
            CC-BY.
          </p>
          <p style={S.text}>
            This work is based on{" "}
            <a
              href="http://www.bladesinthedark.com/"
              target="_blank"
              rel="noopener noreferrer"
              style={S.link}
            >
              Blades in the Dark
            </a>{" "}
            (found at http://www.bladesinthedark.com/), product of One Seven
            Design, developed and authored by John Harper, and licensed for our
            use under the{" "}
            <a
              href="https://creativecommons.org/licenses/by/3.0/"
              target="_blank"
              rel="noopener noreferrer"
              style={S.link}
            >
              Creative Commons Attribution 3.0 Unported license
            </a>{" "}
            (http://creativecommons.org/licenses/by/3.0/).
          </p>
        </div>
      </div>
    </div>
  );
}

import React from "react";
import { SESSION_ENCODED_XP_CAP } from "./sessionEndLiveXpPreview";

/**
 * Same columns as the end-live confirmation modal. Used for read-only settled
 * sessions and for pre-end previews in session detail.
 */
export default function SessionXpAllocationTable({ rows }) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  return (
    <div
      style={{
        marginBottom: "12px",
        border: "1px solid #374151",
        borderRadius: "6px",
        overflow: "auto",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
        <thead>
          <tr style={{ background: "#0d1117", color: "#9ca3af" }}>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Character</th>
            <th style={{ textAlign: "right", padding: "6px 8px" }}>STANDOUT</th>
            <th style={{ textAlign: "right", padding: "6px 8px" }}>STRUGGLE</th>
            <th style={{ textAlign: "right", padding: "6px 8px" }}>Enc. playbook</th>
            <th style={{ textAlign: "right", padding: "6px 8px" }}>Dev→pool</th>
            <th style={{ textAlign: "right", padding: "6px 8px" }}>Manual→tracks</th>
            <th style={{ textAlign: "right", padding: "6px 8px" }}>Total</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Sources</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.characterId} style={{ borderTop: "1px solid #374151" }}>
              <td style={{ padding: "6px 8px", color: "#e5e7eb" }}>{row.name}</td>
              <td style={{ padding: "6px 8px", textAlign: "right", color: "#d1d5db" }}>
                {row.standoutWouldGrant}/{SESSION_ENCODED_XP_CAP}
                <span style={{ color: "#6b7280", fontSize: "10px" }}>
                  {" "}
                  ({row.standoutEvents})
                </span>
              </td>
              <td style={{ padding: "6px 8px", textAlign: "right", color: "#d1d5db" }}>
                {row.struggleWouldGrant}/{SESSION_ENCODED_XP_CAP}
                <span style={{ color: "#6b7280", fontSize: "10px" }}>
                  {" "}
                  ({row.struggleEvents})
                </span>
              </td>
              <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>
                {row.totalEncodedPlaybookXp}
              </td>
              <td style={{ padding: "6px 8px", textAlign: "right", color: "#c4b5fd" }}>
                {row.developmentPoolXp}
              </td>
              <td style={{ padding: "6px 8px", textAlign: "right", color: "#d1d5db" }}>
                {row.manualSessionXp}
              </td>
              <td style={{ padding: "6px 8px", textAlign: "right" }}>
                <span
                  style={{
                    color: "rgb(167, 139, 250)",
                    fontWeight: "bold",
                  }}
                >
                  {row.totalSessionXpPreview}
                </span>
              </td>
              <td style={{ padding: "6px 8px", color: "#9ca3af", fontSize: "10px" }}>
                {[
                  row.totalEncodedPlaybookXp
                    ? `Encoded playbook +${row.totalEncodedPlaybookXp}`
                    : null,
                  row.developmentPoolXp
                    ? `Stand Development (session) +${row.developmentPoolXp} → pool`
                    : null,
                  row.manualSessionXp
                    ? `Manual GM awards +${row.manualSessionXp} (already on tracks)`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

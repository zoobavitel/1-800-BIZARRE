import React from "react";
import { SESSION_ENCODED_XP_CAP } from "./sessionEndLiveXpPreview";

// SRD trigger XP caps at 2/session per trigger; the underlying tracker can
// legitimately store more rows (e.g. auto settle + a stray manual toggle),
// but the headline number should never imply more credit than the cap.
const capTrigger = (n) =>
  Math.min(SESSION_ENCODED_XP_CAP, Math.max(0, Number(n) || 0));

/**
 * Same columns as the end-live confirmation modal. Used for read-only settled
 * sessions and for pre-end previews in session detail.
 *
 * Column glossary (SRD end-of-session XP triggers — each capped at 2/session):
 *   - BELIEFS:  expressed beliefs, drives, heritage, or background this session
 *               (counts player/GM toggles + heritage auto-grants on rolls)
 *   - STRUGGLE: struggled with issues from vice, trauma, or entanglements
 *               (counts vice overindulgence + vice failures + trauma marks +
 *               player/GM toggles)
 *   - STANDOUT: standout action or notable use of playbook / stand abilities
 *               (counts rolls tagged [abilities: …] + player/GM toggles)
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
            <th
              style={{ textAlign: "right", padding: "6px 8px" }}
              title="BELIEFS — expressed beliefs, drives, heritage, or background (player/GM toggles + heritage auto-grants). SRD cap: 2/session. Headline = XP recorded in the experience tracker for this session."
            >
              BELIEFS
            </th>
            <th
              style={{ textAlign: "right", padding: "6px 8px" }}
              title="STANDOUT — notable use of playbook / stand abilities or standout leadership. Headline = tracker XP (toggles + settled auto). Parens = pre-settle auto roll signals: count of rolls tagged [abilities: …]. SRD cap: 2/session."
            >
              STANDOUT
            </th>
            <th
              style={{ textAlign: "right", padding: "6px 8px" }}
              title="STRUGGLE — struggled with issues from vice, trauma, or entanglements. Headline = tracker XP (toggles + settled auto). Parens = pre-settle auto roll signals: vice overindulgence + vice failures + new trauma marks. SRD cap: 2/session."
            >
              STRUGGLE
            </th>
            <th
              style={{ textAlign: "right", padding: "6px 8px" }}
              title="Encoded playbook XP queued for the next end-live settlement (Standout + Struggle would-grant). Becomes 0 once auto_encoded_xp_settled, since those values are then in tracker."
            >
              Enc. playbook
            </th>
            <th
              style={{ textAlign: "right", padding: "6px 8px" }}
              title="Stand Development XP that will be banked to the session pool at end-live. 0 once settled."
            >
              Dev→pool
            </th>
            <th
              style={{ textAlign: "right", padding: "6px 8px" }}
              title="Manual GM/player XP grants logged this session via the character sheet's track-add (these are MANUAL trigger rows tagged [insight]/[prowess]/[resolve]/[heritage]/[playbook]). Separate ledger from the trigger toggles — never double-counted with Beliefs/Standout/Struggle."
            >
              Manual→tracks
            </th>
            <th
              style={{ textAlign: "right", padding: "6px 8px" }}
              title="Sum of every XP record for this PC in this session (toggles + auto + manual tracks + dev pool + desperate-roll attribute XP) plus any encoded XP the auto settle would still add on top (only while not yet settled)."
            >
              Total
            </th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Sources</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.characterId} style={{ borderTop: "1px solid #374151" }}>
              <td style={{ padding: "6px 8px", color: "#e5e7eb" }}>{row.name}</td>
              <td style={{ padding: "6px 8px", textAlign: "right", color: "#d1d5db" }}>
                {capTrigger(row.beliefsToggleCount)}/{SESSION_ENCODED_XP_CAP}
              </td>
              <td style={{ padding: "6px 8px", textAlign: "right", color: "#d1d5db" }}>
                {capTrigger(row.standoutToggleCount ?? row.standoutWouldGrant)}/
                {SESSION_ENCODED_XP_CAP}
                <span style={{ color: "#6b7280", fontSize: "10px" }}>
                  {" "}
                  (auto {capTrigger(row.standoutEvents)})
                </span>
              </td>
              <td style={{ padding: "6px 8px", textAlign: "right", color: "#d1d5db" }}>
                {capTrigger(row.struggleToggleCount ?? row.struggleWouldGrant)}/
                {SESSION_ENCODED_XP_CAP}
                <span style={{ color: "#6b7280", fontSize: "10px" }}>
                  {" "}
                  (auto {capTrigger(row.struggleEvents)})
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

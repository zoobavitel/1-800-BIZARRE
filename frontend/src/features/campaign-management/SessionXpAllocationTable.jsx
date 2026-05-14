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
 *   - PLAYBOOK: playbook-specific trigger — mark on the sheet when you used your
 *               playbook abilities in play (resisting, boosting rolls, position,
 *               effect, Stand / Hamon / Spin fictional uses); toggles + tracker only
 *               (no roll-tag auto for this column after encoded settle changes)
 *   - STRUGGLE: struggled with issues from vice, trauma, or entanglements
 *               (counts vice overindulgence + vice failures + trauma marks +
 *               player/GM toggles)
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
              title="PLAYBOOK — end-of-session playbook-specific XP (SRD). Mark when you used abilities from your playbook in the fiction—including to resist, add dice, or shift position/effect with Stand, Hamon, or Spin. Headline = tracker XP from experience toggles (max 2/session for this category). No automatic count from the roll log for this column."
            >
              PLAYBOOK
            </th>
            <th
              style={{ textAlign: "right", padding: "6px 8px" }}
              title="STRUGGLE — struggled with issues from vice, trauma, or entanglements. Headline = tracker XP (toggles + settled auto). Parens = pre-settle auto roll signals: vice overindulgence + vice failures + new trauma marks. SRD cap: 2/session."
            >
              STRUGGLE
            </th>
            <th
              style={{ textAlign: "right", padding: "6px 8px" }}
              title="Encoded STRUGGLE XP queued for the next end-live settlement (vice / trauma signals), capped per SRD. Becomes 0 once auto_encoded_xp_settled, since those values are then in tracker. Playbook-specific XP is no longer granted from the roll log here."
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
              title="Manual GM/player XP grants logged this session via the character sheet's track-add (these are MANUAL trigger rows tagged [insight]/[prowess]/[resolve]/[heritage]/[playbook]). Separate ledger from the trigger toggles — never double-counted with Beliefs/Playbook/Struggle."
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
              <td style={{ padding: "6px 8px", color: "#e5e7eb" }}>
                <div>{row.name}</div>
                {row.playbookArchetypeCaption ? (
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: "10px",
                      color: "#6b7280",
                      lineHeight: 1.35,
                    }}
                  >
                    {row.playbookArchetypeCaption}
                  </div>
                ) : null}
              </td>
              <td style={{ padding: "6px 8px", textAlign: "right", color: "#d1d5db" }}>
                {capTrigger(row.beliefsToggleCount)}/{SESSION_ENCODED_XP_CAP}
              </td>
              <td style={{ padding: "6px 8px", textAlign: "right", color: "#d1d5db" }}>
                {capTrigger(
                  row.playbookToggleCount ??
                    row.standoutToggleCount ??
                    row.playbookWouldGrant ??
                    row.standoutWouldGrant,
                )}
                /{SESSION_ENCODED_XP_CAP}
                {capTrigger(
                  row.playbookEvents ?? row.standoutEvents ?? 0,
                ) > 0 ? (
                  <span style={{ color: "#6b7280", fontSize: "10px" }}>
                    {" "}
                    (auto{" "}
                    {capTrigger(row.playbookEvents ?? row.standoutEvents ?? 0)})
                  </span>
                ) : null}
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

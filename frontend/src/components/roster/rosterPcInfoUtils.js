import React, { useEffect, useState } from "react";
import { referenceAPI } from "../../features/character-sheet/services/api";
import { viceOptions } from "../../data/data";

/** Shared PC expand Info / stress helpers (API-shaped + camelCase). */

export const ROSTER_STRESS_MAX = 9;

const lbl = { fontSize: 10, color: "#9ca3af", textTransform: "uppercase" };

function readHeritageId(ch) {
  const o = ch || {};
  const h = o.heritage ?? o.heritage_id ?? null;
  if (h == null || h === "") return "";
  if (typeof h === "object" && h.id != null) return String(h.id);
  return String(h);
}

function readViceName(ch) {
  const o = ch || {};
  return String(
    o.vice_info?.name ||
      o.vice?.name ||
      (typeof o.vice === "string" ? o.vice : "") ||
      o.custom_vice ||
      "",
  ).trim();
}

function readCrewLabel(ch) {
  const o = ch || {};
  if (o.crew && typeof o.crew === "object") {
    return String(o.crew.name || "").trim();
  }
  return String(o.crew_name || o.personal_crew_name || "").trim();
}

function readCampaignLabel(ch, campaign) {
  if (campaign?.name) return String(campaign.name).trim();
  const o = ch || {};
  if (o.campaign && typeof o.campaign === "object") {
    return String(o.campaign.name || "").trim();
  }
  return "";
}

export function rosterPcInfoDraftFromCharacter(ch) {
  const o = ch || {};
  return {
    name: String(o.true_name ?? o.name ?? "").trim(),
    standName: String(o.stand_name ?? o.standName ?? "").trim(),
    look: String(o.appearance ?? o.look ?? "").trim(),
    background: String(o.background_note ?? o.background ?? "").trim(),
    heritageId: readHeritageId(o),
    vice: readViceName(o),
    viceDetails: String(o.vice_details ?? o.viceDetails ?? "").trim(),
    closeFriend: String(o.close_friend ?? o.closeFriend ?? "").trim(),
    rival: String(o.rival ?? "").trim(),
  };
}

export function rosterPcInfoPayloadFromDraft(d) {
  const draft = d || {};
  const heritageRaw = String(draft.heritageId ?? "").trim();
  const heritage =
    heritageRaw === ""
      ? null
      : /^\d+$/.test(heritageRaw)
        ? parseInt(heritageRaw, 10)
        : null;
  const viceName = String(draft.vice ?? "").trim();
  return {
    true_name: String(draft.name ?? "").trim(),
    stand_name: String(draft.standName ?? "").trim(),
    appearance: String(draft.look ?? "").trim(),
    background_note: String(draft.background ?? "").trim(),
    heritage,
    ...(viceName
      ? { custom_vice: viceName }
      : { vice: null, custom_vice: "" }),
    vice_details: String(draft.viceDetails ?? "").trim(),
    close_friend: String(draft.closeFriend ?? "").trim(),
    rival: String(draft.rival ?? "").trim(),
  };
}

export function rosterPcInfoPayloadEqual(a, b) {
  const keys = [
    "true_name",
    "stand_name",
    "appearance",
    "background_note",
    "heritage",
    "vice_details",
    "close_friend",
    "rival",
  ];
  for (const k of keys) {
    if (String(a?.[k] ?? "") !== String(b?.[k] ?? "")) return false;
  }
  const aVice = a?.custom_vice ?? a?.vice ?? null;
  const bVice = b?.custom_vice ?? b?.vice ?? null;
  if (String(aVice ?? "") !== String(bVice ?? "")) return false;
  return true;
}

/** Integer stress 0–9 from API int or frontend stressFilled / boolean array. */
export function rosterPcStressCount(ch) {
  const o = ch || {};
  if (o.stressFilled != null && Number.isFinite(Number(o.stressFilled))) {
    return Math.max(
      0,
      Math.min(ROSTER_STRESS_MAX, Math.floor(Number(o.stressFilled))),
    );
  }
  if (typeof o.stress === "number" && Number.isFinite(o.stress)) {
    return Math.max(0, Math.min(ROSTER_STRESS_MAX, Math.floor(o.stress)));
  }
  if (Array.isArray(o.stress)) {
    return Math.max(
      0,
      Math.min(ROSTER_STRESS_MAX, o.stress.filter(Boolean).length),
    );
  }
  return 0;
}

/** Comma-separated trauma names / keys for display. */
export function rosterPcTraumaLabel(ch) {
  const o = ch || {};
  const details = o.trauma_details;
  if (Array.isArray(details) && details.length) {
    const names = details
      .map((t) => String(t?.name || t?.label || "").trim())
      .filter(Boolean);
    if (names.length) return names.join(", ");
  }
  const trauma = o.trauma;
  if (trauma && typeof trauma === "object" && !Array.isArray(trauma)) {
    const keys = Object.keys(trauma)
      .filter((k) => trauma[k])
      .map((k) => k.replace(/_/g, " "));
    if (keys.length) return keys.join(", ");
  }
  if (Array.isArray(trauma) && trauma.length) {
    const parts = trauma
      .map((item) => {
        if (item == null) return "";
        if (typeof item === "object") return String(item.name || "").trim();
        return String(item).trim();
      })
      .filter(Boolean);
    if (parts.length) return parts.join(", ");
  }
  return "—";
}

function ReadonlyRow({ label, value }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={lbl}>{label}</div>
      <div
        style={{
          fontSize: 11,
          color: "#e5e7eb",
          marginTop: 4,
          lineHeight: 1.35,
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

export function RosterPcInfoFields({
  draft,
  setDraft,
  onCommit,
  readOnly = false,
  busy = false,
  S,
  traumaLabel = "—",
  character = null,
  campaign = null,
}) {
  const [heritages, setHeritages] = useState([]);

  useEffect(() => {
    let cancelled = false;
    referenceAPI
      .getHeritages()
      .then((list) => {
        if (!cancelled) setHeritages(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setHeritages([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const field = (key, label, multiline = false) => {
    const value = draft?.[key] ?? "";
    const common = {
      value,
      disabled: busy || readOnly,
      onChange: (e) =>
        setDraft((prev) => ({ ...prev, [key]: e.target.value })),
      onBlur: () => {
        if (readOnly) return;
        onCommit?.();
      },
      style: {
        ...S.inp,
        width: "100%",
        fontSize: 11,
        marginTop: 4,
        ...(multiline ? { minHeight: 48, resize: "vertical" } : {}),
      },
    };
    return (
      <div key={key} style={{ marginBottom: 8 }}>
        <div style={lbl}>{label}</div>
        {multiline ? (
          <textarea {...common} />
        ) : (
          <input type="text" {...common} />
        )}
      </div>
    );
  };

  const crewLabel = readCrewLabel(character);
  const campaignLabel = readCampaignLabel(character, campaign);
  const heritageName =
    character?.heritage_details?.name ||
    character?.heritage_name ||
    heritages.find((h) => String(h.id) === String(draft?.heritageId))?.name ||
    "";

  return (
    <div>
      {field("name", "Name")}
      <ReadonlyRow label="Crew" value={crewLabel} />
      {field("standName", "Stand name")}
      {field("look", "Look")}
      <div style={{ marginBottom: 8 }}>
        <div style={lbl}>Heritage</div>
        {readOnly ? (
          <div
            style={{
              fontSize: 11,
              color: "#e5e7eb",
              marginTop: 4,
              lineHeight: 1.35,
            }}
          >
            {heritageName || "—"}
          </div>
        ) : (
          <select
            value={draft?.heritageId ?? ""}
            disabled={busy}
            onChange={(e) => {
              const v = e.target.value;
              setDraft((prev) => ({ ...prev, heritageId: v }));
              // Commit after state update via microtask with next draft
              queueMicrotask(() =>
                onCommit?.({ ...draft, heritageId: v }),
              );
            }}
            style={{ ...S.select, width: "100%", fontSize: 11, marginTop: 4 }}
          >
            <option value="">— None —</option>
            {heritages.map((h) => (
              <option key={h.id} value={String(h.id)}>
                {h.name || `Heritage ${h.id}`}
              </option>
            ))}
          </select>
        )}
      </div>
      {field("background", "Background")}
      <ReadonlyRow label="Campaign" value={campaignLabel} />
      <div style={{ marginBottom: 8 }}>
        <div style={lbl}>Vice / Purveyor</div>
        {readOnly ? (
          <div
            style={{
              fontSize: 11,
              color: "#e5e7eb",
              marginTop: 4,
              lineHeight: 1.35,
            }}
          >
            {[draft?.vice, draft?.viceDetails].filter(Boolean).join(" · ") ||
              "—"}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginTop: 4,
            }}
          >
            <select
              value={draft?.vice ?? ""}
              disabled={busy}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((prev) => ({ ...prev, vice: v }));
                queueMicrotask(() => onCommit?.({ ...draft, vice: v }));
              }}
              style={{ ...S.select, width: "100%", fontSize: 11 }}
            >
              <option value="">Select Vice</option>
              {viceOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={draft?.viceDetails ?? ""}
              disabled={busy}
              placeholder="Purveyor details"
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  viceDetails: e.target.value,
                }))
              }
              onBlur={() => onCommit?.()}
              style={{ ...S.inp, width: "100%", fontSize: 11 }}
            />
          </div>
        )}
      </div>
      {field("closeFriend", "Close friend")}
      {field("rival", "Rival")}
      <div style={{ marginBottom: 4 }}>
        <div style={lbl}>Trauma</div>
        <div
          style={{
            fontSize: 11,
            color: "#e5e7eb",
            marginTop: 4,
            lineHeight: 1.35,
          }}
        >
          {traumaLabel || "—"}
        </div>
      </div>
    </div>
  );
}

export function RosterPcStressTraumaStrip({
  stress,
  traumaLabel,
  readOnly = false,
  busy = false,
  onStressChange,
  S,
}) {
  const n = Math.max(
    0,
    Math.min(ROSTER_STRESS_MAX, Math.floor(Number(stress) || 0)),
  );
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 6,
        }}
      >
        <div style={{ ...lbl, marginBottom: 0 }}>Stress</div>
        <span style={{ fontSize: 12, color: "#e5e7eb", fontWeight: 600 }}>
          {n} / {ROSTER_STRESS_MAX}
        </span>
        {!readOnly ? (
          <span style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              style={{ ...S.btnGhost, fontSize: 10, padding: "1px 8px" }}
              disabled={busy || n <= 0}
              title="Lower stress"
              onClick={() => onStressChange?.(Math.max(0, n - 1))}
            >
              −
            </button>
            <button
              type="button"
              style={{ ...S.btnGhost, fontSize: 10, padding: "1px 8px" }}
              disabled={busy || n >= ROSTER_STRESS_MAX}
              title="Raise stress"
              onClick={() =>
                onStressChange?.(Math.min(ROSTER_STRESS_MAX, n + 1))
              }
            >
              +
            </button>
          </span>
        ) : null}
      </div>
      <div style={lbl}>Trauma</div>
      <div
        style={{
          fontSize: 11,
          color: "#e5e7eb",
          marginTop: 4,
          lineHeight: 1.35,
        }}
      >
        {traumaLabel || "—"}
      </div>
    </div>
  );
}

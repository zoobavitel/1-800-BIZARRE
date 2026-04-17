import React, { useState, useEffect } from "react";
import { authAPI, useAuth } from "../features/auth";

// Dark mode format (same as Character Sheet, Character Options)
const S = {
  page: {
    fontFamily: "monospace",
    fontSize: "13px",
    background: "#000",
    color: "#fff",
    minHeight: "100vh",
  },
  content: { padding: "16px", maxWidth: "800px", margin: "0 auto" },
  section: { marginBottom: "32px" },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: "1px",
    color: "#e2e8f0",
    borderBottom: "1px solid #374151",
    paddingBottom: "8px",
    marginBottom: "16px",
  },
  card: {
    background: "#111827",
    border: "1px solid #374151",
    borderRadius: "4px",
    padding: "12px",
    marginBottom: "8px",
  },
  lbl: {
    color: "#f87171",
    fontSize: "11px",
    fontWeight: "bold",
    marginBottom: "4px",
    display: "block",
  },
  inp: {
    background: "transparent",
    color: "#fff",
    border: "none",
    borderBottom: "1px solid #4b5563",
    padding: "6px 10px",
    width: "100%",
    fontFamily: "monospace",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
  },
  textarea: {
    background: "#111827",
    color: "#fff",
    border: "1px solid #374151",
    borderRadius: "4px",
    padding: "8px 10px",
    width: "100%",
    fontFamily: "monospace",
    fontSize: "13px",
    outline: "none",
    minHeight: "80px",
    resize: "vertical",
  },
  toggle: (on) => ({
    width: "40px",
    height: "22px",
    borderRadius: "11px",
    border: "none",
    cursor: "pointer",
    background: on ? "#4f8ef7" : "#374151",
    color: "#fff" /* inner knob */,
  }),
  btn: {
    padding: "8px 16px",
    borderRadius: "4px",
    fontSize: "12px",
    cursor: "pointer",
    border: "none",
    fontFamily: "monospace",
    background: "#7c3aed",
    color: "#fff",
  },
};

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreviewError, setAvatarPreviewError] = useState(false);
  const [signature, setSignature] = useState("");
  const [showAvatars, setShowAvatars] = useState(true);
  const [showSignatures, setShowSignatures] = useState(true);
  const [displayTitle, setDisplayTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  useEffect(() => {
    setAvatarPreviewError(false);
  }, [avatarUrl]);

  useEffect(() => {
    authAPI
      .getProfile()
      .then((p) => {
        if (p) {
          setAvatarUrl(p.avatar_url ?? "");
          setSignature(p.signature ?? "");
          setDisplayTitle(p.display_title ?? "");
          setShowAvatars(p.show_avatars !== false);
          setShowSignatures(p.show_signatures !== false);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      await authAPI.updateProfile({
        avatar_url: avatarUrl.trim(),
        signature,
        display_title: displayTitle,
        show_avatars: showAvatars,
        show_signatures: showSignatures,
        theme: "dark",
      });
      setSaveMessage("Saved");
    } catch (err) {
      setSaveMessage(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.content}>
        <section style={S.section}>
          <h2 style={S.sectionTitle}>Profile</h2>
          <div style={S.card}>
            <label style={S.lbl}>Username</label>
            <div style={{ color: "#e5e7eb", fontSize: "14px", wordBreak: "break-all" }}>
              {(user?.username && String(user.username).trim()) || "—"}
            </div>
          </div>
          <div style={S.card}>
            <label style={S.lbl}>Profile picture URL</label>
            <p
              style={{
                margin: "0 0 8px",
                color: "#9ca3af",
                fontSize: "11px",
                lineHeight: 1.45,
              }}
            >
              Use a direct image URL (https://…). File upload is not supported
              here. Recommended: square image (1:1), up to 1024x1024 and 2 MB.
              Best results at 256x256 in WebP, PNG, or JPEG.
            </p>
            <input
              style={S.inp}
              type="url"
              inputMode="url"
              autoComplete="off"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.png"
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                marginTop: "12px",
              }}
            >
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  flexShrink: 0,
                  borderRadius: "4px",
                  border: "1px solid #374151",
                  background: "#0f172a",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#6b7280",
                  fontSize: "10px",
                  textAlign: "center",
                  padding: "4px",
                }}
              >
                {avatarUrl.trim() && !avatarPreviewError ? (
                  <img
                    src={avatarUrl.trim()}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarPreviewError(true)}
                    onLoad={() => setAvatarPreviewError(false)}
                  />
                ) : avatarUrl.trim() && avatarPreviewError ? (
                  "Invalid URL or image blocked"
                ) : (
                  "Preview"
                )}
              </div>
              <span style={{ color: "#9ca3af", fontSize: "11px" }}>
                Preview updates as you type a valid image URL.
              </span>
            </div>
          </div>
          <div style={S.card}>
            <label style={S.lbl}>Signature</label>
            <textarea
              style={S.textarea}
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Custom signature..."
            />
          </div>
          <div style={S.card}>
            <label style={S.lbl}>Display title</label>
            <input
              style={S.inp}
              type="text"
              value={displayTitle}
              onChange={(e) => setDisplayTitle(e.target.value)}
              placeholder="e.g. Stand User, GM"
            />
          </div>
          <div style={S.card}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <span>Show avatars</span>
              <button
                type="button"
                style={S.toggle(showAvatars)}
                onClick={() => setShowAvatars(!showAvatars)}
                aria-label={showAvatars ? "Hide avatars" : "Show avatars"}
              >
                <span
                  style={{
                    display: "block",
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: "#fff",
                    marginLeft: showAvatars ? "20px" : "2px",
                    marginTop: "2px",
                    transition: "margin-left 0.2s",
                  }}
                />
              </button>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>Show signatures</span>
              <button
                type="button"
                style={S.toggle(showSignatures)}
                onClick={() => setShowSignatures(!showSignatures)}
                aria-label={
                  showSignatures ? "Hide signatures" : "Show signatures"
                }
              >
                <span
                  style={{
                    display: "block",
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: "#fff",
                    marginLeft: showSignatures ? "20px" : "2px",
                    marginTop: "2px",
                    transition: "margin-left 0.2s",
                  }}
                />
              </button>
            </div>
          </div>
        </section>

        <section style={S.section}>
          <h2 style={S.sectionTitle}>Theme / Appearance</h2>
          <div style={S.card}>
            <label style={S.lbl}>HFTF</label>
            <p style={{ margin: "0 0 10px", color: "#9ca3af", fontSize: "11px" }}>
              Same palette as the home page: deep black, purple accent, gold and
              cream highlights.
            </p>
            <div
              style={{
                display: "flex",
                height: "6px",
                width: "100%",
                maxWidth: "320px",
                borderRadius: "2px",
                overflow: "hidden",
                marginBottom: "12px",
              }}
              aria-hidden
            >
              <div style={{ flex: 1, background: "var(--hftf-gold)" }} />
              <div style={{ flex: 1, background: "var(--hftf-orange)" }} />
              <div style={{ flex: 1, background: "#c0392b" }} />
              <div style={{ flex: 1, background: "var(--hftf-purple)" }} />
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "8px 16px",
                borderRadius: "4px",
                border: "1px solid var(--hftf-border)",
                background: "var(--hftf-deep)",
                color: "var(--hftf-text-cream)",
                fontFamily: 'var(--font-heading, "Oswald", sans-serif)',
                fontSize: "13px",
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              HFTF
            </div>
          </div>
        </section>

        <section style={S.section}>
          <h2 style={S.sectionTitle}>Notification Settings</h2>
          <div style={S.card}>
            <div style={{ color: "#9ca3af", fontSize: "12px" }}>
              Notification settings will be available in a future update.
            </div>
          </div>
        </section>

        <section style={S.section}>
          <button style={S.btn} onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>
          {saveMessage && (
            <span
              style={{
                marginLeft: "12px",
                fontSize: "12px",
                color: saveMessage === "Saved" ? "#34d399" : "#f87171",
              }}
            >
              {saveMessage}
            </span>
          )}
        </section>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from "react";
import { authAPI, useAuth } from "../features/auth";
import { useTheme } from "../features/theme/ThemeContext";
import { resolveMediaUrl } from "../features/character-sheet/services/api";
import AvatarCropModal from "../components/AvatarCropModal";

const S = {
  page: {
    fontFamily: "monospace",
    fontSize: "13px",
    background: "var(--bg-page)",
    color: "var(--text-primary)",
    minHeight: "100vh",
  },
  content: { padding: "16px", maxWidth: "800px", margin: "0 auto" },
  section: { marginBottom: "32px" },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: "1px",
    color: "var(--text-primary)",
    borderBottom: "1px solid var(--border)",
    paddingBottom: "8px",
    marginBottom: "16px",
  },
  card: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
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
    color: "var(--text-primary)",
    border: "none",
    borderBottom: "1px solid var(--border)",
    padding: "6px 10px",
    width: "100%",
    fontFamily: "monospace",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
  },
  textarea: {
    background: "var(--bg-card)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
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
    background: on ? "#4f8ef7" : "rgba(148, 163, 184, 0.35)",
    color: "#fff" /* inner knob */,
  }),
  btn: {
    padding: "8px 16px",
    borderRadius: "4px",
    fontSize: "12px",
    cursor: "pointer",
    border: "none",
    fontFamily: "monospace",
    background: "var(--accent)",
    color: "#fff",
  },
  mutedSmall: {
    margin: "0 0 10px",
    color: "var(--text-muted)",
    fontSize: "11px",
    lineHeight: 1.45,
  },
};

function themeChipStyle(active) {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    textAlign: "left",
    padding: "10px 14px",
    borderRadius: "4px",
    border: active
      ? "2px solid var(--accent)"
      : "1px solid var(--hftf-border)",
    background: active ? "rgba(108, 57, 137, 0.12)" : "var(--hftf-panel)",
    color: "var(--hftf-text-cream)",
    fontFamily: 'var(--font-heading, "Oswald", sans-serif)',
    cursor: "pointer",
    minWidth: "120px",
    boxSizing: "border-box",
    outline: "none",
  };
}

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const { theme: appTheme, setTheme } = useTheme();
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPath, setAvatarPath] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarPreviewError, setAvatarPreviewError] = useState(false);
  const [removeAvatarRequested, setRemoveAvatarRequested] = useState(false);
  const [signature, setSignature] = useState("");
  const [showAvatars, setShowAvatars] = useState(true);
  const [showSignatures, setShowSignatures] = useState(true);
  const [displayTitle, setDisplayTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [cropOpen, setCropOpen] = useState(false);
  const avatarFileInputRef = useRef(null);

  useEffect(() => {
    setAvatarPreviewError(false);
  }, [avatarPreview, avatarUrl]);

  useEffect(() => {
    authAPI
      .getProfile()
      .then((p) => {
        if (p) {
          const path = p.avatar ?? "";
          const url = p.avatar_url ?? "";
          setAvatarPath(path);
          setAvatarUrl(url);
          setAvatarFile(null);
          setRemoveAvatarRequested(false);
          setAvatarPreview(resolveMediaUrl(path || url || ""));
          setSignature(p.signature ?? "");
          setDisplayTitle(p.display_title ?? "");
          setShowAvatars(p.show_avatars !== false);
          setShowSignatures(p.show_signatures !== false);
        }
      })
      .catch(() => {});
  }, []);

  const handleAvatarFileSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setSaveMessage("Avatar must be 2 MB or smaller.");
      return;
    }
    setAvatarFile(file);
    setAvatarUrl("");
    setRemoveAvatarRequested(false);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const payload = {
        signature,
        display_title: displayTitle,
        show_avatars: showAvatars,
        show_signatures: showSignatures,
        theme: appTheme,
        avatar_url: avatarUrl.trim(),
      };
      if (avatarFile) {
        payload.avatarFile = avatarFile;
        payload.avatar_url = "";
      } else if (removeAvatarRequested) {
        payload.avatar = null;
      } else if (avatarUrl.trim()) {
        payload.avatar = null;
      }
      const saved = await authAPI.updateProfile(payload);
      setAvatarFile(null);
      setRemoveAvatarRequested(false);
      setAvatarPath(saved?.avatar ?? "");
      setAvatarUrl(saved?.avatar_url ?? "");
      setAvatarPreview(
        resolveMediaUrl((saved?.avatar || saved?.avatar_url || "") ?? ""),
      );
      setSaveMessage("Saved");
    } catch (err) {
      setSaveMessage(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const previewSrc = avatarPreview || resolveMediaUrl(avatarPath || avatarUrl);

  const handleCropApply = (file) => {
    if (avatarPreview && String(avatarPreview).startsWith("blob:")) {
      try {
        URL.revokeObjectURL(avatarPreview);
      } catch {
        /* ignore */
      }
    }
    setAvatarFile(file);
    setAvatarUrl("");
    setRemoveAvatarRequested(false);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarPreviewError(false);
    setCropOpen(false);
    setSaveMessage(null);
  };

  return (
    <div style={S.page}>
      <div style={S.content}>
        <section style={S.section}>
          <h2 style={S.sectionTitle}>Profile</h2>
          <div style={S.card}>
            <label style={S.lbl}>Username</label>
            <div
              style={{
                color: "var(--text-primary)",
                fontSize: "14px",
                wordBreak: "break-all",
              }}
            >
              {(user?.username && String(user.username).trim()) || "—"}
            </div>
          </div>
          <div style={S.card}>
            <label style={S.lbl}>Profile picture</label>
            <p style={{ ...S.mutedSmall, margin: "0 0 8px" }}>
              Upload a JPEG, PNG, WebP, or GIF (max 2 MB), or paste an HTTPS image
              URL. Recommended: square image (1:1), best at 256×256.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
              <input
                ref={avatarFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: "none" }}
                onChange={handleAvatarFileSelect}
              />
              <button
                type="button"
                style={S.btn}
                onClick={() => avatarFileInputRef.current?.click()}
              >
                Upload
              </button>
              <button
                type="button"
                style={S.btn}
                onClick={() => {
                  setAvatarFile(null);
                  setAvatarUrl("");
                  setAvatarPath("");
                  setAvatarPreview("");
                  setRemoveAvatarRequested(true);
                }}
              >
                Remove
              </button>
            </div>
            <input
              style={S.inp}
              type="url"
              inputMode="url"
              autoComplete="off"
              value={avatarUrl}
              onChange={(e) => {
                setAvatarUrl(e.target.value);
                setAvatarFile(null);
                setRemoveAvatarRequested(false);
                setAvatarPreview(e.target.value.trim());
              }}
              placeholder="https://example.com/avatar.png"
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                marginTop: "12px",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  flexShrink: 0,
                  borderRadius: "4px",
                  border: "1px solid var(--border)",
                  background: "var(--bg-page)",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted)",
                  fontSize: "10px",
                  textAlign: "center",
                  padding: "4px",
                }}
              >
                {previewSrc && !avatarPreviewError ? (
                  <img
                    src={previewSrc}
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
                ) : previewSrc && avatarPreviewError ? (
                  "Invalid URL or image blocked"
                ) : (
                  "Preview"
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  minWidth: 0,
                  flex: "1 1 160px",
                }}
              >
                <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                  Preview updates from upload or URL. Use Adjust to crop and zoom
                  before saving.
                </span>
                <button
                  type="button"
                  style={{
                    ...S.btn,
                    alignSelf: "flex-start",
                    opacity:
                      previewSrc && !avatarPreviewError ? 1 : 0.5,
                    cursor:
                      previewSrc && !avatarPreviewError
                        ? "pointer"
                        : "not-allowed",
                  }}
                  disabled={!previewSrc || avatarPreviewError}
                  onClick={() => setCropOpen(true)}
                >
                  Adjust
                </button>
              </div>
            </div>
            {cropOpen && previewSrc && !avatarPreviewError ? (
              <AvatarCropModal
                imageSrc={previewSrc}
                onCancel={() => setCropOpen(false)}
                onApply={handleCropApply}
              />
            ) : null}
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
            <label style={S.lbl}>Color theme</label>
            <p style={{ ...S.mutedSmall, marginBottom: "12px" }}>
              HFTF brand themes (purple, gold, orange) apply across the app,
              including the player character sheet. Cool Night is an optional
              slate escape hatch (gray panels, coral labels, cool accents).
            </p>
            <div
              style={{
                display: "flex",
                height: "6px",
                width: "100%",
                maxWidth: "320px",
                borderRadius: "2px",
                overflow: "hidden",
                marginBottom: "14px",
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
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                alignItems: "stretch",
              }}
              role="group"
              aria-label="Choose color theme"
            >
              <button
                type="button"
                style={themeChipStyle(appTheme === "dark")}
                aria-pressed={appTheme === "dark"}
                onClick={() => setTheme("dark")}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  HFTF
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    marginTop: "4px",
                    opacity: 0.85,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  Dark
                </span>
              </button>
              <button
                type="button"
                style={themeChipStyle(appTheme === "light")}
                aria-pressed={appTheme === "light"}
                onClick={() => setTheme("light")}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  HFTF Light
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    marginTop: "4px",
                    opacity: 0.85,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  Parchment
                </span>
              </button>
              <button
                type="button"
                style={themeChipStyle(appTheme === "cool_night")}
                aria-pressed={appTheme === "cool_night"}
                onClick={() => setTheme("cool_night")}
              >
                <span
                  style={{
                    display: "flex",
                    height: "4px",
                    width: "100%",
                    borderRadius: "1px",
                    overflow: "hidden",
                    marginBottom: "6px",
                  }}
                  aria-hidden
                >
                  <span style={{ flex: 1, background: "#111827" }} />
                  <span style={{ flex: 1, background: "#374151" }} />
                  <span style={{ flex: 1, background: "#f87171" }} />
                  <span style={{ flex: 1, background: "#0ea5e9" }} />
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Cool Night
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    marginTop: "4px",
                    opacity: 0.85,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  Slate
                </span>
              </button>
            </div>
            <p
              style={{
                marginTop: "12px",
                marginBottom: 0,
                color: "var(--text-muted)",
                fontSize: "10px",
                lineHeight: 1.5,
              }}
            >
              Use &quot;Save changes&quot; to store your theme with your profile
              so it carries across devices.
            </p>
          </div>
        </section>

        <section style={S.section}>
          <h2 style={S.sectionTitle}>Notification Settings</h2>
          <div style={S.card}>
            <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>
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

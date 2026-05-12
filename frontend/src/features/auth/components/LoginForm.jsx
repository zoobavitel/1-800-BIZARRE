import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getApiBaseUrl,
  getStoredApiBaseUrl,
  setApiBaseUrl,
} from "../../../config/apiConfig";
import {
  token,
  injectStyles,
  Divider,
  Label,
  TextInput,
  authPageShellStyle,
  AuthCardTopStripe,
} from "./AuthFormShared";

// ─── Main component ───────────────────────────────────────────────────────────
const LoginForm = ({ onSwitchToSignup }) => {
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [serverUrl, setServerUrl] = useState("");
  const [showServerUrl, setShowServerUrl] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [urlError, setUrlError] = useState("");

  const isRemoteSite =
    typeof window !== "undefined" &&
    !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

  useEffect(() => {
    injectStyles();
    const stored = getStoredApiBaseUrl();
    setServerUrl(stored);
    if (isRemoteSite) setShowServerUrl(true);
  }, [isRemoteSite]);

  const { login, error, clearError } = useAuth();

  const handleServerUrlChange = (e) => {
    const value = e.target.value.trim();
    setServerUrl(e.target.value);
    setApiBaseUrl(value || null);
    if (urlError) setUrlError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    setUrlError("");
    setApiBaseUrl(serverUrl.trim() || null);
    if (!getApiBaseUrl()) {
      setUrlError(
        "Set the game server URL below when running on a remote host. Locally use http://127.0.0.1:8000/api unless your host shared a tunnel URL.",
      );
      setShowServerUrl(true);
      return;
    }
    setIsLoading(true);
    const result = await login(credentials);
    if (!result.success) setIsLoading(false);
  };

  const handleChange = (e) =>
    setCredentials((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  return (
    <div style={authPageShellStyle}>
      {/* Card */}
      <div
        className="lf-card"
        style={{
          width: "100%",
          maxWidth: 420,
          background: token.surface,
          border: `1px solid ${token.border}`,
          borderRadius: 16,
          padding: "40px 36px",
          overflow: "hidden",
          boxShadow: `
            0 0 0 1px rgba(255,255,255,0.04) inset,
            0 24px 48px rgba(0,0,0,0.75)
          `,
        }}
      >
        <AuthCardTopStripe />
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1
            className="lf-title"
            style={{
              margin: 0,
              fontSize: 40,
              fontWeight: 400,
            }}
          >
            1(800)BIZARRE
          </h1>
          <p
            style={{
              marginTop: 10,
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: token.muted,
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 500,
            }}
          >
            Sign in to your account
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
        >
          {/* Live-site warning */}
          {isRemoteSite && !serverUrl && (
            <div
              style={{
                padding: "10px 14px",
                background: token.warnDim,
                border: `1px solid rgba(245,158,11,0.4)`,
                borderRadius: 8,
                fontSize: 12.5,
                color: "#fcd34d",
                lineHeight: 1.6,
              }}
            >
              Using the live site — set the Game server URL below (your host's
              backend, e.g.{" "}
              <code style={{ color: "#fde68a" }}>
                https://xxx.ngrok-free.app/api
              </code>
              ). Host runs{" "}
              <code style={{ color: "#fde68a" }}>ngrok http 8000</code> and
              shares that URL.
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              style={{
                padding: "10px 14px",
                background: token.dangerDim,
                border: `1px solid rgba(239,68,68,0.4)`,
                borderRadius: 8,
                fontSize: 13,
                color: "#fca5a5",
                lineHeight: 1.6,
              }}
            >
              {error}
              {error.includes("Could not reach game server") && isRemoteSite && (
                <p style={{ marginTop: 6, marginBottom: 0, fontSize: 12 }}>
                  Enter the host's URL above: <strong>https://</strong>
                  their-ngrok-url
                  <strong>/api</strong> (host runs <code>ngrok http 8000</code>
                  ).
                </p>
              )}
            </div>
          )}

          <Divider />

          {/* Server URL accordion */}
          <div>
            <button
              type="button"
              className="lf-toggle"
              onClick={() => setShowServerUrl((s) => !s)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                fontSize: 12,
                letterSpacing: "0.08em",
                color: token.muted,
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "color 0.2s",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  fontSize: 9,
                  transition: "transform 0.2s",
                  transform: showServerUrl ? "rotate(90deg)" : "rotate(0deg)",
                }}
              >
                ▶
              </span>
              Game server {isRemoteSite ? "(required here)" : "(optional)"}
            </button>

            {showServerUrl && (
              <div style={{ marginTop: 10 }}>
                <TextInput
                  type="url"
                  value={serverUrl}
                  onChange={handleServerUrlChange}
                  placeholder="https://xxx.ngrok-free.app/api"
                />
                {urlError && (
                  <p
                    style={{
                      marginTop: 8,
                      marginBottom: 0,
                      fontSize: 12,
                      color: "#fca5a5",
                      lineHeight: 1.5,
                    }}
                  >
                    {urlError}
                  </p>
                )}
                <p
                  style={{
                    marginTop: 6,
                    marginBottom: 0,
                    fontSize: 11.5,
                    color: token.muted,
                    lineHeight: 1.5,
                  }}
                >
                  {isRemoteSite
                    ? "Paste the URL your host sends (must include /api). This site has no baked-in API host."
                    : "Leave blank to use http://127.0.0.1:8000/api (local dev). When playing remotely, use the host’s tunnel URL."}
                </p>
              </div>
            )}
          </div>

          <Divider />

          {/* Username */}
          <div>
            <Label htmlFor="username">Username</Label>
            <TextInput
              id="username"
              name="username"
              required
              value={credentials.username}
              onChange={handleChange}
              placeholder="Your username"
            />
          </div>

          {/* Password */}
          <div>
            <Label htmlFor="password">Password</Label>
            <TextInput
              id="password"
              name="password"
              type="password"
              required
              value={credentials.password}
              onChange={handleChange}
              placeholder="Your password"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="lf-btn-primary"
            style={{
              marginTop: 4,
              width: "100%",
              padding: "12px 0",
              background: token.accent,
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13,
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 600,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.55 : 1,
              transition: "background 0.2s, box-shadow 0.2s, transform 0.15s",
              boxShadow: `0 4px 16px ${token.accentGlow}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {isLoading ? (
              <>
                <span
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </button>

          {/* Switch to signup */}
          <div style={{ textAlign: "center", paddingTop: 4 }}>
            <button
              type="button"
              onClick={onSwitchToSignup}
              className="lf-btn-ghost"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 12.5,
                color: token.muted,
                letterSpacing: "0.04em",
                transition: "color 0.2s",
                padding: 0,
              }}
            >
              Don't have an account?{" "}
              <span style={{ color: token.accent, fontWeight: 600 }}>
                Sign up
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;

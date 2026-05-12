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

const SignupForm = ({ onSwitchToLogin }) => {
  const [userData, setUserData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [serverUrl, setServerUrl] = useState("");
  const [showServerUrl, setShowServerUrl] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const isRemoteSite =
    typeof window !== "undefined" &&
    !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

  useEffect(() => {
    injectStyles();
    const stored = getStoredApiBaseUrl();
    setServerUrl(stored);
    if (isRemoteSite) setShowServerUrl(true);
  }, [isRemoteSite]);

  const { signup, error, clearError } = useAuth();

  const handleServerUrlChange = (e) => {
    const value = e.target.value.trim();
    setServerUrl(e.target.value);
    setApiBaseUrl(value || null);
    if (validationErrors.serverUrl) {
      setValidationErrors((prev) => ({ ...prev, serverUrl: "" }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (userData.username.length < 3) {
      errors.username = "Username must be at least 3 characters long";
    }

    if (userData.password.length < 6) {
      errors.password = "Password must be at least 6 characters long";
    }

    if (userData.password !== userData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    setValidationErrors({});

    if (!validateForm()) {
      return;
    }

    setApiBaseUrl(serverUrl.trim() || null);
    if (!getApiBaseUrl()) {
      setValidationErrors({
        serverUrl:
          "Set the game server URL under Game server (required on remote hosts; locally use http://127.0.0.1:8000/api).",
      });
      setShowServerUrl(true);
      return;
    }

    setIsLoading(true);

    const result = await signup({
      username: userData.username,
      password: userData.password,
    });

    if (!result.success) {
      setIsLoading(false);
      const isUsernameError =
        result.error &&
        /already taken|already exists|username/i.test(result.error);
      if (isUsernameError) {
        setValidationErrors((prev) => ({ ...prev, username: result.error }));
      }
      return;
    }
    // If successful, the AuthContext will handle the redirect
  };

  const handleChange = (e) => {
    setUserData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));

    if (e.target.name === "username" && error) {
      clearError();
    }
    if (validationErrors[e.target.name]) {
      setValidationErrors((prev) => ({
        ...prev,
        [e.target.name]: "",
      }));
    }
  };

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
            Create your account
          </p>
        </div>

        {/* Error - prominent, above form */}
        {error && (
          <div
            role="alert"
            style={{
              marginBottom: 20,
              padding: "14px 18px",
              background: token.dangerDim,
              border: "2px solid rgba(239,68,68,0.6)",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              color: "#fca5a5",
              lineHeight: 1.5,
              boxShadow: "0 4px 12px rgba(239,68,68,0.2)",
            }}
          >
            {error}
            {error.includes("Could not reach game server") && isRemoteSite && (
              <p
                style={{
                  marginTop: 8,
                  marginBottom: 0,
                  fontSize: 12,
                  fontWeight: 400,
                }}
              >
                Enter the host's URL below: <strong>https://</strong>
                their-ngrok-url<strong>/api</strong>
              </p>
            )}
          </div>
        )}

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
                {validationErrors.serverUrl && (
                  <p
                    style={{
                      marginTop: 8,
                      marginBottom: 0,
                      fontSize: 12,
                      color: "#fca5a5",
                      lineHeight: 1.5,
                    }}
                  >
                    {validationErrors.serverUrl}
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
                    ? "Paste the URL your host sends (must include /api)."
                    : "Leave blank to use http://127.0.0.1:8000/api (local dev)."}
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
              value={userData.username}
              onChange={handleChange}
              placeholder="Choose a username"
              hasError={!!validationErrors.username}
            />
            {validationErrors.username && (
              <p
                style={{
                  marginTop: 6,
                  marginBottom: 0,
                  fontSize: 12,
                  color: "#fca5a5",
                  lineHeight: 1.5,
                }}
              >
                {validationErrors.username}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <Label htmlFor="password">Password</Label>
            <TextInput
              id="password"
              name="password"
              type="password"
              required
              value={userData.password}
              onChange={handleChange}
              placeholder="Create a password"
              hasError={!!validationErrors.password}
            />
            {validationErrors.password && (
              <p
                style={{
                  marginTop: 6,
                  marginBottom: 0,
                  fontSize: 12,
                  color: "#fca5a5",
                  lineHeight: 1.5,
                }}
              >
                {validationErrors.password}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <TextInput
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              value={userData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              hasError={!!validationErrors.confirmPassword}
            />
            {validationErrors.confirmPassword && (
              <p
                style={{
                  marginTop: 6,
                  marginBottom: 0,
                  fontSize: 12,
                  color: "#fca5a5",
                  lineHeight: 1.5,
                }}
              >
                {validationErrors.confirmPassword}
              </p>
            )}
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
                Creating account…
              </>
            ) : (
              "Create account"
            )}
          </button>

          {/* Switch to login */}
          <div style={{ textAlign: "center", paddingTop: 4 }}>
            <button
              type="button"
              onClick={onSwitchToLogin}
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
              Already have an account?{" "}
              <span style={{ color: token.accent, fontWeight: 600 }}>
                Sign in
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignupForm;

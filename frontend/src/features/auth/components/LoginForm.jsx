import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getStoredApiBaseUrl, setApiBaseUrl } from '../../../config/apiConfig';

// ─── Design tokens ──────────────────────────────────────────────────────────
const token = {
  bg:           '#080810',
  surface:      '#0e0e1a',
  surfaceHover: '#13131f',
  border:       '#2a2a4a',
  borderFocus:  '#7c3aed',
  text:         '#e2e2f0',
  muted:        '#6b6b8d',
  accent:       '#7c3aed',
  accentHover:  '#6d28d9',
  accentGlow:   'rgba(124,58,237,0.35)',
  gold:         '#f5c842',
  goldDim:      'rgba(245,200,66,0.12)',
  danger:       '#ef4444',
  dangerDim:    'rgba(239,68,68,0.15)',
  warn:         '#f59e0b',
  warnDim:      'rgba(245,158,11,0.12)',
};

// ─── Keyframes injected once ─────────────────────────────────────────────────
const KEYFRAMES = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700&family=Rajdhani:wght@400;500;600&display=swap');

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes pulseBorder {
    0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0); }
    50%       { box-shadow: 0 0 0 3px rgba(124,58,237,0.25); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .lf-card {
    animation: fadeUp 0.55s cubic-bezier(0.16,1,0.3,1) both;
  }
  .lf-input:focus {
    outline: none;
    border-color: ${token.borderFocus} !important;
    box-shadow: 0 0 0 3px ${token.accentGlow}, inset 0 1px 2px rgba(0,0,0,0.4);
  }
  .lf-btn-primary:hover:not(:disabled) {
    background: ${token.accentHover} !important;
    box-shadow: 0 6px 24px ${token.accentGlow} !important;
    transform: translateY(-1px);
  }
  .lf-btn-primary:active:not(:disabled) {
    transform: translateY(0);
  }
  .lf-btn-ghost:hover {
    color: ${token.text} !important;
  }
  .lf-toggle:hover {
    color: ${token.muted} !important;
  }
  .lf-title {
    background: linear-gradient(90deg, ${token.gold}, #fff 40%, ${token.gold});
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 4s linear infinite;
  }
`;

function injectStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('lf-styles')) return;
  const el = document.createElement('style');
  el.id = 'lf-styles';
  el.textContent = KEYFRAMES;
  document.head.appendChild(el);
}

// ─── Sub-components ──────────────────────────────────────────────────────────
const Divider = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
    <div style={{ flex: 1, height: 1, background: token.border }} />
    <div style={{
      width: 6, height: 6, borderRadius: '50%',
      background: token.accent, boxShadow: `0 0 8px ${token.accentGlow}`,
    }} />
    <div style={{ flex: 1, height: 1, background: token.border }} />
  </div>
);

const Label = ({ htmlFor, children }) => (
  <label
    htmlFor={htmlFor}
    style={{
      display: 'block',
      marginBottom: 6,
      fontSize: 11,
      fontFamily: "'Rajdhani', sans-serif",
      fontWeight: 600,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: token.muted,
    }}
  >
    {children}
  </label>
);

const TextInput = ({ id, name, type = 'text', required, value, onChange, placeholder }) => (
  <input
    id={id}
    name={name}
    type={type}
    required={required}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    className="lf-input"
    style={{
      display: 'block',
      width: '100%',
      boxSizing: 'border-box',
      padding: '10px 14px',
      background: '#07070f',
      border: `1px solid ${token.border}`,
      borderRadius: 8,
      color: token.text,
      fontFamily: "'Rajdhani', sans-serif",
      fontSize: 15,
      fontWeight: 500,
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}
  />
);

// ─── Main component ───────────────────────────────────────────────────────────
const LoginForm = ({ onSwitchToSignup }) => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [serverUrl, setServerUrl] = useState('');
  const [showServerUrl, setShowServerUrl] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isLiveSite =
    typeof window !== 'undefined' && window.location.origin.includes('github.io');

  useEffect(() => {
    injectStyles();
    const stored = getStoredApiBaseUrl();
    setServerUrl(stored);
    if (isLiveSite) setShowServerUrl(true);
  }, [isLiveSite]);

  const { login, error, clearError } = useAuth();

  const handleServerUrlChange = (e) => {
    const value = e.target.value.trim();
    setServerUrl(e.target.value);
    setApiBaseUrl(value || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    clearError();
    const result = await login(credentials);
    if (!result.success) setIsLoading(false);
  };

  const handleChange = (e) =>
    setCredentials((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: token.bg,
        backgroundImage: `radial-gradient(ellipse 60% 50% at 50% 40%, rgba(124,58,237,0.08) 0%, transparent 70%)`,
        fontFamily: "'Rajdhani', sans-serif",
        padding: 24,
      }}
    >
      {/* Card */}
      <div
        className="lf-card"
        style={{
          width: '100%',
          maxWidth: 420,
          background: token.surface,
          border: `1px solid ${token.border}`,
          borderRadius: 16,
          padding: '40px 36px',
          boxShadow: `
            0 0 0 1px rgba(255,255,255,0.03) inset,
            0 32px 64px rgba(0,0,0,0.6),
            0 0 80px rgba(124,58,237,0.06)
          `,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {/* Decorative top accent */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            marginBottom: 16,
          }}>
            <div style={{ width: 28, height: 1, background: `linear-gradient(to right, transparent, ${token.gold})` }} />
            <div style={{
              width: 8, height: 8,
              background: token.gold,
              transform: 'rotate(45deg)',
              boxShadow: `0 0 12px ${token.gold}`,
            }} />
            <div style={{ width: 28, height: 1, background: `linear-gradient(to left, transparent, ${token.gold})` }} />
          </div>

          <h1
            className="lf-title"
            style={{
              margin: 0,
              fontSize: 26,
              fontFamily: "'Cinzel Decorative', cursive",
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}
          >
            1(800)BIZARRE
          </h1>
          <p style={{
            marginTop: 8,
            fontSize: 12,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: token.muted,
          }}>
            Sign in to your account
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Live-site warning */}
          {isLiveSite && !serverUrl && (
            <div style={{
              padding: '10px 14px',
              background: token.warnDim,
              border: `1px solid rgba(245,158,11,0.4)`,
              borderRadius: 8,
              fontSize: 12.5,
              color: '#fcd34d',
              lineHeight: 1.6,
            }}>
              Using the live site — set the Game server URL below (your host's backend, e.g.{' '}
              <code style={{ color: '#fde68a' }}>https://xxx.ngrok-free.app/api</code>).
              Host runs <code style={{ color: '#fde68a' }}>ngrok http 8000</code> and shares that URL.
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 14px',
              background: token.dangerDim,
              border: `1px solid rgba(239,68,68,0.4)`,
              borderRadius: 8,
              fontSize: 13,
              color: '#fca5a5',
              lineHeight: 1.6,
            }}>
              {error}
              {error.includes('Could not reach game server') && isLiveSite && (
                <p style={{ marginTop: 6, marginBottom: 0, fontSize: 12 }}>
                  Enter the host's URL above: <strong>https://</strong>their-ngrok-url
                  <strong>/api</strong> (host runs <code>ngrok http 8000</code>).
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
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                fontSize: 12,
                letterSpacing: '0.08em',
                color: '#4a4a6a',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'color 0.2s',
              }}
            >
              <span style={{
                display: 'inline-block',
                fontSize: 9,
                transition: 'transform 0.2s',
                transform: showServerUrl ? 'rotate(90deg)' : 'rotate(0deg)',
              }}>▶</span>
              Game server (optional)
            </button>

            {showServerUrl && (
              <div style={{ marginTop: 10 }}>
                <TextInput
                  type="url"
                  value={serverUrl}
                  onChange={handleServerUrlChange}
                  placeholder="https://xxx.ngrok-free.app/api"
                />
                <p style={{ marginTop: 6, marginBottom: 0, fontSize: 11.5, color: '#3d3d5c', lineHeight: 1.5 }}>
                  Leave blank for localhost. When playing remotely, the host runs the backend and shares their URL.
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
              width: '100%',
              padding: '12px 0',
              background: token.accent,
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 13,
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.55 : 1,
              transition: 'background 0.2s, box-shadow 0.2s, transform 0.15s',
              boxShadow: `0 4px 16px ${token.accentGlow}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {isLoading ? (
              <>
                <span style={{
                  display: 'inline-block',
                  width: 14, height: 14,
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  animation: 'spin 0.7s linear infinite',
                }} />
                Signing in…
              </>
            ) : 'Sign In'}
          </button>

          {/* Switch to signup */}
          <div style={{ textAlign: 'center', paddingTop: 4 }}>
            <button
              type="button"
              onClick={onSwitchToSignup}
              className="lf-btn-ghost"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12.5,
                color: '#5b5b7d',
                letterSpacing: '0.04em',
                transition: 'color 0.2s',
                padding: 0,
              }}
            >
              Don't have an account?{' '}
              <span style={{ color: token.accent, fontWeight: 600 }}>Sign up</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;

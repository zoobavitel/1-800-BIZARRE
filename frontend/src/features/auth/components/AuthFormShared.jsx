import React from 'react';

// ─── Design tokens ──────────────────────────────────────────────────────────
export const token = {
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

export function injectStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('lf-styles')) return;
  const el = document.createElement('style');
  el.id = 'lf-styles';
  el.textContent = KEYFRAMES;
  document.head.appendChild(el);
}

// ─── Sub-components ──────────────────────────────────────────────────────────
export const Divider = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
    <div style={{ flex: 1, height: 1, background: token.border }} />
    <div style={{
      width: 6, height: 6, borderRadius: '50%',
      background: token.accent, boxShadow: `0 0 8px ${token.accentGlow}`,
    }} />
    <div style={{ flex: 1, height: 1, background: token.border }} />
  </div>
);

export const Label = ({ htmlFor, children }) => (
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

export const TextInput = ({
  id,
  name,
  type = 'text',
  required,
  value,
  onChange,
  placeholder,
  hasError = false,
}) => (
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
      border: `1px solid ${hasError ? token.danger : token.border}`,
      borderRadius: 8,
      color: token.text,
      fontFamily: "'Rajdhani', sans-serif",
      fontSize: 15,
      fontWeight: 500,
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}
  />
);

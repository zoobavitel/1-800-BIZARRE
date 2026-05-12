import React from "react";

// ─── Design tokens (manga / JoJo-inspired: bold type, screentone, no fantasy chrome)
export const token = {
  bg: "#09090e",
  surface: "#101018",
  surfaceHover: "#16161f",
  border: "#2a2d38",
  borderFocus: "#c026d3",
  text: "#f4f4f5",
  muted: "#71717a",
  accent: "#a855f7",
  accentHover: "#9333ea",
  accentGlow: "rgba(168,85,247,0.35)",
  /** Pop yellow (title / accents), not “quest gold” */
  jojoYellow: "#facc15",
  gold: "#facc15",
  goldDim: "rgba(250,204,21,0.1)",
  danger: "#ef4444",
  dangerDim: "rgba(239,68,68,0.15)",
  warn: "#f59e0b",
  warnDim: "rgba(245,158,11,0.12)",
};

/** Full-viewport shell behind login / signup cards */
export const authPageShellStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: token.bg,
  backgroundImage: `
    radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0),
    linear-gradient(168deg, #09090e 0%, #111118 48%, #0c0e14 100%)
  `,
  backgroundSize: "22px 22px, 100% 100%",
  fontFamily: "'DM Sans', system-ui, sans-serif",
  padding: 24,
};

/** Top color break on auth cards (split yellow / purple) */
export function AuthCardTopStripe() {
  return (
    <div
      aria-hidden
      style={{
        margin: "-40px -36px 20px -36px",
        height: 5,
        background: `linear-gradient(90deg, ${token.jojoYellow} 0%, ${token.jojoYellow} 42%, ${token.accent} 42%, ${token.accent} 100%)`,
        borderRadius: "16px 16px 0 0",
      }}
    />
  );
}

// ─── Keyframes injected once ─────────────────────────────────────────────────
const KEYFRAMES = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@500;600;700&family=DM+Sans:wght@400;500;600&display=swap');

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulseBorder {
    0%, 100% { box-shadow: 0 0 0 0 rgba(192,38,211,0); }
    50%       { box-shadow: 0 0 0 3px rgba(192,38,211,0.22); }
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
    font-family: 'Bebas Neue', Impact, 'Arial Narrow', sans-serif;
    font-weight: 400;
    letter-spacing: 0.08em;
    line-height: 1.05;
    background: linear-gradient(
      95deg,
      #4ade80 0%,
      ${token.jojoYellow} 24%,
      #fb923c 48%,
      #f87171 72%,
      #c084fc 100%
    );
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 2px 0 rgba(0,0,0,0.9));
  }
`;

export function injectStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById("lf-auth-styles")) return;
  const el = document.createElement("style");
  el.id = "lf-auth-styles";
  el.textContent = KEYFRAMES;
  document.head.appendChild(el);
}

// ─── Sub-components ──────────────────────────────────────────────────────────
export const Divider = () => (
  <div
    style={{
      height: 2,
      margin: "6px 0",
      background: `linear-gradient(90deg, transparent 0%, ${token.border} 12%, ${token.border} 88%, transparent 100%)`,
      borderRadius: 1,
    }}
  />
);

export const Label = ({ htmlFor, children }) => (
  <label
    htmlFor={htmlFor}
    style={{
      display: "block",
      marginBottom: 6,
      fontSize: 11,
      fontFamily: "'Oswald', sans-serif",
      fontWeight: 600,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: token.muted,
    }}
  >
    {children}
  </label>
);

export const TextInput = ({
  id,
  name,
  type = "text",
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
      display: "block",
      width: "100%",
      boxSizing: "border-box",
      padding: "10px 14px",
      background: "#07070f",
      border: `1px solid ${hasError ? token.danger : token.border}`,
      borderRadius: 8,
      color: token.text,
      fontFamily: "'DM Sans', sans-serif",
      fontSize: 15,
      fontWeight: 500,
      transition: "border-color 0.2s, box-shadow 0.2s",
    }}
  />
);

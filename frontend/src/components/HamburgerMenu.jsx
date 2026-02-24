import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Menu, X } from 'lucide-react';

// ── Palette & tokens ─────────────────────────────────────────────────────────
const C = {
  bg:        '#111827',
  bgSidebar: '#0f1623',
  bgHover:   '#1e2d3d',
  bgActive:  '#1c3148',
  border:    '#1f2d40',
  accent:    '#e07b39',
  accentDim: '#c0622a',
  textPrimary: '#e2e8f0',
  textSecondary: '#94a3b8',
  textDisabled:  '#4b5563',
  textDanger:    '#e57373',
  switchOn:  '#4f8ef7',
  appBtn:    '#1a2535',
  appBtnActive: '#0f1e30',
};

// ── Inline style helpers ──────────────────────────────────────────────────────
const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 999,
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(2px)',
  },
  sidebar: {
    position: 'fixed', top: 0, left: 0, bottom: 0,
    width: '232px',
    zIndex: 1000,
    background: C.bgSidebar,
    borderRight: `1px solid ${C.border}`,
    display: 'flex', flexDirection: 'column',
    overflowY: 'auto',
    fontFamily: "'Roboto Mono', 'Consolas', monospace",
    transition: 'transform 0.22s cubic-bezier(.4,0,.2,1)',
    boxShadow: '4px 0 24px rgba(0,0,0,0.5)',
  },
  appSwitcher: {
    display: 'flex', gap: '8px',
    padding: '14px 12px 10px',
    borderBottom: `1px solid ${C.border}`,
  },
  appBtn: (active) => ({
    flex: 1, display: 'flex', alignItems: 'center', gap: '7px',
    padding: '8px 8px',
    background: active ? C.appBtnActive : C.appBtn,
    border: `1px solid ${active ? C.accent : C.border}`,
    borderRadius: '6px',
    cursor: 'pointer', color: active ? C.textPrimary : C.textSecondary,
    fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.04em',
    fontFamily: 'inherit',
    textTransform: 'uppercase',
    transition: 'all 0.15s',
  }),
  appBtnIcon: (active) => ({
    width: '26px', height: '26px', borderRadius: '50%',
    background: active ? C.accent : '#2a3a4a',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '10px', fontWeight: 'bold', color: '#fff', flexShrink: 0,
  }),
  meta: {
    padding: '10px 14px 8px',
    borderBottom: `1px solid ${C.border}`,
    fontSize: '11px', color: C.textSecondary,
    lineHeight: '1.6',
  },
  metaTag: {
    display: 'inline-block',
    background: '#1e2d40',
    border: `1px solid ${C.border}`,
    borderRadius: '3px',
    padding: '1px 6px',
    fontSize: '10px', color: C.textSecondary,
  },
  toggleRow: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 14px',
    borderBottom: `1px solid ${C.border}`,
  },
  scrollBody: {
    flex: 1, overflowY: 'auto', padding: '0 0 8px',
  },
  section: {
    padding: '10px 14px 4px',
  },
  sectionHeader: {
    fontSize: '10px', fontWeight: 'bold',
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: C.accent, marginBottom: '4px',
    padding: '0 2px',
  },
  item: (disabled, active) => ({
    display: 'block', width: '100%',
    padding: '6px 10px',
    background: active ? C.bgActive : 'transparent',
    border: 'none', borderRadius: '4px',
    color: disabled ? C.textDisabled : C.textPrimary,
    fontSize: '12px', cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit', textAlign: 'left',
    transition: 'background 0.12s, color 0.12s',
    letterSpacing: '0.01em',
    lineHeight: '1.4',
  }),
  select: {
    width: '100%', marginTop: '4px',
    padding: '5px 8px',
    background: '#1a2535',
    border: `1px solid ${C.border}`,
    borderRadius: '4px',
    color: C.textSecondary,
    fontSize: '11px',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  divider: {
    height: '1px',
    background: C.border,
    margin: '4px 14px',
  },
  footer: {
    padding: '10px 14px',
    borderTop: `1px solid ${C.border}`,
    fontSize: '10px', color: C.textDanger,
    letterSpacing: '0.03em',
  },
  hamburger: {
    background: 'transparent', border: 'none',
    cursor: 'pointer', color: C.textPrimary,
    padding: '6px', lineHeight: 0,
  },
};

// ── Toggle Switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: '36px', height: '20px', borderRadius: '10px', border: 'none',
        background: checked ? C.switchOn : '#374151',
        cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s', flexShrink: 0,
        padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: '3px',
        left: checked ? '18px' : '3px',
        width: '14px', height: '14px', borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.18s',
        display: 'block',
      }} />
    </button>
  );
}

// ── Menu Item ─────────────────────────────────────────────────────────────────
function MenuItem({ label, disabled, active, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      style={{
        ...styles.item(disabled, active),
        background: hovered && !disabled ? C.bgHover : active ? C.bgActive : 'transparent',
        color: disabled ? C.textDisabled : hovered || active ? C.textPrimary : C.textPrimary,
      }}
      disabled={disabled}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={!disabled ? onClick : undefined}
    >
      {label}
    </button>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>{title}</div>
      {children}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function HamburgerMenu({
  open,
  onToggle,
  onClose,
  currentPage,
  onPageChange,
  characters = [],
  onSelectCharacter,
  onNewCharacter,
  hideBuiltInButton = false,
  isAuthenticated = false,
  onLogin,
  onLogout,
  appVersion = '104',
  disabledRulebooksCount = 166,
}) {
  const [darkMode, setDarkMode] = useState(true);
  const [activeApp, setActiveApp] = useState('pathbuilder');

  const handleNav = (page, payload) => {
    onPageChange?.(page, payload);
    onClose?.();
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && open) onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const sidebar = (
    <>
      {/* Overlay */}
      {open && (
        <div style={styles.overlay} onClick={onClose} />
      )}

      {/* Sidebar panel */}
      <div style={{
        ...styles.sidebar,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
      }}>

        {/* ── App Switcher ── */}
        <div style={styles.appSwitcher}>
          {[
            { id: 'pathbuilder', label: 'Pathbuilder\n2E', short: 'PB' },
            { id: 'starbuilder',  label: 'Starbuilder\n2E',  short: 'SB' },
          ].map(({ id, label, short }) => (
            <button
              key={id}
              style={styles.appBtn(activeApp === id)}
              onClick={() => setActiveApp(id)}
            >
              <span style={styles.appBtnIcon(activeApp === id)}>{short}</span>
              <span style={{ whiteSpace: 'pre-line', lineHeight: '1.3' }}>{label}</span>
            </button>
          ))}
        </div>

        {/* ── Meta info ── */}
        <div style={styles.meta}>
          <div>Web Version {appVersion}</div>
          <div style={{ marginTop: '2px' }}>
            Remaster: <span style={styles.metaTag}>On</span>
          </div>
        </div>

        {/* ── Dark / Light toggle ── */}
        <div style={styles.toggleRow}>
          <Toggle checked={!darkMode} onChange={(v) => setDarkMode(!v)} />
          <span style={{ fontSize: '12px', color: C.textSecondary }}>
            {darkMode ? 'Dark' : 'Light'}
          </span>
        </div>

        {/* ── Scrollable body ── */}
        <div style={styles.scrollBody}>

          <Section title="Account">
            {isAuthenticated ? (
              <>
                <MenuItem label="Signed in" disabled />
                {typeof onLogout === 'function' && (
                  <MenuItem label="Sign Out" onClick={() => { onLogout(); onClose?.(); }} />
                )}
              </>
            ) : (
              <MenuItem label="Login" onClick={() => { onLogin?.(); onClose?.(); }} />
            )}
          </Section>

          <div style={styles.divider} />

          <Section title="Character">
            <MenuItem label="Character Options" onClick={() => handleNav('character-options')} />
            <MenuItem label="New Character" onClick={() => { onNewCharacter?.(); onClose?.(); }} />
            <MenuItem label="Save Character (Local)" onClick={() => handleNav('save')} />
            {characters.length > 0 ? (
              <div style={{ padding: '4px 2px 0' }}>
                <select
                  style={styles.select}
                  defaultValue=""
                  onChange={(e) => {
                    const id = e.target.value ? parseInt(e.target.value, 10) : null;
                    if (id != null) { onSelectCharacter?.(id); onClose?.(); }
                    e.target.value = '';
                  }}
                >
                  <option value="" disabled>Open Character…</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>{c.name || 'Unnamed'}</option>
                  ))}
                </select>
              </div>
            ) : (
              <MenuItem label="Open Character" disabled />
            )}
          </Section>

          <div style={styles.divider} />

          <Section title="Connect">
            <MenuItem label="Connect to GM" onClick={() => handleNav('connect-gm')} />
            <MenuItem label="Launch GM Mode" disabled />
          </Section>

          <div style={styles.divider} />

          <Section title="Export">
            <MenuItem label="Character Sheet PDF" onClick={() => handleNav('export-pdf')} />
            <MenuItem label="Stat Block PDF" onClick={() => handleNav('stat-pdf')} />
            <MenuItem label="Export JSON" onClick={() => handleNav('export-json')} />
            <MenuItem label="Share Copy of Character" onClick={() => handleNav('share')} />
          </Section>

          <div style={styles.divider} />

          <Section title="Data">
            <MenuItem label="Backup/Restore" onClick={() => handleNav('backup')} />
            <MenuItem label="Campaign Management" active={currentPage === 'campaigns'} onClick={() => handleNav('campaigns')} />
            <MenuItem label="Ability Browser" active={currentPage === 'abilities'} onClick={() => handleNav('abilities')} />
            <MenuItem label="Remaster Information" onClick={() => handleNav('remaster')} />
          </Section>

          <div style={styles.divider} />

          <Section title="Custom">
            <MenuItem label="Custom Pack" disabled />
            <MenuItem label="Custom Ability Increases" disabled />
            <MenuItem label="Custom Feat Choice" disabled />
            <MenuItem label="Custom Skill Increases" disabled />
          </Section>

          <div style={styles.divider} />

          <Section title="Help">
            <MenuItem label="Help" onClick={() => handleNav('help')} />
            <MenuItem label="Licenses" onClick={() => handleNav('licenses')} />
            <MenuItem label="Patch Notes" onClick={() => handleNav('patch-notes')} />
            <MenuItem label="Report Error" onClick={() => handleNav('report-error')} />
          </Section>

          <div style={styles.divider} />

          <Section title="Navigation">
            <MenuItem label="Home"       active={currentPage === 'home'}      onClick={() => handleNav('home')} />
            <MenuItem label="Characters" active={currentPage === 'character'} onClick={() => handleNav('character')} />
            <MenuItem label="GM — NPCs"  active={currentPage === 'npcs'}      onClick={() => handleNav('npcs')} />
            <MenuItem label="Responsive Test" active={currentPage === 'test'} onClick={() => handleNav('test')} />
          </Section>
        </div>

        {/* ── Footer ── */}
        <div style={styles.footer}>
          {disabledRulebooksCount} disabled rulebook(s)
        </div>
      </div>
    </>
  );

  return (
    <>
      {!hideBuiltInButton && (
        <button style={styles.hamburger} onClick={onToggle} aria-label="Toggle menu">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      )}
      {typeof document !== 'undefined' && createPortal(sidebar, document.body)}
    </>
  );
}

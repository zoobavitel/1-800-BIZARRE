import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Menu, X } from 'lucide-react';

const MENU_GROUP_HEADER = {
  fontSize: '10px',
  fontWeight: 'bold',
  letterSpacing: '0.05em',
  color: '#d97706',
  marginBottom: '6px',
  marginTop: '1rem',
  textTransform: 'uppercase',
};
const MENU_GROUP = { marginBottom: '0.5rem' };
const SIDENAV_LINK = {
  display: 'block',
  width: '100%',
  padding: '8px 12px',
  textAlign: 'left',
  background: 'transparent',
  border: 'none',
  borderRadius: '4px',
  color: '#e5e7eb',
  fontSize: '13px',
  cursor: 'pointer',
  fontFamily: 'monospace',
};
const SIDENAV_LINK_GREY = { ...SIDENAV_LINK, color: '#6b7280', cursor: 'default' };
const LINK_HOVER = { background: '#374151', color: '#fff' };

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
  isAuthenticated = true,
  onLogout,
  appVersion = '1.0',
}) {
  const [darkMode, setDarkMode] = useState(true);

  const handleNav = (page, payload) => {
    onPageChange(page, payload);
    onClose();
  };

  const linkProps = (onClick) => ({
    style: SIDENAV_LINK,
    onMouseOver: (e) => Object.assign(e.target.style, LINK_HOVER),
    onMouseOut: (e) => Object.assign(e.target.style, SIDENAV_LINK),
    onClick: () => {
      if (onClick) onClick();
      onClose();
    },
  });

  const menuButton = (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Toggle menu"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
      style={{ fontFamily: 'monospace' }}
    >
      {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
    </button>
  );

  const sidebar = (
    <>
      <div
        className="fixed inset-0 z-[90] bg-black/50 transition-opacity duration-200 ease-out"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed top-0 left-0 z-[95] w-72 max-w-[85vw] h-full bg-gray-900 border-r border-gray-700 shadow-xl overflow-y-auto transition-[transform] duration-250 ease-out"
        style={{
          paddingTop: '3.5rem',
          paddingLeft: '12px',
          paddingRight: '12px',
          paddingBottom: '24px',
          fontFamily: 'monospace',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          pointerEvents: open ? 'auto' : 'none',
        }}
        role="dialog"
        aria-label="Main menu"
        aria-hidden={!open}
      >
        <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '1em' }}>Web Version {appVersion}</p>
        <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '1em' }}>Remaster: On</div>
        <div style={{ marginBottom: '1em' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#e5e7eb' }}>
            <input
              type="checkbox"
              checked={!darkMode}
              onChange={(e) => setDarkMode(!e.target.checked)}
              style={{ width: '36px', height: '20px', accentColor: '#6366f1' }}
            />
            <span>{darkMode ? 'Dark' : 'Light'}</span>
          </label>
        </div>

        <div style={MENU_GROUP_HEADER}>Signin</div>
        <div style={MENU_GROUP}>
          {isAuthenticated && typeof onLogout === 'function' ? (
            <button type="button" {...linkProps(onLogout)}>Logout</button>
          ) : (
            <button type="button" {...linkProps(() => handleNav('home'))}>Login and Upgrade App</button>
          )}
        </div>

        <div style={MENU_GROUP_HEADER}>Character</div>
        <div style={MENU_GROUP}>
          <button type="button" {...linkProps()}>Character Options</button>
          <button type="button" {...linkProps(onNewCharacter)}>New Character</button>
          <button type="button" {...linkProps()}>Save Character (Local)</button>
          {characters.length > 0 && (
            <div style={{ marginTop: '4px' }}>
              <label htmlFor="menu-open-character" style={{ fontSize: '11px', color: '#9ca3af', display: 'block', marginBottom: '4px' }}>Open Character</label>
              <select
                id="menu-open-character"
                style={{ width: '100%', padding: '8px 10px', background: '#1f2937', border: '1px solid #4b5563', borderRadius: '4px', color: '#e5e7eb', fontSize: '13px', cursor: 'pointer' }}
                value=""
                onChange={(e) => {
                  const id = e.target.value ? parseInt(e.target.value, 10) : null;
                  if (id != null) onSelectCharacter(id);
                  e.target.value = '';
                  onClose();
                }}
              >
                <option value="">Select a character…</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name || 'Unnamed'}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div style={MENU_GROUP_HEADER}>Connect</div>
        <div style={MENU_GROUP}>
          <button type="button" {...linkProps()}>Connect to GM</button>
          <button type="button" style={SIDENAV_LINK_GREY}>Launch GM Mode</button>
        </div>

        <div style={MENU_GROUP_HEADER}>Export</div>
        <div style={MENU_GROUP}>
          <button type="button" {...linkProps()}>Character Sheet PDF</button>
          <button type="button" {...linkProps()}>Stat Block PDF</button>
          <button type="button" {...linkProps()}>Export JSON</button>
          <button type="button" {...linkProps()}>Share Copy of Character</button>
        </div>

        <div style={MENU_GROUP_HEADER}>Data</div>
        <div style={MENU_GROUP}>
          <button type="button" {...linkProps()}>Backup/Restore</button>
          <button type="button" {...linkProps(() => handleNav('home'))}>Campaign Management</button>
          <button type="button" {...linkProps()}>Feat Browser</button>
          <button type="button" {...linkProps()}>Remaster Information</button>
        </div>

        <div style={MENU_GROUP_HEADER}>Custom</div>
        <div style={MENU_GROUP}>
          <span style={SIDENAV_LINK_GREY}>Custom Pack</span>
          <span style={SIDENAV_LINK_GREY}>Custom Ability Increases</span>
          <span style={SIDENAV_LINK_GREY}>Custom Feat Choice</span>
          <span style={SIDENAV_LINK_GREY}>Custom Skill Increases</span>
        </div>

        <div style={MENU_GROUP_HEADER}>Help</div>
        <div style={MENU_GROUP}>
          <button type="button" {...linkProps()}>Help</button>
          <button type="button" {...linkProps()}>Licenses</button>
          <button type="button" {...linkProps()}>Patch Notes</button>
          <button type="button" {...linkProps()}>Report Error</button>
        </div>

        <div style={MENU_GROUP_HEADER}>Navigation</div>
        <div style={MENU_GROUP}>
          <button type="button" style={{ ...SIDENAV_LINK, ...(currentPage === 'home' ? LINK_HOVER : {}) }} onMouseOver={(e) => { if (currentPage !== 'home') Object.assign(e.target.style, LINK_HOVER); }} onMouseOut={(e) => { if (currentPage !== 'home') Object.assign(e.target.style, SIDENAV_LINK); }} onClick={() => handleNav('home')}>Home</button>
          <button type="button" style={{ ...SIDENAV_LINK, ...(currentPage === 'character' ? LINK_HOVER : {}) }} onMouseOver={(e) => { if (currentPage !== 'character') Object.assign(e.target.style, LINK_HOVER); }} onMouseOut={(e) => { if (currentPage !== 'character') Object.assign(e.target.style, SIDENAV_LINK); }} onClick={() => handleNav('character')}>Characters</button>
          <button type="button" style={{ ...SIDENAV_LINK, ...(currentPage === 'npcs' ? LINK_HOVER : {}) }} onMouseOver={(e) => { if (currentPage !== 'npcs') Object.assign(e.target.style, LINK_HOVER); }} onMouseOut={(e) => { if (currentPage !== 'npcs') Object.assign(e.target.style, SIDENAV_LINK); }} onClick={() => handleNav('npcs')}>GM — NPCs</button>
          <button type="button" style={{ ...SIDENAV_LINK, ...(currentPage === 'test' ? LINK_HOVER : {}) }} onMouseOver={(e) => { if (currentPage !== 'test') Object.assign(e.target.style, LINK_HOVER); }} onMouseOut={(e) => { if (currentPage !== 'test') Object.assign(e.target.style, SIDENAV_LINK); }} onClick={() => handleNav('test')}>Responsive Test</button>
        </div>
      </aside>
    </>
  );

  return (
    <>
      {!hideBuiltInButton && (
        <div className="fixed top-4 left-4 z-[100]">{menuButton}</div>
      )}
      {typeof document !== 'undefined' && createPortal(sidebar, document.body)}
    </>
  );
}

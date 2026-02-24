import React from 'react';
import { Menu, X } from 'lucide-react';

const SECTION_STYLE = {
  marginBottom: '1rem',
};
const SECTION_TITLE = {
  fontSize: '10px',
  fontWeight: 'bold',
  letterSpacing: '0.05em',
  color: '#d97706',
  marginBottom: '6px',
  textTransform: 'uppercase',
};
const ITEM = {
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
const ITEM_HOVER = { background: '#374151', color: '#fff' };

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
}) {
  const handleNav = (page, payload) => {
    onPageChange(page, payload);
    onClose();
  };

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

  return (
    <>
      {!hideBuiltInButton && (
        <div className="fixed top-4 left-4 z-[100]">{menuButton}</div>
      )}

      {open && (
        <>
          <div
            className="fixed inset-0 z-[90] bg-black/50"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside
            className="fixed top-0 left-0 z-[95] w-72 max-w-[85vw] h-full bg-gray-900 border-r border-gray-700 shadow-xl overflow-y-auto"
            style={{ paddingTop: '3.5rem', paddingLeft: '12px', paddingRight: '12px', paddingBottom: '24px', fontFamily: 'monospace' }}
            role="dialog"
            aria-label="Main menu"
          >
            <div style={SECTION_STYLE}>
              <div style={SECTION_TITLE}>Character</div>
              <button
                type="button"
                style={ITEM}
                onMouseOver={(e) => Object.assign(e.target.style, ITEM_HOVER)}
                onMouseOut={(e) => Object.assign(e.target.style, ITEM)}
                onClick={() => { onNewCharacter(); onClose(); }}
              >
                New Character
              </button>
              {characters.length > 0 && (
                <div style={{ marginTop: '4px' }}>
                  <label htmlFor="menu-open-character" style={{ fontSize: '11px', color: '#9ca3af', display: 'block', marginBottom: '4px' }}>
                    Open Character
                  </label>
                  <select
                    id="menu-open-character"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: '#1f2937',
                      border: '1px solid #4b5563',
                      borderRadius: '4px',
                      color: '#e5e7eb',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
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

            <div style={SECTION_STYLE}>
              <div style={SECTION_TITLE}>Navigation</div>
              <button
                type="button"
                style={{ ...ITEM, ...(currentPage === 'home' ? ITEM_HOVER : {}) }}
                onMouseOver={(e) => { if (currentPage !== 'home') Object.assign(e.target.style, ITEM_HOVER); }}
                onMouseOut={(e) => { if (currentPage !== 'home') Object.assign(e.target.style, ITEM); }}
                onClick={() => handleNav('home')}
              >
                Home
              </button>
              <button
                type="button"
                style={{ ...ITEM, ...(currentPage === 'character' ? ITEM_HOVER : {}) }}
                onMouseOver={(e) => { if (currentPage !== 'character') Object.assign(e.target.style, ITEM_HOVER); }}
                onMouseOut={(e) => { if (currentPage !== 'character') Object.assign(e.target.style, ITEM); }}
                onClick={() => handleNav('character')}
              >
                Characters
              </button>
              <button
                type="button"
                style={{ ...ITEM, ...(currentPage === 'npcs' ? ITEM_HOVER : {}) }}
                onMouseOver={(e) => { if (currentPage !== 'npcs') Object.assign(e.target.style, ITEM_HOVER); }}
                onMouseOut={(e) => { if (currentPage !== 'npcs') Object.assign(e.target.style, ITEM); }}
                onClick={() => handleNav('npcs')}
              >
                GM — NPCs
              </button>
              <button
                type="button"
                style={{ ...ITEM, ...(currentPage === 'test' ? ITEM_HOVER : {}) }}
                onMouseOver={(e) => { if (currentPage !== 'test') Object.assign(e.target.style, ITEM_HOVER); }}
                onMouseOut={(e) => { if (currentPage !== 'test') Object.assign(e.target.style, ITEM); }}
                onClick={() => handleNav('test')}
              >
                Responsive Test
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, MessageSquare, Settings, LogOut } from 'lucide-react';

const C = {
  bgSidebar: '#0f1623',
  bgHover: '#1e2d3d',
  border: '#1f2d40',
  textPrimary: '#e2e8f0',
  textSecondary: '#94a3b8',
  textDanger: '#e57373',
};

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 999,
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(2px)',
  },
  sidebar: {
    position: 'fixed', top: 0, right: 0, bottom: 0,
    width: '232px',
    zIndex: 1000,
    background: C.bgSidebar,
    borderLeft: `1px solid ${C.border}`,
    display: 'flex', flexDirection: 'column',
    overflowY: 'auto',
    fontFamily: "'Roboto Mono', 'Consolas', monospace",
    transition: 'transform 0.22s cubic-bezier(.4,0,.2,1)',
    boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
  },
  section: { padding: '10px 14px 4px' },
  sectionHeader: {
    fontSize: '10px', fontWeight: 'bold',
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: C.textSecondary, marginBottom: '8px', padding: '0 2px',
  },
  item: {
    display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
    padding: '10px 12px',
    background: 'transparent', border: 'none', borderRadius: '4px',
    color: C.textPrimary, fontSize: '13px', cursor: 'pointer',
    fontFamily: 'inherit', textAlign: 'left',
    transition: 'background 0.12s',
  },
  itemDanger: {
    color: C.textDanger,
  },
};

function MenuItem({ icon: Icon, label, onClick, danger }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      style={{
        ...styles.item,
        ...(danger ? styles.itemDanger : {}),
        background: hovered ? C.bgHover : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {Icon && <Icon size={18} style={{ flexShrink: 0 }} />}
      {label}
    </button>
  );
}

export default function UserMenu({
  open,
  onClose,
  onNavigateToNotifications,
  onNavigateToMessages,
  onNavigateToAccountSettings,
  onLogout,
}) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && open) onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleNav = (fn) => {
    if (typeof fn === 'function') fn();
    onClose?.();
  };

  const panel = (
    <>
      {open && <div style={styles.overlay} onClick={onClose} aria-hidden="true" />}
      <div
        style={{
          ...styles.sidebar,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
        }}
        role="dialog"
        aria-label="User menu"
      >
        <div style={{ padding: '16px 14px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: C.textSecondary, letterSpacing: '0.05em' }}>
            USER MENU
          </div>
        </div>
        <div style={styles.section}>
          <div style={styles.sectionHeader}>Account</div>
          <MenuItem
            icon={Bell}
            label="Notifications"
            onClick={() => handleNav(onNavigateToNotifications)}
          />
          <MenuItem
            icon={MessageSquare}
            label="Messages"
            onClick={() => handleNav(onNavigateToMessages)}
          />
          <MenuItem
            icon={Settings}
            label="Account Settings"
            onClick={() => handleNav(onNavigateToAccountSettings)}
          />
          <MenuItem
            icon={LogOut}
            label="Sign Out"
            danger
            onClick={() => { if (typeof onLogout === 'function') onLogout(); onClose?.(); }}
          />
        </div>
      </div>
    </>
  );

  return typeof document !== 'undefined' ? createPortal(panel, document.body) : null;
}

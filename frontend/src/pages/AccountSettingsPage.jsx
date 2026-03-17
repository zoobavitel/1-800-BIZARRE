import React, { useState, useEffect } from 'react';
import { authAPI } from '../features/auth/services/authService';
import { useTheme } from '../features/theme/ThemeContext';

// Dark mode format (same as Character Sheet, Character Options)
const S = {
  page: { fontFamily: 'monospace', fontSize: '13px', background: '#000', color: '#fff', minHeight: '100vh' },
  hdr: { background: '#1f2937', padding: '8px 16px', borderBottom: '1px solid #4b5563', position: 'sticky', top: 0, zIndex: 10 },
  content: { padding: '16px', maxWidth: '800px', margin: '0 auto' },
  section: { marginBottom: '32px' },
  sectionTitle: {
    fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px',
    color: '#e2e8f0', borderBottom: '1px solid #374151', paddingBottom: '8px', marginBottom: '16px',
  },
  card: {
    background: '#111827', border: '1px solid #374151', borderRadius: '4px', padding: '12px', marginBottom: '8px',
  },
  lbl: { color: '#f87171', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', display: 'block' },
  inp: {
    background: 'transparent', color: '#fff', border: 'none', borderBottom: '1px solid #4b5563',
    padding: '6px 10px', width: '100%', fontFamily: 'monospace', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  },
  textarea: {
    background: '#111827', color: '#fff', border: '1px solid #374151', borderRadius: '4px',
    padding: '8px 10px', width: '100%', fontFamily: 'monospace', fontSize: '13px', outline: 'none',
    minHeight: '80px', resize: 'vertical',
  },
  toggle: (on) => ({
    width: '40px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer',
    background: on ? '#4f8ef7' : '#374151', color: '#fff' /* inner knob */,
  }),
  btn: {
    padding: '8px 16px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', border: 'none',
    fontFamily: 'monospace', background: '#7c3aed', color: '#fff',
  },
  tab: (active) => ({
    padding: '6px 14px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer',
    border: `1px solid ${active ? '#4b5563' : '#374151'}`,
    background: active ? '#374151' : 'transparent', color: active ? '#fff' : '#9ca3af',
    fontFamily: 'monospace',
  }),
};

export default function AccountSettingsPage({ onBack }) {
  const { theme, setTheme } = useTheme();
  const [signature, setSignature] = useState('');
  const [showAvatars, setShowAvatars] = useState(true);
  const [showSignatures, setShowSignatures] = useState(true);
  const [displayTitle, setDisplayTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  useEffect(() => {
    authAPI.getProfile()
      .then((p) => {
        if (p) {
          setSignature(p.signature ?? '');
          setDisplayTitle(p.display_title ?? '');
          setShowAvatars(p.show_avatars !== false);
          setShowSignatures(p.show_signatures !== false);
          if (p.theme && (p.theme === 'dark' || p.theme === 'light')) setTheme(p.theme);
        }
      })
      .catch(() => {});
  }, [setTheme]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      await authAPI.updateProfile({
        signature,
        display_title: displayTitle,
        show_avatars: showAvatars,
        show_signatures: showSignatures,
        theme,
      });
      setSaveMessage('Saved');
    } catch (err) {
      setSaveMessage(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.hdr}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                padding: '6px 12px', border: '1px solid #4b5563', borderRadius: '4px',
                background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontFamily: 'monospace', fontSize: '12px',
              }}
            >
              ← Back
            </button>
          )}
          <span style={{ fontSize: '18px', fontWeight: 'bold' }}>1(800)BIZARRE — ACCOUNT SETTINGS</span>
        </div>
      </div>
      <div style={S.content}>
        <section style={S.section}>
          <h2 style={S.sectionTitle}>Profile</h2>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Show avatars</span>
              <button
                type="button"
                style={S.toggle(showAvatars)}
                onClick={() => setShowAvatars(!showAvatars)}
                aria-label={showAvatars ? 'Hide avatars' : 'Show avatars'}
              >
                <span style={{ display: 'block', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', marginLeft: showAvatars ? '20px' : '2px', marginTop: '2px', transition: 'margin-left 0.2s' }} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Show signatures</span>
              <button
                type="button"
                style={S.toggle(showSignatures)}
                onClick={() => setShowSignatures(!showSignatures)}
                aria-label={showSignatures ? 'Hide signatures' : 'Show signatures'}
              >
                <span style={{ display: 'block', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', marginLeft: showSignatures ? '20px' : '2px', marginTop: '2px', transition: 'margin-left 0.2s' }} />
              </button>
            </div>
          </div>
        </section>

        <section style={S.section}>
          <h2 style={S.sectionTitle}>Theme / Appearance</h2>
          <div style={S.card}>
            <label style={S.lbl}>Color theme</label>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                style={S.tab(theme === 'dark')}
                onClick={() => setTheme('dark')}
              >
                Dark mode
              </button>
              <button
                style={S.tab(theme === 'light')}
                onClick={() => setTheme('light')}
              >
                Light mode
              </button>
            </div>
          </div>
        </section>

        <section style={S.section}>
          <h2 style={S.sectionTitle}>Notification Settings</h2>
          <div style={S.card}>
            <div style={{ color: '#9ca3af', fontSize: '12px' }}>
              Notification settings will be available in a future update.
            </div>
          </div>
        </section>

        <section style={S.section}>
          <button style={S.btn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          {saveMessage && (
            <span style={{ marginLeft: '12px', fontSize: '12px', color: saveMessage === 'Saved' ? '#34d399' : '#f87171' }}>
              {saveMessage}
            </span>
          )}
        </section>
      </div>
    </div>
  );
}

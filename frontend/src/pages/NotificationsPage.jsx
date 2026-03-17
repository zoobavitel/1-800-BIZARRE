import React from 'react';

const S = {
  page: { fontFamily: 'monospace', fontSize: '13px', background: '#000', color: '#fff', minHeight: '100vh' },
  hdr: { background: '#1f2937', padding: '8px 16px', borderBottom: '1px solid #4b5563', position: 'sticky', top: 0, zIndex: 10 },
  content: { padding: '16px', maxWidth: '1000px', margin: '0 auto' },
  emptyState: { textAlign: 'center', padding: '48px 16px', color: '#6b7280' },
};

export default function NotificationsPage({ onBack }) {
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
          <span style={{ fontSize: '18px', fontWeight: 'bold' }}>1(800)BIZARRE — NOTIFICATIONS</span>
        </div>
      </div>
      <div style={S.content}>
        <div style={S.emptyState}>No notifications yet.</div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { referenceAPI } from '../features/character-sheet';

const S = {
  page:  { fontFamily: 'monospace', fontSize: '13px', background: '#000', color: '#fff', minHeight: '100vh' },
  content: { padding: '16px', maxWidth: '1000px', margin: '0 auto' },
  card: { background: '#111827', border: '1px solid #374151', borderRadius: '4px', padding: '12px', marginBottom: '8px' },
  btn: { padding: '6px 14px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', border: 'none', fontFamily: 'monospace' },
  sel: { background: '#374151', color: '#fff', border: '1px solid #4b5563', padding: '5px 10px', fontSize: '12px', fontFamily: 'monospace', borderRadius: '4px' },
  searchInput: {
    background: '#0d1117', color: '#fff', border: '1px solid #374151', borderRadius: '4px',
    padding: '6px 10px', fontFamily: 'monospace', fontSize: '13px', outline: 'none', width: '260px', boxSizing: 'border-box',
  },
  tag: (color) => ({
    display: 'inline-block', padding: '1px 7px', borderRadius: '10px',
    fontSize: '10px', fontWeight: 'bold', background: color, color: '#fff', marginLeft: '6px',
  }),
  emptyState: { textAlign: 'center', padding: '48px 16px', color: '#6b7280' },
};

const TYPE_COLORS = {
  standard: '#1d4ed8',
  hamon:    '#b45309',
  spin:     '#7c3aed',
};

export default function AbilityBrowser() {
  const [abilities, setAbilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      referenceAPI.getAbilities().catch(() => []),
      referenceAPI.getHamonAbilities().catch(() => []),
      referenceAPI.getSpinAbilities().catch(() => []),
    ]).then(([standard, hamon, spin]) => {
      if (cancelled) return;
      const tagged = [
        ...(standard || []).map((a) => ({ ...a, type: 'standard' })),
        ...(hamon || []).map((a) => ({ ...a, type: 'hamon' })),
        ...(spin || []).map((a) => ({ ...a, type: 'spin' })),
      ];
      setAbilities(tagged);
      setLoading(false);
    }).catch((err) => {
      if (!cancelled) {
        setError(err.message || 'Failed to load abilities');
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, []);

  const filtered = abilities.filter((a) => {
    if (filter !== 'all' && a.type !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const name = (a.name || '').toLowerCase();
      const desc = (a.description || '').toLowerCase();
      if (!name.includes(q) && !desc.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    all: abilities.length,
    standard: abilities.filter((a) => a.type === 'standard').length,
    hamon: abilities.filter((a) => a.type === 'hamon').length,
    spin: abilities.filter((a) => a.type === 'spin').length,
  };

  return (
    <div style={S.page}>
      <div style={S.content}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
          <input
            style={S.searchInput}
            placeholder="Search abilities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <nav style={{ display: 'flex', gap: '4px' }}>
            {['all', 'standard', 'hamon', 'spin'].map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                style={{
                  ...S.btn,
                  background: filter === t ? (TYPE_COLORS[t] || '#374151') : 'transparent',
                  color: filter === t ? '#fff' : '#9ca3af',
                  border: `1px solid ${filter === t ? 'transparent' : '#4b5563'}`,
                  textTransform: 'uppercase',
                }}
              >
                {t} ({counts[t]})
              </button>
            ))}
          </nav>
        </div>

        {error && (
          <div style={{ background: '#7f1d1d', border: '1px solid #b91c1c', borderRadius: '4px', padding: '8px 12px', fontSize: '12px', color: '#fca5a5', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={S.emptyState}>Loading abilities…</div>
        ) : filtered.length === 0 ? (
          <div style={S.emptyState}>
            {search.trim() ? `No abilities matching "${search}"` : 'No abilities found'}
          </div>
        ) : (
          filtered.map((a) => (
            <div key={`${a.type}-${a.id}`} style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{a.name}</span>
                <span style={S.tag(TYPE_COLORS[a.type] || '#374151')}>{a.type}</span>
                {a.playbook && <span style={{ fontSize: '10px', color: '#6b7280', marginLeft: '8px' }}>{a.playbook}</span>}
                {a.prerequisite && <span style={{ fontSize: '10px', color: '#f59e0b', marginLeft: '8px' }}>Req: {a.prerequisite}</span>}
              </div>
              {a.description && (
                <div style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.5' }}>{a.description}</div>
              )}
            </div>
          ))
        )}

        <div style={{ fontSize: '11px', color: '#4b5563', textAlign: 'center', marginTop: '16px' }}>
          Showing {filtered.length} of {abilities.length} abilities
        </div>
      </div>
    </div>
  );
}

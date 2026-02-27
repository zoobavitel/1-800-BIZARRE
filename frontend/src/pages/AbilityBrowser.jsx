import React, { useState, useEffect, useMemo } from 'react';
import { referenceAPI } from '../features/character-sheet';

const S = {
  page:  { fontFamily: 'monospace', fontSize: '13px', background: '#000', color: '#fff', minHeight: '100vh' },
  content: { padding: '16px', maxWidth: '1000px', margin: '0 auto' },
  card: { background: '#111827', border: '1px solid #374151', borderRadius: '4px', padding: '12px', marginBottom: '8px' },
  btn: { padding: '6px 14px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', border: 'none', fontFamily: 'monospace' },
  searchInput: {
    background: '#0d1117', color: '#fff', border: '1px solid #374151', borderRadius: '4px',
    padding: '6px 10px', fontFamily: 'monospace', fontSize: '13px', outline: 'none', width: '260px', boxSizing: 'border-box',
  },
  tag: (color) => ({
    display: 'inline-block', padding: '1px 7px', borderRadius: '10px',
    fontSize: '10px', fontWeight: 'bold', background: color, color: '#fff', marginLeft: '6px',
  }),
  emptyState: { textAlign: 'center', padding: '48px 16px', color: '#6b7280' },
  categoryHeader: {
    fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px',
    color: '#d1d5db', borderBottom: '1px solid #374151', paddingBottom: '6px',
    marginTop: '20px', marginBottom: '10px',
  },
};

const TYPE_COLORS = {
  standard: '#1d4ed8',
  hamon:    '#b45309',
  spin:     '#7c3aed',
  heritage: '#059669',
};

const CATEGORY_ORDER = [
  'aggression', 'endurance', 'cunning', 'awareness',
  'presence', 'teamwork', 'adaptability', 'stand_nature',
];

const CATEGORY_LABELS = {
  aggression: 'Aggression',
  endurance: 'Endurance',
  cunning: 'Cunning',
  awareness: 'Awareness',
  presence: 'Presence',
  teamwork: 'Teamwork',
  adaptability: 'Adaptability',
  stand_nature: 'Stand Nature',
};

export default function AbilityBrowser({ initialFilter }) {
  const [abilities, setAbilities] = useState([]);
  const [heritages, setHeritages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState(initialFilter && ['standard', 'hamon', 'spin', 'heritage'].includes(initialFilter) ? initialFilter : 'all');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      referenceAPI.getAbilities().catch(() => []),
      referenceAPI.getHamonAbilities().catch(() => []),
      referenceAPI.getSpinAbilities().catch(() => []),
      referenceAPI.getHeritages().catch(() => []),
    ]).then(([standard, hamon, spin, heritagesData]) => {
      if (cancelled) return;
      const tagged = [
        ...(standard || []).map((a) => ({ ...a, type: a.type || 'standard' })),
        ...(hamon || []).map((a) => ({ ...a, type: 'hamon' })),
        ...(spin || []).map((a) => ({ ...a, type: 'spin' })),
      ];
      setAbilities(tagged);
      setHeritages(heritagesData || []);
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
    if (filter !== 'all' && filter !== 'heritage' && a.type !== filter) return false;
    if (filter === 'heritage') return false;
    if (categoryFilter !== 'all' && (a.category || '') !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const name = (a.name || '').toLowerCase();
      const desc = (a.description || '').toLowerCase();
      if (!name.includes(q) && !desc.includes(q)) return false;
    }
    return true;
  });

  const filteredHeritages = useMemo(() => {
    if (filter !== 'heritage') return [];
    const list = heritages || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((h) => {
      const name = (h.name || '').toLowerCase();
      const desc = (h.description || '').toLowerCase();
      const benefitMatch = (h.benefits || []).some(
        (b) => (b.name || '').toLowerCase().includes(q) || (b.description || '').toLowerCase().includes(q)
      );
      const detrimentMatch = (h.detriments || []).some(
        (d) => (d.name || '').toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q)
      );
      return name.includes(q) || desc.includes(q) || benefitMatch || detrimentMatch;
    });
  }, [heritages, filter, search]);

  const counts = {
    all: abilities.length,
    standard: abilities.filter((a) => a.type === 'standard').length,
    hamon: abilities.filter((a) => a.type === 'hamon').length,
    spin: abilities.filter((a) => a.type === 'spin').length,
    heritage: heritages.length,
  };

  const showCategories = filter === 'all' || filter === 'standard';

  const grouped = useMemo(() => {
    if (!showCategories || categoryFilter !== 'all') return null;
    const groups = {};
    for (const a of filtered) {
      const cat = a.category || '_other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(a);
    }
    return groups;
  }, [filtered, showCategories, categoryFilter]);

  const availableCategories = useMemo(() => {
    const cats = new Set();
    abilities.filter((a) => a.type === 'standard').forEach((a) => {
      if (a.category) cats.add(a.category);
    });
    return CATEGORY_ORDER.filter((c) => cats.has(c));
  }, [abilities]);

  const renderAbilityCard = (a) => (
    <div key={`${a.type}-${a.id}`} style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{a.name}</span>
        <span style={S.tag(TYPE_COLORS[a.type] || '#374151')}>{a.type}</span>
        {a.category && showCategories && categoryFilter !== 'all' && (
          <span style={{ fontSize: '10px', color: '#6b7280', marginLeft: '8px' }}>
            {CATEGORY_LABELS[a.category] || a.category}
          </span>
        )}
        {a.playbook && <span style={{ fontSize: '10px', color: '#6b7280', marginLeft: '8px' }}>{a.playbook}</span>}
        {a.prerequisite && <span style={{ fontSize: '10px', color: '#f59e0b', marginLeft: '8px' }}>Req: {a.prerequisite}</span>}
      </div>
      {a.description && (
        <div style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.5' }}>{a.description}</div>
      )}
    </div>
  );

  const renderHeritageCard = (h) => (
    <div key={`heritage-${h.id}`} style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{h.name}</span>
        <span style={S.tag(TYPE_COLORS.heritage)}>Heritage</span>
        <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '8px' }}>
          {h.base_hp ?? 0} HP base
        </span>
      </div>
      {h.description && (
        <div style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.5', marginBottom: '10px' }}>{h.description}</div>
      )}
      {(h.benefits || []).length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={S.categoryHeader}>Benefits</div>
          {(h.benefits || []).map((b) => (
            <div key={b.id} style={{ marginBottom: '6px', paddingLeft: '8px', borderLeft: '2px solid #059669' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <span style={{ fontWeight: '600', fontSize: '12px' }}>{b.name}</span>
                <span style={{ fontSize: '10px', color: '#059669' }}>-{b.hp_cost} HP</span>
                {b.required && <span style={S.tag('#dc2626')}>Required</span>}
              </div>
              {b.description && <div style={{ fontSize: '11px', color: '#9ca3af', lineHeight: '1.4' }}>{b.description}</div>}
            </div>
          ))}
        </div>
      )}
      {(h.detriments || []).length > 0 && (
        <div>
          <div style={S.categoryHeader}>Detriments</div>
          {(h.detriments || []).map((d) => (
            <div key={d.id} style={{ marginBottom: '6px', paddingLeft: '8px', borderLeft: '2px solid #7c3aed' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <span style={{ fontWeight: '600', fontSize: '12px' }}>{d.name}</span>
                <span style={{ fontSize: '10px', color: '#7c3aed' }}>+{d.hp_value} HP</span>
                {d.required && <span style={S.tag('#dc2626')}>Required</span>}
              </div>
              {d.description && <div style={{ fontSize: '11px', color: '#9ca3af', lineHeight: '1.4' }}>{d.description}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.content}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
          <input
            style={S.searchInput}
            placeholder={filter === 'heritage' ? 'Search heritages…' : 'Search abilities…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <nav style={{ display: 'flex', gap: '4px' }}>
            {['all', 'standard', 'hamon', 'spin', 'heritage'].map((t) => (
              <button
                key={t}
                onClick={() => { setFilter(t); if (t !== 'all' && t !== 'standard') setCategoryFilter('all'); }}
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

        {/* Category filter (only for standard abilities) */}
        {showCategories && availableCategories.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <button
              onClick={() => setCategoryFilter('all')}
              style={{
                ...S.btn, fontSize: '11px', padding: '4px 10px',
                background: categoryFilter === 'all' ? '#374151' : 'transparent',
                color: categoryFilter === 'all' ? '#fff' : '#6b7280',
                border: `1px solid ${categoryFilter === 'all' ? 'transparent' : '#374151'}`,
              }}
            >
              All Categories
            </button>
            {availableCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                style={{
                  ...S.btn, fontSize: '11px', padding: '4px 10px',
                  background: categoryFilter === cat ? '#374151' : 'transparent',
                  color: categoryFilter === cat ? '#fff' : '#6b7280',
                  border: `1px solid ${categoryFilter === cat ? 'transparent' : '#374151'}`,
                }}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div style={{ background: '#7f1d1d', border: '1px solid #b91c1c', borderRadius: '4px', padding: '8px 12px', fontSize: '12px', color: '#fca5a5', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={S.emptyState}>Loading abilities\u2026</div>
        ) : filter === 'heritage' ? (
          filteredHeritages.length === 0 ? (
            <div style={S.emptyState}>
              {search.trim() ? `No heritages matching "${search}"` : 'No heritages found'}
            </div>
          ) : (
            filteredHeritages.map(renderHeritageCard)
          )
        ) : filtered.length === 0 ? (
          <div style={S.emptyState}>
            {search.trim() ? `No abilities matching "${search}"` : 'No abilities found'}
          </div>
        ) : grouped ? (
          CATEGORY_ORDER.filter((cat) => grouped[cat]?.length > 0).map((cat) => (
            <div key={cat}>
              <div style={S.categoryHeader}>{CATEGORY_LABELS[cat]}</div>
              {grouped[cat].map(renderAbilityCard)}
            </div>
          )).concat(
            grouped._other?.length > 0
              ? [<div key="_other">
                  <div style={S.categoryHeader}>Other</div>
                  {grouped._other.map(renderAbilityCard)}
                </div>]
              : []
          )
        ) : (
          filtered.map(renderAbilityCard)
        )}

        <div style={{ fontSize: '11px', color: '#4b5563', textAlign: 'center', marginTop: '16px' }}>
          {filter === 'heritage'
            ? `Showing ${filteredHeritages.length} of ${heritages.length} heritages`
            : `Showing ${filtered.length} of ${abilities.length} abilities`}
        </div>
      </div>
    </div>
  );
}

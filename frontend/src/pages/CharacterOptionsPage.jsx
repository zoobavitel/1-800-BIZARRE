import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, BookOpen, Users, Zap } from 'lucide-react';
import { characterAPI, referenceAPI } from '../features/character-sheet';

const S = {
  page: { fontFamily: 'monospace', fontSize: '13px', background: '#000', color: '#fff', minHeight: '100vh' },
  content: { padding: '16px', maxWidth: '1000px', margin: '0 auto' },
  section: { marginBottom: '32px' },
  sectionTitle: {
    fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px',
    color: '#e2e8f0', borderBottom: '1px solid #374151', paddingBottom: '8px', marginBottom: '16px',
  },
  card: {
    background: '#111827', border: '1px solid #374151', borderRadius: '4px', padding: '12px', marginBottom: '8px',
  },
  tag: (color) => ({
    display: 'inline-block', padding: '1px 7px', borderRadius: '10px',
    fontSize: '10px', fontWeight: 'bold', background: color, color: '#fff', marginLeft: '6px',
  }),
  categoryHeader: {
    fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em',
    color: '#d1d5db', marginTop: '10px', marginBottom: '6px',
  },
  linkBtn: {
    padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', border: '1px solid #4b5563',
    background: 'transparent', color: '#9ca3af', fontFamily: 'monospace', marginTop: '8px',
  },
  emptyState: { textAlign: 'center', padding: '24px 16px', color: '#6b7280' },
};

const TYPE_COLORS = { heritage: '#059669', stand: '#a78bfa', hamon: '#b45309', spin: '#7c3aed' };

export default function CharacterOptionsPage({ onNavigateToAbilities }) {
  const [heritages, setHeritages] = useState([]);
  const [creationGuide, setCreationGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedBuilds, setExpandedBuilds] = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      referenceAPI.getHeritages().catch(() => []),
      characterAPI.getCreationGuide().catch(() => null),
    ]).then(([heritagesData, guide]) => {
      if (cancelled) return;
      setHeritages(heritagesData || []);
      setCreationGuide(guide);
      setLoading(false);
    }).catch((err) => {
      if (!cancelled) {
        setError(err.message || 'Failed to load');
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const toggleBuild = (idx) => {
    setExpandedBuilds((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

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

  const rules = creationGuide?.creation_rules || {};
  const standTypes = creationGuide?.stand_types || [];
  const exampleBuilds = creationGuide?.stand_example_builds || [];

  if (loading) {
    return (
      <div style={S.page}>
        <div style={S.content}>
          <div style={S.emptyState}>Loading character options…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={S.page}>
        <div style={S.content}>
          <div style={{ background: '#7f1d1d', border: '1px solid #b91c1c', borderRadius: '4px', padding: '12px', color: '#fca5a5' }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.content}>
        {error && (
          <div style={{ background: '#7f1d1d', border: '1px solid #b91c1c', borderRadius: '4px', padding: '8px 12px', fontSize: '12px', color: '#fca5a5', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        {/* Heritage Options */}
        <section style={S.section}>
          <h2 style={S.sectionTitle}>Heritage Options</h2>
          {heritages.length === 0 ? (
            <div style={S.emptyState}>No heritages found</div>
          ) : (
            heritages.map(renderHeritageCard)
          )}
        </section>

        {/* Playbook Options */}
        <section style={S.section}>
          <h2 style={S.sectionTitle}>Playbook Options</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Zap style={{ width: 18, height: 18, color: TYPE_COLORS.stand }} />
                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Stand</span>
                <span style={S.tag(TYPE_COLORS.stand)}>Stand</span>
              </div>
              <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.5' }}>
                Stands do not have a rigid playbook to follow—a Stand's form informs how it behaves, not what it can do. Players create Stands with a set amount of abilities (per SRD rules), choosing from standard abilities or unique abilities that follow the rules. The example builds below are optional—they encourage player thinking and engagement when designing your own Stand.
              </p>
              {typeof onNavigateToAbilities === 'function' && (
                <button style={S.linkBtn} onClick={() => onNavigateToAbilities('standard')}>
                  Browse standard abilities
                </button>
              )}
            </div>
            <div style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <BookOpen style={{ width: 18, height: 18, color: TYPE_COLORS.hamon }} />
                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Hamon</span>
                <span style={S.tag(TYPE_COLORS.hamon)}>Hamon</span>
              </div>
              <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.5' }}>
                {rules.playbook_abilities?.hamon || 'Choose from Hamon abilities based on coin stat grades.'} Foundation playbooks available. Abilities gated by A-ranks.
              </p>
              {typeof onNavigateToAbilities === 'function' && (
                <button style={S.linkBtn} onClick={() => onNavigateToAbilities('hamon')}>
                  Browse Hamon abilities
                </button>
              )}
            </div>
            <div style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Users style={{ width: 18, height: 18, color: TYPE_COLORS.spin }} />
                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Spin</span>
                <span style={S.tag(TYPE_COLORS.spin)}>Spin</span>
              </div>
              <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.5' }}>
                {rules.playbook_abilities?.spin || 'Choose from Spin abilities based on coin stat grades.'} Foundation playbooks available. Abilities gated by A-ranks.
              </p>
              {typeof onNavigateToAbilities === 'function' && (
                <button style={S.linkBtn} onClick={() => onNavigateToAbilities('spin')}>
                  Browse Spin abilities
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Stand Types & Example Builds */}
        <section style={S.section}>
          <h2 style={S.sectionTitle}>Stand Types & Example Builds</h2>
          <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.5', marginBottom: '16px' }}>
            These are the allowed Stand types. Example builds show how each type can be realized—they are optional inspiration, not requirements.
          </p>

          {standTypes.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={S.categoryHeader}>Allowed Stand Types</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {standTypes.map((t) => (
                  <div key={t.id} style={{ ...S.card, flex: '1 1 200px', minWidth: '180px' }}>
                    <span style={{ fontWeight: '600', fontSize: '12px' }}>{t.name}</span>
                    <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px', lineHeight: '1.4' }}>{t.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {exampleBuilds.length > 0 && (
            <div>
              <div style={S.categoryHeader}>Example Builds</div>
              {exampleBuilds.map((build, idx) => (
                <div key={idx} style={S.card}>
                  <button
                    type="button"
                    onClick={() => toggleBuild(idx)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', width: '100%', background: 'none', border: 'none',
                      color: '#fff', cursor: 'pointer', fontFamily: 'monospace', fontSize: '13px', textAlign: 'left', padding: 0,
                    }}
                  >
                    {expandedBuilds[idx] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span style={{ fontWeight: 'bold' }}>{build.name}</span>
                    <span style={S.tag(TYPE_COLORS.stand)}>{build.type}</span>
                  </button>
                  {expandedBuilds[idx] && (
                    <div style={{ marginTop: '12px', paddingLeft: '24px', borderLeft: '2px solid #4b5563' }}>
                      <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.5', marginBottom: '10px' }}>{build.summary}</p>
                      {build.stand_coin && (
                        <div style={{ marginBottom: '10px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#d1d5db', marginBottom: '4px' }}>Stand Coin</div>
                          <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                            {['power', 'speed', 'range', 'durability', 'precision', 'development'].map((k) => (
                              <span key={k} style={{ marginRight: '12px' }}>{k}: {build.stand_coin[k] || '—'}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {(build.unique_abilities || []).length > 0 && (
                        <div style={{ marginBottom: '10px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#d1d5db', marginBottom: '4px' }}>Unique Abilities</div>
                          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: '#9ca3af', lineHeight: '1.5' }}>
                            {build.unique_abilities.map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {(build.recommended_standard_abilities || []).length > 0 && (
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#d1d5db', marginBottom: '4px' }}>Recommended Standard Abilities</div>
                          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: '#9ca3af', lineHeight: '1.5' }}>
                            {build.recommended_standard_abilities.map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Character Creation Guide */}
        <section style={S.section}>
          <h2 style={S.sectionTitle}>Character Creation Guide</h2>
          <div style={S.card}>
            <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: '1.8', color: '#e2e8f0' }}>
              <li><strong>Choose a Playbook</strong> — Stand, Hamon, or Spin. Each has a unique narrative flavor and foundational abilities.</li>
              <li><strong>Choose Your Heritage</strong> — Influences origins and innate capabilities. See Heritage Options above.</li>
              <li><strong>Make a Background</strong> — Detail your previous life and how you joined the crew.</li>
              <li><strong>Assign 7 Action Dots</strong> — {rules.action_dots?.description || 'Distribute 7 action dots, max 2 per action.'}</li>
              <li><strong>Create Your Stand (or Hamon/Spin)</strong> — Define abilities and Coin stats. Stands use a set number of abilities (standard or unique per rules). Example builds are optional inspiration.</li>
              <li><strong>Stand/Hamon/Spin Armor</strong> — Track special armor tied to your path.</li>
              <li><strong>Close Friend and Rival</strong> — Pick one of each from your playbook.</li>
              <li><strong>Choose Your Vice</strong> — Faith, Gambling, Luxury, Obligation, Pleasure, Stupor, or Weird.</li>
            </ol>
          </div>
          {rules.coin_stats && (
            <div style={{ ...S.card, marginTop: '8px' }}>
              <div style={S.categoryHeader}>Coin Stats</div>
              <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.5' }}>{rules.coin_stats.description}</p>
              <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>Grades: {rules.coin_stats.grades?.join(', ') || 'F, D, C, B, A, S'}</p>
            </div>
          )}
          {rules.benefits_detriments && (
            <div style={{ ...S.card, marginTop: '8px' }}>
              <div style={S.categoryHeader}>Benefits & Detriments</div>
              <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.5' }}>{rules.benefits_detriments.hp_budget}</p>
              <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.5', marginTop: '4px' }}>{rules.benefits_detriments.required_selection}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

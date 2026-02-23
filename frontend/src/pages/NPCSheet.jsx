import React, { useState, useEffect } from 'react';

// ─── SRD Data Tables (from 1(800)Bizarre SRD) ─────────────────────────────────

const LEVEL_OFFSET = 9;

const GRADES = ['F', 'D', 'C', 'B', 'A', 'S'];
const GRADE_PTS = { F: 0, D: 1, C: 2, B: 3, A: 4, S: 5 };
const GRADE_IDX = { F: 0, D: 1, C: 2, B: 3, A: 4, S: 5 };

const DUR_VULN_CLOCK = { F: 4, D: 6, C: 8, B: 10, A: 12, S: 0 };
const DUR_REGULAR_ARMOR = { F: 1, D: 2, C: 2, B: 3, A: 4, S: 5 };
const DUR_SPECIAL_ARMOR = { F: 0, D: 1, C: 1, B: 2, A: 3, S: 3 };

const POWER_TABLE = {
  S: { harm: 4, pos: 'Forces position worse by 1 step (always)' },
  A: { harm: 4, pos: 'Forces position worse by 1 step' },
  B: { harm: 3, pos: 'Standard scaling' },
  C: { harm: 2, pos: 'Standard scaling' },
  D: { harm: 1, pos: 'Standard scaling' },
  F: { harm: 0, pos: 'Minimal threat' },
};

const SPEED_TABLE = {
  S: { base: '200 ft', greater: '—', lesser: '—', note: 'Acts before everyone' },
  A: { base: '60 ft', greater: '120 ft', lesser: '30 ft', note: '' },
  B: { base: '40 ft', greater: '80 ft', lesser: '20 ft', note: '' },
  C: { base: '35 ft', greater: '70 ft', lesser: '15 ft', note: '' },
  D: { base: '30 ft', greater: '60 ft', lesser: '15 ft', note: '' },
  F: { base: '25 ft', greater: '50 ft', lesser: '10 ft', note: '' },
};

const RANGE_TABLE = {
  S: { base: 'Unlimited', greater: 'No penalty', lesser: 'No penalty' },
  A: { base: '100 ft', greater: '200 ft', lesser: '50 ft' },
  B: { base: '50 ft', greater: '100 ft', lesser: '25 ft' },
  C: { base: '40 ft', greater: '80 ft', lesser: '20 ft' },
  D: { base: '20 ft', greater: '40 ft', lesser: '10 ft' },
  F: { base: '10 ft', greater: '20 ft', lesser: '5 ft' },
};

const PRECISION_TABLE = {
  S: { partial: 'Greater Effect on next action', failure: '🔴 NPC gets a Critical' },
  A: { partial: 'Greater Effect on next action', failure: 'Greater Effect on next action' },
  B: { partial: 'Standard Effect on next action', failure: 'Greater Effect on next action' },
  C: { partial: 'Standard Effect on next action', failure: 'Standard Effect on next action' },
  D: { partial: 'Lesser Effect on next action', failure: 'Standard Effect on next action' },
  F: { partial: '🟢 NPC critically fails next action', failure: 'Lesser Effect on next action' },
};

const DEV_TABLE = {
  S: 'Real-time evolution — can gain entirely new abilities mid-fight. Completely unpredictable.',
  A: 'Adaptive combat — once per combat, mutate one existing ability to do something different.',
  B: 'Learns from defeat — in rematches, returns with 1 new ability based on what defeated them.',
  C: 'Fixed script — predictable once understood. No surprises. Easy to counter.',
  D: 'Limited moveset — PCs get +1d against it after witnessing its abilities twice.',
  F: 'Unstable — loses abilities during prolonged combat. Reduce by 1 armor charge each scene.',
};

// ─── ProgressClock ────────────────────────────────────────────────────────────

const ProgressClock = ({ size = 80, segments, filled, onClick, label, sublabel, color = '#dc2626' }) => {
  if (segments === 0) return null;
  const r = size / 2 - 4, cx = size / 2, cy = size / 2;
  const sa = 360 / segments;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {Array.from({ length: segments }, (_, i) => {
          const a1 = ((i * sa - 90) * Math.PI) / 180;
          const a2 = (((i + 1) * sa - 90) * Math.PI) / 180;
          const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
          const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
          return (
            <path key={i}
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${sa > 180 ? 1 : 0} 1 ${x2} ${y2} Z`}
              fill={i < filled ? color : 'transparent'} stroke="#4b5563" strokeWidth="1.5"
              style={{ cursor: onClick ? 'pointer' : 'default' }}
              onClick={onClick ? () => onClick(i < filled ? i : i + 1) : undefined}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="#6b7280" strokeWidth="2" />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: Math.max(8, size / 6), fill: '#fff', fontFamily: 'monospace', fontWeight: 'bold', transform: 'rotate(90deg)', transformOrigin: `${cx}px ${cy}px` }}>
          {filled}/{segments}
        </text>
      </svg>
      {label && <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#d1d5db', textAlign: 'center', maxWidth: `${size}px` }}>{label}</div>}
      {sublabel && <div style={{ fontSize: '10px', color: '#6b7280', textAlign: 'center', maxWidth: `${size}px` }}>{sublabel}</div>}
    </div>
  );
};

// ─── ArmorTracker ─────────────────────────────────────────────────────────────

const ArmorTracker = ({ label, max, used, onChange, color }) => {
  if (max === 0) return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '10px', color: '#4b5563', fontWeight: 'bold' }}>{label}</div>
      <div style={{ fontSize: '10px', color: '#6b7280' }}>0 charges</div>
    </div>
  );
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 'bold', marginBottom: '4px' }}>{label}</div>
      <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {Array.from({ length: max }, (_, i) => (
          <div key={i}
            onClick={() => onChange(i < used ? i : i + 1)}
            title={i < used ? 'Spent — click to restore' : 'Click to spend'}
            style={{ width: '18px', height: '18px', border: `1px solid ${color}`, cursor: 'pointer',
              background: i < used ? color : 'transparent', borderRadius: '2px' }}
          />
        ))}
      </div>
      <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>{max - used} left</div>
    </div>
  );
};

// ─── GradeSelector ────────────────────────────────────────────────────────────

const GradeSelector = ({ value, onChange, label, infoLine }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
    <div style={{ minWidth: '90px' }}>
      <div style={{ fontSize: '11px', color: '#d1d5db', fontWeight: 'bold', textTransform: 'uppercase' }}>{label}</div>
      {infoLine && <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '1px' }}>{infoLine}</div>}
    </div>
    <div style={{ display: 'flex', gap: '3px' }}>
      {GRADES.map(g => (
        <button key={g} onClick={() => onChange(g)}
          style={{
            width: '28px', height: '28px', border: '1px solid',
            borderColor: value === g ? '#a78bfa' : '#374151',
            background: value === g ? '#4c1d95' : '#1f2937',
            color: value === g ? '#e9d5ff' : '#6b7280',
            fontWeight: value === g ? 'bold' : 'normal',
            fontSize: '11px', cursor: 'pointer', fontFamily: 'monospace', borderRadius: '3px',
          }}>
          {g}
        </button>
      ))}
    </div>
  </div>
);

// ─── NPCSheet (SRD-aligned) ──────────────────────────────────────────────────

export function NPCSheet({ npc, onSave, onClose, onCreateNew, allNPCs = [], onSwitchNPC }) {
  const [name, setName] = useState(npc?.name || '');
  const [standName, setStandName] = useState(npc?.standName || '');
  const [role, setRole] = useState(npc?.role || '');
  const [notes, setNotes] = useState(npc?.notes || '');

  const [stats, setStats] = useState(npc?.stats || {
    power: 'D', speed: 'D', range: 'D', durability: 'D', precision: 'D', development: 'D',
  });

  const [conflictClocks, setConflictClocks] = useState(npc?.conflictClocks || [
    { id: 1, name: 'Defeat', segments: 8, filled: 0 },
  ]);
  const [altClocks, setAltClocks] = useState(npc?.altClocks || []);
  const [regularUsed, setRegularUsed] = useState(npc?.regularUsed || 0);
  const [specialUsed, setSpecialUsed] = useState(npc?.specialUsed || 0);
  const [abilities, setAbilities] = useState(npc?.abilities || []);

  useEffect(() => {
    if (!npc) return;
    setName(npc.name ?? '');
    setStandName(npc.standName ?? '');
    setRole(npc.role ?? '');
    setNotes(npc.notes ?? '');
    setStats(npc.stats || { power: 'D', speed: 'D', range: 'D', durability: 'D', precision: 'D', development: 'D' });
    setConflictClocks(npc.conflictClocks || [{ id: 1, name: 'Defeat', segments: 8, filled: 0 }]);
    setAltClocks(npc.altClocks || []);
    setRegularUsed(npc.regularUsed ?? 0);
    setSpecialUsed(npc.specialUsed ?? 0);
    setAbilities(npc.abilities || []);
  }, [npc?.id]);

  const totalPoints = Object.values(stats).reduce((s, g) => s + GRADE_PTS[g], 0);
  const level = Math.max(1, totalPoints - LEVEL_OFFSET);
  const totalSpentXP = totalPoints * 10;

  const durGrade = stats.durability;
  const vulnSegs = DUR_VULN_CLOCK[durGrade];
  const regArmorMax = DUR_REGULAR_ARMOR[durGrade];
  const specArmorMax = DUR_SPECIAL_ARMOR[durGrade];
  const isDurS = durGrade === 'S';

  const powerInfo = POWER_TABLE[stats.power];
  const speedInfo = SPEED_TABLE[stats.speed];
  const rangeInfo = RANGE_TABLE[stats.range];
  const precInfo = PRECISION_TABLE[stats.precision];
  const devInfo = DEV_TABLE[stats.development];

  const addConflictClock = () => {
    const nameInput = prompt('Clock name (e.g. "Defeat Diavolo", "Expose the User"):');
    if (!nameInput) return;
    const segs = parseInt(prompt('Segments (4, 6, 8, 12):') || '8');
    if (![4, 6, 8, 12].includes(segs)) { alert('Must be 4, 6, 8, or 12.'); return; }
    setConflictClocks(p => [...p, { id: Date.now(), name: nameInput, segments: segs, filled: 0 }]);
  };

  const addAltClock = () => {
    const nameInput = prompt('Alternative win condition (e.g. "Expose User", "Break Stand Logic"):');
    if (!nameInput) return;
    const segs = parseInt(prompt('Segments (4, 6, 8, 12):') || '8');
    if (![4, 6, 8, 12].includes(segs)) return;
    setAltClocks(p => [...p, { id: Date.now(), name: nameInput, segments: segs, filled: 0 }]);
  };

  const updateConflictClock = (id, filled) =>
    setConflictClocks(p => p.map(c => c.id === id ? { ...c, filled } : c));
  const deleteConflictClock = (id) =>
    setConflictClocks(p => p.filter(c => c.id !== id));
  const updateAltClock = (id, filled) =>
    setAltClocks(p => p.map(c => c.id === id ? { ...c, filled } : c));
  const deleteAltClock = (id) =>
    setAltClocks(p => p.filter(c => c.id !== id));

  const handleSave = () => {
    if (onSave) onSave({
      id: npc?.id || Date.now(),
      name, standName, role, notes, stats,
      conflictClocks, altClocks,
      regularUsed, specialUsed, abilities,
    });
  };

  const S = {
    page: { fontFamily: 'monospace', fontSize: '13px', background: '#000', color: '#fff', minHeight: '100vh' },
    hdr: { background: '#1a0533', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #7c3aed', position: 'sticky', top: 0, zIndex: 10 },
    card: { background: '#0d0d1a', border: '1px solid #2d1f52', borderRadius: '4px', padding: '12px', marginBottom: '12px' },
    lbl: { color: '#a78bfa', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' },
    inp: { background: 'transparent', color: '#fff', border: 'none', borderBottom: '1px solid #4b2d8f', padding: '2px 4px', width: '100%', fontFamily: 'monospace', fontSize: '13px', outline: 'none', boxSizing: 'border-box' },
    sel: { background: '#1f1035', color: '#fff', border: '1px solid #4b2d8f', padding: '4px 8px', fontSize: '12px', fontFamily: 'monospace' },
    btn: { padding: '4px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', border: 'none', fontFamily: 'monospace' },
    g2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
    g3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' },
    ref: { background: '#0a0a14', border: '1px solid #1f1f3a', borderRadius: '4px', padding: '8px', fontSize: '11px' },
    warn: { background: '#1a0000', border: '1px solid #7f1d1d', borderRadius: '4px', padding: '6px 10px', fontSize: '11px', color: '#fca5a5' },
    sdur: { background: '#0a1a0a', border: '2px solid #16a34a', borderRadius: '6px', padding: '10px', fontSize: '11px', color: '#86efac' },
  };

  return (
    <div style={S.page}>
      <div style={S.hdr}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#c4b5fd' }}>1(800)BIZARRE</span>
          <span style={{ color: '#7c3aed', fontSize: '14px' }}>◆</span>
          <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 'bold' }}>GM — NPC SHEET</span>
          {name && <span style={{ color: '#fff', fontWeight: 'bold' }}>{name}</span>}
          {standName && <span style={{ color: '#a78bfa' }}>「{standName}」</span>}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {allNPCs.length > 1 && (
            <select style={S.sel} value={npc?.id || ''} onChange={e => {
              const n = allNPCs.find(x => x.id === parseInt(e.target.value));
              if (n && onSwitchNPC) onSwitchNPC(n);
            }}>
              <option value="">Switch NPC…</option>
              {allNPCs.map(n => <option key={n.id} value={n.id}>{n.name || 'Unnamed'}</option>)}
            </select>
          )}
          {onCreateNew && (
            <button type="button" onClick={onCreateNew} style={{ ...S.btn, background: '#4c1d95', color: '#e9d5ff' }}>+ New NPC</button>
          )}
          <button type="button" onClick={handleSave} style={{ ...S.btn, background: '#16a34a', color: '#fff' }}>Save</button>
          {onClose && <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '18px' }}>✕</button>}
        </div>
      </div>

      <div style={{ padding: '16px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ ...S.card, borderColor: '#4c1d95' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: '16px', alignItems: 'end' }}>
            <div>
              <span style={S.lbl}>NPC Name / User Name</span>
              <input style={S.inp} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Yoshikage Kira" />
            </div>
            <div>
              <span style={S.lbl}>Stand Name</span>
              <input style={S.inp} value={standName} onChange={e => setStandName(e.target.value)} placeholder="e.g. 「Killer Queen」" />
            </div>
            <div>
              <span style={S.lbl}>Role / Type</span>
              <input style={S.inp} value={role} onChange={e => setRole(e.target.value)} placeholder="Boss / Ally / Minion" />
            </div>
            <div style={{ textAlign: 'center', minWidth: '100px' }}>
              <span style={S.lbl}>NPC LEVEL</span>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: level >= 7 ? '#f87171' : level >= 4 ? '#fbbf24' : '#34d399', lineHeight: 1 }}>
                {level}
              </div>
              <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>{totalPoints} pts × 10</div>
            </div>
          </div>
        </div>

        <div style={S.g2}>
          <div>
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                <span style={S.lbl}>Stand Coin Stats</span>
                <span style={{ fontSize: '11px', color: '#6b7280' }}>{totalPoints} pts → Level {level}</span>
              </div>
              <GradeSelector value={stats.power} onChange={v => setStats(p => ({ ...p, power: v }))} label="Power"
                infoLine={`Lv${powerInfo.harm} harm · ${powerInfo.pos}`} />
              <GradeSelector value={stats.speed} onChange={v => setStats(p => ({ ...p, speed: v }))} label="Speed"
                infoLine={`${speedInfo.base} base · ${speedInfo.greater} greater${speedInfo.note ? ` · ${speedInfo.note}` : ''}`} />
              <GradeSelector value={stats.range} onChange={v => setStats(p => ({ ...p, range: v }))} label="Range"
                infoLine={`${rangeInfo.base} · ${rangeInfo.greater} greater · ${rangeInfo.lesser} lesser`} />
              <GradeSelector value={stats.durability} onChange={v => {
                setStats(p => ({ ...p, durability: v }));
                setRegularUsed(0);
                setSpecialUsed(0);
              }} label="Durability"
                infoLine={isDurS
                  ? '⚠ S-DUR: No vulnerability clock — alternative win conditions required'
                  : `${vulnSegs}-seg clock · ${regArmorMax} regular · ${specArmorMax} special`} />
              <GradeSelector value={stats.precision} onChange={v => setStats(p => ({ ...p, precision: v }))} label="Precision"
                infoLine={`Partial → ${precInfo.partial}`} />
              <GradeSelector value={stats.development} onChange={v => setStats(p => ({ ...p, development: v }))} label="Development"
                infoLine={devInfo.split('—')[0].trim()} />
            </div>

            <div style={S.card}>
              <span style={S.lbl}>Combat Reference</span>
              <div style={{ ...S.ref, marginBottom: '8px' }}>
                <div style={{ color: '#f87171', fontWeight: 'bold', marginBottom: '4px' }}>POWER {stats.power} — Base Harm: Level {powerInfo.harm}</div>
                <div style={{ color: '#9ca3af' }}>Greater Effect → Harm +1 level | Lesser Effect → Harm −1 level</div>
              </div>
              <div style={{ ...S.ref, marginBottom: '8px' }}>
                <div style={{ color: '#60a5fa', fontWeight: 'bold', marginBottom: '4px' }}>SPEED {stats.speed} — {speedInfo.base}</div>
                <div style={{ color: '#9ca3af' }}>Greater: {speedInfo.greater} · Lesser: {speedInfo.lesser}</div>
              </div>
              <div style={{ ...S.ref, marginBottom: '8px' }}>
                <div style={{ color: '#34d399', fontWeight: 'bold', marginBottom: '4px' }}>RANGE {stats.range} — {rangeInfo.base}</div>
                <div style={{ color: '#9ca3af' }}>Greater: {rangeInfo.greater} · Lesser: {rangeInfo.lesser}</div>
              </div>
              <div style={{ ...S.ref, marginBottom: '8px' }}>
                <div style={{ color: '#e879f9', fontWeight: 'bold', marginBottom: '4px' }}>PRECISION {stats.precision}</div>
                <div style={{ color: '#9ca3af' }}>Partial: {precInfo.partial} · Failure: {precInfo.failure}</div>
              </div>
              <div style={S.ref}>
                <div style={{ color: '#fb923c', fontWeight: 'bold', marginBottom: '4px' }}>DEVELOPMENT {stats.development}</div>
                <div style={{ color: '#9ca3af', lineHeight: '1.5' }}>{devInfo}</div>
              </div>
            </div>

            <div style={S.card}>
              <span style={S.lbl}>Stand Abilities</span>
              <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '8px' }}>Narrative descriptions only — no mechanical dots</div>
              {abilities.map(ab => (
                <div key={ab.id} style={{ background: '#1a1030', border: '1px solid #2d1f52', borderRadius: '4px', padding: '8px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <input value={ab.name}
                        onChange={e => setAbilities(p => p.map(a => a.id === ab.id ? { ...a, name: e.target.value } : a))}
                        style={{ ...S.inp, fontWeight: 'bold', fontSize: '12px' }}
                        placeholder="Ability name"
                      />
                      <textarea value={ab.description}
                        onChange={e => setAbilities(p => p.map(a => a.id === ab.id ? { ...a, description: e.target.value } : a))}
                        placeholder="What does this ability do?"
                        style={{ width: '100%', background: 'transparent', color: '#d1d5db', border: 'none', fontFamily: 'monospace', fontSize: '11px', resize: 'vertical', outline: 'none', minHeight: '40px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <button type="button" onClick={() => setAbilities(p => p.filter(a => a.id !== ab.id))}
                      style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', marginLeft: '6px' }}>×</button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setAbilities(p => [...p, { id: Date.now(), name: '', description: '', type: 'unique' }])}
                style={{ ...S.btn, border: '2px dashed #2d1f52', background: 'transparent', color: '#6b7280', width: '100%', padding: '6px' }}>
                + Add Ability
              </button>
            </div>
          </div>

          <div>
            {isDurS ? (
              <div style={{ ...S.card, border: '2px solid #16a34a' }}>
                <div style={S.sdur}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#22c55e', marginBottom: '6px' }}>⬛ DURABILITY S — INVINCIBLE TO DIRECT HARM</div>
                  <div style={{ marginBottom: '8px' }}>This NPC has no Vulnerability Clock. Create alternative win condition clocks below.</div>
                </div>
                <div style={{ marginTop: '12px' }}>
                  <span style={S.lbl}>Armor Charges (S-DUR)</span>
                  <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginTop: '8px' }}>
                    <ArmorTracker label="REGULAR" max={regArmorMax} used={regularUsed} onChange={setRegularUsed} color="#f59e0b" />
                    <ArmorTracker label="SPECIAL" max={specArmorMax} used={specialUsed} onChange={setSpecialUsed} color="#7c3aed" />
                  </div>
                </div>
                <div style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={S.lbl}>Alternative Win Conditions</span>
                    <button type="button" onClick={addAltClock} style={{ ...S.btn, background: '#166534', color: '#86efac', fontSize: '11px' }}>+ Add Clock</button>
                  </div>
                  {altClocks.length === 0 && <div style={{ ...S.warn, textAlign: 'center' }}>S-DUR NPCs must have at least one alternative win condition clock!</div>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
                    {altClocks.map(clk => (
                      <div key={clk.id} style={{ textAlign: 'center', position: 'relative' }}>
                        <ProgressClock size={90} segments={clk.segments} filled={clk.filled}
                          onClick={f => updateAltClock(clk.id, f)} color="#16a34a"
                          label={clk.name} sublabel={`${clk.segments}-segment`} />
                        <button type="button" onClick={() => deleteAltClock(clk.id)}
                          style={{ position: 'absolute', top: '-4px', right: '-4px', color: '#f87171', background: '#1a0000', border: '1px solid #7f1d1d', borderRadius: '50%', width: '16px', height: '16px', cursor: 'pointer', fontSize: '10px' }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                  <span style={S.lbl}>Durability {stats.durability} — Vulnerability Clock</span>
                  <span style={{ fontSize: '10px', color: '#6b7280' }}>{vulnSegs} segments</span>
                </div>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: '0 0 auto' }}>
                    {(() => {
                      const totalTicks = conflictClocks.reduce((s, c) => s + c.filled, 0);
                      const vulnFilled = Math.min(totalTicks, vulnSegs);
                      const isDefeated = vulnFilled >= vulnSegs;
                      return (
                        <div style={{ textAlign: 'center' }}>
                          {isDefeated && <div style={{ ...S.warn, marginBottom: '6px', textAlign: 'center', fontWeight: 'bold' }}>☠ DEFEATED</div>}
                          <ProgressClock size={100} segments={vulnSegs} filled={vulnFilled}
                            color={isDefeated ? '#991b1b' : '#dc2626'}
                            label="Vulnerability" sublabel={`${vulnFilled}/${vulnSegs}`} />
                        </div>
                      );
                    })()}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '10px', color: '#9ca3af' }}>Spend armor charges before filling clocks.</div>
                    <ArmorTracker label="REGULAR ARMOR" max={regArmorMax} used={regularUsed} onChange={setRegularUsed} color="#f59e0b" />
                    <ArmorTracker label="SPECIAL ARMOR" max={specArmorMax} used={specialUsed} onChange={setSpecialUsed} color="#7c3aed" />
                  </div>
                </div>
              </div>
            )}

            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <span style={S.lbl}>Conflict Clocks</span>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>PCs roll to fill these. Limited=1, Standard=2, Greater=3 ticks.</div>
                </div>
                <button type="button" onClick={addConflictClock} style={{ ...S.btn, background: '#4c1d95', color: '#e9d5ff', fontSize: '11px' }}>+ Clock</button>
              </div>
              {conflictClocks.length === 0 && <div style={{ color: '#6b7280', fontSize: '11px', textAlign: 'center', padding: '12px' }}>No clocks yet — add one to track the conflict.</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: conflictClocks.length <= 2 ? 'center' : 'flex-start' }}>
                {conflictClocks.map(clk => {
                  const isComplete = clk.filled >= clk.segments;
                  return (
                    <div key={clk.id} style={{ textAlign: 'center', position: 'relative', background: isComplete ? '#0a1a0a' : 'transparent', border: isComplete ? '1px solid #16a34a' : 'none', borderRadius: '6px', padding: isComplete ? '6px' : '0' }}>
                      {isComplete && <div style={{ fontSize: '10px', color: '#22c55e', fontWeight: 'bold', marginBottom: '4px' }}>✓ COMPLETE</div>}
                      <ProgressClock size={90} segments={clk.segments} filled={clk.filled}
                        onClick={f => updateConflictClock(clk.id, f)}
                        color={isComplete ? '#16a34a' : '#7c3aed'}
                        label={clk.name} sublabel={`${clk.segments}-seg`} />
                      <div style={{ marginTop: '4px', display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button type="button" onClick={() => { const newName = prompt('Rename clock:', clk.name); if (newName) setConflictClocks(p => p.map(c => c.id === clk.id ? { ...c, name: newName } : c)); }} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px' }}>rename</button>
                        <button type="button" onClick={() => deleteConflictClock(clk.id)} style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px' }}>delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={S.card}>
              <span style={S.lbl}>GM Notes</span>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Tactics, motivations, encounter context…"
                style={{ width: '100%', height: '120px', background: '#0a0a14', color: '#d1d5db', border: '1px solid #2d1f52', padding: '8px', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page wrapper with local state (for use as a route) ──────────────────────────

export default function NPCSheetPage() {
  const [npcs, setNPCs] = useState([
    {
      id: 1,
      name: 'Yoshikage Kira',
      standName: 'Killer Queen',
      role: 'Boss',
      notes: 'Obsessive, methodical. Wants a quiet life.',
      stats: { power: 'A', speed: 'B', range: 'C', durability: 'B', precision: 'A', development: 'C' },
      conflictClocks: [{ id: 1, name: 'Defeat Kira', segments: 12, filled: 0 }, { id: 2, name: 'Expose Identity', segments: 6, filled: 0 }],
      altClocks: [],
      regularUsed: 0,
      specialUsed: 0,
      abilities: [
        { id: 1, name: 'Sheer Heart Attack', type: 'unique', description: 'Heat-seeking autonomous bomb. Pursues nearest heat source until detonation.' },
        { id: 2, name: 'Bites the Dust', type: 'unique', description: 'Reversal bomb. Triggers on discovery — rewinds time, killing the investigator.' },
      ],
    },
  ]);
  const [current, setCurrent] = useState(npcs[0]);

  const handleSave = (updated) => {
    setNPCs(p => p.some(n => n.id === updated.id) ? p.map(n => n.id === updated.id ? updated : n) : [...p, updated]);
    setCurrent(updated);
  };

  const handleCreateNew = () => {
    const newNpc = {
      id: Date.now(), name: '', standName: '', role: '', notes: '',
      stats: { power: 'D', speed: 'D', range: 'D', durability: 'D', precision: 'D', development: 'D' },
      conflictClocks: [{ id: Date.now(), name: 'Defeat', segments: 8, filled: 0 }],
      altClocks: [], regularUsed: 0, specialUsed: 0, abilities: [],
    };
    setNPCs(p => [...p, newNpc]);
    setCurrent(newNpc);
  };

  return (
    <NPCSheet
      npc={current}
      allNPCs={npcs}
      onSave={handleSave}
      onCreateNew={handleCreateNew}
      onSwitchNPC={n => setCurrent(npcs.find(x => x.id === n.id) || n)}
    />
  );
}

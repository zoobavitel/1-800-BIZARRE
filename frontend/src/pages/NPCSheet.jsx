import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── SRD Data Tables ──────────────────────────────────────────────────────────

// NOTE: SRD has two level formulas — one doc says -9, another says -10.
// Change this constant to whichever is confirmed correct.
const LEVEL_OFFSET = 9;

const GRADES = ['F', 'D', 'C', 'B', 'A', 'S'];
const GRADE_PTS = { F: 0, D: 1, C: 2, B: 3, A: 4, S: 5 };

// Durability → Vulnerability Clock segments
const DUR_VULN_CLOCK = { F: 4, D: 6, C: 8, B: 10, A: 12, S: 0 };

// Durability → Regular armor charges
const DUR_REGULAR_ARMOR = { F: 1, D: 2, C: 2, B: 3, A: 4, S: 5 };

// Durability → Special armor charges
const DUR_SPECIAL_ARMOR = { F: 0, D: 1, C: 1, B: 2, A: 3, S: 3 };

// Power → base harm level + position note
const POWER_TABLE = {
  S: { harm: 4, pos: 'Forces position worse by 1 step (always)' },
  A: { harm: 4, pos: 'Forces position worse by 1 step' },
  B: { harm: 3, pos: 'Standard scaling' },
  C: { harm: 2, pos: 'Standard scaling' },
  D: { harm: 1, pos: 'Standard scaling' },
  F: { harm: 0, pos: 'Minimal threat' },
};

// Speed → movement table
const SPEED_TABLE = {
  S: { base: '200 ft', greater: '—', lesser: '—', note: 'Acts before everyone' },
  A: { base: '60 ft',  greater: '120 ft', lesser: '30 ft',  note: '' },
  B: { base: '40 ft',  greater: '80 ft',  lesser: '20 ft',  note: '' },
  C: { base: '35 ft',  greater: '70 ft',  lesser: '15 ft',  note: '' },
  D: { base: '30 ft',  greater: '60 ft',  lesser: '15 ft',  note: '' },
  F: { base: '25 ft',  greater: '50 ft',  lesser: '10 ft',  note: '' },
};

// Range → operational distance table
const RANGE_TABLE = {
  S: { base: 'Unlimited', greater: 'No penalty', lesser: 'No penalty' },
  A: { base: '100 ft', greater: '200 ft', lesser: '50 ft' },
  B: { base: '50 ft',  greater: '100 ft', lesser: '25 ft' },
  C: { base: '40 ft',  greater: '80 ft',  lesser: '20 ft' },
  D: { base: '20 ft',  greater: '40 ft',  lesser: '10 ft' },
  F: { base: '10 ft',  greater: '20 ft',  lesser: '5 ft'  },
};

// Precision → reactive counter-effects
const PRECISION_TABLE = {
  S: { partial: 'Greater Effect on next action', failure: '🔴 NPC gets a Critical' },
  A: { partial: 'Greater Effect on next action', failure: 'Greater Effect on next action' },
  B: { partial: 'Standard Effect on next action', failure: 'Greater Effect on next action' },
  C: { partial: 'Standard Effect on next action', failure: 'Standard Effect on next action' },
  D: { partial: 'Lesser Effect on next action',   failure: 'Standard Effect on next action' },
  F: { partial: '🟢 NPC critically fails next action', failure: 'Lesser Effect on next action' },
};

// Development → tactical adaptability
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
          style={{ fontSize: Math.max(8, size / 6), fill: '#fff', fontFamily: 'monospace', fontWeight: 'bold', transform: `rotate(90deg)`, transformOrigin: `${cx}px ${cy}px` }}>
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

// ─── NPCSheet ─────────────────────────────────────────────────────────────────

const NPCSheet = ({ npc, onSave, onClose, campaigns = [] }) => {
  const [activeMode, setActiveMode] = useState('NPC');

  const [name,      setName]      = useState(npc?.name      || '');
  const [standName, setStandName] = useState(npc?.standName || '');
  const [role,      setRole]      = useState(npc?.role      || '');
  const [notes,     setNotes]     = useState(npc?.notes     || '');
  const [campaign,  setCampaign]  = useState(npc?.campaign  || '');
  const [faction,   setFaction]   = useState(npc?.faction ?? npc?.faction_id ?? '');

  useEffect(() => {
    setFaction(npc?.faction ?? npc?.faction_id ?? '');
  }, [npc?.id, npc?.faction, npc?.faction_id]);

  const campaignFactions = (campaign && campaigns?.find((c) => c.id == campaign || c.id === campaign?.id))?.factions || [];

  // Crew / faction management fields
  const [contacts,     setContacts]     = useState(npc?.contacts     || []);
  const [factionStatus, setFactionStatus] = useState(npc?.faction_status || npc?.factionStatus || {});
  const [inventory,    setInventory]    = useState(npc?.inventory    || []);

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

  // Portrait state
  const [imageFile, setImageFile]       = useState(null);
  const [imageUrl, setImageUrl]         = useState(npc?.image_url || '');
  const [imagePreview, setImagePreview] = useState(npc?.image || npc?.image_url || '');
  const fileInputRef = useRef(null);

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState(null);
  const debounceRef = useRef(null);
  const mountedRef  = useRef(false);
  const npcIdRef    = useRef(npc?.id || null);
  const savingRef   = useRef(false);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }, []);

  const handleImageUrlPrompt = useCallback(() => {
    const url = prompt('Paste image URL:');
    if (url) {
      setImageUrl(url);
      setImagePreview(url);
      setImageFile(null);
    }
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const totalPoints = Object.values(stats).reduce((s, g) => s + GRADE_PTS[g], 0);
  const level       = Math.max(1, totalPoints - LEVEL_OFFSET);
  // XP expenditure: each stand coin grade = 10 XP; no action dots for NPCs
  // Level 1 baseline = 100 XP (10 pts × 10). Each 10 XP above = +1 level.
  const totalSpentXP = totalPoints * 10;

  const durGrade     = stats.durability;
  const vulnSegs     = DUR_VULN_CLOCK[durGrade];
  const regArmorMax  = DUR_REGULAR_ARMOR[durGrade];
  const specArmorMax = DUR_SPECIAL_ARMOR[durGrade];
  const isDurS       = durGrade === 'S';

  const powerInfo  = POWER_TABLE[stats.power];
  const speedInfo  = SPEED_TABLE[stats.speed];
  const rangeInfo  = RANGE_TABLE[stats.range];
  const precInfo   = PRECISION_TABLE[stats.precision];
  const devInfo    = DEV_TABLE[stats.development];

  // ── Clock helpers ─────────────────────────────────────────────────────────────

  const addConflictClock = () => {
    const name = prompt('Clock name (e.g. "Defeat Diavolo", "Expose the User"):');
    if (!name) return;
    const segs = parseInt(prompt('Segments (4, 6, 8, 12):') || '8');
    if (![4, 6, 8, 12].includes(segs)) { alert('Must be 4, 6, 8, or 12.'); return; }
    setConflictClocks(p => [...p, { id: Date.now(), name, segments: segs, filled: 0 }]);
  };

  const addAltClock = () => {
    const name = prompt('Alternative win condition (e.g. "Expose User", "Break Stand Logic"):');
    if (!name) return;
    const segs = parseInt(prompt('Segments (4, 6, 8, 12):') || '8');
    if (![4, 6, 8, 12].includes(segs)) return;
    setAltClocks(p => [...p, { id: Date.now(), name, segments: segs, filled: 0 }]);
  };

  const updateConflictClock = (id, filled) =>
    setConflictClocks(p => p.map(c => c.id === id ? { ...c, filled } : c));
  const deleteConflictClock = (id) =>
    setConflictClocks(p => p.filter(c => c.id !== id));
  const updateAltClock = (id, filled) =>
    setAltClocks(p => p.map(c => c.id === id ? { ...c, filled } : c));
  const deleteAltClock = (id) =>
    setAltClocks(p => p.filter(c => c.id !== id));

  const buildPayload = useCallback(() => ({
    ...(npcIdRef.current ? { id: npcIdRef.current } : {}),
    name, standName, role, notes, stats,
    conflictClocks, altClocks,
    regularUsed, specialUsed, abilities,
    campaign: campaign || null,
    faction: faction || null,
    image_url: imageUrl,
    contacts, faction_status: factionStatus, inventory,
    ...(imageFile ? { imageFile } : {}),
  }), [name, standName, role, notes, stats, conflictClocks, altClocks, regularUsed, specialUsed, abilities, campaign, faction, imageUrl, imageFile, contacts, factionStatus, inventory]);

  // Debounced auto-save
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (savingRef.current || !onSave) return;
      savingRef.current = true;
      setSaveStatus('saving');
      try {
        const result = await onSave(buildPayload());
        if (result?.id && !npcIdRef.current) npcIdRef.current = result.id;
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus((s) => s === 'saved' ? null : s), 2000);
      } catch {
        setSaveStatus('error');
      } finally {
        savingRef.current = false;
      }
    }, 1500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, standName, role, notes, stats, conflictClocks, altClocks, regularUsed, specialUsed, abilities, campaign, imageUrl, imageFile]);

  // ── Styles ────────────────────────────────────────────────────────────────────

  const S = {
    page:  { fontFamily: 'monospace', fontSize: '13px', background: '#000', color: '#fff', minHeight: '100vh' },
    hdr:   { background: '#1a0533', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #7c3aed', position: 'sticky', top: 0, zIndex: 10 },
    card:  { background: '#0d0d1a', border: '1px solid #2d1f52', borderRadius: '4px', padding: '12px', marginBottom: '12px' },
    lbl:   { color: '#a78bfa', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' },
    inp:   { background: 'transparent', color: '#fff', border: 'none', borderBottom: '1px solid #4b2d8f', padding: '2px 4px', width: '100%', fontFamily: 'monospace', fontSize: '13px', outline: 'none', boxSizing: 'border-box' },
    sel:   { background: '#1f1035', color: '#fff', border: '1px solid #4b2d8f', padding: '4px 8px', fontSize: '12px', fontFamily: 'monospace' },
    btn:   { padding: '4px 12px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', border: 'none', fontFamily: 'monospace' },
    g2:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
    g3:    { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' },
    ref:   { background: '#0a0a14', border: '1px solid #1f1f3a', borderRadius: '4px', padding: '8px', fontSize: '11px' },
    warn:  { background: '#1a0000', border: '1px solid #7f1d1d', borderRadius: '4px', padding: '6px 10px', fontSize: '11px', color: '#fca5a5' },
    sdur:  { background: '#0a1a0a', border: '2px solid #16a34a', borderRadius: '6px', padding: '10px', fontSize: '11px', color: '#86efac' },
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>

      {/* ── Header ── */}
      <div style={S.hdr}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#c4b5fd' }}>1(800)BIZARRE</span>
          <span style={{ color: '#7c3aed', fontSize: '14px' }}>◆</span>
          <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 'bold' }}>GM — NPC SHEET</span>
          {name && <span style={{ color: '#fff', fontWeight: 'bold' }}>{name}</span>}
          {standName && <span style={{ color: '#a78bfa' }}>「{standName}」</span>}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {saveStatus === 'saving' && <span style={{ fontSize: '11px', color: '#fbbf24' }}>Saving...</span>}
          {saveStatus === 'saved'  && <span style={{ fontSize: '11px', color: '#34d399' }}>Saved</span>}
          {saveStatus === 'error'  && <span style={{ fontSize: '11px', color: '#f87171' }}>Error saving</span>}
          {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '18px' }}>✕</button>}
        </div>
      </div>

      {/* ── Mode Toggle ── */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0', background: '#0d0d1a', borderBottom: '1px solid #2d1f52', padding: '6px 0' }}>
        {['NPC', 'CREW'].map(mode => (
          <button key={mode} onClick={() => setActiveMode(mode)}
            style={{
              padding: '6px 24px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold',
              border: '1px solid #4b2d8f', cursor: 'pointer', letterSpacing: '0.08em',
              background: activeMode === mode ? '#7c3aed' : '#1a0533',
              color: activeMode === mode ? '#fff' : '#9ca3af',
              borderRadius: mode === 'NPC' ? '4px 0 0 4px' : '0 4px 4px 0',
            }}>
            {mode === 'NPC' ? 'NPC MODE' : 'CREW MODE'}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px', maxWidth: '1400px', margin: '0 auto' }}>

        {activeMode === 'NPC' && (<>
        {/* ── Identity Bar ── */}
        <div style={{ ...S.card, borderColor: '#4c1d95' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'end' }}>
            {/* Portrait */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%', border: '2px solid #4b2d8f',
                background: '#1f1035', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {imagePreview
                  ? <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: '#4b5563', fontSize: '28px' }}>?</span>}
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
                <button onClick={() => fileInputRef.current?.click()}
                  style={{ ...S.btn, fontSize: '9px', padding: '2px 6px', background: '#1f1035', color: '#a78bfa' }}>Upload</button>
                <button onClick={handleImageUrlPrompt}
                  style={{ ...S.btn, fontSize: '9px', padding: '2px 6px', background: '#1f1035', color: '#a78bfa' }}>URL</button>
              </div>
            </div>
            {/* Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr auto', gap: '16px', alignItems: 'end', flex: 1 }}>
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
              <div>
                <span style={S.lbl}>Campaign</span>
                <select style={{ ...S.sel, width: '100%' }} value={campaign} onChange={e => setCampaign(e.target.value)}>
                  <option value="">No Campaign</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <span style={S.lbl}>Crew / Faction</span>
                <select style={{ ...S.sel, width: '100%' }} value={faction || ''} onChange={e => setFaction(e.target.value ? parseInt(e.target.value, 10) : '')}>
                  <option value="">— None —</option>
                  {campaignFactions.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ textAlign: 'center', minWidth: '100px' }}>
                <span style={S.lbl}>NPC LEVEL</span>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: level >= 7 ? '#f87171' : level >= 4 ? '#fbbf24' : '#34d399', lineHeight: 1 }}>
                  {level}
                </div>
                <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                  {totalPoints} pts × 10
                </div>
                <div style={{ fontSize: '10px', color: '#4c1d95', marginTop: '1px' }}>
                  = {totalSpentXP} XP spent
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={S.g2}>

          {/* ════ LEFT — Stats + Reference ════ */}
          <div>

            {/* Stand Coin Stats */}
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                <span style={S.lbl}>Stand Coin Stats</span>
                <span style={{ fontSize: '11px', color: '#6b7280' }}>{totalPoints} pts → Level {level}</span>
              </div>

              <GradeSelector value={stats.power} onChange={v => setStats(p => ({ ...p, power: v }))} label="Power"
                infoLine={`Lv${POWER_TABLE[stats.power].harm} harm · ${POWER_TABLE[stats.power].pos}`} />

              <GradeSelector value={stats.speed} onChange={v => setStats(p => ({ ...p, speed: v }))} label="Speed"
                infoLine={`${SPEED_TABLE[stats.speed].base} base · ${SPEED_TABLE[stats.speed].greater} greater${SPEED_TABLE[stats.speed].note ? ` · ${SPEED_TABLE[stats.speed].note}` : ''}`} />

              <GradeSelector value={stats.range} onChange={v => setStats(p => ({ ...p, range: v }))} label="Range"
                infoLine={`${RANGE_TABLE[stats.range].base} · ${RANGE_TABLE[stats.range].greater} greater · ${RANGE_TABLE[stats.range].lesser} lesser`} />

              <GradeSelector value={stats.durability} onChange={v => {
                setStats(p => ({ ...p, durability: v }));
                setRegularUsed(0);
                setSpecialUsed(0);
              }} label="Durability"
                infoLine={isDurS
                  ? '⚠ S-DUR: No vulnerability clock — alternative win conditions required'
                  : `${vulnSegs}-seg clock · ${regArmorMax} regular · ${specArmorMax} special`}
              />

              <GradeSelector value={stats.precision} onChange={v => setStats(p => ({ ...p, precision: v }))} label="Precision"
                infoLine={`Partial → ${PRECISION_TABLE[stats.precision].partial}`} />

              <GradeSelector value={stats.development} onChange={v => setStats(p => ({ ...p, development: v }))} label="Development"
                infoLine={DEV_TABLE[stats.development].split('—')[0].trim()} />
            </div>

            {/* Stat Reference Cards */}
            <div style={S.card}>
              <span style={S.lbl}>Combat Reference</span>

              {/* Power */}
              <div style={{ ...S.ref, marginBottom: '8px' }}>
                <div style={{ color: '#f87171', fontWeight: 'bold', marginBottom: '4px' }}>
                  POWER {stats.power} — Base Harm: Level {powerInfo.harm}
                </div>
                <div style={{ color: '#9ca3af' }}>
                  Greater Effect → Harm +1 level &nbsp;|&nbsp; Lesser Effect → Harm −1 level
                </div>
                {(stats.power === 'S' || stats.power === 'A') && (
                  <div style={{ color: '#fbbf24', marginTop: '3px' }}>⚠ Can force PC position worse by 1 step</div>
                )}
              </div>

              {/* Speed */}
              <div style={{ ...S.ref, marginBottom: '8px' }}>
                <div style={{ color: '#60a5fa', fontWeight: 'bold', marginBottom: '4px' }}>
                  SPEED {stats.speed} — {speedInfo.base}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', color: '#9ca3af' }}>
                  <div>Greater: {speedInfo.greater}</div>
                  <div>Lesser: {speedInfo.lesser}</div>
                </div>
                <div style={{ color: '#6b7280', marginTop: '2px' }}>Initiative: GM's call — NPCs never roll</div>
              </div>

              {/* Range */}
              <div style={{ ...S.ref, marginBottom: '8px' }}>
                <div style={{ color: '#34d399', fontWeight: 'bold', marginBottom: '4px' }}>
                  RANGE {stats.range} — {rangeInfo.base}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', color: '#9ca3af' }}>
                  <div>Greater: {rangeInfo.greater}</div>
                  <div>Lesser: {rangeInfo.lesser}</div>
                </div>
                {stats.range !== 'S' && (
                  <div style={{ color: '#6b7280', marginTop: '2px' }}>Beyond optimal range → Effect drops 1 level</div>
                )}
              </div>

              {/* Precision */}
              <div style={{ ...S.ref, marginBottom: '8px' }}>
                <div style={{ color: '#e879f9', fontWeight: 'bold', marginBottom: '4px' }}>
                  PRECISION {stats.precision} — Reactive Counter-Effects
                </div>
                <div style={{ color: '#9ca3af' }}>
                  <div>PC rolls 4–5 (partial): {precInfo.partial}</div>
                  <div style={{ marginTop: '2px' }}>PC rolls 1–3 (failure): {precInfo.failure}</div>
                </div>
              </div>

              {/* Development */}
              <div style={S.ref}>
                <div style={{ color: '#fb923c', fontWeight: 'bold', marginBottom: '4px' }}>
                  DEVELOPMENT {stats.development} — Tactical Adaptability
                </div>
                <div style={{ color: '#9ca3af', lineHeight: '1.5' }}>{devInfo}</div>
              </div>
            </div>

            {/* Abilities */}
            <div style={S.card}>
              <span style={S.lbl}>Stand Abilities</span>
              <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '8px' }}>
                Narrative descriptions only — no mechanical dots
              </div>
              {abilities.map(ab => (
                <div key={ab.id} style={{ background: '#1a1030', border: '1px solid #2d1f52', borderRadius: '4px', padding: '8px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                        <input value={ab.name}
                          onChange={e => setAbilities(p => p.map(a => a.id === ab.id ? { ...a, name: e.target.value } : a))}
                          style={{ ...S.inp, fontWeight: 'bold', borderBottom: '1px solid #4b2d8f', fontSize: '12px' }}
                          placeholder="Ability name"
                        />
                        <select value={ab.type}
                          onChange={e => setAbilities(p => p.map(a => a.id === ab.id ? { ...a, type: e.target.value } : a))}
                          style={{ ...S.sel, fontSize: '10px', padding: '2px 4px' }}>
                          <option value="unique">Unique</option>
                          <option value="standard">Standard</option>
                          <option value="passive">Passive</option>
                        </select>
                      </div>
                      <textarea value={ab.description}
                        onChange={e => setAbilities(p => p.map(a => a.id === ab.id ? { ...a, description: e.target.value } : a))}
                        placeholder="What does this ability do narratively?"
                        style={{ width: '100%', background: 'transparent', color: '#d1d5db', border: 'none', fontFamily: 'monospace', fontSize: '11px', resize: 'vertical', outline: 'none', minHeight: '40px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <button onClick={() => setAbilities(p => p.filter(a => a.id !== ab.id))}
                      style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', marginLeft: '6px', flexShrink: 0 }}>×</button>
                  </div>
                </div>
              ))}
              <button onClick={() => setAbilities(p => [...p, { id: Date.now(), name: '', description: '', type: 'unique' }])}
                style={{ ...S.btn, border: '2px dashed #2d1f52', background: 'transparent', color: '#6b7280', width: '100%', padding: '6px' }}>
                + Add Ability
              </button>
            </div>

          </div>

          {/* ════ RIGHT — Clocks + Armor ════ */}
          <div>

            {/* Durability / Vulnerability Section */}
            {isDurS ? (
              /* S-DURABILITY — No vulnerability clock */
              <div style={{ ...S.card, border: '2px solid #16a34a' }}>
                <div style={S.sdur}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#22c55e', marginBottom: '6px' }}>
                    ⬛ DURABILITY S — INVINCIBLE TO DIRECT HARM
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    This NPC has no Vulnerability Clock. Direct harm from PCs cannot defeat them.
                    Create alternative win condition clocks below.
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '10px' }}>
                    Examples: "Expose the User" · "Break Stand Logic" · "Destroy the Mechanism"
                  </div>
                </div>
                {/* Still show armor for S */}
                <div style={{ marginTop: '12px' }}>
                  <span style={S.lbl}>Armor Charges (S-DUR)</span>
                  <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginTop: '8px' }}>
                    <ArmorTracker label="REGULAR" max={regArmorMax} used={regularUsed}
                      onChange={setRegularUsed} color="#f59e0b" />
                    <ArmorTracker label="SPECIAL" max={specArmorMax} used={specialUsed}
                      onChange={setSpecialUsed} color="#7c3aed" />
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280', textAlign: 'center', marginTop: '6px' }}>
                    Spend BEFORE filling any clock. Special = completely negates harm.
                  </div>
                </div>

                {/* Alt win condition clocks */}
                <div style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={S.lbl}>Alternative Win Conditions</span>
                    <button onClick={addAltClock}
                      style={{ ...S.btn, background: '#166534', color: '#86efac', fontSize: '11px' }}>+ Add Clock</button>
                  </div>
                  {altClocks.length === 0 && (
                    <div style={{ ...S.warn, textAlign: 'center' }}>
                      S-DUR NPCs must have at least one alternative win condition clock!
                    </div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
                    {altClocks.map(clk => (
                      <div key={clk.id} style={{ textAlign: 'center', position: 'relative' }}>
                        <ProgressClock size={90} segments={clk.segments} filled={clk.filled}
                          onClick={f => updateAltClock(clk.id, f)} color="#16a34a"
                          label={clk.name} sublabel={`${clk.segments}-segment clock`} />
                        <button onClick={() => deleteAltClock(clk.id)}
                          style={{ position: 'absolute', top: '-4px', right: '-4px', color: '#f87171', background: '#1a0000', border: '1px solid #7f1d1d', borderRadius: '50%', width: '16px', height: '16px', cursor: 'pointer', fontSize: '10px', padding: 0, lineHeight: 1 }}>×</button>
                        <button onClick={() => {
                          const newName = prompt('Rename clock:', clk.name);
                          if (newName) setAltClocks(p => p.map(c => c.id === clk.id ? { ...c, name: newName } : c));
                        }} style={{ display: 'block', margin: '2px auto 0', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px' }}>rename</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* NORMAL DURABILITY — Vulnerability Clock + Armor */
              <div style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                  <span style={S.lbl}>Durability {stats.durability} — Vulnerability Clock</span>
                  <span style={{ fontSize: '10px', color: '#6b7280' }}>{vulnSegs} segments</span>
                </div>

                {/* Vuln clock — read-only display; PCs fill it via conflict clocks */}
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: '0 0 auto' }}>
                    {/* Vulnerability clock — represents cumulative harm taken */}
                    {(() => {
                      // Calculate total ticks from conflict clocks
                      const totalTicks = conflictClocks.reduce((s, c) => s + c.filled, 0);
                      const vulnFilled = Math.min(totalTicks, vulnSegs);
                      const isDefeated = vulnFilled >= vulnSegs;
                      return (
                        <div style={{ textAlign: 'center' }}>
                          {isDefeated && (
                            <div style={{ ...S.warn, marginBottom: '6px', textAlign: 'center', fontWeight: 'bold' }}>
                              ☠ DEFEATED
                            </div>
                          )}
                          <ProgressClock size={100} segments={vulnSegs} filled={vulnFilled}
                            color={isDefeated ? '#991b1b' : '#dc2626'}
                            label="Vulnerability" sublabel={`${vulnFilled}/${vulnSegs}`} />
                        </div>
                      );
                    })()}
                  </div>

                  {/* Armor charges */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                      Spend armor charges <strong>before</strong> filling clocks.
                    </div>
                    <ArmorTracker label="REGULAR ARMOR" max={regArmorMax} used={regularUsed}
                      onChange={setRegularUsed} color="#f59e0b" />
                    <ArmorTracker label="SPECIAL ARMOR" max={specArmorMax} used={specialUsed}
                      onChange={setSpecialUsed} color="#7c3aed" />
                    <div style={{ fontSize: '10px', color: '#4b5563', lineHeight: '1.5' }}>
                      Regular: reduce harm by 1 level<br />
                      Special: completely negate harm
                    </div>
                    <button onClick={() => { setRegularUsed(0); setSpecialUsed(0); }}
                      style={{ ...S.btn, background: '#1f2937', color: '#9ca3af', fontSize: '10px', alignSelf: 'flex-start' }}>
                      Reset Armor
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Conflict Clocks — PCs roll to fill these */}
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <span style={S.lbl}>Conflict Clocks</span>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                    PCs roll action ratings to fill these. Limited=1 tick, Standard=2, Greater=3.
                  </div>
                </div>
                <button onClick={addConflictClock}
                  style={{ ...S.btn, background: '#4c1d95', color: '#e9d5ff', fontSize: '11px' }}>+ Clock</button>
              </div>

              {conflictClocks.length === 0 && (
                <div style={{ color: '#6b7280', fontSize: '11px', textAlign: 'center', padding: '12px' }}>
                  No clocks yet — add one to start tracking the conflict.
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: conflictClocks.length <= 2 ? 'center' : 'flex-start' }}>
                {conflictClocks.map(clk => {
                  const isComplete = clk.filled >= clk.segments;
                  return (
                    <div key={clk.id} style={{ textAlign: 'center', position: 'relative', background: isComplete ? '#0a1a0a' : 'transparent', border: isComplete ? '1px solid #16a34a' : 'none', borderRadius: '6px', padding: isComplete ? '6px' : '0' }}>
                      {isComplete && (
                        <div style={{ fontSize: '10px', color: '#22c55e', fontWeight: 'bold', marginBottom: '4px' }}>✓ COMPLETE</div>
                      )}
                      <ProgressClock size={90} segments={clk.segments} filled={clk.filled}
                        onClick={f => updateConflictClock(clk.id, f)}
                        color={isComplete ? '#16a34a' : '#7c3aed'}
                        label={clk.name} sublabel={`${clk.segments}-seg`} />
                      <div style={{ marginTop: '4px', display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button onClick={() => {
                          const newName = prompt('Rename clock:', clk.name);
                          if (newName) setConflictClocks(p => p.map(c => c.id === clk.id ? { ...c, name: newName } : c));
                        }} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px' }}>rename</button>
                        <button onClick={() => deleteConflictClock(clk.id)}
                          style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px' }}>delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Effect tick reference */}
              <div style={{ marginTop: '12px', display: 'flex', gap: '6px', justifyContent: 'center' }}>
                {[['LIMITED', '1 tick', '#6b7280'], ['STANDARD', '2 ticks', '#7c3aed'], ['GREATER', '3 ticks', '#16a34a']].map(([label, ticks, color]) => (
                  <div key={label} style={{ background: '#0a0a14', border: `1px solid ${color}`, borderRadius: '4px', padding: '4px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color, fontWeight: 'bold' }}>{label}</div>
                    <div style={{ fontSize: '11px', color: '#d1d5db' }}>{ticks}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Level Differential Reference */}
            <div style={S.card}>
              <span style={S.lbl}>Level Differential</span>
              <div style={{ fontSize: '11px', lineHeight: '1.8', color: '#9ca3af' }}>
                <div><span style={{ color: '#34d399' }}>PC Level &gt; NPC Level:</span> +1 Position OR +1 Effect (GM chooses)</div>
                <div><span style={{ color: '#f87171' }}>NPC Level &gt; PC Level:</span> −1 Position OR −1 Effect (GM chooses)</div>
                <div><span style={{ color: '#dc2626' }}>NPC Level 3+ higher:</span> Both worsen position AND reduce effect</div>
              </div>
              <div style={{ marginTop: '8px', padding: '6px', background: '#0a0a14', borderRadius: '4px', fontSize: '11px', color: '#6b7280' }}>
                This NPC is Level <strong style={{ color: level >= 7 ? '#f87171' : level >= 4 ? '#fbbf24' : '#34d399' }}>{level}</strong> ({totalSpentXP} XP in Stand Coin).
                Starting PCs are Level 1 (~95 XP: 60 coin + 35 dots). Level differential effects apply automatically.
              </div>
            </div>

            {/* GM Notes */}
            <div style={S.card}>
              <span style={S.lbl}>GM Notes</span>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Tactics, motivations, encounter context, rematch notes…"
                style={{ width: '100%', height: '120px', background: '#0a0a14', color: '#d1d5db', border: '1px solid #2d1f52', padding: '8px', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

          </div>
        </div>
        </>)}

        {/* ══════════════════════════════════ CREW MODE ══════════════════════════════════ */}
        {activeMode === 'CREW' && (
          <div>
            {/* Crew Header */}
            <div style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#c4b5fd' }}>
                  {name || 'Unnamed NPC'} — Crew Management
                </span>
                {role && <span style={{ background: '#4c1d95', padding: '2px 10px', borderRadius: '4px', fontSize: '11px', color: '#e9d5ff' }}>{role}</span>}
              </div>
              <div style={{ marginTop: '8px' }}>
                <span style={S.lbl}>CREW / FACTION</span>
                <select
                  style={S.sel}
                  value={faction || ''}
                  onChange={(e) => setFaction(e.target.value ? parseInt(e.target.value, 10) : '')}
                >
                  <option value="">— None —</option>
                  {campaignFactions.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>
                  Faction this NPC belongs to (also manageable in campaign management)
                </div>
              </div>
            </div>

            <div style={S.g2}>
              {/* Contacts */}
              <div style={S.card}>
                <span style={S.lbl}>CONTACTS / ASSOCIATES</span>
                <div style={{ marginBottom: '8px' }}>
                  {contacts.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                      <input value={c.name} placeholder="Name"
                        onChange={e => setContacts(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                        style={{ ...S.inp, flex: 1 }} />
                      <input value={c.role || ''} placeholder="Role / relation"
                        onChange={e => setContacts(p => p.map((x, j) => j === i ? { ...x, role: e.target.value } : x))}
                        style={{ ...S.inp, flex: 1 }} />
                      <select value={c.disposition || 'neutral'}
                        onChange={e => setContacts(p => p.map((x, j) => j === i ? { ...x, disposition: e.target.value } : x))}
                        style={{ ...S.sel, fontSize: '11px', padding: '2px 4px' }}>
                        <option value="allied">Allied</option>
                        <option value="friendly">Friendly</option>
                        <option value="neutral">Neutral</option>
                        <option value="suspicious">Suspicious</option>
                        <option value="hostile">Hostile</option>
                      </select>
                      <button onClick={() => setContacts(p => p.filter((_, j) => j !== i))}
                        style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}>✕</button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setContacts(p => [...p, { name: '', role: '', disposition: 'neutral' }])}
                  style={{ ...S.btn, border: '2px dashed #374151', background: 'transparent', color: '#6b7280', width: '100%', padding: '6px' }}>
                  + Add Contact
                </button>
              </div>

              {/* Faction Status */}
              <div style={S.card}>
                <span style={S.lbl}>FACTION STATUS</span>
                <div style={{ marginBottom: '8px' }}>
                  {Object.entries(factionStatus).map(([faction, value]) => (
                    <div key={faction} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                      <span style={{ flex: 1, fontSize: '12px', color: '#d1d5db' }}>{faction}</span>
                      <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                        <button onClick={() => setFactionStatus(p => ({ ...p, [faction]: Math.max(-3, (p[faction] || 0) - 1) }))}
                          style={{ ...S.btn, padding: '1px 6px', background: '#7f1d1d', color: '#fca5a5', fontSize: '11px' }}>−</button>
                        <span style={{
                          display: 'inline-block', width: '28px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px',
                          color: value > 0 ? '#34d399' : value < 0 ? '#f87171' : '#9ca3af',
                        }}>{value > 0 ? `+${value}` : value}</span>
                        <button onClick={() => setFactionStatus(p => ({ ...p, [faction]: Math.min(3, (p[faction] || 0) + 1) }))}
                          style={{ ...S.btn, padding: '1px 6px', background: '#14532d', color: '#86efac', fontSize: '11px' }}>+</button>
                      </div>
                      <button onClick={() => setFactionStatus(p => { const n = { ...p }; delete n[faction]; return n; })}
                        style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}>✕</button>
                    </div>
                  ))}
                </div>
                <button onClick={() => {
                  const n = prompt('Faction name:');
                  if (n && !factionStatus[n]) setFactionStatus(p => ({ ...p, [n]: 0 }));
                }}
                  style={{ ...S.btn, border: '2px dashed #374151', background: 'transparent', color: '#6b7280', width: '100%', padding: '6px' }}>
                  + Add Faction
                </button>
                <div style={{ marginTop: '10px', fontSize: '10px', color: '#6b7280' }}>
                  −3 War · −2 Hostile · −1 Interfering · 0 Neutral · +1 Helpful · +2 Friendly · +3 Allied
                </div>
              </div>
            </div>

            {/* Inventory */}
            <div style={S.card}>
              <span style={S.lbl}>INVENTORY / ASSETS</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {inventory.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '4px', alignItems: 'center', background: '#1f1035', padding: '4px 8px', borderRadius: '4px', border: '1px solid #2d1f52' }}>
                    <input value={item.name} placeholder="Item"
                      onChange={e => setInventory(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                      style={{ ...S.inp, width: '120px', borderBottom: 'none', fontSize: '12px' }} />
                    <input value={item.qty != null ? item.qty : ''} placeholder="#" type="number" min="0"
                      onChange={e => setInventory(p => p.map((x, j) => j === i ? { ...x, qty: e.target.value === '' ? null : Number(e.target.value) } : x))}
                      style={{ ...S.inp, width: '36px', borderBottom: 'none', fontSize: '12px', textAlign: 'center' }} />
                    <button onClick={() => setInventory(p => p.filter((_, j) => j !== i))}
                      style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                  </div>
                ))}
              </div>
              <button onClick={() => setInventory(p => [...p, { name: '', qty: 1 }])}
                style={{ ...S.btn, border: '2px dashed #374151', background: 'transparent', color: '#6b7280', width: '100%', padding: '6px' }}>
                + Add Item
              </button>
            </div>

            {/* Crew Notes */}
            <div style={S.card}>
              <span style={S.lbl}>CREW NOTES</span>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Crew connections, territory control, gang resources, operations notes…"
                style={{ width: '100%', height: '140px', background: '#0a0a14', color: '#d1d5db', border: '1px solid #2d1f52', padding: '8px', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export { NPCSheet };

// ─── App Wrapper (standalone demo) ─────────────────────────────────────────────

export default function App() {
  const [current] = useState({
    id: 1,
    name: 'Yoshikage Kira',
    standName: 'Killer Queen',
    role: 'Boss',
    notes: 'Obsessive, methodical. Wants a quiet life. Will reset scenario if cornered.',
    stats: { power: 'A', speed: 'B', range: 'C', durability: 'B', precision: 'A', development: 'C' },
    conflictClocks: [
      { id: 1, name: 'Defeat Kira', segments: 12, filled: 0 },
      { id: 2, name: 'Expose Identity', segments: 6, filled: 0 },
    ],
    altClocks: [],
    regularUsed: 0,
    specialUsed: 0,
    abilities: [
      { id: 1, name: 'Sheer Heart Attack', type: 'unique', description: 'Heat-seeking autonomous bomb.' },
      { id: 2, name: 'Bites the Dust', type: 'unique', description: 'Reversal bomb implanted in a host.' },
    ],
  });

  const handleSave = async (data) => {
    console.log('Demo save:', data);
    return data;
  };

  return (
    <NPCSheet
      npc={current}
      onSave={handleSave}
      campaigns={[]}
    />
  );
}

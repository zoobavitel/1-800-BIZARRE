import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  GRADE,
  MAX_CREATION_DOTS,
  MAX_DOTS_PER_ACTION_CREATION,
  PC_STAT_DESC,
  DUR_TABLE,
  DEV_SESSION_XP,
  ACTION_ATTR,
  VICE_OPTIONS,
  DEFAULT_TRAUMA,
} from '../features/character-sheet/constants/srd';

// ─── ProgressClock ────────────────────────────────────────────────────────────

const ProgressClock = ({ size = 80, segments = 4, filled = 0, onClick = null, interactive = false }) => {
  const r = size / 2 - 4, cx = size / 2, cy = size / 2;
  const sa = 360 / segments;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {Array.from({ length: segments }, (_, i) => {
        const a1 = ((i * sa - 90) * Math.PI) / 180;
        const a2 = (((i + 1) * sa - 90) * Math.PI) / 180;
        const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
        const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
        return (
          <path key={i}
            d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${sa > 180 ? 1 : 0} 1 ${x2} ${y2} Z`}
            fill={i < filled ? '#dc2626' : 'transparent'} stroke="#6b7280" strokeWidth="1"
            style={{ cursor: interactive ? 'pointer' : 'default' }}
            onClick={interactive && onClick ? () => onClick(i < filled ? i : i + 1) : undefined}
          />
        );
      })}
      <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="#6b7280" strokeWidth="2" />
    </svg>
  );
};

// ─── CharacterSheetWrapper ────────────────────────────────────────────────────

const CharacterSheetWrapper = ({ character, onClose, onSave, onCreateNew, onSwitchCharacter, allCharacters = [], campaigns = [] }) => {
  const [activeMode, setActiveMode] = useState('CHARACTER MODE');

  // Identity
  const [charData, setCharData] = useState({
    name: character?.name || '', standName: character?.standName || '',
    heritage: character?.heritage || 'Human', background: character?.background || '',
    look: character?.look || '', vice: character?.vice || '', crew: character?.crew || '',
  });

  // Campaign assignment
  const [campaignId, setCampaignId] = useState(character?.campaign || '');

  // Portrait state
  const [imageFile, setImageFile]       = useState(null);
  const [imageUrl, setImageUrl]         = useState(character?.image_url || '');
  const [imagePreview, setImagePreview] = useState(character?.image || character?.image_url || '');
  const fileInputRef = useRef(null);

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState(null);
  const debounceRef = useRef(null);
  const mountedRef  = useRef(false);
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

  // FIX 2+3: Stand Coin Stats — F(0)..A(4); S is GM-only
  const [standStats, setStandStats] = useState(character?.standStats || {
    power: 1, speed: 1, range: 1, durability: 1, precision: 1, development: 1,
  });

  // FIX 1: Action ratings — creation enforces 7 total / max 2 per action
  const [actionRatings, setActionRatings] = useState(character?.actionRatings || {
    HUNT: 0, STUDY: 0, SURVEY: 0, TINKER: 0,
    FINESSE: 0, PROWL: 0, SKIRMISH: 0, WRECK: 0,
    BIZARRE: 0, COMMAND: 0, CONSORT: 0, SWAY: 0,
  });

  // Stress — tracked as filled count; max derived from Durability
  const [stressFilled, setStressFilled] = useState(character?.stressFilled || 0);

  // Trauma (object from API or DEFAULT_TRAUMA)
  const [trauma, setTrauma] = useState(character?.trauma && typeof character.trauma === 'object' && !Array.isArray(character.trauma)
    ? { ...DEFAULT_TRAUMA, ...character.trauma }
    : DEFAULT_TRAUMA);

  // FIX 4: Armor charges derived from Durability grade
  const [regularArmorUsed, setRegularArmorUsed] = useState(character?.regularArmorUsed || 0);
  const [specialArmorUsed, setSpecialArmorUsed] = useState(character?.specialArmorUsed || false);

  // Harm (API can send harm or harmEntries)
  const [harm, setHarm] = useState(character?.harm || character?.harmEntries || {
    level3: [''], level2: ['', ''], level1: ['', ''],
  });
  const [healingClock, setHealingClock] = useState(character?.healingClock ?? 0);

  // Coin & Stash (API sends coin as array; sheet uses coinFilled number)
  const [coinFilled, setCoinFilled] = useState(
    typeof character?.coinFilled === 'number' ? character.coinFilled
      : Array.isArray(character?.coin) ? character.coin.filter(Boolean).length
      : 0
  );
  const [stashBoxes, setStashBoxes] = useState(character?.stash && Array.isArray(character.stash)
    ? character.stash
    : Array(40).fill(false));

  // XP tracks
  const [xp, setXp] = useState(character?.xp || {
    insight: 0, prowess: 0, resolve: 0, heritage: 0, playbook: 0,
  });

  // FIX 6: Level-up modal state
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpChoice, setLevelUpChoice] = useState('stat');
  const [levelUpStat, setLevelUpStat] = useState('power');
  const [levelUpDot1, setLevelUpDot1] = useState('HUNT');
  const [levelUpDot2, setLevelUpDot2] = useState('HUNT');

  // FIX 7: Minor advance action selector
  const [minorAdvanceAction, setMinorAdvanceAction] = useState('HUNT');

  // Abilities & Clocks
  const [abilities, setAbilities] = useState(character?.abilities || []);
  const [clocks, setClocks] = useState(character?.clocks || []);
  const [playbook, setPlaybook] = useState(character?.playbook || 'Stand');

  // Dice result
  const [diceResult, setDiceResult] = useState(null);

  // Crew
  const [crewData, setCrewData] = useState({
    name: '', reputation: '', rep: 0, turf: 0, hold: 'strong', tier: 0,
    wanted: 0, coin: 0, description: '', specialAbilities: [],
    upgrades: {
      lair: { carriage:false, boat:false, hidden:false, quarters:false, secure:false, vault:false, workshop:false },
      training: { insight:false, prowess:false, resolve:false, personal:false, mastery:false },
    },
    notes: '',
  });

  // ─── Derived Values ──────────────────────────────────────────────────────────

  const durVal = Math.min(4, Math.max(0, Number(standStats.durability) || 1));
  const devVal = Math.min(4, Math.max(0, Number(standStats.development) || 1));
  const maxStress       = 9 + (DUR_TABLE[durVal]?.stressBonus ?? 0);
  const maxArmorCharges = DUR_TABLE[durVal]?.armorCharges ?? 1;
  const sessionDevXP    = DEV_SESSION_XP[devVal] ?? 0;

  const totalActionDots  = Object.values(actionRatings).reduce((s, v) => s + v, 0);
  const totalStandPoints = Object.values(standStats).reduce((s, v) => s + v, 0);
  const totalXP          = Object.values(xp).reduce((s, v) => s + v, 0);
  const dotsRemaining    = MAX_CREATION_DOTS - totalActionDots;

  // XP expenditure accounting
  // Each stand coin grade = 10 XP (cost of one level-up stat advance)
  // Each action dot = 5 XP (cost of one minor advance)
  // Level 1 baseline = 95 XP (6 coin pts × 10 + 7 dots × 5)
  const totalSpentXP = (totalStandPoints * 10) + (totalActionDots * 5);
  const pcLevel = 1 + Math.floor((totalSpentXP - 95) / 10);

  // PC

  const getAttributeDice = (actions) => actions.filter(a => actionRatings[a] > 0).length;

  // ─── Handlers ────────────────────────────────────────────────────────────────

  // FIX 1: Creation-mode dot clicks — hard cap 7 total / max 2 per action
  const updateActionRating = (action, newVal) => {
    if (newVal < 0 || newVal > MAX_DOTS_PER_ACTION_CREATION) return;
    const delta = newVal - actionRatings[action];
    if (delta > 0 && totalActionDots + delta > MAX_CREATION_DOTS) return;
    setActionRatings(p => ({ ...p, [action]: newVal }));
  };

  // Advancement path can go beyond 2, up to 4
  const advanceActionDot = (action) => {
    if (actionRatings[action] >= 4) return;
    setActionRatings(p => ({ ...p, [action]: p[action] + 1 }));
  };

  // FIX 2: Hard cap at A(4) — S is GM-only
  const incrementStat = (stat) => {
    if (standStats[stat] >= 4) return;
    setStandStats(p => ({ ...p, [stat]: p[stat] + 1 }));
  };

  // FIX 3: Prevent all-F — at least one stat must stay D or higher
  const decrementStat = (stat) => {
    if (standStats[stat] <= 0) return;
    const allWouldBeF = Object.entries(standStats).every(
      ([k, v]) => k === stat ? (v - 1) === 0 : v === 0
    );
    if (allWouldBeF) return;
    setStandStats(p => ({ ...p, [stat]: p[stat] - 1 }));
  };

  const toggleXP = (track, idx) => {
    const maxVals = { insight:5, prowess:5, resolve:5, heritage:5, playbook:10 };
    setXp(p => ({ ...p, [track]: Math.min(idx < p[track] ? idx : idx + 1, maxVals[track]) }));
  };

  // Spend XP from pools in priority order
  const deductXP = (amount) => {
    let rem = amount;
    const next = { ...xp };
    for (const key of ['playbook','insight','prowess','resolve','heritage']) {
      const take = Math.min(rem, next[key]);
      next[key] -= take;
      rem -= take;
      if (rem === 0) break;
    }
    setXp(next);
  };

  // FIX 6: Confirm level-up (binary choice)
  const confirmLevelUp = () => {
    if (totalXP < 10) return;
    deductXP(10);
    if (levelUpChoice === 'stat') {
      incrementStat(levelUpStat);
    } else {
      advanceActionDot(levelUpDot1);
      advanceActionDot(levelUpDot2);
    }
    setShowLevelUp(false);
  };

  // FIX 7: Minor advance — 5 XP for +1 action dot (outside level-up)
  const spendXPForDot = () => {
    if (totalXP < 5 || actionRatings[minorAdvanceAction] >= 4) return;
    deductXP(5);
    advanceActionDot(minorAdvanceAction);
  };

  // FIX 8: Resistance critical → stressCost = -1 (clear 1 stress, pay none)
  const rollDice = (actionName, diceCount, isResistance = false, isDesperateAction = false) => {
    let dice, highest, sixes, isCritical, outcome;

    if (diceCount === 0) {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      highest = Math.min(d1, d2);
      dice = [d1, d2]; sixes = 0; isCritical = false;
      outcome = highest >= 6 ? 'Success' : highest >= 4 ? 'Partial Success' : 'Failure';
    } else {
      dice    = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1);
      highest = Math.max(...dice);
      sixes   = dice.filter(d => d === 6).length;
      isCritical = sixes >= 2;
      outcome = highest >= 6 ? (isCritical ? 'Critical Success' : 'Success') : highest >= 4 ? 'Partial Success' : 'Failure';
    }

    // FIX 8: Critical resistance = 0 stress cost AND clear 1 stress; represented as -1
    const stressCost = isResistance
      ? (isCritical ? -1 : Math.max(0, 6 - highest))
      : null;

    setDiceResult({
      action: actionName, dice, result: highest, outcome,
      special: isCritical ? `Critical! (${sixes} sixes)` : '',
      isResistance, stressCost, zeroDice: diceCount === 0,
      isDesperateAction, isCritical,
    });

    if (isDesperateAction && !isResistance) {
      const attr = ACTION_ATTR[actionName];
      if (attr) setXp(p => ({ ...p, [attr]: Math.min(p[attr] + 1, 5) }));
    }
  };

  const addClock = () => {
    const name = prompt('Clock name:');
    const segs = parseInt(prompt('Segments (4, 6, 8):') || '4');
    if (name && [4, 6, 8].includes(segs))
      setClocks(p => [...p, { id: Date.now(), name, segments: segs, filled: 0 }]);
  };

  const buildPayload = useCallback(() => {
    const backendId =
      character?.id != null &&
      Number.isInteger(Number(character.id)) &&
      Number(character.id) > 0 &&
      Number(character.id) < 1e10
        ? character.id
        : null;
    return {
      ...charData, standStats, actionRatings, stressFilled,
      trauma, regularArmorUsed, specialArmorUsed, harm, healingClock,
      coinFilled, stash: stashBoxes, xp, abilities, clocks, playbook,
      campaign: campaignId || null,
      image_url: imageUrl,
      ...(imageFile ? { imageFile } : {}),
      id: backendId, lastModified: new Date().toISOString(),
    };
  }, [charData, standStats, actionRatings, stressFilled, trauma, regularArmorUsed, specialArmorUsed, harm, healingClock, coinFilled, stashBoxes, xp, abilities, clocks, playbook, campaignId, imageUrl, imageFile, character?.id]);

  // Debounced auto-save
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (savingRef.current || !onSave) return;
      savingRef.current = true;
      setSaveStatus('saving');
      try {
        await onSave(buildPayload());
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
  }, [charData, standStats, actionRatings, stressFilled, trauma, regularArmorUsed, specialArmorUsed, harm, healingClock, coinFilled, stashBoxes, xp, abilities, clocks, playbook, campaignId, imageUrl, imageFile]);

  // ─── Styles ──────────────────────────────────────────────────────────────────

  const S = {
    page:  { fontFamily:'monospace', fontSize:'13px', background:'#000', color:'#fff', minHeight:'100vh' },
    hdr:   { background:'#1f2937', padding:'8px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid #4b5563', position:'sticky', top:0, zIndex:10 },
    card:  { background:'#111827', border:'1px solid #374151', borderRadius:'4px', padding:'12px', marginBottom:'12px' },
    lbl:   { color:'#f87171', fontSize:'11px', fontWeight:'bold', marginBottom:'4px', display:'block' },
    inp:   { background:'transparent', color:'#fff', border:'none', borderBottom:'1px solid #4b5563', padding:'2px 4px', width:'100%', fontFamily:'monospace', fontSize:'13px', outline:'none', boxSizing:'border-box' },
    sel:   { background:'#374151', color:'#fff', border:'1px solid #4b5563', padding:'4px 8px', fontSize:'12px', fontFamily:'monospace' },
    btn:   { padding:'4px 12px', borderRadius:'4px', fontSize:'12px', cursor:'pointer', border:'none', fontFamily:'monospace' },
    g2:    { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' },
    g3:    { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'16px' },
    warn:  { background:'#7f1d1d', border:'1px solid #b91c1c', borderRadius:'4px', padding:'4px 8px', fontSize:'11px', color:'#fca5a5' },
    info:  { background:'#1e1b4b', border:'1px solid #4338ca', borderRadius:'4px', padding:'4px 8px', fontSize:'11px', color:'#a5b4fc' },
    gold:  { background:'#451a03', border:'1px solid #92400e', borderRadius:'4px', padding:'6px 10px', fontSize:'11px', color:'#fcd34d' },
    green: { background:'#14532d', border:'1px solid #166534', borderRadius:'4px', padding:'4px 8px', fontSize:'11px', color:'#86efac' },
  };

  const dotColor = dotsRemaining === 0 ? '#f87171' : dotsRemaining <= 2 ? '#eab308' : '#6b7280';

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>

      {/* ── Header ── */}
      <div style={S.hdr}>
        <div style={{ fontSize:'18px', fontWeight:'bold' }}>1(800)BIZARRE — {activeMode}</div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <select value={activeMode} onChange={e => setActiveMode(e.target.value)} style={S.sel}>
            <option>CHARACTER MODE</option>
            <option>CREW MODE</option>
          </select>
          {saveStatus === 'saving' && <span style={{ fontSize:'11px', color:'#fbbf24' }}>Saving...</span>}
          {saveStatus === 'saved'  && <span style={{ fontSize:'11px', color:'#34d399' }}>Saved</span>}
          {saveStatus === 'error'  && <span style={{ fontSize:'11px', color:'#f87171' }}>Error saving</span>}
          {onClose && <button onClick={onClose} style={{ background:'none', border:'none', color:'#9ca3af', cursor:'pointer', fontSize:'18px' }}>✕</button>}
        </div>
      </div>

      <div style={{ padding:'16px', maxWidth:'1400px', margin:'0 auto' }}>

        {/* ══════════════════════════════════ CHARACTER MODE ══════════════════════════════════ */}
        {activeMode === 'CHARACTER MODE' && (
          <>
            {/* Character bar */}
            <div style={{ ...S.card, display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <span style={{ color:'#9ca3af', fontSize:'11px', fontWeight:'bold' }}>CURRENT CHARACTER</span>
                <span style={{ fontWeight:'bold' }}>{charData.name || 'Unnamed Character'}</span>
                {charData.standName && <span style={{ color:'#a78bfa' }}>「{charData.standName}」</span>}
              </div>
              <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                <div style={{ background:'#1e1b4b', border:'1px solid #4338ca', borderRadius:'4px', padding:'4px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:'10px', color:'#818cf8', fontWeight:'bold', letterSpacing:'0.05em' }}>LEVEL</div>
                  <div style={{ fontSize:'20px', fontWeight:'bold', lineHeight:1, color: pcLevel >= 7 ? '#f87171' : pcLevel >= 4 ? '#fbbf24' : '#a5b4fc' }}>
                    {pcLevel}
                  </div>
                  <div style={{ fontSize:'9px', color:'#4b5563', marginTop:'1px' }}>{totalSpentXP} XP spent</div>
                </div>
                {(allCharacters.length >= 1 || charData?.id == null) && (
                  <select
                    style={S.sel}
                    value={charData?.id != null ? charData.id : 'new'}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === 'new' && onSwitchCharacter) {
                        onSwitchCharacter(null);
                    return;
                      }
                      const c = allCharacters.find(ch => ch.id === parseInt(val, 10));
                      if (c && onSwitchCharacter) onSwitchCharacter(c);
                    }}
                  >
                    <option value="new">— New character —</option>
                    {allCharacters.map(c => <option key={c.id} value={c.id}>{c.name || 'Unnamed'}</option>)}
                  </select>
                )}
                {onCreateNew && (
                  <button onClick={onCreateNew} style={{ ...S.btn, background:'#16a34a', color:'#fff' }}>+ New Character</button>
                )}
              </div>
            </div>

            <div style={S.g2}>

              {/* ══ LEFT COLUMN ══ */}
              <div>

                {/* Identity */}
                <div style={S.card}>
                  <div style={{ display:'flex', gap:'16px', alignItems:'start' }}>
                    {/* Portrait */}
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', flexShrink:0 }}>
                      <div style={{
                        width:'80px', height:'80px', borderRadius:'50%', border:'2px solid #4b5563',
                        background:'#1f2937', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center',
                      }}>
                        {imagePreview
                          ? <img src={imagePreview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : <span style={{ color:'#4b5563', fontSize:'28px' }}>?</span>}
                      </div>
                      <div style={{ display:'flex', gap:'4px' }}>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display:'none' }} />
                        <button onClick={() => fileInputRef.current?.click()}
                          style={{ ...S.btn, fontSize:'9px', padding:'2px 6px', background:'#1f2937', color:'#9ca3af' }}>Upload</button>
                        <button onClick={handleImageUrlPrompt}
                          style={{ ...S.btn, fontSize:'9px', padding:'2px 6px', background:'#1f2937', color:'#9ca3af' }}>URL</button>
                      </div>
                    </div>
                    {/* Identity fields */}
                    <div style={{ flex:1 }}>
                      <div style={S.g2}>
                        <div><span style={S.lbl}>NAME</span><input style={S.inp} value={charData.name} onChange={e => setCharData(p => ({ ...p, name: e.target.value }))} placeholder="Character Name" /></div>
                        <div><span style={S.lbl}>CREW</span><input style={S.inp} value={charData.crew} onChange={e => setCharData(p => ({ ...p, crew: e.target.value }))} placeholder="Crew Name" /></div>
                      </div>
                      <div style={{ marginTop:'8px' }}>
                        <span style={S.lbl}>STAND NAME</span>
                        <input style={S.inp} value={charData.standName} onChange={e => setCharData(p => ({ ...p, standName: e.target.value }))} placeholder="「Stand Name」" />
                      </div>
                      <div style={{ marginTop:'8px' }}>
                        <span style={S.lbl}>LOOK</span>
                        <input style={S.inp} value={charData.look} onChange={e => setCharData(p => ({ ...p, look: e.target.value }))} placeholder="Appearance and style" />
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginTop:'8px' }}>
                        <div><span style={S.lbl}>HERITAGE</span><input style={S.inp} value={charData.heritage} onChange={e => setCharData(p => ({ ...p, heritage: e.target.value }))} placeholder="Heritage" /></div>
                        <div><span style={S.lbl}>BACKGROUND</span><input style={S.inp} value={charData.background} onChange={e => setCharData(p => ({ ...p, background: e.target.value }))} placeholder="Background" /></div>
                        <div>
                          <span style={S.lbl}>CAMPAIGN</span>
                          <select style={{ ...S.sel, width:'100%' }} value={campaignId} onChange={e => setCampaignId(e.target.value)}>
                            <option value="">No Campaign</option>
                            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ marginTop:'8px' }}>
                        <span style={S.lbl}>VICE / PURVEYOR</span>
                        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                          <select value={charData.vice} onChange={e => setCharData(p => ({ ...p, vice: e.target.value }))} style={S.sel}>
                            <option value="">Select Vice</option>
                            {VICE_OPTIONS.map(v => <option key={v}>{v}</option>)}
                          </select>
                          <input style={{ ...S.inp, flex:1 }} placeholder="Purveyor details" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stress & Trauma */}
                <div style={S.card}>
                  {/* FIX 4: stress max labeled with durability contribution */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:'6px' }}>
                    <span style={{ ...S.lbl, marginBottom:0 }}>STRESS</span>
                    <span style={{ fontSize:'11px', color:'#6b7280' }}>
                      {stressFilled}/{maxStress}
                      {DUR_TABLE[durVal].stressBonus !== 0 && (
                        <span style={{ color: DUR_TABLE[durVal].stressBonus > 0 ? '#34d399' : '#f87171' }}>
                          {' '}({DUR_TABLE[durVal].stressBonus > 0 ? '+' : ''}{DUR_TABLE[durVal].stressBonus} DUR)
                        </span>
                      )}
                    </span>
                  </div>
                  <div style={{ display:'flex', gap:'3px', flexWrap:'wrap', marginBottom:'12px' }}>
                    {Array.from({ length: maxStress }, (_, i) => (
                      <div key={i}
                        onClick={() => setStressFilled(i < stressFilled ? i : i + 1)}
                        style={{ width:'22px', height:'22px', border:'1px solid #4b5563', cursor:'pointer', background: i < stressFilled ? '#dc2626' : '#1f2937' }}
                      />
                    ))}
                  </div>
                  <span style={S.lbl}>TRAUMA</span>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
                    {Object.entries(trauma).map(([t, checked]) => (
                      <label key={t} style={{ display:'flex', alignItems:'center', gap:'4px', cursor:'pointer', fontSize:'11px' }}>
                        <input type="checkbox" checked={checked} onChange={() => setTrauma(p => ({ ...p, [t]: !p[t] }))} />
                        {t}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Harm + Armor */}
                <div style={S.card}>
                  <div style={{ display:'flex', gap:'16px' }}>
                    <div style={{ flex:1 }}>
                      <span style={S.lbl}>HARM</span>
                      {[
                        { key:'level3', label:'NEED HELP', count:1 },
                        { key:'level2', label:'-1D', count:2 },
                        { key:'level1', label:'LESS EFFECT', count:2 },
                      ].map(({ key, label, count }) =>
                        Array.from({ length: count }, (_, idx) => (
                          <div key={`${key}-${idx}`} style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' }}>
                            <span style={{ fontSize:'10px', color:'#9ca3af', width:'68px', flexShrink:0 }}>{label}</span>
                            <input style={{ ...S.inp, border:'1px solid #374151', background:'#0a0a0a', padding:'2px 6px', fontSize:'11px' }}
                              placeholder={`Lv${key.slice(-1)} harm`}
                              value={harm[key][idx]}
                              onChange={e => setHarm(p => ({ ...p, [key]: p[key].map((v, i) => i === idx ? e.target.value : v) }))}
                            />
                          </div>
                        ))
                      )}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
                      <span style={{ fontSize:'10px', color:'#9ca3af' }}>HEALING</span>
                      <ProgressClock size={55} segments={4} filled={healingClock} interactive onClick={setHealingClock} />
                    </div>

                    {/* FIX 4: Armor charges derived from Durability */}
                    <div style={{ minWidth:'90px' }}>
                      <span style={{ fontSize:'10px', color:'#9ca3af', display:'block', marginBottom:'4px' }}>
                        ARMOR
                        <span style={{ color:'#f59e0b', marginLeft:'4px' }}>
                          ({maxArmorCharges} chg)
                        </span>
                      </span>
                      {maxArmorCharges === 0 ? (
                        <div style={{ fontSize:'10px', color:'#6b7280' }}>F-DUR: no armor</div>
                      ) : (
                        <div style={{ display:'flex', gap:'3px', marginBottom:'6px' }}>
                          {Array.from({ length: maxArmorCharges }, (_, i) => (
                            <div key={i}
                              onClick={() => setRegularArmorUsed(i < regularArmorUsed ? i : i + 1)}
                              title={i < regularArmorUsed ? 'Used — click to restore' : 'Click to spend'}
                              style={{ width:'20px', height:'20px', border:'1px solid #4b5563', cursor:'pointer',
                                background: i < regularArmorUsed ? '#b45309' : '#1f2937' }}
                            />
                          ))}
                        </div>
                      )}
                      <label style={{ display:'flex', alignItems:'center', gap:'4px', cursor:'pointer', fontSize:'11px' }}>
                        <input type="checkbox" checked={specialArmorUsed} onChange={e => setSpecialArmorUsed(e.target.checked)} />
                        SPECIAL
                      </label>
                    </div>
                  </div>
                </div>

                {/* Coin & Stash */}
                <div style={S.card}>
                  <span style={S.lbl}>COIN</span>
                  <div style={{ display:'flex', gap:'4px', marginBottom:'8px' }}>
                    {Array.from({ length: 4 }, (_, i) => (
                      <div key={i} onClick={() => setCoinFilled(i < coinFilled ? i : i + 1)}
                        style={{ width:'24px', height:'24px', border:'1px solid #4b5563', cursor:'pointer', background: i < coinFilled ? '#ca8a04' : '#1f2937' }} />
                    ))}
                  </div>
                  <span style={S.lbl}>STASH</span>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(10, 1fr)', gap:'2px' }}>
                    {stashBoxes.map((f, i) => (
                      <div key={i} onClick={() => setStashBoxes(p => p.map((v, j) => j === i ? !v : v))}
                        style={{ width:'16px', height:'16px', border:'1px solid #2d2d2d', cursor:'pointer', background: f ? '#ca8a04' : '#0a0a0a' }} />
                    ))}
                  </div>
                </div>

                {/* XP & Advancement */}
                <div style={S.card}>
                  <span style={S.lbl}>EXPERIENCE TRACKS</span>
                  {[
                    { name:'INSIGHT',  key:'insight',  max:5 },
                    { name:'PROWESS',  key:'prowess',  max:5 },
                    { name:'RESOLVE',  key:'resolve',  max:5 },
                    { name:'HERITAGE', key:'heritage', max:5 },
                    { name:'PLAYBOOK', key:'playbook', max:10 },
                  ].map(({ name, key, max }) => (
                    <div key={key} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                      <span style={{ fontSize:'11px', color:'#9ca3af', width:'64px' }}>{name}</span>
                      <div style={{ display:'flex', gap:'2px' }}>
                        {Array.from({ length: max }, (_, i) => (
                          <div key={i} onClick={() => toggleXP(key, i)}
                            style={{ width:'13px', height:'13px', border:'1px solid #4b5563', cursor:'pointer',
                              background: i < xp[key] ? '#7c3aed' : '#111827' }} />
                        ))}
                      </div>
                      <span style={{ fontSize:'10px', color:'#6b7280' }}>({xp[key]}/{max})</span>
                    </div>
                  ))}

                  {/* Advancement panel */}
                  <div style={{ marginTop:'10px', padding:'10px', background:'#0d1117', borderRadius:'4px', border:'1px solid #30363d' }}>

                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                      <span style={{ color:'#a78bfa', fontWeight:'bold' }}>Total XP: {totalXP}</span>
                      {/* FIX 5: Development session XP display */}
                      {sessionDevXP > 0
                        ? <span style={{ ...S.info, padding:'2px 6px' }}>+{sessionDevXP} XP/session (DEV {GRADE[devVal]})</span>
                        : <span style={{ fontSize:'10px', color:'#4b5563' }}>DEV F — standard XP only</span>
                      }
                    </div>

                    {/* FIX 6: Corrected level-up description */}
                    <div style={{ fontSize:'11px', padding:'8px', background:'#111827', borderRadius:'4px', border:'1px solid #374151', marginBottom:'8px' }}>
                      <div style={{ color:'#d1d5db', fontWeight:'bold', marginBottom:'3px' }}>LEVEL UP — 10 XP</div>
                      <div style={{ color:'#9ca3af', marginBottom:'2px' }}>Choose ONE option:</div>
                      <div style={{ color:'#c4b5fd' }}>A — +1 Stand Coin grade (any stat)</div>
                      <div style={{ color:'#c4b5fd', marginBottom:'4px' }}>B — +2 Action dots (any 2 actions; can exceed 2)</div>
                      <div style={{ color:'#6b7280', fontSize:'10px' }}>★ A new ability is always included free. If the stat just reached A-rank, your ability is automatically unlocked.</div>
                    </div>

                    {totalXP >= 10 ? (
                      <button onClick={() => setShowLevelUp(true)}
                        style={{ ...S.btn, background:'#7c3aed', color:'#fff', width:'100%', marginBottom:'10px', fontWeight:'bold' }}>
                        ⬆ LEVEL UP AVAILABLE
                      </button>
                    ) : (
                      <div style={{ ...S.warn, marginBottom:'10px', textAlign:'center' }}>
                        {10 - totalXP} more XP needed to level up
                      </div>
                    )}

                    {/* FIX 7: Minor advance — 5 XP → +1 action dot */}
                    <div style={{ borderTop:'1px solid #1f2937', paddingTop:'8px' }}>
                      <div style={{ fontSize:'11px', color:'#d1d5db', fontWeight:'bold', marginBottom:'2px' }}>MINOR ADVANCE — 5 XP</div>
                      <div style={{ fontSize:'11px', color:'#6b7280', marginBottom:'6px' }}>+1 Action dot, outside level-up (max 4 per action)</div>
                      <div style={{ display:'flex', gap:'6px' }}>
                        <select value={minorAdvanceAction} onChange={e => setMinorAdvanceAction(e.target.value)}
                          style={{ ...S.sel, flex:1, fontSize:'11px' }}>
                          {Object.keys(actionRatings).map(a => (
                            <option key={a} value={a} disabled={actionRatings[a] >= 4}>
                              {a} ({actionRatings[a]}/4){actionRatings[a] >= 4 ? ' — MAX' : ''}
                            </option>
                          ))}
                        </select>
                        <button onClick={spendXPForDot}
                          disabled={totalXP < 5 || actionRatings[minorAdvanceAction] >= 4}
                          style={{ ...S.btn, fontSize:'11px',
                            background: totalXP >= 5 && actionRatings[minorAdvanceAction] < 4 ? '#4338ca' : '#374151',
                            color: totalXP >= 5 && actionRatings[minorAdvanceAction] < 4 ? '#fff' : '#6b7280' }}>
                          −5 XP
                        </button>
                      </div>
                      {totalXP < 5 && <div style={{ ...S.warn, marginTop:'4px' }}>{5 - totalXP} more XP needed</div>}
                    </div>
                  </div>

                  <div style={{ marginTop:'10px', fontSize:'11px', color:'#9ca3af', lineHeight:'1.7' }}>
                    <span style={S.lbl}>MARK XP WHEN YOU…</span>
                    🔷 Make a desperate action roll — +1 XP in that attribute<br />
                    🔷 Express beliefs, drives, heritage, or background<br />
                    🔷 Struggle with your vice, trauma, or crew entanglements
                  </div>
                </div>

              </div>

              {/* ══ RIGHT COLUMN ══ */}
              <div>
                <div style={{ ...S.card, border:'1px solid #4b5563' }}>

                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                    <h2 style={{ margin:0, fontSize:'18px', color:'#9ca3af', fontWeight:'bold' }}>PLAYBOOK</h2>
                    <select value={playbook} onChange={e => setPlaybook(e.target.value)} style={S.sel}>
                      <option>Stand</option><option>Hamon</option><option>Spin</option>
                    </select>
                  </div>

                  {/* Stand Coin Stats — FIX 2 + 3 + 4 + 5 */}
                  <div style={{ marginBottom:'16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:'6px' }}>
                      <span style={S.lbl}>STAND COIN STATS</span>
                      <span style={{ fontSize:'11px', color: totalStandPoints > 6 ? '#f87171' : totalStandPoints === 6 ? '#34d399' : '#6b7280' }}>
                        {totalStandPoints}/6 pts
                      </span>
                    </div>

                    {totalStandPoints > 6 && (
                      <div style={{ ...S.warn, marginBottom:'8px' }}>
                        Over budget by {totalStandPoints - 6} point{totalStandPoints - 6 > 1 ? 's' : ''} — reduce a stat
                      </div>
                    )}

                    {Object.entries(standStats).map(([stat, val]) => {
                      const canDec = val > 0 && !Object.entries(standStats).every(([k, v]) => k === stat ? val - 1 === 0 : v === 0);
                      const canInc = val < 4;
                      const desc = PC_STAT_DESC[stat]?.[val];
                      return (
                        <div key={stat} style={{ marginBottom:'10px' }}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:'12px' }}>
                            <span style={{ color:'#d1d5db', fontWeight:'bold', width:'90px', textTransform:'uppercase' }}>{stat}</span>
                            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                              <button onClick={() => decrementStat(stat)} disabled={!canDec}
                                style={{ ...S.btn, background: canDec ? '#dc2626' : '#374151', color:'#fff', width:'20px', height:'20px', padding:0, opacity: canDec ? 1 : 0.4 }}>−</button>
                              <span style={{ width:'18px', textAlign:'center', fontWeight:'bold' }}>{val}</span>
                              <button onClick={() => incrementStat(stat)} disabled={!canInc}
                                style={{ ...S.btn, background: canInc ? '#16a34a' : '#374151', color:'#fff', width:'20px', height:'20px', padding:0, opacity: canInc ? 1 : 0.4 }}>+</button>
                              <span style={{ width:'14px', color:'#9ca3af', fontSize:'11px' }}>{GRADE[val]}</span>
                            </div>
                          </div>
                          {/* Stat description snippet */}
                          {desc && (
                            <div style={{ fontSize:'10px', color:'#6b7280', marginTop:'2px', paddingLeft:'90px', lineHeight:'1.4' }}>
                              {desc}
                              {/* Extra inline notes for specific stats */}
                              {stat === 'durability' && val === 4 && (
                                <span style={{ color:'#f59e0b' }}> · Resistance reduces harm 2 levels</span>
                              )}
                              {stat === 'precision' && val === 4 && (
                                <span style={{ color:'#a78bfa' }}> · 5s also count as success</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <div style={{ fontSize:'10px', color:'#4b5563', marginTop:'2px' }}>
                      Player max: A(4) — S-rank is GM-assigned only
                    </div>
                    <div style={{ marginTop:'6px', background:'#0d1117', borderRadius:'4px', padding:'6px 8px', fontSize:'11px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ color:'#6b7280' }}>Coin: {totalStandPoints} pts × 10 = <span style={{ color:'#a78bfa' }}>{totalStandPoints * 10} XP</span></span>
                      <span style={{ color:'#6b7280' }}>Dots: {totalActionDots} × 5 = <span style={{ color:'#a78bfa' }}>{totalActionDots * 5} XP</span></span>
                      <span style={{ color: pcLevel >= 4 ? '#fbbf24' : '#34d399', fontWeight:'bold' }}>Lv {pcLevel}</span>
                    </div>
                  </div>

                  {/* FIX 1: Action Ratings — creation dot budget */}
                  <div style={{ marginBottom:'14px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                      <span style={S.lbl}>ACTION RATINGS</span>
                      <span style={{ fontSize:'11px', color: dotColor, fontWeight: dotsRemaining === 0 ? 'bold' : 'normal' }}>
                        {totalActionDots}/{MAX_CREATION_DOTS} dots {dotsRemaining > 0 ? `(${dotsRemaining} left)` : '— FULL'}
                      </span>
                    </div>
                    {dotsRemaining < 0 && (
                      <div style={{ ...S.warn, marginBottom:'6px' }}>
                        Over dot budget — remove {Math.abs(dotsRemaining)} dot{Math.abs(dotsRemaining) > 1 ? 's' : ''}
                      </div>
                    )}

                    <div style={S.g3}>
                      {[
                        { attr:'INSIGHT', actions:['HUNT','STUDY','SURVEY','TINKER'] },
                        { attr:'PROWESS', actions:['FINESSE','PROWL','SKIRMISH','WRECK'] },
                        { attr:'RESOLVE', actions:['BIZARRE','COMMAND','CONSORT','SWAY'] },
                      ].map(({ attr, actions }) => (
                        <div key={attr}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                            <span onClick={() => rollDice(attr, getAttributeDice(actions), true)}
                              style={{ fontSize:'11px', fontWeight:'bold', cursor:'pointer', color:'#e5e7eb' }}
                              title="Click for Resistance Roll">
                              {attr}
                            </span>
                            <div style={{ display:'flex', gap:'2px' }}>
                              {[1,2,3,4].map(d => (
                                <div key={d} style={{ width:'7px', height:'7px', borderRadius:'50%', border:'1px solid #4b5563',
                                  background: d <= getAttributeDice(actions) ? '#3b82f6' : '#1f2937' }} />
                              ))}
                            </div>
                          </div>
                          {actions.map(action => {
                            const rating = actionRatings[action];
                            return (
                              <div key={action} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                                <span onClick={() => rollDice(action, rating)}
                                  style={{ fontSize:'11px', cursor:'pointer', color:'#d1d5db' }}
                                  title={`Click to roll ${rating}d`}>
                                  {action}
                                </span>
                                <div style={{ display:'flex', gap:'2px' }}>
                                  {[1,2,3,4].map(d => {
                                    const filled    = d <= rating;
                                    const isAdvDot  = d > MAX_DOTS_PER_ACTION_CREATION; // dots 3-4 require advancement
                                    return (
                                      <div key={d}
                                        onClick={() => {
                                          if (isAdvDot) return; // not clickable during creation
                                          updateActionRating(action, d <= rating ? d - 1 : d);
                                        }}
                                        title={isAdvDot
                                          ? (filled ? `Dot ${d} — gained via advancement` : `Dot ${d} — unlock via advancement`)
                                          : (dotsRemaining === 0 && !filled ? 'No creation dots remaining' : '')}
                                        style={{
                                          width:'12px', height:'12px', borderRadius:'50%',
                                          border:`1px solid ${isAdvDot ? '#374151' : '#6b7280'}`,
                                          cursor: isAdvDot ? 'default' : 'pointer',
                                          background: filled ? (isAdvDot ? '#a78bfa' : '#7c3aed') : '#111827',
                                          opacity: isAdvDot && !filled ? 0.2 : 1,
                                        }}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dice Result — FIX 8 */}
                  {diceResult && (
                    <div style={{ background:'#1f2937', padding:'12px', borderRadius:'4px', border:'1px solid #4b5563', marginBottom:'14px', fontSize:'12px' }}>
                      <div style={{ color:'#a78bfa', fontWeight:'bold', marginBottom:'6px' }}>
                        {diceResult.action} {diceResult.isResistance ? 'Resistance Roll' : 'Action Roll'}
                        {diceResult.zeroDice && <span style={{ color:'#f87171', marginLeft:'8px' }}>(0 Dice — take lower)</span>}
                        {diceResult.isDesperateAction && <span style={{ color:'#f97316', marginLeft:'8px' }}>(Desperate — XP marked)</span>}
                      </div>
                      <div style={{ display:'flex', gap:'6px', alignItems:'center', flexWrap:'wrap', marginBottom:'8px' }}>
                        <div style={{ display:'flex', gap:'3px' }}>
                          {diceResult.dice.map((die, i) => (
                            <span key={i} style={{
                              display:'inline-flex', width:'24px', height:'24px', borderRadius:'4px',
                              alignItems:'center', justifyContent:'center', fontWeight:'bold', border:'1px solid',
                              background: die === 6 ? '#166534' : die >= 4 ? '#1e3a8a' : '#374151',
                              borderColor: die === 6 ? '#22c55e' : die >= 4 ? '#3b82f6' : '#6b7280',
                            }}>
                              {die}
                            </span>
                          ))}
                        </div>
                        <span style={{ fontWeight:'bold', color:
                          diceResult.outcome.includes('Critical') ? '#fbbf24' :
                          diceResult.outcome === 'Success' ? '#22c55e' :
                          diceResult.outcome.includes('Partial') ? '#eab308' : '#ef4444' }}>
                          {diceResult.outcome}
                        </span>
                        {diceResult.special && <span style={{ color:'#fbbf24' }}>{diceResult.special}</span>}
                      </div>

                      {/* FIX 8: Critical resistance → clear 1 stress */}
                      {diceResult.isResistance && (
                        <div style={{ padding:'8px', borderRadius:'4px', ...(diceResult.isCritical
                          ? { background:'#451a03', border:'1px solid #92400e' }
                          : { background:'#0d1117', border:'1px solid #374151' }) }}>
                          {diceResult.isCritical ? (
                            <>
                              <div style={{ color:'#fbbf24', fontWeight:'bold', marginBottom:'2px' }}>
                                ✦ CRITICAL — 0 Stress cost + Clear 1 stress
                              </div>
                              <div style={{ color:'#fcd34d', fontSize:'11px' }}>
                                Pay no stress AND remove one previously filled stress box.
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ color:'#eab308', fontWeight:'bold', marginBottom:'2px' }}>
                                Stress Cost: {diceResult.stressCost}
                              </div>
                              <div style={{ color:'#d1d5db', fontSize:'11px' }}>
                                Consequence reduced by 1 level (or fully negated at GM discretion).
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {!diceResult.isResistance && !diceResult.isDesperateAction && (
                        <button onClick={() => {
                          const attr = ACTION_ATTR[diceResult.action];
                          if (attr) setXp(p => ({ ...p, [attr]: Math.min(p[attr] + 1, 5) }));
                          setDiceResult(p => ({ ...p, isDesperateAction: true }));
                        }} style={{ ...S.btn, background:'#c2410c', color:'#fff', marginTop:'6px', fontSize:'11px' }}>
                          Mark as Desperate (+1 XP)
                        </button>
                      )}
                      <button onClick={() => setDiceResult(null)}
                        style={{ display:'block', marginTop:'6px', color:'#6b7280', background:'none', border:'none', cursor:'pointer', fontSize:'11px' }}>
                        ✕ Clear
                      </button>
                    </div>
                  )}

                  {/* Abilities */}
                  <div style={{ marginBottom:'14px' }}>
                    <span style={S.lbl}>ABILITIES</span>
                    {abilities.map(ab => (
                      <div key={ab.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#374151', padding:'5px 8px', borderRadius:'4px', marginBottom:'3px', fontSize:'12px' }}>
                        <div>
                          <span style={{ fontWeight:'bold' }}>{ab.name}</span>
                          <span style={{ marginLeft:'6px', padding:'1px 5px', background:'#7c3aed', borderRadius:'10px', fontSize:'10px' }}>{ab.type}</span>
                        </div>
                        <button onClick={() => setAbilities(p => p.filter(a => a.id !== ab.id))}
                          style={{ color:'#f87171', background:'none', border:'none', cursor:'pointer', fontSize:'15px' }}>×</button>
                      </div>
                    ))}
                    <div style={{ display:'flex', gap:'5px', marginTop:'6px', flexWrap:'wrap' }}>
                      <button
                        onClick={() => { const n = prompt('Standard ability name:'); if (n) setAbilities(p => [...p, { id: Date.now(), name: n, type: 'standard' }]); }}
                        style={{ ...S.btn, background:'#1d4ed8', color:'#fff', fontSize:'11px' }}>
                        + Standard
                      </button>
                      <button
                        onClick={() => { const n = prompt('Custom ability name:'); if (n) setAbilities(p => [...p, { id: Date.now(), name: n, type: 'custom' }]); }}
                        style={{ ...S.btn, background:'#16a34a', color:'#fff', fontSize:'11px' }}>
                        + Custom
                      </button>
                      {playbook !== 'Stand' && (
                        <button
                          onClick={() => { const n = prompt(`${playbook} playbook ability name:`); if (n) setAbilities(p => [...p, { id: Date.now(), name: n, type: playbook.toLowerCase() }]); }}
                          style={{ ...S.btn, background:'#7c3aed', color:'#fff', fontSize:'11px' }}>
                          + {playbook} Playbook
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Clocks */}
                  <div style={{ marginBottom:'14px' }}>
                    <span style={S.lbl}>CLOCKS</span>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'10px', marginBottom:'8px' }}>
                      {clocks.map(clk => (
                        <div key={clk.id} style={{ background:'#374151', padding:'8px', borderRadius:'4px', textAlign:'center' }}>
                          <input value={clk.name}
                            onChange={e => setClocks(p => p.map(c => c.id === clk.id ? { ...c, name: e.target.value } : c))}
                            style={{ ...S.inp, textAlign:'center', fontSize:'11px', width:'80px', marginBottom:'4px' }} />
                          <div style={{ display:'flex', justifyContent:'center' }}>
                            <ProgressClock size={50} segments={clk.segments} filled={clk.filled} interactive
                              onClick={f => setClocks(p => p.map(c => c.id === clk.id ? { ...c, filled: f } : c))} />
                          </div>
                          <div style={{ fontSize:'10px', color:'#6b7280' }}>{clk.filled}/{clk.segments}</div>
                          <button onClick={() => setClocks(p => p.filter(c => c.id !== clk.id))}
                            style={{ color:'#f87171', background:'none', border:'none', cursor:'pointer', fontSize:'11px' }}>✕</button>
                        </div>
                      ))}
                    </div>
                    <button onClick={addClock}
                      style={{ ...S.btn, border:'2px dashed #374151', background:'transparent', color:'#6b7280', width:'100%', padding:'6px' }}>
                      + Add Clock
                    </button>
                  </div>

                  {/* Bonus Dice ref */}
                  <div style={{ fontSize:'12px', marginBottom:'12px' }}>
                    <span style={S.lbl}>BONUS DICE</span>
                    <div><strong>PUSH YOURSELF</strong> (2 Stress) — or — <strong>DEVIL'S BARGAIN</strong></div>
                    <div style={{ color:'#9ca3af', marginTop:'2px' }}>Assist: +1d to teammate's roll (costs you 1 Stress)</div>
                  </div>

                  {/* Notes */}
                  <div>
                    <span style={S.lbl}>NOTES</span>
                    <textarea placeholder="Notes…" style={{ width:'100%', height:'80px', background:'#0d1117', color:'#fff', border:'1px solid #374151', padding:'8px', fontFamily:'monospace', fontSize:'12px', resize:'vertical', boxSizing:'border-box' }} />
                  </div>

                </div>
              </div>
            </div>

            {/* Bottom row */}
            <div style={{ ...S.g3, marginTop:'16px' }}>
              <div style={S.card}>
                <span style={S.lbl}>TEAMWORK</span>
                {['Assist a teammate (+1d, costs 1 Stress)','Lead a group action','Protect a teammate','Set up a teammate'].map(t => (
                  <div key={t} style={{ background:'#374151', padding:'4px 8px', marginBottom:'3px', fontSize:'12px' }}>{t}</div>
                ))}
              </div>
              <div style={S.card}>
                <span style={S.lbl}>PLANNING & LOAD</span>
                <div style={{ fontSize:'12px', color:'#d1d5db' }}>
                  {[['Assault','Point of attack'],['Occult','Arcane power'],['Deception','Method'],['Social','Connection'],['Stealth','Entry point'],['Transport','Route']].map(([p, d]) => (
                    <div key={p}><strong>{p}:</strong> <em>{d}</em></div>
                  ))}
                </div>
              </div>
              <div style={S.card}>
                <span style={S.lbl}>GATHER INFORMATION</span>
                <div style={{ fontSize:'12px', color:'#9ca3af' }}>
                  {["What do they intend to do?","How can I get them to [X]?","What are they really feeling?","What should I look out for?","Where's the weakness here?","What's really going on here?"].map(q => (
                    <div key={q}>🔷 {q}</div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════ CREW MODE ══════════════════════════════════ */}
        {activeMode === 'CREW MODE' && (
          <div>
            <div style={S.card}>
              <div style={S.g2}>
                <div><span style={S.lbl}>CREW NAME</span><input style={S.inp} value={crewData.name} onChange={e => setCrewData(p => ({ ...p, name: e.target.value }))} placeholder="Crew Name" /></div>
                <div><span style={S.lbl}>REPUTATION</span><input style={S.inp} value={crewData.reputation} onChange={e => setCrewData(p => ({ ...p, reputation: e.target.value }))} placeholder="Crew Reputation" /></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'12px', marginTop:'12px' }}>
                {[['REP','rep',6,'#16a34a'],['TURF','turf',6,'#1d4ed8'],['TIER','tier',4,'#7c3aed'],['WANTED','wanted',5,'#ca8a04'],['COIN','coin',4,'#ca8a04']].map(([label,key,max,color]) => (
                  <div key={key}>
                    <span style={S.lbl}>{label}</span>
                    <div style={{ display:'flex', gap:'2px', flexWrap:'wrap' }}>
                      {Array.from({ length: max }, (_, i) => (
                        <div key={i} onClick={() => setCrewData(p => ({ ...p, [key]: i < p[key] ? i : i+1 }))}
                          style={{ width:'16px', height:'16px', border:'1px solid #4b5563', cursor:'pointer', background: i < crewData[key] ? color : '#111827' }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:'12px', display:'flex', gap:'16px', alignItems:'center' }}>
                <span style={S.lbl}>HOLD</span>
                {['weak','strong'].map(h => (
                  <label key={h} style={{ display:'flex', alignItems:'center', gap:'4px', cursor:'pointer', fontSize:'12px' }}>
                    <input type="radio" name="hold" value={h} checked={crewData.hold===h} onChange={e => setCrewData(p => ({ ...p, hold:e.target.value }))} />
                    <span style={{ textTransform:'uppercase' }}>{h}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={S.g3}>
              <div style={S.card}>
                <span style={S.lbl}>SPECIAL ABILITIES</span>
                {crewData.specialAbilities.map((ab,i) => (
                  <div key={i} style={{ fontSize:'12px', marginBottom:'6px' }}>
                    <div style={{ fontWeight:'bold' }}>{ab.name}</div>
                    <div style={{ color:'#9ca3af' }}>{ab.description}</div>
                  </div>
                ))}
                <button onClick={() => { const n=prompt('Ability name:'); const d=prompt('Description:'); if(n&&d) setCrewData(p=>({...p,specialAbilities:[...p.specialAbilities,{name:n,description:d}]})); }}
                  style={{ ...S.btn, background:'#1d4ed8', color:'#fff', fontSize:'11px', marginTop:'6px' }}>+ Add Ability</button>
                <div style={{ marginTop:'12px' }}>
                  <span style={S.lbl}>CREW XP TRIGGERS</span>
                  <div style={{ fontSize:'11px', color:'#d1d5db', lineHeight:'1.7' }}>
                    🔷 Contend with challenges above your station<br/>
                    🔷 Bolster your crew's reputation<br/>
                    🔷 Express goals, drives, or nature of the crew
                  </div>
                </div>
              </div>
              <div style={S.card}>
                <span style={S.lbl}>DESCRIPTION</span>
                <textarea value={crewData.description} onChange={e => setCrewData(p=>({...p,description:e.target.value}))} placeholder="A short crew description…"
                  style={{ width:'100%', height:'80px', background:'#0d1117', color:'#fff', border:'1px solid #374151', padding:'8px', fontFamily:'monospace', fontSize:'12px', resize:'none', boxSizing:'border-box' }} />
                <div style={{ marginTop:'12px' }}>
                  <span style={S.lbl}>UPGRADES — LAIR</span>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px' }}>
                    {Object.entries(crewData.upgrades.lair).map(([key,val]) => (
                      <label key={key} style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', cursor:'pointer', textTransform:'capitalize' }}>
                        <input type="checkbox" checked={val} onChange={e=>setCrewData(p=>({...p,upgrades:{...p.upgrades,lair:{...p.upgrades.lair,[key]:e.target.checked}}}))} />{key}
                      </label>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop:'12px' }}>
                  <span style={S.lbl}>UPGRADES — TRAINING</span>
                  {Object.entries(crewData.upgrades.training).map(([key,val]) => (
                    <label key={key} style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', cursor:'pointer', textTransform:'capitalize', marginBottom:'2px' }}>
                      <input type="checkbox" checked={val} onChange={e=>setCrewData(p=>({...p,upgrades:{...p.upgrades,training:{...p.upgrades.training,[key]:e.target.checked}}}))} />{key}
                    </label>
                  ))}
                </div>
              </div>
              <div style={S.card}>
                <span style={S.lbl}>NOTES</span>
                <textarea value={crewData.notes} onChange={e=>setCrewData(p=>({...p,notes:e.target.value}))} placeholder="Notes…"
                  style={{ width:'100%', height:'200px', background:'#0d1117', color:'#fff', border:'1px solid #374151', padding:'8px', fontFamily:'monospace', fontSize:'12px', resize:'none', boxSizing:'border-box' }} />
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── FIX 6: Level-Up Modal ── */}
      {showLevelUp && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}>
          <div style={{ background:'#111827', border:'2px solid #7c3aed', borderRadius:'8px', padding:'24px', width:'420px', maxWidth:'90vw' }}>
            <div style={{ fontSize:'16px', fontWeight:'bold', color:'#a78bfa', marginBottom:'4px' }}>⬆ LEVEL UP</div>
            <div style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'16px' }}>
              Choose ONE path. A new Stand ability is automatically included either way.
              {levelUpChoice === 'stat' && standStats[levelUpStat] === 3 && (
                <div style={{ ...S.green, marginTop:'6px' }}>★ This stat will hit A-rank — ability auto-unlocked!</div>
              )}
            </div>

            <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
              {[['stat','+1 Stand Coin Grade'],['dots','+2 Action Dots']].map(([val,label]) => (
                <button key={val} onClick={() => setLevelUpChoice(val)}
                  style={{ ...S.btn, flex:1, color:'#fff',
                    background: levelUpChoice === val ? '#7c3aed' : '#374151',
                    border: `2px solid ${levelUpChoice === val ? '#a78bfa' : 'transparent'}` }}>
                  {label}
                </button>
              ))}
            </div>

            {levelUpChoice === 'stat' && (
              <div style={{ marginBottom:'16px' }}>
                <span style={S.lbl}>Which stat to advance?</span>
                <select value={levelUpStat} onChange={e => setLevelUpStat(e.target.value)} style={{ ...S.sel, width:'100%' }}>
                  {Object.entries(standStats).map(([stat, val]) => (
                    <option key={stat} value={stat} disabled={val >= 4}>
                      {stat.toUpperCase()} — {GRADE[val]}{val < 4 ? ` → ${GRADE[val+1]}` : ' (MAX — A)'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {levelUpChoice === 'dots' && (
              <div style={{ marginBottom:'16px' }}>
                <span style={S.lbl}>Choose 2 actions (+1 dot each — can pick same action twice)</span>
                <div style={{ display:'flex', gap:'8px' }}>
                  {[levelUpDot1, levelUpDot2].map((val, i) => (
                    <select key={i} value={val}
                      onChange={e => i === 0 ? setLevelUpDot1(e.target.value) : setLevelUpDot2(e.target.value)}
                      style={{ ...S.sel, flex:1 }}>
                      {Object.keys(actionRatings).map(a => (
                        <option key={a} value={a} disabled={actionRatings[a] >= 4}>
                          {a} ({actionRatings[a]}/4){actionRatings[a] >= 4 ? ' MAX' : ''}
                        </option>
                      ))}
                    </select>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={confirmLevelUp}
                style={{ ...S.btn, background:'#7c3aed', color:'#fff', flex:1, fontWeight:'bold' }}>
                Confirm (−10 XP)
              </button>
              <button onClick={() => setShowLevelUp(false)}
                style={{ ...S.btn, background:'#374151', color:'#fff' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export { CharacterSheetWrapper };

// ─── App Wrapper (standalone demo) ────────────────────────────────────────────

export default function App() {
  const [current] = useState({
    id: 1,
    name: 'Josuke Higashikata',
    standName: 'Crazy Diamond',
    heritage: 'Japanese',
    background: 'Student',
    vice: 'Obsession',
    crew: 'Morioh Crew',
    standStats: { power: 2, speed: 2, range: 0, durability: 1, precision: 1, development: 0 },
    actionRatings: { HUNT:1, STUDY:0, SURVEY:1, TINKER:2, FINESSE:0, PROWL:0, SKIRMISH:2, WRECK:0, BIZARRE:0, COMMAND:1, CONSORT:0, SWAY:0 },
  });

  const handleSave = async (data) => {
    console.log('Demo save:', data);
    return data;
  };

  return (
    <CharacterSheetWrapper
      character={current}
      allCharacters={[current]}
      campaigns={[]}
      onSave={handleSave}
    />
  );
}

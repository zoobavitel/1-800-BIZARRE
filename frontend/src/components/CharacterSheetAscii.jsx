// src/components/CharacterSheetAscii.jsx
import React, { useState, useEffect } from 'react';
import '../styles/CharacterSheetAscii.css';

const CharacterSheetAscii = ({ character, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: '',
    id: '',
    crew: '',
    look: '',
    heritage: 'Human',
    origin: '',
    vice: 'Faith',
    stress: 0,
    trauma: [],
    harm: {
      level1: { used: false, name: '' },
      level2: { used: false, name: '' },
      level3: { used: false, name: '' },
    },
    healing_clock: 0,
    armor: {
      light_used: false,
      medium_used: false,
      heavy_used: false,
    },
    loadout: 'light',
    action_dots: {
      hunt: 0, study: 0, survey: 0, tinker: 0,
      finesse: 0, prowl: 0, skirmish: 0, wreck: 0,
      attune: 0, command: 0, consort: 0, sway: 0
    },
    stand_stats: {
      durability: 'F',
      power: 'F',
      speed: 'F',
      precision: 'F',
      range: 'F',
      potential: 'F'
    },
    abilities: ['', '', '', '', '', '', '', ''],
    allies: ['', '', '', '', ''],
    rivals: ['', '', '', '', ''],
    equipment: ['', '', '', '', '', '', '', ''],
    notes: ['', '', '', '', '', '', '', ''],
    xp: 0
  });

  // —————————————————————————————————————————————————————————————————————
  // Replace shallow-merge with explicit mapping from API → formData
  useEffect(() => {
    if (!character) return;

    const letter = v => ['F','D','C','B','A','S'][v] || 'F';
    const loadoutMap = { 1: 'light', 2: 'normal', 3: 'heavy' };

    setFormData({
      name:    character.true_name || '',
      id:      String(character.id || ''),
      crew:    character.crew?.name || '',
      look:    character.appearance || '',
      heritage: character.heritage_details?.name || 'Human',
      origin:   character.background_note || '',
      vice:     character.vice_details?.name || character.custom_vice || 'Faith',
      stress:   character.stress || 0,
      trauma:   character.trauma || [],

      harm: {
        level1: {
          used: character.harm_level1_used || false,
          name: character.harm_level1_name || ''
        },
        level2: {
          used: character.harm_level2_used || false,
          name: character.harm_level2_name || ''
        },
        level3: {
          used: character.harm_level3_used || false,
          name: character.harm_level3_name || ''
        }
      },

      healing_clock: character.healing_clock_filled || 0,

      armor: {
        light_used:  character.armor_light_used  || false,
        medium_used: character.armor_medium_used || false,
        heavy_used:  character.armor_heavy_used  || false
      },

      loadout: loadoutMap[character.loadout] || 'light',

      action_dots: character.action_dots || {
        hunt: 0, study: 0, survey: 0, tinker: 0,
        finesse: 0, prowl: 0, skirmish: 0, wreck: 0,
        attune: 0, command: 0, consort: 0, sway: 0
      },

      stand_stats: {
        durability: letter(character.coin_stats?.durability),
        power:      letter(character.coin_stats?.power),
        speed:      letter(character.coin_stats?.speed),
        precision:  letter(character.coin_stats?.precision),
        range:      letter(character.coin_stats?.range),
        potential:  letter(character.coin_stats?.development)
      },

      abilities: [
        ...character.extra_custom_abilities.map(a => a.name),
        ...Array(8 - character.extra_custom_abilities.length).fill('')
      ],

      allies:  [character.close_friend || '', '', '', '', ''],
      rivals:  [character.rival || '',        '', '', '', ''],

      equipment: Array(8).fill(''),
      notes:     Array(8).fill(''),

      xp: character.xp_clocks?.xp || 0
    });
  }, [character]);
  // —————————————————————————————————————————————————————————————————————

  // Generic nested state setter
  const handleChange = (path, value) => {
    setFormData(prev => {
      const updated = { ...prev };
      const keys = path.split('.');
      let cur = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        cur[keys[i]] = { ...cur[keys[i]] };
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = value;
      return updated;
    });
    if (onUpdate) {
      onUpdate({ ...formData, [path]: value });
    }
  };

  // Action dot toggle
  const handleActionDotClick = (action, dot) => {
    const current = formData.action_dots[action];
    const nextVal = current === dot ? dot - 1 : dot;
    handleChange(`action_dots.${action}`, nextVal);
  };

  // Trauma toggle
  const handleTraumaToggle = trauma => {
    const arr = [...formData.trauma];
    const idx = arr.indexOf(trauma);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(trauma);
    handleChange('trauma', arr);
  };

  // Stand stat select
  const handleStandStatChange = (stat, grade) => {
    handleChange(`stand_stats.${stat}`, grade);
  };

  // Helper to render action dots
  const renderActionDots = (actions, label) => (
    <div className="attribute-section">
      <div className="attribute-name">{label}</div>
      {actions.map(a => (
        <div key={a} className="action-row">
          <div className="action-name">{a.toUpperCase()}</div>
          <div className="action-dots">
            {[1,2,3,4].map(d => (
              <span
                key={d}
                className={formData.action_dots[a] >= d ? 'filled' : ''}
                onClick={() => handleActionDotClick(a, d)}
              >
                {formData.action_dots[a] >= d ? '●' : '○'}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const heritageOptions = ['Human','Deep One','Rock Human','Pillar Man','Cyborg','Oracle','Haunting','Gray Matter','Vampire','Chimera'];
  const viceOptions     = ['Faith','Gambling','Luxury','Obligation','Pleasure','Stupor','Bizarre'];
  const traumaTypes      = ['Cold','Haunted','Obsessed','Paranoid','Reckless','Soft','Unstable','Vicious'];
  const gradeOptions     = ['F','D','C','B','A','S'];

  return (
    <div className="character-sheet-ascii">
      <pre className="sheet-header">
        {`
  _   ____ _____    ___  _____ _____   ____  ___________
 / | (    (  _  ) /    (    _)  _  ) /    \\|          (
(  |  ) | |  __ ( | () || | |  __ ( | () || |) |) |) ||
| || (  | |  __ | (    (| | |  __ | (    || |\\      / |
| |_  )  (|_____) \\___)|___)|_____) \\___)|_| \\____/  |
|___|                                                  |
1(800)Bizarre ; Welcome!       |
        `}
      </pre>

      <div className="sheet-grid">
        {/* Left column */}
        <div className="left-column">
          <div className="field-section">
            <label>NAME</label>
            <input 
              type="text" 
              value={formData.name} 
              onChange={(e) => handleChange('name', e.target.value)}
              className="full-width-field"
            />
          </div>

          <div className="field-section">
            <label>ID</label>
            <input 
              type="text" 
              value={formData.id} 
              onChange={(e) => handleChange('id', e.target.value)}
              className="full-width-field"
            />
          </div>

          <div className="field-section">
            <label>CREW</label>
            <input 
              type="text" 
              value={formData.crew} 
              onChange={(e) => handleChange('crew', e.target.value)}
              className="full-width-field"
            />
          </div>

          <div className="field-section">
            <label>LOOK</label>
            <textarea 
              value={formData.look} 
              onChange={(e) => handleChange('look', e.target.value)}
              rows="3"
              className="full-width-field"
            ></textarea>
          </div>

          <div className="field-section">
            <label>HERITAGE:</label>
            <select 
              value={formData.heritage} 
              onChange={(e) => handleChange('heritage', e.target.value)}
              className="inline-select"
            >
              {heritageOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            
            <label> ORIGIN:</label>
            <input 
              type="text" 
              value={formData.origin} 
              onChange={(e) => handleChange('origin', e.target.value)}
              className="inline-field"
            />
          </div>

          <div className="field-section">
            <label>VICE/PURVEYOR:</label>
            <select 
              value={formData.vice} 
              onChange={(e) => handleChange('vice', e.target.value)}
              className="inline-select"
            >
              {viceOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="stress-trauma-section">
            <div className="stress-section">
              <label>STRESS</label>
              <div className="stress-track">
                {[...Array(10)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`stress-box ${formData.stress > i ? 'filled' : ''}`}
                    onClick={() => handleChange('stress', i + 1)}
                  >
                    {formData.stress > i ? '■' : '□'}
                  </div>
                ))}
              </div>
              <div className="durability-grades">
                <span>Durability:</span>
                {gradeOptions.map(grade => (
                  <span key={grade} className="grade">{grade}</span>
                ))}
              </div>
            </div>

            <div className="trauma-section">
              <label>TRAUMA</label>
              <div className="trauma-list">
                {traumaTypes.map(trauma => (
                  <div key={trauma} className="trauma-item">
                    <input 
                      type="checkbox" 
                      id={`trauma-${trauma}`}
                      checked={formData.trauma.includes(trauma)}
                      onChange={() => handleTraumaToggle(trauma)}
                    />
                    <label htmlFor={`trauma-${trauma}`}>{trauma}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="harm-section">
            <div className="harm-header">
              <span>HARM</span>
              <span>HEALING</span>
            </div>
            <div className="harm-grid">
              <div className="harm-level">
                <div className="harm-number">3</div>
                <input 
                  type="checkbox"
                  checked={formData.harm.level3.used}
                  onChange={(e) => handleChange('harm.level3.used', e.target.checked)}
                />
                <input 
                  type="text"
                  value={formData.harm.level3.name}
                  onChange={(e) => handleChange('harm.level3.name', e.target.value)}
                  placeholder="Need Help"
                />
                <div className="healing-section">
                  <div>clock</div>
                  <div className="healing-clock">
                    {[...Array(4)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`clock-segment ${formData.healing_clock > i ? 'filled' : ''}`}
                        onClick={() => handleChange('healing_clock', i + 1)}
                      >
                        {formData.healing_clock > i ? '▣' : '☐'}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="harm-level">
                <div className="harm-number">2</div>
                <input 
                  type="checkbox"
                  checked={formData.harm.level2.used}
                  onChange={(e) => handleChange('harm.level2.used', e.target.checked)}
                />
                <input 
                  type="text"
                  value={formData.harm.level2.name}
                  onChange={(e) => handleChange('harm.level2.name', e.target.value)}
                  placeholder="-1D"
                />
                <div className="armor-section">
                  <div>ARMOR USES</div>
                  <div className="armor-uses">
                    <div>Id</div>
                    <div className="armor-boxes">
                      <div 
                        className={`armor-box ${!formData.armor.light_used ? 'filled' : ''}`}
                        onClick={() => handleChange('armor.light_used', !formData.armor.light_used)}
                      >
                        {!formData.armor.light_used ? '▣' : '☐'}
                      </div>
                      {formData.loadout !== 'light' && (
                        <div 
                          className={`armor-box ${!formData.armor.medium_used ? 'filled' : ''}`}
                          onClick={() => handleChange('armor.medium_used', !formData.armor.medium_used)}
                        >
                          {!formData.armor.medium_used ? '▣' : '☐'}
                        </div>
                      )}
                      {formData.loadout === 'heavy' && (
                        <div 
                          className={`armor-box ${!formData.armor.heavy_used ? 'filled' : ''}`}
                          onClick={() => handleChange('armor.heavy_used', !formData.armor.heavy_used)}
                        >
                          {!formData.armor.heavy_used ? '▣' : '☐'}
                        </div>
                      )}
                    </div>
                    <div className="armor-types">Dur D B S</div>
                  </div>
                </div>
              </div>
              <div className="harm-level">
                <div className="harm-number">1</div>
                <input 
                  type="checkbox"
                  checked={formData.harm.level1.used}
                  onChange={(e) => handleChange('harm.level1.used', e.target.checked)}
                />
                <input 
                  type="text"
                  value={formData.harm.level1.name}
                  onChange={(e) => handleChange('harm.level1.name', e.target.value)}
                  placeholder="Less Effect"
                />
                <div className="devils-bargain">
                  <div>Devils</div>
                  <div className="bargain-box">[ ]</div>
                  <div>Bargain</div>
                </div>
              </div>
            </div>
          </div>

          <div className="stand-stats-section">
            <div className="section-header">STAND STATS</div>
            <div className="stand-stats-grid">
              <div className="stat-labels">
                <div className="stat-row">
                  <span>Durability:</span>
                  {gradeOptions.map(grade => (
                    <span 
                      key={grade}
                      className={`grade-option ${formData.stand_stats.durability === grade ? 'selected' : ''}`}
                      onClick={() => handleStandStatChange('durability', grade)}
                    >
                      {grade}
                    </span>
                  ))}
                </div>
                <div className="stat-row">
                  <span>Power:</span>
                  {gradeOptions.map(grade => (
                    <span 
                      key={grade}
                      className={`grade-option ${formData.stand_stats.power === grade ? 'selected' : ''}`}
                      onClick={() => handleStandStatChange('power', grade)}
                    >
                      {grade}
                    </span>
                  ))}
                </div>
                <div className="stat-row">
                  <span>Speed:</span>
                  {gradeOptions.map(grade => (
                    <span 
                      key={grade}
                      className={`grade-option ${formData.stand_stats.speed === grade ? 'selected' : ''}`}
                      onClick={() => handleStandStatChange('speed', grade)}
                    >
                      {grade}
                    </span>
                  ))}
                </div>
              </div>
              <div className="vector-name">
                <input 
                  type="text" 
                  placeholder="Stand Name"
                  value={formData.stand_name || ''}
                  onChange={(e) => handleChange('stand_name', e.target.value)}
                />
              </div>
              <div className="stat-labels">
                <div className="stat-row">
                  <span>Precision:</span>
                  {gradeOptions.map(grade => (
                    <span 
                      key={grade}
                      className={`grade-option ${formData.stand_stats.precision === grade ? 'selected' : ''}`}
                      onClick={() => handleStandStatChange('precision', grade)}
                    >
                      {grade}
                    </span>
                  ))}
                </div>
                <div className="stat-row">
                  <span>Range:</span>
                  {gradeOptions.map(grade => (
                    <span 
                      key={grade}
                      className={`grade-option ${formData.stand_stats.range === grade ? 'selected' : ''}`}
                      onClick={() => handleStandStatChange('range', grade)}
                    >
                      {grade}
                    </span>
                  ))}
                </div>
                <div className="stat-row">
                  <span>Potential:</span>
                  {gradeOptions.map(grade => (
                    <span 
                      key={grade}
                      className={`grade-option ${formData.stand_stats.potential === grade ? 'selected' : ''}`}
                      onClick={() => handleStandStatChange('potential', grade)}
                    >
                      {grade}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mutation-trigger">
                <div>*Triggered</div>
                <div>by story</div>
                <div>progress.</div>
              </div>
            </div>
          </div>

          <div className="abilities-section">
            <div className="section-header">ABILITIES</div>
            {formData.abilities.map((ability, index) => (
              <input 
                key={index}
                type="text"
                className="ability-field"
                placeholder={`Ability ${index + 1}`}
                value={ability}
                onChange={(e) => {
                  const newAbilities = [...formData.abilities];
                  newAbilities[index] = e.target.value;
                  handleChange('abilities', newAbilities);
                }}
              />
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="right-column">
          <div className="notes-section">
            <div className="section-header">NOTES</div>
            {formData.notes.map((note, index) => (
              <textarea 
                key={index}
                className="note-field"
                placeholder={`Note ${index + 1}`}
                value={note}
                rows="2"
                onChange={(e) => {
                  const newNotes = [...formData.notes];
                  newNotes[index] = e.target.value;
                  handleChange('notes', newNotes);
                }}
              />
            ))}
          </div>

          <div className="xp-section">
            <div className="xp-header">XP</div>
            <div className="xp-track">
              {[...Array(8)].map((_, i) => (
                <div 
                  key={i} 
                  className={`xp-box ${formData.xp > i ? 'filled' : ''}`}
                  onClick={() => handleChange('xp', i + 1)}
                >
                  {formData.xp > i ? '■' : '□'}
                </div>
              ))}
            </div>
          </div>

          <div className="action-ratings">
            <div className="insight-section">
              {renderActionDots(['hunt', 'study', 'survey', 'tinker'], 'INSIGHT')}
            </div>
            <div className="prowess-section">
              {renderActionDots(['finesse', 'prowl', 'skirmish', 'wreck'], 'PROWESS')}
            </div>
            <div className="resolve-section">
              {renderActionDots(['attune', 'command', 'consort', 'sway'], 'RESOLVE')}
            </div>
          </div>

          <div className="push-yourself">
            <div className="bonus-die">BONUS DIE</div>
            <div className="push-section">
              <div className="push-box filled">■</div>
              <span>PUSH YOURSELF (take 2 stress) - OR - accept</span>
            </div>
            <div className="devils-bargain-row">
              <div className="bargain-box filled">■</div>
              <span>a DEVIL'S BARGAIN.</span>
            </div>
          </div>

          <div className="loadout-section">
            <div className="loadout-header">EQUIP</div>
            <div className="loadout-options">
              <label>
                <input 
                  type="radio" 
                  name="loadout" 
                  value="light"
                  checked={formData.loadout === 'light'}
                  onChange={() => handleChange('loadout', 'light')}
                />
                Light
              </label>
              <label>
                <input 
                  type="radio" 
                  name="loadout" 
                  value="normal"
                  checked={formData.loadout === 'normal'}
                  onChange={() => handleChange('loadout', 'normal')}
                />
                Normal
              </label>
              <label>
                <input 
                  type="radio" 
                  name="loadout" 
                  value="heavy"
                  checked={formData.loadout === 'heavy'}
                  onChange={() => handleChange('loadout', 'heavy')}
                />
                Heavy
              </label>
            </div>
          </div>

          <div className="equipment-section">
            {formData.equipment.map((item, index) => (
              <div key={index} className="equipment-item">
                <input 
                  type="checkbox"
                  checked={!!item}
                  onChange={(e) => {
                    const newEquipment = [...formData.equipment];
                    newEquipment[index] = e.target.checked ? (item || 'New item') : '';
                    handleChange('equipment', newEquipment);
                  }}
                />
                <input 
                  type="text"
                  placeholder="Equipment item"
                  value={item}
                  onChange={(e) => {
                    const newEquipment = [...formData.equipment];
                    newEquipment[index] = e.target.value;
                    handleChange('equipment', newEquipment);
                  }}
                  disabled={!item}
                />
              </div>
            ))}
          </div>

          <div className="allies-rivals-section">
            <div className="allies-section">
              <div className="section-header">ALLIES</div>
              {formData.allies.map((ally, index) => (
                <div key={index} className="relation-item">
                  <input 
                    type="text"
                    placeholder={`Ally ${index + 1}`}
                    value={ally}
                    onChange={(e) => {
                      const newAllies = [...formData.allies];
                      newAllies[index] = e.target.value;
                      handleChange('allies', newAllies);
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="rivals-section">
              <div className="section-header">RIVALS</div>
              {formData.rivals.map((rival, index) => (
                <div key={index} className="relation-item">
                  <input 
                    type="text"
                    placeholder={`Rival ${index + 1}`}
                    value={rival}
                    onChange={(e) => {
                      const newRivals = [...formData.rivals];
                      newRivals[index] = e.target.value;
                      handleChange('rivals', newRivals);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="xp-triggers">
            <div className="section-header">HOW XP WORKS</div>
            <div className="xp-explanation">
              <p>- Every time you roll a desperate action mark an additional XP.</p>
              <p>- At the end of session for each item below, mark 1 XP (2 XP at most if done multiple times):</p>
              <p>- You made a Devil's Bargain.</p>
              <p>- You addressed a challenge with your id.</p>
              <p>- You expressed your ideals, heritage, or origin.</p>
              <p>- You struggled with your vice or traumas.</p>
            </div>
          </div>

          <div className="footer-sections">
            <div className="footer-section">
              <div className="section-header">TEAMWORK</div>
              <div className="teamwork-item">Assist a teammate</div>
              <div className="teamwork-item">Lead a group action</div>
              <div className="teamwork-item">Protect a teammate</div>
              <div className="teamwork-item">Set up a team mate</div>
            </div>
            <div className="footer-section">
              <div className="section-header">PLANNING & EQUIP</div>
              <div className="planning-item">Chose equipment and a plan. Provide the detail.</div>
              <div className="planning-types">
                <div className="planning-type">ASSAULT</div>
                <div className="planning-type">OCCULT</div>
                <div className="planning-type">DECEPTION</div>
                <div className="planning-type">SOCIAL</div>
                <div className="planning-type">STEALTH</div>
                <div className="planning-type">TRANSPORT</div>
              </div>
            </div>
            <div className="footer-section">
              <div className="section-header">GATHER INFORMATION</div>
              <div className="gather-item">- How can I get them to [x]?</div>
              <div className="gather-item">- What are they really feeling?</div>
              <div className="gather-item">- What should I lookout for?</div>
              <div className="gather-item">- Where's the weakness here?</div>
              <div className="gather-item">- How can I find [x]?</div>
              <div className="gather-item">- What's really going on here?</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterSheetAscii;
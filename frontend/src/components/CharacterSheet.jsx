import React, { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';

const CharacterSheet = () => {
  // ——————————————————————————————
  // Trauma helper data & toggle function
  // ——————————————————————————————
  const traumaDescriptions = {
    Cold: "You're not moved by emotional appeals or social bonds.",
    Haunted: "You're often lost in reverie, reliving past horrors, seeing things.",
    Obsessed: "You're enthralled by one thing: an activity, a person, an ideology.",
    Paranoid: "You imagine danger everywhere; you can't trust others.",
    Reckless: "You have little regard for your own safety or best interests.",
    Soft: "You lose your edge; you become sentimental, passive, gentle.",
    Unstable: "Your emotional state is volatile; you can instantly rage or freeze up.",
    Vicious: "You seek out opportunities to hurt people, even for no good reason."
  };

  // Tab management state
  const [tabs, setTabs] = useState([{
    id: 'tab-1',
    name: 'New Character',
    character: {
      trueName: '',
      alias: '',
      crew: '',
      look: '',
      heritage: 'Human',
      playbook: 'Stand',
      vice: 'N/A',
      standName: '',
      coinStats: {
        power: 0,
        speed: 0,
        range: 0,
        durability: 0,
        precision: 0,
        development: 0
      },
      skills: {
        insight: { hunt: 0, study: 0, survey: 0, tinker: 0 },
        prowess: { finesse: 0, prowl: 0, skirmish: 0, wreck: 0 },
        resolve: { bizarre: 0, command: 0, consort: 0, sway: 0 }
      },
      specialAbilities: [],
      standardAbilities: [],
      heritageHP: 0,
      selectedDetriments: [],
      selectedBenefits: [],
      xp: {
        insight: 0,
        prowess: 0,
        resolve: 0,
        playbook: 0
      },
      stress: Array(12).fill(false),
      trauma: [],
              harm: { level3: '', level2_0: '', level2_1: '', level1_0: '', level1_1: '' },
      heat: 0,
      wanted: 0,
      friend: '',
      rival: '',
      description: '',
      equipment: [],
      background: '',
      notes: ''
    }
  }]);

  const [activeTab, setActiveTab] = useState('tab-1');

  // Get current character
  const getCurrentCharacter = () => tabs.find(tab => tab.id === activeTab)?.character || tabs[0].character;
  const setCurrentCharacter = (newCharacter) => {
    setTabs(prev => prev.map(tab => 
      tab.id === activeTab 
        ? { ...tab, character: newCharacter, name: newCharacter.trueName || 'New Character' }
        : tab
    ));
  };

  const character = getCurrentCharacter();

  const [gameState, setGameState] = useState({
    showDiceRoller: false,
    showHeritagePanel: false,
    showAbilitiesPanel: false,
    showAdvancementPanel: false,
    position: 'risky',
    effect: 'standard',
    lastRoll: null
  });

  const [saveStatus, setSaveStatus] = useState('');

  // Heritage data
  const heritages = {
    'Human': { 
      baseHP: 0, 
      description: 'Versatile but without inherent supernatural abilities',
      requiredBenefits: [],
      requiredDetriments: [],
      optionalDetriments: [
        { name: 'Physically Inferior', description: '-1d when resisting physical harm', hp: 1 },
        { name: 'Bizarre Blindspot', description: '-1d when resisting Stand, Hamon, or supernatural effects', hp: 1 },
        { name: 'Slower Recovery', description: 'Healing clock permanently reduced by 1 segment', hp: 1 },
        { name: 'Slower Movement', description: 'Base movement speed reduced from 30ft to 20ft', hp: 1 }
      ],
      benefits: [
        { name: 'Skilled From Birth', description: 'Can start with 3 dots in a single skill instead of the usual cap of 2', cost: 1 },
        { name: 'Sheer Grit', description: 'Once per session, reroll any failed roll', cost: 2 },
        { name: 'Tactical Awareness', description: '+1d to all reaction-based rolls in combat', cost: 1 },
        { name: 'Resourceful', description: 'Gain +1 downtime action for training, healing, or crafting', cost: 2 }
      ]
    },
    'Rock Human': { 
      baseHP: 2,
      description: 'Resilient stone-like beings with natural stealth',
      requiredBenefits: [
        { name: 'Sediment Body', description: 'Can reshape into stone or pebbles, allowing stealth and terrain merging' }
      ],
      requiredDetriments: [
        { name: 'Sinks Like a Rock', description: 'Cannot swim, cannot float', hp: 1 },
        { name: 'Slow Regeneration', description: 'Healing clock has +1 additional segment', hp: 1 }
      ],
      optionalDetriments: [
        { name: 'Hunted by Rock Humans', description: 'Other Rock Humans can sense your location within 100ft', hp: 1 },
        { name: 'Slow Reflexes', description: '-1d when resisting physical attacks', hp: 1 },
        { name: 'Vulnerable to High Frequency Vibrations', description: 'Sound-based attacks deal +1 Harm', hp: 1 },
        { name: 'Cold-Brittle', description: 'Freezing temperatures cause you to move at half speed', hp: 1 }
      ],
      benefits: [
        { name: 'Hardened Physique', description: 'Gain 1 extra Stand Armor charge per scene', cost: 2 },
        { name: 'Rock Punches', description: 'Unarmed attacks now deal Level 2 Harm', cost: 1 },
        { name: 'Camouflage', description: 'If stationary, you can merge and move through stone', cost: 1 },
        { name: 'Mudshot', description: 'Can fire hardened mud that immobilizes targets for 1 turn', cost: 2 },
        { name: 'Tolerance', description: 'The detrimental effects of larpintas are reduced', cost: 2 }
      ]
    },
    'Vampire': { 
      baseHP: 3,
      description: 'Immortal predators vulnerable to sunlight and Hamon',
      requiredBenefits: [
        { name: 'Bloodthirst', description: 'You are capable of drinking anything through any appendage' },
        { name: 'Flight', description: 'You are capable of flying and have a flying speed of 30ft/6 seconds' },
        { name: 'Nocturnal', description: 'You are able to see in the dark up to 100ft. Outside of 100ft, treat darkness as dim light' }
      ],
      requiredDetriments: [
        { name: 'Sunlight Weakness', description: 'Takes Level 4 Harm per minute in direct sunlight', hp: 2 },
        { name: 'Hamon Vulnerability', description: 'Hamon techniques deal +1 Harm and bypass armor', hp: 1 }
      ],
      optionalDetriments: [
        { name: 'Must Be Invited Inside', description: 'Cannot enter homes without an invitation', hp: 1 },
        { name: 'Loses Max Stress Without Feeding', description: 'Every day without feeding, max stress decreases by 1 (restored after feeding)', hp: 1 },
        { name: 'Holy Symbol Weakness', description: 'Seeing a cross deals Level 2 Harm and stuns for one turn', hp: 1 },
        { name: 'Silver Allergy', description: 'Weapons made of silver ignore armor and resistances', hp: 1 }
      ],
      benefits: [
        { name: 'Blood Puppeteer', description: 'If you drink a person\'s blood, you can command them for 1 round', cost: 3 },
        { name: 'Sunlight Immunity', description: 'You are capable of surviving in sunlight', cost: 2 },
        { name: 'Mist Form', description: 'Can turn into mist for 3 turns but cannot attack while in mist', cost: 2 },
        { name: 'Regeneration', description: 'Can spend 1 stress to heal 1 segment of harm', cost: 2 },
        { name: 'Bat Form', description: 'Can fly but must use 1 stress per turn to maintain it', cost: 3 },
        { name: 'Staying Power', description: 'If you are overwhelmed with harm, a hit that will KO can be avoided by losing a limb', cost: 3 }
      ]
    }
  };

  const standardAbilities = {
    'Steady Barrage': 'You can barrage targets up to your Stand\'s range. Add +1d when making multiple rapid-fire attacks.',
    'Echo Strikes': 'After a successful Stand attack, push yourself to make an immediate second attack—target the same foe or strike another.',
    'Final Barrage': 'When reduced to 0 HP or Level 4 harm, make a final +3 effect Stand attack before going down.',
    'Legendary Guard': 'Once per score, you may completely negate one instance of incoming harm.',
    'Tough as Nails': 'Reduce the severity of all physical harm by one level (Level 4 harm still kills).',
    'Extra Attack': 'Push (2 stress) to make two attacks in a single action. Roll once, apply separate consequences to two targets or double down.',
    'Sharpshooter': 'You can push yourself (2 stress) to make a ranged attack at extreme distance beyond what\'s normal for the Stand.',
    'Reflexes': 'If you and another Stand user act at the same time and have the same Speed stat, you go first.',
    'Swift Step': 'Push (2 stress) to automatically outrun or outmaneuver a single pursuer of equal or lesser Speed.',
    'Stand Step': 'Use your Stand\'s Speed to dodge with +1d.',
    'Parry and Break': 'On a successful resistance roll, counterattack with +1 effect.',
    'Iron Will': 'You are immune to the terror that some Bizarre entities inflict on sight. When you make a resistance roll with Resolve, take +1d.'
  };

  const traumaOptions = ['Cold', 'Haunted', 'Obsessed', 'Paranoid', 'Reckless', 'Soft', 'Unstable', 'Vicious'];
  const vices = ['N/A','Faith', 'Gambling', 'Luxury', 'Obligation', 'Pleasure', 'Stupor', 'Weird'];

  // Auto-save functionality
  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      localStorage.setItem('jojoCharacter', JSON.stringify(character));
      setSaveStatus('Auto-saved');
      setTimeout(() => setSaveStatus(''), 2000);
    }, 1000);
    return () => clearTimeout(saveTimeout);
  }, [character]);

  // Load saved character
  useEffect(() => {
    const saved = localStorage.getItem('jojoCharacter');
    if (saved) {
      try {
        const parsedCharacter = JSON.parse(saved);
        // Ensure all required properties exist
        const safeCharacter = {
          ...parsedCharacter,
          harm: parsedCharacter.harm || { level3: '', level2_0: '', level2_1: '', level1_0: '', level1_1: '' },
          stress: parsedCharacter.stress || Array(12).fill(false),
          trauma: parsedCharacter.trauma || [],
          selectedDetriments: parsedCharacter.selectedDetriments || [],
          selectedBenefits: parsedCharacter.selectedBenefits || [],
          specialAbilities: parsedCharacter.specialAbilities || [],
          standardAbilities: parsedCharacter.standardAbilities || [],
          equipment: parsedCharacter.equipment || [],
          xp: parsedCharacter.xp || { insight: 0, prowess: 0, resolve: 0, playbook: 0 },
          coinStats: parsedCharacter.coinStats || { power: 0, speed: 0, range: 0, durability: 0, precision: 0, development: 0 },
          skills: parsedCharacter.skills || {
            insight: { hunt: 0, study: 0, survey: 0, tinker: 0 },
            prowess: { finesse: 0, prowl: 0, skirmish: 0, wreck: 0 },
            resolve: { bizarre: 0, command: 0, consort: 0, sway: 0 }
          }
        };
        setCurrentCharacter(safeCharacter);
        setSaveStatus('Character loaded');
        setTimeout(() => setSaveStatus(''), 2000);
      } catch (error) {
        console.error('Error loading character:', error);
      }
    }
  }, []);

  // Helper functions
  const getAttributeRating = (category) => Math.max(...Object.values((character.skills || {})[category] || {}));
  const getGradeLetter = (value) => ({ 0: 'F', 1: 'D', 2: 'C', 3: 'B', 4: 'A', 5: 'S' }[value] || 'F');
  const coinPointsUsed = Object.values(character.coinStats || {}).reduce((a, b) => a + b, 0);
  const skillPointsUsed = Object.values(character.skills || {}).flatMap(category => Object.values(category || {})).reduce((a, b) => a + b, 0);
  const maxStress = 9 + ((character.coinStats || {}).durability || 0);
  const getTotalXP = () => Object.values(character.xp || {}).reduce((a, b) => a + b, 0);

  const getHeritageHP = () => {
    const heritage = heritages[character.heritage];
    if (!heritage) return 0;
    const requiredDetrimentHP = (heritage.requiredDetriments || []).reduce((sum, det) => sum + (det.hp || 0), 0);
    const optionalDetrimentHP = (character.selectedDetriments || []).reduce((sum, det) => sum + (det.hp || 0), 0);
    return heritage.baseHP + requiredDetrimentHP + optionalDetrimentHP + (character.heritageHP || 0);
  };

  const getUsedHeritageHP = () => (character.selectedBenefits || []).reduce((sum, benefit) => sum + (benefit.cost || 0), 0);

  // Advancement Functions
  const canAdvance5XP = () => getTotalXP() >= 5;
  const canAdvancePlaybook = () => (character.xp || {}).playbook >= 10;

  const spendXPForSkill = (category, skill) => {
    if (!canAdvance5XP()) return;
    
    const currentValue = ((character.skills || {})[category] || {})[skill] || 0;
    if (currentValue >= 4) return; // Max skill level
    
    // Spend 5 XP from attribute tracks only (not playbook)
    const newXP = { ...character.xp };
    let remaining = 5;
    
    // Subtract XP from attribute tracks only
    ['insight', 'prowess', 'resolve'].forEach(track => {
      if (remaining > 0 && newXP[track] > 0) {
        const toSubtract = Math.min(remaining, newXP[track]);
        newXP[track] -= toSubtract;
        remaining -= toSubtract;
      }
    });
    
    setCurrentCharacter(prev => ({
      ...prev,
      xp: newXP,
      skills: {
        ...(prev.skills || {}),
        [category]: {
          ...((prev.skills || {})[category] || {}),
          [skill]: currentValue + 1
        }
      }
    }));
    
    setGameState(prev => ({...prev, showAdvancementPanel: false}));
    setSaveStatus('Skill improved!');
    setTimeout(() => setSaveStatus(''), 2000);
  };

  const spendPlaybookXPForCoinStat = (stat) => {
    if (!canAdvancePlaybook()) return;
    
    const currentValue = (character.coinStats || {})[stat] || 0;
    if (currentValue >= 5) return; // Max coin stat
    
    // Spend 10 XP from playbook track only
    const newXP = { ...character.xp };
    newXP.playbook = Math.max(0, newXP.playbook - 10);
    
    setCurrentCharacter(prev => ({
      ...prev,
      xp: newXP,
      coinStats: {
        ...(prev.coinStats || {}),
        [stat]: currentValue + 1
      }
    }));
    
    setGameState(prev => ({...prev, showAdvancementPanel: false}));
    setSaveStatus('Coin stat improved!');
    setTimeout(() => setSaveStatus(''), 2000);
  };

  // Trauma toggle function
  const toggleTrauma = (condition) => {
    const current = character.trauma || [];
    const updated = current.includes(condition)
      ? current.filter(t => t !== condition)
      : [...current, condition];
    setCurrentCharacter({ ...character, trauma: updated });
  };

  const rollDice = (diceCount, skillName) => {
    if (diceCount <= 0) {
      const dice = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
      const lowest = Math.min(...dice);
      let result = 'Failure', resultColor = '#ef4444';
      if (lowest >= 4) { result = 'Partial Success'; resultColor = '#f59e0b'; }
      if (lowest === 6) { result = 'Success'; resultColor = '#10b981'; }
      setGameState(prev => ({ ...prev, lastRoll: { dice, highest: lowest, result, skill: skillName + ' (Zero Dice)', resultColor, note: 'Zero dice: rolled 2d6, took lowest' }}));
      return;
    }
    
    const dice = Array.from({length: diceCount}, () => Math.floor(Math.random() * 6) + 1);
    const highest = Math.max(...dice);
    let result = 'Failure', resultColor = '#ef4444';
    
    if (highest === 6) {
      result = dice.filter(d => d === 6).length > 1 ? 'Critical Success' : 'Success';
      resultColor = dice.filter(d => d === 6).length > 1 ? '#8b5cf6' : '#10b981';
    } else if (highest >= 4) {
      result = 'Partial Success';
      resultColor = '#f59e0b';
    }
    
    setGameState(prev => ({ ...prev, lastRoll: { dice, highest, result, skill: skillName, resultColor }}));
  };

  const handleSkillChange = (category, skill, value) => {
    if (value < 0 || value > 4) return;
    const currentSkillTotal = skillPointsUsed;
    const currentValue = ((character.skills || {})[category] || {})[skill] || 0;
    const change = value - currentValue;
    if (value > 2 && currentValue === 0) return;
    if (currentSkillTotal + change > 7) return;
    
    setCurrentCharacter(prev => ({
      ...prev,
      skills: { 
        ...(prev.skills || {}), 
        [category]: { 
          ...((prev.skills || {})[category] || {}), 
          [skill]: value 
        } 
      }
    }));
  };

  const handleCoinStatChange = (stat, value) => {
    if (value < 0 || value > 5) return;
    const currentValue = (character.coinStats || {})[stat] || 0;
    const newTotal = coinPointsUsed - currentValue + value;
    if (newTotal > 10) return;
    
    setCurrentCharacter(prev => ({
      ...prev,
      coinStats: { ...(prev.coinStats || {}), [stat]: value }
    }));
  };

  const exportCharacter = () => {
    const dataStr = JSON.stringify(character, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `${character.trueName || 'character'}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    setSaveStatus('Character exported!');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  const importCharacter = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          setCurrentCharacter(imported);
          setSaveStatus('Character imported!');
          setTimeout(() => setSaveStatus(''), 3000);
        } catch (error) {
          setSaveStatus('Import failed');
          setTimeout(() => setSaveStatus(''), 3000);
        }
      };
      reader.readAsText(file);
    }
  };

  // Tab management functions
  const addNewTab = () => {
    const newId = `tab-${Date.now()}`;
    const newTab = {
      id: newId,
      name: 'New Character',
      character: {
        trueName: '',
        alias: '',
        crew: '',
        look: '',
        heritage: 'Human',
        playbook: 'Stand',
        vice: 'N/A',
        standName: '',
        coinStats: {
          power: 0,
          speed: 0,
          range: 0,
          durability: 0,
          precision: 0,
          development: 0
        },
        skills: {
          insight: { hunt: 0, study: 0, survey: 0, tinker: 0 },
          prowess: { finesse: 0, prowl: 0, skirmish: 0, wreck: 0 },
          resolve: { bizarre: 0, command: 0, consort: 0, sway: 0 }
        },
        specialAbilities: [],
        standardAbilities: [],
        heritageHP: 0,
        selectedDetriments: [],
        selectedBenefits: [],
        xp: {
          insight: 0,
          prowess: 0,
          resolve: 0,
          playbook: 0
        },
        stress: Array(12).fill(false),
        trauma: [],
        harm: { level3: '', level2_0: '', level2_1: '', level1_0: '', level1_1: '' },
        heat: 0,
        wanted: 0,
        friend: '',
        rival: '',
        description: '',
        equipment: [],
        background: '',
        notes: ''
      }
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTab(newId);
  };

  const closeTab = (tabId) => {
    if (tabs.length === 1) return; // Don't close the last tab
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);
    if (activeTab === tabId) {
      setActiveTab(newTabs[0].id);
    }
  };

  // Components
  const CheckboxGroup = ({ count, filled = 0, onChange, size = 'small' }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      {Array.from({ length: count }, (_, i) => (
        <div 
          key={i}
          onClick={() => onChange && onChange(i < filled ? i : i + 1)}
          style={{
            width: size === 'large' ? '16px' : '12px',
            height: size === 'large' ? '16px' : '12px',
            border: '1px solid #10b981',
            backgroundColor: i < filled ? '#10b981' : 'transparent',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        />
      ))}
    </div>
  );

  const SkillDots = ({ category, skill, value, max = 4 }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #374151' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', width: '60px' }}>{skill}</span>
        <button
          onClick={() => rollDice(Math.max(value, 0), skill)}
          style={{
            fontSize: '9px',
            backgroundColor: value === 0 ? '#ef4444' : '#10b981',
            color: '#000',
            padding: '2px 6px',
            border: 'none',
            cursor: 'pointer',
            opacity: 0.7,
            transition: 'opacity 0.2s'
          }}
          onMouseOver={(e) => e.target.style.opacity = 1}
          onMouseOut={(e) => e.target.style.opacity = 0.7}
        >
          {value === 0 ? '2d⬇' : `${value}d`}
        </button>
      </div>
      <div style={{ display: 'flex', gap: '2px' }}>
        {Array.from({ length: max }, (_, i) => (
          <div
            key={i}
            onClick={() => handleSkillChange(category, skill, i + 1 === value ? 0 : i + 1)}
            style={{
              width: '12px',
              height: '12px',
              border: '1px solid #10b981',
              backgroundColor: value > i ? '#10b981' : 'transparent',
              cursor: 'pointer',
              opacity: i >= 2 && value === 0 ? 0.3 : 1
            }}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ backgroundColor: '#000', color: '#10b981', fontFamily: 'monospace', minHeight: '100vh', fontSize: '12px' }}>
      {/* Header */}
      <div style={{ 
        backgroundColor: '#1f2937', 
        borderBottom: '2px solid #10b981', 
        padding: '16px',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#fbbf24', margin: 0 }}>
              📞 1(800)BIZARRE
            </h1>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                {character.trueName || 'New Character'} {character.alias && `"${character.alias}"`}
              </div>
              <div style={{ fontSize: '10px', color: '#6ee7b7' }}>
                {character.heritage} • {character.playbook} User
              </div>
            </div>
          </div>

          {/* Game Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span>HEAT:</span>
                <CheckboxGroup 
                  count={9} 
                  filled={character.heat}
                  onChange={(val) => setCurrentCharacter({...character, heat: val})}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>WANTED:</span>
                <CheckboxGroup 
                  count={4} 
                  filled={character.wanted}
                  onChange={(val) => setCurrentCharacter({...character, wanted: val})}
                />
              </div>
            </div>

            <div style={{ fontSize: '10px', borderLeft: '1px solid #10b981', paddingLeft: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span>POSITION:</span>
                <select 
                  value={gameState.position}
                  onChange={(e) => setGameState({...gameState, position: e.target.value})}
                  style={{ backgroundColor: '#1f2937', color: '#10b981', border: '1px solid #10b981', fontSize: '10px', padding: '2px' }}
                >
                  <option value="controlled">Controlled</option>
                  <option value="risky">Risky</option>
                  <option value="desperate">Desperate</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>EFFECT:</span>
                <select 
                  value={gameState.effect}
                  onChange={(e) => setGameState({...gameState, effect: e.target.value})}
                  style={{ backgroundColor: '#1f2937', color: '#10b981', border: '1px solid #10b981', fontSize: '10px', padding: '2px' }}
                >
                  <option value="limited">Limited</option>
                  <option value="standard">Standard</option>
                  <option value="great">Great</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setGameState(prev => ({...prev, showDiceRoller: !prev.showDiceRoller}))}
                style={{
                  backgroundColor: '#10b981',
                  color: '#000',
                  border: 'none',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                🎲 Dice
              </button>
              {(canAdvance5XP() || canAdvancePlaybook()) && (
                <button
                  onClick={() => setGameState(prev => ({...prev, showAdvancementPanel: !prev.showAdvancementPanel}))}
                  style={{
                    backgroundColor: '#8b5cf6',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  ⬆️ Advance
                </button>
              )}
              <input 
                type="file" 
                accept=".json"
                onChange={importCharacter}
                style={{ display: 'none' }}
                id="import-file"
              />
              <label 
                htmlFor="import-file"
                style={{
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                📁 Import
              </label>
              <button
                onClick={exportCharacter}
                style={{
                  backgroundColor: '#f59e0b',
                  color: '#000',
                  border: 'none',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                💾 Export
              </button>
            </div>
          </div>
        </div>

        {/* Status Line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '10px', color: '#6ee7b7' }}>
          <span>Coin Points: <strong style={{ color: coinPointsUsed > 10 ? '#ef4444' : '#fbbf24' }}>{10 - coinPointsUsed}/10</strong></span>
          <span>Skill Points: <strong style={{ color: skillPointsUsed > 7 ? '#ef4444' : '#fbbf24' }}>{7 - skillPointsUsed}/7</strong></span>
          <span>Heritage HP: <strong style={{ color: '#a855f7' }}>{getHeritageHP() - getUsedHeritageHP()}/{getHeritageHP()}</strong></span>
          <span>Total XP: <strong style={{ color: '#8b5cf6' }}>{getTotalXP()}</strong></span>
          <span>Abilities: <strong style={{ color: '#3b82f6' }}>{(character.specialAbilities || []).length + (character.standardAbilities || []).length}</strong></span>
          {saveStatus && <span style={{ color: '#3b82f6' }}>💾 {saveStatus}</span>}
        </div>

        {/* Character Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginTop: '8px' }}>
          {tabs.map(tab => (
            <div
              key={tab.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: activeTab === tab.id ? '#10b981' : '#374151',
                color: activeTab === tab.id ? '#000' : '#10b981',
                padding: '4px 8px',
                fontSize: '10px',
                cursor: 'pointer',
                border: `1px solid ${activeTab === tab.id ? '#10b981' : '#6b7280'}`,
                maxWidth: '150px'
              }}
            >
              <span
                onClick={() => setActiveTab(tab.id)}
                style={{ 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  flex: 1
                }}
              >
                {tab.name}
              </span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: activeTab === tab.id ? '#000' : '#10b981',
                    marginLeft: '4px',
                    cursor: 'pointer',
                    padding: '0',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addNewTab}
            style={{
              backgroundColor: '#6366f1',
              color: '#fff',
              border: 'none',
              padding: '4px 6px',
              fontSize: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2px'
            }}
          >
            <Plus size={12} /> New
          </button>
        </div>

        {/* Advancement Panel */}
        {gameState.showAdvancementPanel && (
          <div style={{ 
            marginTop: '12px', 
            padding: '12px', 
            backgroundColor: '#111827', 
            border: '2px solid #8b5cf6',
            borderRadius: '4px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#8b5cf6', fontSize: '12px', fontWeight: 'bold' }}>
                CHARACTER ADVANCEMENT
              </h3>
              <button
                onClick={() => setGameState(prev => ({...prev, showAdvancementPanel: false}))}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}
              >
                ×
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Skill Advancement */}
              {canAdvance5XP() && (
                <div>
                  <h4 style={{ color: '#10b981', fontSize: '11px', margin: '0 0 8px 0' }}>SPEND 5 XP: +1d TO SKILL</h4>
                  <div style={{ fontSize: '9px', marginBottom: '8px', color: '#6ee7b7' }}>
                    Available from Attribute XP: {(character.xp?.insight || 0) + (character.xp?.prowess || 0) + (character.xp?.resolve || 0)}
                  </div>
                  <div style={{ fontSize: '9px' }}>
                    {Object.entries(character.skills || {}).map(([category, skills]) => (
                      <div key={category} style={{ marginBottom: '8px' }}>
                        <div style={{ fontWeight: 'bold', textTransform: 'uppercase', color: '#6ee7b7', marginBottom: '4px' }}>
                          {category}
                        </div>
                        {Object.entries(skills || {}).map(([skill, value]) => (
                          <button
                            key={skill}
                            onClick={() => spendXPForSkill(category, skill)}
                            disabled={value >= 4}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '4px 8px',
                              marginBottom: '2px',
                              backgroundColor: value >= 4 ? '#374151' : '#1f2937',
                              color: value >= 4 ? '#6b7280' : '#10b981',
                              border: '1px solid #374151',
                              cursor: value >= 4 ? 'not-allowed' : 'pointer',
                              fontSize: '9px'
                            }}
                          >
                            {skill} ({value}d → {Math.min(value + 1, 4)}d)
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coin Stat Advancement */}
              {canAdvancePlaybook() && (
                <div>
                  <h4 style={{ color: '#fbbf24', fontSize: '11px', margin: '0 0 8px 0' }}>SPEND 10 PLAYBOOK XP: +1 COIN STAT</h4>
                  <div style={{ fontSize: '9px', marginBottom: '8px', color: '#6ee7b7' }}>
                    Available Playbook XP: {character.xp?.playbook || 0}
                  </div>
                  <div style={{ fontSize: '9px' }}>
                    {Object.entries(character.coinStats || {}).map(([stat, value]) => (
                      <button
                        key={stat}
                        onClick={() => spendPlaybookXPForCoinStat(stat)}
                        disabled={value >= 5}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '4px 8px',
                          marginBottom: '4px',
                          backgroundColor: value >= 5 ? '#374151' : '#1f2937',
                          color: value >= 5 ? '#6b7280' : '#fbbf24',
                          border: '1px solid #374151',
                          cursor: value >= 5 ? 'not-allowed' : 'pointer',
                          fontSize: '9px',
                          textTransform: 'uppercase'
                        }}
                      >
                        {stat} ({getGradeLetter(value)} → {getGradeLetter(Math.min(value + 1, 5))})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dice Roller */}
        {gameState.showDiceRoller && (
          <div style={{ 
            marginTop: '12px', 
            padding: '12px', 
            backgroundColor: '#111827', 
            border: '1px solid #10b981',
            borderRadius: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                <span style={{ fontWeight: 'bold' }}>Quick Roll:</span>
                {[1,2,3,4,5,6].map(count => (
                  <button
                    key={count}
                    onClick={() => rollDice(count, `${count}d6`)}
                    style={{
                      backgroundColor: '#10b981',
                      color: '#000',
                      border: 'none',
                      padding: '4px 8px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    {count}d
                  </button>
                ))}
              </div>
              {gameState.lastRoll && (
                <div style={{ fontSize: '11px' }}>
                  <span style={{ fontWeight: 'bold' }}>{gameState.lastRoll.skill}:</span>
                  <span style={{ marginLeft: '8px' }}>Rolled: [{gameState.lastRoll.dice.join(', ')}]</span>
                  <span style={{ marginLeft: '8px', color: gameState.lastRoll.resultColor }}>→ {gameState.lastRoll.result}</span>
                  {gameState.lastRoll.note && <div style={{ fontSize: '9px', color: '#9ca3af', marginTop: '2px' }}>{gameState.lastRoll.note}</div>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Character Sheet */}
      <div style={{ padding: '16px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Basic Character Info */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#6ee7b7', marginBottom: '4px' }}>NAME</div>
            <input 
              value={character.trueName}
              onChange={(e) => setCurrentCharacter({...character, trueName: e.target.value})}
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: '1px solid #10b981',
                color: '#10b981',
                fontSize: '12px',
                padding: '4px 0',
                outline: 'none'
              }}
              placeholder="Character Name"
            />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#6ee7b7', marginBottom: '4px' }}>ALIAS</div>
            <input 
              value={character.alias}
              onChange={(e) => setCurrentCharacter({...character, alias: e.target.value})}
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: '1px solid #10b981',
                color: '#10b981',
                fontSize: '12px',
                padding: '4px 0',
                outline: 'none'
              }}
              placeholder="Street Name"
            />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#6ee7b7', marginBottom: '4px' }}>CREW</div>
            <input 
              value={character.crew}
              onChange={(e) => setCurrentCharacter({...character, crew: e.target.value})}
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: '1px solid #10b981',
                color: '#10b981',
                fontSize: '12px',
                padding: '4px 0',
                outline: 'none'
              }}
              placeholder="Crew Name"
            />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#6ee7b7', marginBottom: '4px' }}>HERITAGE</div>
            <select 
              value={character.heritage}
              onChange={(e) => setCurrentCharacter({...character, heritage: e.target.value, selectedDetriments: [], selectedBenefits: []})}
              style={{
                width: '100%',
                backgroundColor: '#1f2937',
                border: '1px solid #10b981',
                color: '#10b981',
                fontSize: '11px',
                padding: '4px'
              }}
            >
              {Object.keys(heritages).map(heritage => (
                <option key={heritage} value={heritage}>{heritage}</option>
              ))}
            </select>
            <button
              onClick={() => setGameState(prev => ({...prev, showHeritagePanel: !prev.showHeritagePanel}))}
              style={{
                fontSize: '9px',
                backgroundColor: '#6366f1',
                color: '#fff',
                border: 'none',
                padding: '2px 6px',
                marginTop: '4px',
                cursor: 'pointer'
              }}
            >
              Configure Heritage
            </button>
          </div>
        </div>

        {/* Heritage Configuration Panel */}
        {gameState.showHeritagePanel && (
          <div style={{ 
            marginBottom: '20px',
            border: '2px solid #a855f7',
            backgroundColor: 'rgba(168, 85, 247, 0.05)',
            padding: '16px',
            borderRadius: '4px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#a855f7', fontSize: '14px', fontWeight: 'bold' }}>
                {character.heritage.toUpperCase()} HERITAGE
              </h3>
              <button
                onClick={() => setGameState(prev => ({...prev, showHeritagePanel: false}))}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}
              >
                ×
              </button>
            </div>
            <div style={{ fontSize: '11px', color: '#c084fc', marginBottom: '12px' }}>
              {heritages[character.heritage].description}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#10b981', marginBottom: '8px' }}>
                  Available HP: {getHeritageHP() - getUsedHeritageHP()}/{getHeritageHP()}
                </div>
                
                {/* Required Benefits */}
                {heritages[character.heritage].requiredBenefits?.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '10px', color: '#10b981', margin: '0 0 4px 0' }}>REQUIRED BENEFITS</h4>
                    {heritages[character.heritage].requiredBenefits.map((benefit, index) => (
                      <div key={index} style={{ fontSize: '9px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 'bold' }}>{benefit.name}:</span> {benefit.description}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Required Detriments */}
                {heritages[character.heritage].requiredDetriments?.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '10px', color: '#ef4444', margin: '0 0 4px 0' }}>REQUIRED DETRIMENTS</h4>
                    {heritages[character.heritage].requiredDetriments.map((detriment, index) => (
                      <div key={index} style={{ fontSize: '9px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 'bold' }}>{detriment.name} (+{detriment.hp} HP):</span> {detriment.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                {/* Optional Detriments */}
                {heritages[character.heritage].optionalDetriments?.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '10px', color: '#f59e0b', margin: '0 0 4px 0' }}>OPTIONAL DETRIMENTS</h4>
                    {heritages[character.heritage].optionalDetriments.map((detriment, index) => (
                      <label key={index} style={{ display: 'block', fontSize: '9px', marginBottom: '6px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox"
                          checked={(character.selectedDetriments || []).some(d => d.name === detriment.name)}
                          onChange={() => {
                            const isSelected = (character.selectedDetriments || []).some(d => d.name === detriment.name);
                            setCurrentCharacter(prev => ({
                              ...prev,
                              selectedDetriments: isSelected 
                                ? (prev.selectedDetriments || []).filter(d => d.name !== detriment.name)
                                : [...(prev.selectedDetriments || []), detriment]
                            }));
                          }}
                          style={{ marginRight: '6px', accentColor: '#f59e0b' }}
                        />
                        <span style={{ fontWeight: 'bold' }}>{detriment.name} (+{detriment.hp} HP):</span> {detriment.description}
                      </label>
                    ))}
                  </div>
                )}
                
                {/* Benefits */}
                {heritages[character.heritage].benefits?.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '10px', color: '#10b981', margin: '0 0 4px 0' }}>BENEFITS</h4>
                    {heritages[character.heritage].benefits.map((benefit, index) => (
                      <label key={index} style={{ display: 'block', fontSize: '9px', marginBottom: '6px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox"
                          checked={(character.selectedBenefits || []).some(b => b.name === benefit.name)}
                          disabled={getHeritageHP() - getUsedHeritageHP() < benefit.cost}
                          onChange={() => {
                            const isSelected = (character.selectedBenefits || []).some(b => b.name === benefit.name);
                            setCurrentCharacter(prev => ({
                              ...prev,
                              selectedBenefits: isSelected 
                                ? (prev.selectedBenefits || []).filter(b => b.name !== benefit.name)
                                : [...(prev.selectedBenefits || []), benefit]
                            }));
                          }}
                          style={{ marginRight: '6px', accentColor: '#10b981' }}
                        />
                        <span style={{ fontWeight: 'bold' }}>{benefit.name} ({benefit.cost} HP):</span> {benefit.description}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Look and Vice */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#6ee7b7', marginBottom: '4px' }}>LOOK</div>
            <input 
              value={character.look}
              onChange={(e) => setCurrentCharacter({...character, look: e.target.value})}
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: '1px solid #10b981',
                color: '#10b981',
                fontSize: '12px',
                padding: '4px 0',
                outline: 'none'
              }}
              placeholder="Describe appearance"
            />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#6ee7b7', marginBottom: '4px' }}>VICE</div>
            <select 
              value={character.vice}
              onChange={(e) => setCurrentCharacter({...character, vice: e.target.value})}
              style={{
                width: '100%',
                backgroundColor: '#1f2937',
                border: '1px solid #10b981',
                color: '#10b981',
                fontSize: '11px',
                padding: '4px'
              }}
            >
              {vices.map(vice => (
                <option key={vice} value={vice}>{vice}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#6ee7b7', marginBottom: '4px' }}>PLAYBOOK</div>
            <select 
              value={character.playbook}
              onChange={(e) => setCurrentCharacter({...character, playbook: e.target.value})}
              style={{
                width: '100%',
                backgroundColor: '#1f2937',
                border: '1px solid #10b981',
                color: '#10b981',
                fontSize: '11px',
                padding: '4px'
              }}
            >
              <option value="Stand">Stand</option>
              <option value="Hamon">Hamon</option>
              <option value="Spin">Spin</option>
            </select>
          </div>
        </div>

        {/* Stand Name (if Stand user) */}
        {character.playbook === 'Stand' && (
          <div style={{ marginBottom: '20px', textAlign: 'center' }}>
            <input 
              value={character.standName}
              onChange={(e) => setCurrentCharacter({...character, standName: e.target.value})}
              style={{
                backgroundColor: 'transparent',
                border: '2px solid #ef4444',
                color: '#ef4444',
                fontSize: '18px',
                fontWeight: 'bold',
                textAlign: 'center',
                padding: '8px 16px',
                outline: 'none',
                width: '300px'
              }}
              placeholder="「STAND NAME」"
            />
          </div>
        )}

        {/* Main Content Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
          {/* Left Column - Coin Stats & Stress */}
          <div>
            {/* Stand Coin Stats */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                backgroundColor: '#10b981', 
                color: '#000', 
                padding: '6px 12px', 
                fontSize: '11px', 
                fontWeight: 'bold',
                marginBottom: '8px'
              }}>
                STAND COIN ({coinPointsUsed}/10 pts)
              </div>
              <div style={{ border: '1px solid #10b981', padding: '12px' }}>
                {Object.entries(character.coinStats || {}).map(([stat, value]) => (
                  <div key={stat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', width: '80px' }}>{stat}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <select 
                        value={value || 0}
                        onChange={(e) => handleCoinStatChange(stat, parseInt(e.target.value))}
                        style={{
                          backgroundColor: '#1f2937',
                          color: '#10b981',
                          border: '1px solid #10b981',
                          fontSize: '10px',
                          padding: '2px'
                        }}
                      >
                        {[0,1,2,3,4,5].map(v => (
                          <option key={v} value={v}>{v} ({getGradeLetter(v)})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stress */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                backgroundColor: '#10b981', 
                color: '#000', 
                padding: '6px 12px', 
                fontSize: '11px', 
                fontWeight: 'bold',
                marginBottom: '8px'
              }}>
                STRESS ({(character.stress || []).filter(Boolean).length}/{maxStress})
              </div>
              <CheckboxGroup 
                count={maxStress} 
                filled={(character.stress || []).filter(Boolean).length}
                size="large"
                onChange={(val) => {
                  const newStress = Array(maxStress).fill(false);
                  for(let i = 0; i < val; i++) newStress[i] = true;
                  setCurrentCharacter({...character, stress: newStress});
                }}
              />
            </div>

            {/* Trauma */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                backgroundColor: '#10b981',
                color: '#000',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 'bold',
                marginBottom: '8px'
              }}>
                TRAUMA
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px'
              }}>
                {traumaOptions.map(cond => {
                  const isActive = (character.trauma || []).includes(cond);
                  return (
                    <button
                      key={cond}
                      onClick={() => toggleTrauma(cond)}
                      title={traumaDescriptions[cond]}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      <div style={{
                        width: '12px',
                        height: '12px',
                        border: '1px solid #10b981',
                        backgroundColor: isActive ? '#10b981' : 'transparent',
                        transition: 'background-color 0.2s'
                      }} />
                      <span style={{ fontSize: '9px', color: '#10b981' }}>{cond}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Harm */}
            <div>
              <div style={{ 
                backgroundColor: '#10b981', 
                color: '#000', 
                padding: '6px 12px', 
                fontSize: '11px', 
                fontWeight: 'bold',
                marginBottom: '8px'
              }}>
                HARM
              </div>
              <div style={{ border: '1px solid #10b981', padding: '8px' }}>
                {[
                  { level: 3, label: 'SEVERE', effect: 'Need Help' },
                  { level: 2, label: 'MODERATE', effect: '-1d' },
                  { level: 2, label: 'MODERATE', effect: '-1d' },
                  { level: 1, label: 'LESSER', effect: 'Less Effect' },
                  { level: 1, label: 'LESSER', effect: 'Less Effect' }
                ].map(({level, label, effect}, index) => (
                  <div key={`${level}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', width: '8px' }}>{level}</span>
                    <input
                      value={(character.harm || {})[`level${level}_${index}`] || ''}
                      onChange={(e) => setCurrentCharacter({
                        ...character,
                        harm: {...(character.harm || {}), [`level${level}_${index}`]: e.target.value}
                      })}
                      style={{
                        flex: 1,
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid #10b981',
                        color: '#10b981',
                        fontSize: '10px',
                        padding: '2px 0',
                        outline: 'none'
                      }}
                      placeholder={`${label} harm`}
                    />
                    <span style={{ fontSize: '8px', color: '#6ee7b7', width: '60px' }}>{effect}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Middle Column - Action Ratings */}
          <div>
            {/* Insight Actions */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                backgroundColor: '#10b981', 
                color: '#000', 
                padding: '6px 12px', 
                fontSize: '11px', 
                fontWeight: 'bold',
                marginBottom: '8px'
              }}>
                INSIGHT ({getAttributeRating('insight')}d)
              </div>
              <div style={{ border: '1px solid #10b981', padding: '8px' }}>
                {Object.entries((character.skills || {}).insight || {}).map(([skill, rating]) => (
                  <SkillDots key={skill} category="insight" skill={skill} value={rating} />
                ))}
              </div>
            </div>

            {/* Prowess Actions */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                backgroundColor: '#10b981', 
                color: '#000', 
                padding: '6px 12px', 
                fontSize: '11px', 
                fontWeight: 'bold',
                marginBottom: '8px'
              }}>
                PROWESS ({getAttributeRating('prowess')}d)
              </div>
              <div style={{ border: '1px solid #10b981', padding: '8px' }}>
                {Object.entries((character.skills || {}).prowess || {}).map(([skill, rating]) => (
                  <SkillDots key={skill} category="prowess" skill={skill} value={rating} />
                ))}
              </div>
            </div>

            {/* Resolve Actions */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                backgroundColor: '#10b981', 
                color: '#000', 
                padding: '6px 12px', 
                fontSize: '11px', 
                fontWeight: 'bold',
                marginBottom: '8px'
              }}>
                RESOLVE ({getAttributeRating('resolve')}d)
              </div>
              <div style={{ border: '1px solid #10b981', padding: '8px' }}>
                {Object.entries((character.skills || {}).resolve || {}).map(([skill, rating]) => (
                  <SkillDots key={skill} category="resolve" skill={skill} value={rating} />
                ))}
              </div>
            </div>

            {/* XP Tracks */}
            <div>
              <div style={{ 
                backgroundColor: '#10b981', 
                color: '#000', 
                padding: '6px 12px', 
                fontSize: '11px', 
                fontWeight: 'bold',
                marginBottom: '8px'
              }}>
                EXPERIENCE
              </div>
              <div style={{ border: '1px solid #10b981', padding: '8px', fontSize: '10px' }}>
                {Object.entries(character.xp || {}).map(([track, xp]) => (
                  <div key={track} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{track}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckboxGroup 
                        count={track === 'playbook' ? 10 : 5}
                        filled={xp || 0}
                        onChange={(val) => setCurrentCharacter({
                          ...character,
                          xp: {...(character.xp || {}), [track]: val}
                        })}
                      />
                      <span>{xp || 0}/{track === 'playbook' ? 10 : 5}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Abilities & Notes */}
          <div>
            {/* Abilities */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ 
                  backgroundColor: '#10b981', 
                  color: '#000', 
                  padding: '6px 12px', 
                  fontSize: '11px', 
                  fontWeight: 'bold',
                  marginBottom: '8px'
                }}>
                  ABILITIES ({(character.specialAbilities || []).length + (character.standardAbilities || []).length})
                </div>
                <button
                  onClick={() => setGameState(prev => ({...prev, showAbilitiesPanel: !prev.showAbilitiesPanel}))}
                  style={{
                    fontSize: '9px',
                    backgroundColor: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    padding: '4px 8px',
                    cursor: 'pointer'
                  }}
                >
                  Manage
                </button>
              </div>
              <div style={{ border: '1px solid #10b981', padding: '8px', minHeight: '120px' }}>
                {[...(character.specialAbilities || []), ...(character.standardAbilities || [])].map((ability, index) => (
                  <div key={index} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #374151' }}>
                    <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#fbbf24' }}>{ability.name}</div>
                    <div style={{ fontSize: '9px', color: '#6ee7b7', marginTop: '2px' }}>{ability.description}</div>
                  </div>
                ))}
                {((character.specialAbilities || []).length + (character.standardAbilities || []).length) === 0 && (
                  <div style={{ fontSize: '10px', color: '#6b7280', fontStyle: 'italic' }}>No abilities selected</div>
                )}
              </div>
            </div>

            {/* Abilities Panel */}
            {gameState.showAbilitiesPanel && (
              <div style={{ 
                marginBottom: '20px',
                border: '2px solid #3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                padding: '12px',
                borderRadius: '4px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, color: '#3b82f6', fontSize: '12px' }}>STANDARD ABILITIES</h4>
                  <button
                    onClick={() => setGameState(prev => ({...prev, showAbilitiesPanel: false}))}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '9px' }}>
                  {Object.entries(standardAbilities).map(([name, description]) => (
                    <label key={name} style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={(character.standardAbilities || []).some(a => a.name === name)}
                        onChange={() => {
                          const abilityObj = { name, description };
                          const isSelected = (character.standardAbilities || []).some(a => a.name === name);
                          setCurrentCharacter(prev => ({
                            ...prev,
                            standardAbilities: isSelected 
                              ? (prev.standardAbilities || []).filter(a => a.name !== name)
                              : [...(prev.standardAbilities || []), abilityObj]
                          }));
                        }}
                        style={{ marginRight: '6px', accentColor: '#3b82f6' }}
                      />
                      <span style={{ fontWeight: 'bold' }}>{name}</span>
                      <div style={{ marginLeft: '18px', color: '#6ee7b7', fontSize: '8px' }}>{description}</div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <div style={{ 
                backgroundColor: '#10b981', 
                color: '#000', 
                padding: '6px 12px', 
                fontSize: '11px', 
                fontWeight: 'bold',
                marginBottom: '8px'
              }}>
                NOTES
              </div>
              <textarea
                value={character.notes}
                onChange={(e) => setCurrentCharacter({...character, notes: e.target.value})}
                style={{
                  width: '100%',
                  height: '120px',
                  backgroundColor: '#1f2937',
                  border: '1px solid #10b981',
                  color: '#10b981',
                  fontSize: '10px',
                  padding: '8px',
                  resize: 'none',
                  outline: 'none'
                }}
                placeholder="Character background, equipment, relationships..."
              />
            </div>

            {/* Quick Reference */}
            <div style={{ marginTop: '16px', fontSize: '9px', color: '#6b7280' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>QUICK REFERENCE</div>
              <div><strong>6:</strong> Full success</div>
              <div><strong>4-5:</strong> Partial success</div>
              <div><strong>1-3:</strong> Bad outcome</div>
              <div style={{ marginTop: '4px' }}>
                <strong>Resistance:</strong> 6 - highest die = stress
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterSheet;
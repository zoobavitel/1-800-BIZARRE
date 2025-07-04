
import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Users, Zap, Shield, Star, Play, BookOpen, Dice6, Plus, X, Settings } from 'lucide-react';

// Full Character Sheet Component (preserving ALL original functionality)
const CharacterSheetWrapper = ({ character, onClose, onSave }) => {
  const [activeMode, setActiveMode] = useState('CHARACTER MODE');
  const [navOpen, setNavOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    gameRules: false,
    collections: false,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedAbilities, setSelectedAbilities] = useState(character?.abilities || []);
  
  // Interactive state - initialize with character data if provided
  const [characterData, setCharacterData] = useState({
    name: character?.name || '',
    standName: character?.standName || '',
    heritage: character?.heritage || 'Human',
    background: character?.background || '',
    look: character?.look || '',
    vice: character?.vice || '',
    crew: character?.crew || ''
  });

  const [stressBoxes, setStressBoxes] = useState(character?.stress || Array(9).fill(false));
  const [traumaChecks, setTraumaChecks] = useState(character?.trauma || {
    COLD: false, HAUNTED: false, OBSESSED: false, PARANOID: false,
    RECKLESS: false, SOFT: false, UNSTABLE: false, VICIOUS: false
  });
  const [armorUses, setArmorUses] = useState(character?.armor || { armor: false, heavy: false, special: false });
  const [harmEntries, setHarmEntries] = useState(character?.harmEntries || {
    level3: [''],
    level2: ['', ''],
    level1: ['', '']
  });
  const [coinBoxes, setCoinBoxes] = useState(character?.coin || Array(4).fill(false));
  const [stashBoxes, setStashBoxes] = useState(character?.stash || Array(40).fill(false));
  const [healingClock, setHealingClock] = useState(character?.healingClock || 0);
  const [actionRatings, setActionRatings] = useState(character?.actionRatings || {
    HUNT: 0, STUDY: 0, SURVEY: 0, TINKER: 0,
    FINESSE: 0, PROWL: 0, SKIRMISH: 0, WRECK: 0,
    BIZARRE: 0, COMMAND: 0, CONSORT: 0, SWAY: 0
  });
  
  // Stand Coin Stats - NEW addition preserving the original concept
  const [standStats, setStandStats] = useState(character?.standStats || {
    power: 1, speed: 1, range: 1, durability: 1, precision: 1, development: 1
  });
  
  const [diceResult, setDiceResult] = useState(null);
  const [customClocks, setCustomClocks] = useState(character?.clocks || []);
  
  // XP tracking
  const [xpTracks, setXpTracks] = useState(character?.xp || {
    insight: 0, prowess: 0, resolve: 0, heritage: 0, playbook: 0
  });
  
  const searchRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const isAuthenticated = true; // Mock authentication

  // Standard abilities list
  const standardAbilities = [
    'Shadow', 'Iron Will', 'Functioning Vice', 'Foresight', 'Calculating',
    'Like Looking into a Mirror', 'Trust in Me', 'Subterfuge', 'Cloak & Dagger',
    'Artificer', 'Analyst', 'Fortitude', 'Venomous', 'Bizarre Ward',
    'Physicker', 'Saboteur', 'Leader', 'Vigorous', 'Bodyguard', 'Savage',
    'Tough as Nails', 'Sharpshooter', 'Steady Barrage', 'Reflexes',
    'Bizarre Improvisation', 'Stand Evolution', 'Stand Fusion', 'Stand Recall'
  ];

  // Vice options
  const viceOptions = [
    'Gambling', 'Obsession', 'Violence', 'Pleasure', 'Stupor', 'Weird', 
    'Obligation', 'Faith', 'Luxury', 'Art', 'Competition', 'Power', 
    'Adventure', 'Solitude', 'Justice'
  ];

  // Calculate attribute dice (each action with at least 1 die contributes 1 to the attribute)
  const getAttributeDice = (actions) => {
    return actions.filter(action => actionRatings[action] > 0).length;
  };

  // XP track management
  const toggleXP = (track, index) => {
    const maxValues = {
      insight: 5,
      prowess: 5,
      resolve: 5,
      heritage: 5,
      playbook: 10
    };
    
    const currentValue = xpTracks[track];
    let newValue;
    
    if (index < currentValue) {
      // Clicking on a filled tick - reduce to that level
      newValue = index;
    } else {
      // Clicking on an empty tick - fill up to that level
      newValue = index + 1;
    }
    
    // Ensure we don't exceed maximum
    newValue = Math.min(newValue, maxValues[track]);
    
    setXpTracks({ ...xpTracks, [track]: newValue });
  };

  const getTotalXP = () => {
    return Object.values(xpTracks).reduce((total, xp) => total + xp, 0);
  };

  // Dice rolling function
  const rollDice = (actionName, diceCount, isResistanceRoll = false, isDesperateAction = false) => {
    if (diceCount === 0) {
      // Roll 2 dice and take the lower result for 0 dice
      const dice1 = Math.floor(Math.random() * 6) + 1;
      const dice2 = Math.floor(Math.random() * 6) + 1;
      const result = Math.min(dice1, dice2);
      
      let outcome = 'Failure';
      if (result >= 6) outcome = 'Success';
      else if (result >= 4) outcome = 'Partial Success';
      
      setDiceResult({
        action: actionName,
        dice: [dice1, dice2],
        result: result,
        outcome: outcome,
        special: '0 dice: Roll 2d6, take lower',
        isResistance: isResistanceRoll,
        stressCost: isResistanceRoll ? 6 - result : null,
        zeroDice: true,
        isDesperateAction: isDesperateAction
      });
    } else {
      const dice = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1);
      const highest = Math.max(...dice);
      const sixes = dice.filter(d => d === 6).length;
      
      let outcome = 'Failure';
      if (highest >= 6) {
        outcome = sixes > 1 ? 'Critical Success' : 'Success';
      } else if (highest >= 4) {
        outcome = 'Partial Success';
      }
      
      setDiceResult({
        action: actionName,
        dice: dice,
        result: highest,
        outcome: outcome,
        special: sixes > 1 ? `Critical! (${sixes} sixes)` : '',
        isResistance: isResistanceRoll,
        stressCost: isResistanceRoll ? 6 - highest : null,
        zeroDice: false,
        isDesperateAction: isDesperateAction
      });
    }

    // Auto-mark XP for desperate actions
    if (isDesperateAction && !isResistanceRoll) {
      // Mark XP in the appropriate attribute for the action
      const actionToAttribute = {
        'HUNT': 'insight', 'STUDY': 'insight', 'SURVEY': 'insight', 'TINKER': 'insight',
        'FINESSE': 'prowess', 'PROWL': 'prowess', 'SKIRMISH': 'prowess', 'WRECK': 'prowess',
        'BIZARRE': 'resolve', 'COMMAND': 'resolve', 'CONSORT': 'resolve', 'SWAY': 'resolve'
      };
      
      const attribute = actionToAttribute[actionName];
      if (attribute && xpTracks[attribute] < 5) {
        setXpTracks(prev => ({
          ...prev,
          [attribute]: Math.min(prev[attribute] + 1, 5)
        }));
      }
    }
  };

  // Clock management
  const addCustomClock = () => {
    const name = prompt('Clock name:');
    const segments = parseInt(prompt('Number of segments (4, 6, or 8):') || '4');
    if (name && [4, 6, 8].includes(segments)) {
      setCustomClocks([...customClocks, {
        id: Date.now(),
        name,
        segments,
        filled: 0
      }]);
    }
  };

  const updateClock = (clockId, newFilled) => {
    setCustomClocks(customClocks.map(clock => 
      clock.id === clockId ? { ...clock, filled: newFilled } : clock
    ));
  };

  const deleteClock = (clockId) => {
    setCustomClocks(customClocks.filter(clock => clock.id !== clockId));
  };

  // Toggle functions
  const toggleStress = (index) => {
    const newStress = [...stressBoxes];
    newStress[index] = !newStress[index];
    setStressBoxes(newStress);
  };

  const toggleTrauma = (trauma) => {
    setTraumaChecks({ ...traumaChecks, [trauma]: !traumaChecks[trauma] });
  };

  const toggleArmor = (type) => {
    setArmorUses({ ...armorUses, [type]: !armorUses[type] });
  };

  const toggleCoin = (index) => {
    const newCoin = [...coinBoxes];
    newCoin[index] = !newCoin[index];
    setCoinBoxes(newCoin);
  };

  const toggleStash = (index) => {
    const newStash = [...stashBoxes];
    newStash[index] = !newStash[index];
    setStashBoxes(newStash);
  };

  const updateActionRating = (action, value) => {
    setActionRatings({ ...actionRatings, [action]: value });
  };

  const updateCharacterData = (field, value) => {
    setCharacterData(prev => ({ ...prev, [field]: value }));
  };

  const updateHarmEntry = (level, index, value) => {
    setHarmEntries(prev => ({
      ...prev,
      [level]: prev[level].map((entry, i) => i === index ? value : entry)
    }));
  };

  // Header logic (simplified without router)
  const performSearch = async (query) => {
    if (!query.trim() || !isAuthenticated) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearchLoading(true);
    try {
      // Mock search results for demo
      const mockResults = [
        { type: 'Character', title: 'Metal Fingers', subtitle: 'Cyborg Stand User', id: 1, url: '/characters/1' },
        { type: 'Ability', title: 'Iron Will', subtitle: 'Standard Ability', id: 2, url: '/abilities/iron-will' }
      ];
      setSearchResults(mockResults);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);
  };

  const handleSearchResultClick = (result) => {
    setShowSearchResults(false);
    setSearchQuery('');
    // Mock navigation - in a real app this would use router
    console.log('Navigate to:', result.url);
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);
  
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  useEffect(() => {
    if (navOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [navOpen]);

  const ProgressClock = ({ size = 80, segments = 4, filled = 0, onClick = null, interactive = false }) => {
    const radius = size / 2 - 4;
    const centerX = size / 2;
    const centerY = size / 2;
    
    const segmentAngle = 360 / segments;
    const segmentPaths = [];
    
    for (let i = 0; i < segments; i++) {
      const startAngle = (i * segmentAngle - 90) * (Math.PI / 180);
      const endAngle = ((i + 1) * segmentAngle - 90) * (Math.PI / 180);
      
      const x1 = centerX + radius * Math.cos(startAngle);
      const y1 = centerY + radius * Math.sin(startAngle);
      const x2 = centerX + radius * Math.cos(endAngle);
      const y2 = centerY + radius * Math.sin(endAngle);
      
      const largeArcFlag = segmentAngle > 180 ? 1 : 0;
      
      const pathData = [
        `M ${centerX} ${centerY}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z'
      ].join(' ');
      
      segmentPaths.push(
        <path
          key={i}
          d={pathData}
          fill={i < filled ? '#dc2626' : 'transparent'}
          stroke="#6b7280"
          strokeWidth="1"
          className={interactive ? 'cursor-pointer hover:stroke-red-400' : ''}
          onClick={interactive ? () => {
            if (onClick) {
              // If clicking a filled segment, reduce to that level
              // If clicking an empty segment, fill up to that level
              const newFilled = i < filled ? i : i + 1;
              onClick(newFilled);
            }
          } : undefined}
        />
      );
    }
    
    return (
      <svg width={size} height={size} className="transform -rotate-90">
        {segmentPaths}
        <circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill="transparent"
          stroke="#6b7280"
          strokeWidth="2"
        />
      </svg>
    );
  };

  const addAbility = (abilityName, type = 'standard') => {
    const newAbility = {
      id: Date.now(),
      name: abilityName,
      type: type,
      description: type === 'custom' ? 'Custom ability description...' : ''
    };
    setSelectedAbilities([...selectedAbilities, newAbility]);
  };

  const removeAbility = (abilityId) => {
    setSelectedAbilities(selectedAbilities.filter(ability => ability.id !== abilityId));
  };

  const handleSave = () => {
    const updatedCharacter = {
      ...characterData,
      actionRatings,
      standStats,
      stress: stressBoxes,
      trauma: traumaChecks,
      armor: armorUses,
      harmEntries,
      coin: coinBoxes,
      stash: stashBoxes,
      healingClock,
      xp: xpTracks,
      abilities: selectedAbilities,
      clocks: customClocks,
      id: character?.id || Date.now(),
      lastModified: new Date().toISOString()
    };
    
    onSave(updatedCharacter);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-black text-white font-mono text-sm max-w-7xl w-full">
        {/* Header */}
        <header className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-600 sticky top-0 z-10">
          <div className="text-xl font-bold text-white cursor-pointer">1(800)BIZARRE</div>
          <div className="flex items-center space-x-4">
            {isAuthenticated && (
              <div className="search-container desktop-search" ref={searchRef}>
                <div className="flex items-center">
                  <input 
                    type="text" 
                    className="bg-gray-700 text-white border border-gray-600 rounded px-3 py-1 text-sm" 
                    placeholder="Search characters, campaigns, abilities..." 
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onFocus={() => searchQuery && setShowSearchResults(true)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearchSubmit()}
                  />
                  <button onClick={handleSearchSubmit} className="ml-2 text-gray-400 hover:text-white">🔍</button>
                </div>
                
                {showSearchResults && (
                  <div className="absolute top-full left-0 right-0 bg-gray-800 border border-gray-600 mt-1 rounded shadow-lg z-50">
                    {searchLoading ? (
                      <div className="p-3 text-gray-400">Searching...</div>
                    ) : searchResults.length > 0 ? (
                      <>
                        <div className="p-2 text-xs text-gray-400 border-b border-gray-600">
                          Search Results ({searchResults.length})
                        </div>
                        {searchResults.map((result, index) => (
                          <div 
                            key={`${result.type}-${result.id}-${index}`}
                            className="p-3 hover:bg-gray-700 cursor-pointer border-b border-gray-700 last:border-b-0"
                            onClick={() => handleSearchResultClick(result)}
                          >
                            <div className="text-xs text-purple-400">{result.type}</div>
                            <div className="text-white font-medium">{result.title}</div>
                            <div className="text-xs text-gray-400">{result.subtitle}</div>
                          </div>
                        ))}
                      </>
                    ) : searchQuery ? (
                      <div className="p-3 text-gray-400">
                        No results found for "{searchQuery}"
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
            <select 
              value={activeMode}
              onChange={(e) => setActiveMode(e.target.value)}
              className="bg-gray-600 text-white border border-gray-500 px-2 py-1 text-xs"
            >
              <option>CHARACTER MODE</option>
              <option>CREW MODE</option>
              <option>FACTION MODE</option>
            </select>
            <button 
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-xs font-bold"
            >
              Save
            </button>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </header>

        <div className="p-4">
          {/* Character Info Section */}
          <div className="grid grid-cols-2 gap-8 mb-6">
            {/* Left Side */}
            <div className="space-y-4">
              {/* Name and Details */}
              <div className="space-y-2">
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <div className="text-red-400 text-xs font-bold">NAME</div>
                    <div className="border-b border-gray-600 pb-1">
                      <input 
                        type="text" 
                        value={characterData.name}
                        onChange={(e) => updateCharacterData('name', e.target.value)}
                        className="bg-transparent w-full text-white font-bold" 
                        placeholder="Character Name"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-red-400 text-xs font-bold">CREW</div>
                    <div className="border-b border-gray-600 pb-1">
                      <input 
                        type="text" 
                        value={characterData.crew}
                        onChange={(e) => updateCharacterData('crew', e.target.value)}
                        className="bg-transparent w-full text-white" 
                        placeholder="Crew Name"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <div className="text-red-400 text-xs font-bold">STAND NAME</div>
                    <div className="border-b border-gray-600 pb-1">
                      <input 
                        type="text" 
                        value={characterData.standName}
                        onChange={(e) => updateCharacterData('standName', e.target.value)}
                        className="bg-transparent w-full text-white" 
                        placeholder="「Stand Name」"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-red-400 text-xs font-bold">LOOK</div>
                  <div className="border-b border-gray-600 pb-1">
                    <input 
                      type="text" 
                      value={characterData.look}
                      onChange={(e) => updateCharacterData('look', e.target.value)}
                      className="bg-transparent w-full text-white" 
                      placeholder="Character appearance and style"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <div className="text-red-400 text-xs font-bold">HERITAGE</div>
                    <div className="border-b border-gray-600 pb-1">
                      <input 
                        type="text" 
                        value={characterData.heritage}
                        onChange={(e) => updateCharacterData('heritage', e.target.value)}
                        className="bg-transparent w-full text-white" 
                        placeholder="Heritage"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-red-400 text-xs font-bold">BACKGROUND</div>
                    <div className="border-b border-gray-600 pb-1">
                      <input 
                        type="text" 
                        value={characterData.background}
                        onChange={(e) => updateCharacterData('background', e.target.value)}
                        className="bg-transparent w-full text-white" 
                        placeholder="Background"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-red-400 text-xs font-bold">VICE / PURVEYOR</div>
                  <div className="border-b border-gray-600 pb-1 flex items-center justify-between">
                    <div className="flex items-center space-x-2 flex-1">
                      <select 
                        value={characterData.vice}
                        onChange={(e) => updateCharacterData('vice', e.target.value)}
                        className="bg-gray-700 text-white border border-gray-600 px-2 py-1 text-xs"
                      >
                        <option value="">Select Vice</option>
                        {viceOptions.map(vice => (
                          <option key={vice} value={vice}>{vice}</option>
                        ))}
                      </select>
                      <input type="text" placeholder="Purveyor name/details" className="bg-transparent flex-1 text-white text-xs" />
                    </div>
                    <button className="bg-gray-600 px-2 py-1 text-xs border border-gray-500 ml-2">Indulge Vice</button>
                  </div>
                </div>
              </div>

              {/* Stress & Trauma */}
              <div className="space-y-4">
                <div>
                  <div className="text-red-400 text-xs font-bold mb-1">STRESS</div>
                  <div className="flex space-x-1">
                    {stressBoxes.map((filled, i) => (
                      <div 
                        key={i} 
                        className={`w-6 h-6 border border-gray-600 cursor-pointer hover:bg-gray-600 ${
                          filled ? 'bg-red-600' : 'bg-gray-800'
                        }`}
                        onClick={() => toggleStress(i)}
                      ></div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-red-400 text-xs font-bold mb-1">TRAUMA</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {Object.entries(traumaChecks).map(([trauma, checked]) => (
                      <label key={trauma} className="flex items-center space-x-1 cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="w-3 h-3" 
                          checked={checked}
                          onChange={() => toggleTrauma(trauma)}
                        />
                        <span>{trauma}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Harm */}
              <div>
                <div className="text-red-400 text-xs font-bold mb-2">HARM</div>
                <div className="flex space-x-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-400 w-16">NEED HELP</span>
                      <div className="flex-1 border border-gray-600 h-6 bg-gray-800">
                        <input 
                          type="text" 
                          className="bg-transparent w-full h-full px-2 text-white text-xs" 
                          placeholder="Level 3 harm" 
                          value={harmEntries.level3[0]}
                          onChange={(e) => updateHarmEntry('level3', 0, e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-400 w-16">-1D</span>
                      <div className="flex-1 border border-gray-600 h-6 bg-gray-800">
                        <input 
                          type="text" 
                          className="bg-transparent w-full h-full px-2 text-white text-xs" 
                          placeholder="Level 2 harm" 
                          value={harmEntries.level2[0]}
                          onChange={(e) => updateHarmEntry('level2', 0, e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-400 w-16">-1D</span>
                      <div className="flex-1 border border-gray-600 h-6 bg-gray-800">
                        <input 
                          type="text" 
                          className="bg-transparent w-full h-full px-2 text-white text-xs" 
                          placeholder="Level 2 harm" 
                          value={harmEntries.level2[1]}
                          onChange={(e) => updateHarmEntry('level2', 1, e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-400 w-16">LESS EFFECT</span>
                      <div className="flex-1 border border-gray-600 h-6 bg-gray-800">
                        <input 
                          type="text" 
                          className="bg-transparent w-full h-full px-2 text-white text-xs" 
                          placeholder="Level 1 harm" 
                          value={harmEntries.level1[0]}
                          onChange={(e) => updateHarmEntry('level1', 0, e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-400 w-16">LESS EFFECT</span>
                      <div className="flex-1 border border-gray-600 h-6 bg-gray-800">
                        <input 
                          type="text" 
                          className="bg-transparent w-full h-full px-2 text-white text-xs" 
                          placeholder="Level 1 harm" 
                          value={harmEntries.level1[1]}
                          onChange={(e) => updateHarmEntry('level1', 1, e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="text-xs text-gray-400 mb-1">progress clock</div>
                    <ProgressClock 
                      size={60} 
                      segments={4} 
                      filled={healingClock}
                      interactive={true}
                      onClick={setHealingClock}
                    />
                    <div className="text-xs text-gray-400 mt-1">HEALING</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-gray-400">ARMOR USES</div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          className="w-3 h-3" 
                          checked={armorUses.armor}
                          onChange={() => toggleArmor('armor')}
                        />
                        <span className="text-xs">ARMOR</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          className="w-3 h-3" 
                          checked={armorUses.heavy}
                          onChange={() => toggleArmor('heavy')}
                        />
                        <span className="text-xs">+HEAVY</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          className="w-3 h-3" 
                          checked={armorUses.special}
                          onChange={() => toggleArmor('special')}
                        />
                        <span className="text-xs">SPECIAL</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Coin */}
              <div>
                <div className="text-red-400 text-xs font-bold mb-1">COIN</div>
                <div className="flex space-x-1">
                  {coinBoxes.map((filled, i) => (
                    <div 
                      key={i} 
                      className={`w-6 h-6 border border-gray-600 cursor-pointer hover:bg-gray-600 ${
                        filled ? 'bg-yellow-600' : 'bg-gray-800'
                      }`}
                      onClick={() => toggleCoin(i)}
                    ></div>
                  ))}
                </div>
                <div className="grid grid-cols-8 gap-1 mt-2">
                  {stashBoxes.map((filled, i) => (
                    <div 
                      key={i} 
                      className={`w-4 h-4 border border-gray-600 text-xs flex items-center justify-center cursor-pointer hover:bg-gray-600 ${
                        filled ? 'bg-yellow-600' : 'bg-gray-800'
                      }`}
                      onClick={() => toggleStash(i)}
                    >
                      {filled ? '⬛' : ''}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-400 mt-1">STASH</div>
              </div>
            </div>

            {/* Right Side - Playbook */}
            <div className="bg-gray-800 p-4 border border-gray-600">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-400">PLAYBOOK</h2>
                <div className="text-xs text-gray-400">A SHORT PLAYBOOK<br />DESCRIPTION</div>
              </div>
              
              <div className="mb-4 text-xs text-gray-300">
                Choose your playbook type and customize your abilities to match your character's unique powers and fighting style.
              </div>

              {/* Playbook Type Selector */}
              <div className="mb-4">
                <div className="text-xs font-bold mb-2">PLAYBOOK TYPE</div>
                <select className="bg-gray-700 text-white border border-gray-600 px-2 py-1 text-xs w-full">
                  <option>Stand</option>
                  <option>Hamon</option>
                  <option>Spin</option>
                </select>
              </div>

              {/* Stand Coin Stats */}
              <div className="mb-6">
                <div className="text-xs font-bold mb-2">STAND COIN STATS</div>
                <div className="space-y-2">
                  {Object.entries(standStats).map(([stat, value]) => (
                    <div key={stat} className="flex items-center justify-between text-xs">
                      <span className="text-gray-300 capitalize font-semibold w-20">{stat.toUpperCase()}</span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setStandStats(prev => ({ ...prev, [stat]: Math.max(0, value - 1) }))}
                          className="w-5 h-5 bg-red-600 hover:bg-red-700 rounded text-white text-xs font-bold"
                          disabled={value === 0}
                        >
                          -
                        </button>
                        <span className="w-8 text-center text-white font-bold">{value}</span>
                        <button
                          onClick={() => setStandStats(prev => ({ ...prev, [stat]: Math.min(4, value + 1) }))}
                          className="w-5 h-5 bg-green-600 hover:bg-green-700 rounded text-white text-xs font-bold"
                          disabled={value === 4}
                        >
                          +
                        </button>
                        <span className="text-gray-400 text-xs ml-2">
                          {value === 0 ? 'F' : value === 1 ? 'D' : value === 2 ? 'C' : value === 3 ? 'B' : 'A'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  Total: {Object.values(standStats).reduce((sum, val) => sum + val, 0)}/10 points
                </div>
              </div>

              {/* Action Ratings */}
              <div className="grid grid-cols-3 gap-6 mb-6">
                {/* Insight */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div 
                      className="text-xs font-bold cursor-pointer hover:text-purple-400"
                      onClick={() => rollDice('Insight', getAttributeDice(['HUNT', 'STUDY', 'SURVEY', 'TINKER']), true)}
                      title="Click to make Resistance Roll (resists mental/knowledge-based consequences)"
                    >
                      INSIGHT
                    </div>
                    <div className="flex space-x-1">
                      {[1, 2, 3, 4].map((dot) => (
                        <div 
                          key={dot} 
                          className={`w-2 h-2 rounded-full border border-gray-500 ${
                            dot <= getAttributeDice(['HUNT', 'STUDY', 'SURVEY', 'TINKER']) ? 'bg-blue-500' : 'bg-gray-700'
                          }`}
                          title={`Insight attribute dots: ${getAttributeDice(['HUNT', 'STUDY', 'SURVEY', 'TINKER'])}`}
                        ></div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {['HUNT', 'STUDY', 'SURVEY', 'TINKER'].map((action) => (
                      <div key={action} className="flex items-center justify-between">
                        <span 
                          className="text-xs cursor-pointer hover:text-purple-400"
                          onClick={() => rollDice(action, actionRatings[action], false)}
                          title={`Click to roll ${actionRatings[action]} dice for ${action}`}
                        >
                          {action}
                        </span>
                        <div className="flex space-x-1">
                          {[1, 2, 3, 4].map((dot) => (
                            <div 
                              key={dot} 
                              className={`w-3 h-3 rounded-full border border-gray-500 cursor-pointer hover:bg-purple-400 ${
                                dot <= actionRatings[action] ? 'bg-purple-600' : 'bg-gray-700'
                              }`}
                              onClick={() => updateActionRating(action, dot <= actionRatings[action] ? dot - 1 : dot)}
                            ></div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Prowess */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div 
                      className="text-xs font-bold cursor-pointer hover:text-purple-400"
                      onClick={() => rollDice('Prowess', getAttributeDice(['FINESSE', 'PROWL', 'SKIRMISH', 'WRECK']), true)}
                      title="Click to make Resistance Roll (resists physical consequences)"
                    >
                      PROWESS
                    </div>
                    <div className="flex space-x-1">
                      {[1, 2, 3, 4].map((dot) => (
                        <div 
                          key={dot} 
                          className={`w-2 h-2 rounded-full border border-gray-500 ${
                            dot <= getAttributeDice(['FINESSE', 'PROWL', 'SKIRMISH', 'WRECK']) ? 'bg-blue-500' : 'bg-gray-700'
                          }`}
                          title={`Prowess attribute dots: ${getAttributeDice(['FINESSE', 'PROWL', 'SKIRMISH', 'WRECK'])}`}
                        ></div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {['FINESSE', 'PROWL', 'SKIRMISH', 'WRECK'].map((action) => (
                      <div key={action} className="flex items-center justify-between">
                        <span 
                          className="text-xs cursor-pointer hover:text-purple-400"
                          onClick={() => rollDice(action, actionRatings[action], false)}
                          title={`Click to roll ${actionRatings[action]} dice for ${action}`}
                        >
                          {action}
                        </span>
                        <div className="flex space-x-1">
                          {[1, 2, 3, 4].map((dot) => (
                            <div 
                              key={dot} 
                              className={`w-3 h-3 rounded-full border border-gray-500 cursor-pointer hover:bg-purple-400 ${
                                dot <= actionRatings[action] ? 'bg-purple-600' : 'bg-gray-700'
                              }`}
                              onClick={() => updateActionRating(action, dot <= actionRatings[action] ? dot - 1 : dot)}
                            ></div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resolve */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div 
                      className="text-xs font-bold cursor-pointer hover:text-purple-400"
                      onClick={() => rollDice('Resolve', getAttributeDice(['BIZARRE', 'COMMAND', 'CONSORT', 'SWAY']), true)}
                      title="Click to make Resistance Roll (resists emotional/mental consequences)"
                    >
                      RESOLVE
                    </div>
                    <div className="flex space-x-1">
                      {[1, 2, 3, 4].map((dot) => (
                        <div 
                          key={dot} 
                          className={`w-2 h-2 rounded-full border border-gray-500 ${
                            dot <= getAttributeDice(['BIZARRE', 'COMMAND', 'CONSORT', 'SWAY']) ? 'bg-blue-500' : 'bg-gray-700'
                          }`}
                          title={`Resolve attribute dots: ${getAttributeDice(['BIZARRE', 'COMMAND', 'CONSORT', 'SWAY'])}`}
                        ></div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {['BIZARRE', 'COMMAND', 'CONSORT', 'SWAY'].map((action) => (
                      <div key={action} className="flex items-center justify-between">
                        <span 
                          className="text-xs cursor-pointer hover:text-purple-400"
                          onClick={() => rollDice(action, actionRatings[action], false)}
                          title={`Click to roll ${actionRatings[action]} dice for ${action}`}
                        >
                          {action}
                        </span>
                        <div className="flex space-x-1">
                          {[1, 2, 3, 4].map((dot) => (
                            <div 
                              key={dot} 
                              className={`w-3 h-3 rounded-full border border-gray-500 cursor-pointer hover:bg-purple-400 ${
                                dot <= actionRatings[action] ? 'bg-purple-600' : 'bg-gray-700'
                              }`}
                              onClick={() => updateActionRating(action, dot <= actionRatings[action] ? dot - 1 : dot)}
                            ></div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Dice Results */}
              {diceResult && (
                <div className="mb-6 bg-gray-700 p-3 rounded border border-gray-600">
                  <div className="text-sm font-bold text-purple-400 mb-2">
                    {diceResult.action} {diceResult.isResistance ? 'Resistance Roll' : 'Action Roll'}
                    {diceResult.zeroDice && <span className="text-red-400 ml-2">(0 Dice)</span>}
                    {diceResult.isDesperateAction && <span className="text-orange-400 ml-2">(Desperate - XP Gained!)</span>}
                  </div>
                  <div className="flex items-center space-x-4 text-xs mb-2">
                    <div>
                      <span className="text-gray-400">Dice:</span>
                      <span className="ml-1">
                        {diceResult.dice.map((die, i) => (
                          <span key={i} className={`inline-block w-6 h-6 border rounded mr-1 text-center leading-6 ${
                            die === 6 ? 'bg-green-600 border-green-400' : 
                            die >= 4 ? 'bg-blue-600 border-blue-400' : 
                            'bg-gray-600 border-gray-400'
                          } ${diceResult.zeroDice && die === diceResult.result ? 'ring-2 ring-red-400' : ''}`}>
                            {die}
                          </span>
                        ))}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Result:</span>
                      <span className={`ml-1 font-bold ${
                        diceResult.outcome.includes('Success') ? 'text-green-400' : 
                        diceResult.outcome.includes('Partial') ? 'text-yellow-400' : 
                        'text-red-400'
                      }`}>
                        {diceResult.outcome}
                      </span>
                    </div>
                    {diceResult.special && (
                      <div className={`${diceResult.zeroDice ? 'text-red-400 font-bold' : 'text-purple-400'}`}>
                        {diceResult.special}
                      </div>
                    )}
                  </div>

                  {/* Desperate Action Button for Action Rolls */}
                  {!diceResult.isResistance && !diceResult.isDesperateAction && (
                    <div className="mb-2">
                      <button
                        onClick={() => {
                          // Mark this as a desperate action and gain XP
                          const actionToAttribute = {
                            'HUNT': 'insight', 'STUDY': 'insight', 'SURVEY': 'insight', 'TINKER': 'insight',
                            'FINESSE': 'prowess', 'PROWL': 'prowess', 'SKIRMISH': 'prowess', 'WRECK': 'prowess',
                            'BIZARRE': 'resolve', 'COMMAND': 'resolve', 'CONSORT': 'resolve', 'SWAY': 'resolve'
                          };
                          
                          const attribute = actionToAttribute[diceResult.action];
                          if (attribute && xpTracks[attribute] < 5) {
                            setXpTracks(prev => ({
                              ...prev,
                              [attribute]: Math.min(prev[attribute] + 1, 5)
                            }));
                            setDiceResult(prev => ({ ...prev, isDesperateAction: true }));
                          }
                        }}
                        className="bg-orange-600 hover:bg-orange-700 px-2 py-1 rounded text-xs"
                      >
                        Mark as Desperate Action (+1 XP)
                      </button>
                    </div>
                  )}
                  
                  {diceResult.isResistance && (
                    <div className="bg-gray-800 p-2 rounded text-xs">
                      <div className="text-yellow-400 font-bold mb-1">Resistance Roll - Stress Cost: {diceResult.stressCost}</div>
                      <div className="text-gray-300 space-y-1">
                        <div>• Pay {diceResult.stressCost} stress to reduce harm by one level</div>
                        <div>• Level 3 → Level 2 (only if Level 2 slot is open)</div>
                        <div>• Level 2 → Level 1 (only if Level 1 slot is open)</div>
                        <div>• Level 1 → Removed completely</div>
                        <div className="text-yellow-300 mt-1">⚠ Must clear lower-level harm first if slots are full!</div>
                      </div>
                    </div>
                  )}
                  
                  <button 
                    onClick={() => setDiceResult(null)}
                    className="mt-2 text-xs text-gray-400 hover:text-white"
                  >
                    ✕ Clear
                  </button>
                </div>
              )}

              {/* Abilities Section */}
              <div className="mb-6">
                <div className="text-xs font-bold mb-2">ABILITIES</div>
                
                {/* Selected Abilities */}
                <div className="space-y-2 mb-3">
                  {selectedAbilities.map((ability) => (
                    <div key={ability.id} className="flex items-center justify-between bg-gray-700 p-2 rounded text-xs">
                      <div>
                        <span className="font-bold">{ability.name}</span>
                        <span className="ml-2 px-1 py-0.5 bg-purple-600 rounded text-xs">{ability.type}</span>
                      </div>
                      <button 
                        onClick={() => removeAbility(ability.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Ability Buttons */}
                <div className="space-y-2">
                  <div>
                    <button 
                      onClick={() => {
                        const ability = prompt('Choose a standard ability:', standardAbilities[0]);
                        if (ability && standardAbilities.includes(ability)) {
                          addAbility(ability, 'standard');
                        }
                      }}
                      className="w-full py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                    >
                      + Add Standard Ability
                    </button>
                  </div>
                  <div>
                    <button 
                      onClick={() => {
                        const abilityName = prompt('Enter custom ability name:');
                        if (abilityName) {
                          addAbility(abilityName, 'custom');
                        }
                      }}
                      className="w-full py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                    >
                      + Add Custom Ability
                    </button>
                  </div>
                  <div>
                    <button 
                      onClick={() => {
                        const abilityName = prompt('Enter playbook ability name:');
                        if (abilityName) {
                          addAbility(abilityName, 'playbook');
                        }
                      }}
                      className="w-full py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs"
                    >
                      + Add Playbook Ability
                    </button>
                  </div>
                </div>
              </div>

              {/* Bonus Dice */}
              <div>
                <div className="text-xs font-bold mb-2">BONUS DICE</div>
                <div className="space-y-1">
                  <div className="text-xs">
                    <strong>PUSH YOURSELF</strong><br />
                    (take 2 Stress) — or — accept<br />
                    a <strong>DEVIL'S BARGAIN</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section - Full preservation of original layout */}
          <div className="grid grid-cols-3 gap-8">
            {/* Left Column */}
            <div className="space-y-6">
              {/* XP Tracks */}
              <div>
                <div className="text-red-400 text-xs font-bold mb-3">EXPERIENCE TRACKS</div>
                
                {/* Attribute XP Tracks */}
                <div className="space-y-2 mb-4">
                  {[
                    { name: 'INSIGHT', key: 'insight', max: 5 },
                    { name: 'PROWESS', key: 'prowess', max: 5 },
                    { name: 'RESOLVE', key: 'resolve', max: 5 },
                    { name: 'HERITAGE', key: 'heritage', max: 5 }
                  ].map(({ name, key, max }) => (
                    <div key={key} className="flex items-center space-x-2">
                      <span className="text-xs text-gray-400 w-16">{name}</span>
                      <div className="flex space-x-1">
                        {Array.from({ length: max }, (_, i) => (
                          <div
                            key={i}
                            className={`w-3 h-3 border border-gray-500 cursor-pointer hover:bg-purple-400 ${
                              i < xpTracks[key] ? 'bg-purple-600' : 'bg-gray-700'
                            }`}
                            onClick={() => toggleXP(key, i)}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-400">({xpTracks[key]}/{max})</span>
                    </div>
                  ))}
                </div>

                {/* Playbook XP Track */}
                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-xs text-gray-400 w-16">PLAYBOOK</span>
                  <div className="flex space-x-1">
                    {Array.from({ length: 10 }, (_, i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 border border-gray-500 cursor-pointer hover:bg-purple-400 ${
                          i < xpTracks.playbook ? 'bg-purple-600' : 'bg-gray-700'
                        }`}
                        onClick={() => toggleXP('playbook', i)}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">({xpTracks.playbook}/10)</span>
                </div>

                {/* Total XP and Advancement */}
                <div className="bg-gray-800 p-2 rounded text-xs">
                  <div className="text-purple-400 font-bold">Total XP: {getTotalXP()}</div>
                  <div className="text-gray-300 mt-1">
                    Spend 10 XP to advance:
                  </div>
                  <div className="text-gray-400 space-y-1 mt-1">
                    • Increase action rating by 1
                    • Gain new special ability
                    • Increase Stand coin stat by 1 grade
                  </div>
                </div>
              </div>

              <div>
                <div className="text-red-400 text-xs font-bold mb-2">MARK XP:</div>
                <div className="text-xs space-y-1">
                  <div className="flex items-center space-x-2">
                    <span>🔷</span>
                    <span><em>Every time you roll a desperate action, mark xp in that action's attribute.</em></span>
                  </div>
                  <div className="text-xs">
                    At the end of each session, for each item below, mark 1 xp (or instead mark 2 xp if that item occurred multiple times).
                  </div>
                  <div className="flex items-center space-x-2">
                    <span>🔷</span>
                    <span><em>Enter your playbook's specific way to mark XP here.</em></span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span>🔷</span>
                    <span>You expressed your beliefs, drives, heritage, or background.</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span>🔷</span>
                    <span>You struggled with issues from your vice or traumas during the session.</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-red-400 text-xs font-bold mb-2">TEAMWORK</div>
                <div className="space-y-1 text-xs">
                  <div className="bg-gray-700 p-1">Assist a teammate</div>
                  <div className="bg-gray-700 p-1">Lead a group action</div>
                  <div className="bg-gray-700 p-1">Protect a teammate</div>
                  <div className="bg-gray-700 p-1">Set up a teammate</div>
                </div>
              </div>
            </div>

            {/* Middle Column */}
            <div className="space-y-6">
              <div>
                <div className="text-red-400 text-xs font-bold mb-2">PLANNING & LOAD</div>
                <div className="text-xs mb-2">
                  Choose a plan, provide the <strong>detail</strong>. Choose your <strong>load</strong> limit for the operation.
                </div>
                <div className="space-y-1 text-xs">
                  <div><strong>Assault:</strong> <em>Point of attack</em></div>
                  <div><strong>Occult:</strong> <em>Arcane power</em></div>
                  <div><strong>Deception:</strong> <em>Method</em></div>
                  <div><strong>Social:</strong> <em>Connection</em></div>
                  <div><strong>Stealth:</strong> <em>Entry point</em></div>
                  <div><strong>Transport:</strong> <em>Route</em></div>
                </div>
              </div>

              <div>
                <div className="text-red-400 text-xs font-bold mb-2">GATHER INFORMATION</div>
                <div className="space-y-1 text-xs text-gray-400">
                  <div>🔷 What do they intend to do?</div>
                  <div>🔷 How can I get them to [X]?</div>
                  <div>🔷 What are they really feeling?</div>
                  <div>🔷 What should I look out for?</div>
                  <div>🔷 Where's the weakness here?</div>
                  <div>🔷 How can I find [X]?</div>
                  <div>🔷 What's really going on here?</div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <div>
                <div className="text-red-400 text-xs font-bold mb-2">FRIENDS</div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-xs">🔻 Friend name</span>
                </div>
                <button className="w-full bg-gray-600 text-xs py-1 border border-gray-500">Roll Fortune</button>
              </div>

              <div>
                <div className="text-red-400 text-xs font-bold mb-2">RIVALS</div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-xs">🔻 Rival name</span>
                </div>
                <button className="w-full bg-gray-600 text-xs py-1 border border-gray-500">Roll Fortune</button>
              </div>

              <div>
                <div className="text-red-400 text-xs font-bold mb-2">CLOCKS</div>
                
                {/* Custom Clocks */}
                <div className="space-y-3 mb-3">
                  {customClocks.map((clock) => (
                    <div key={clock.id} className="bg-gray-700 p-2 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <input 
                          type="text" 
                          value={clock.name}
                          onChange={(e) => {
                            setCustomClocks(customClocks.map(c => 
                              c.id === clock.id ? { ...c, name: e.target.value } : c
                            ));
                          }}
                          className="bg-transparent text-xs text-white flex-1 mr-2 border-b border-gray-500"
                        />
                        <button 
                          onClick={() => deleteClock(clock.id)}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex items-center justify-center">
                        <ProgressClock 
                          size={40} 
                          segments={clock.segments} 
                          filled={clock.filled}
                          interactive={true}
                          onClick={(newFilled) => updateClock(clock.id, newFilled)}
                        />
                      </div>
                      <div className="text-center text-xs text-gray-400 mt-1">
                        {clock.filled}/{clock.segments}
                      </div>
                    </div>
                  ))}
                </div>
                
                <button 
                  onClick={addCustomClock}
                  className="w-full py-2 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-purple-400 hover:text-purple-400 transition-colors text-xs"
                >
                  + Add Clock
                </button>
                
                {/* Notes section moved here */}
                <div className="mt-4">
                  <div className="text-red-400 text-xs font-bold mb-2">NOTES</div>
                  <div className="border border-gray-600 bg-gray-800 p-2 h-20">
                    <textarea 
                      placeholder="Notes..." 
                      className="w-full h-full bg-transparent text-xs text-white resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};



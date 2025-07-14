import React, { useState, useEffect, useRef } from 'react';
import { X, Plus } from 'lucide-react';

const CharacterSheetWrapper = ({ character, onClose, onSave, onCreateNew, onSwitchCharacter, allCharacters = [] }) => {
  const [activeMode, setActiveMode] = useState('FACTION MODE'); // Start in faction mode
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
  
  // Faction state with demo data
  const [factionData, setFactionData] = useState({
    isGM: true, // Toggle for GM vs Player view
    campaignName: 'Diamond is Unbreakable',
    factions: [
      {
        id: 1,
        name: 'Speedwagon Foundation',
        type: 'MERCHANT',
        hold: 'strong',
        reputation: 3,
        notes: 'International organization funding bizarre research'
      },
      {
        id: 2,
        name: 'Morioh Police',
        type: 'POLITICAL',
        hold: 'weak',
        reputation: 1,
        notes: 'Local law enforcement, unaware of Stand users'
      },
      {
        id: 3,
        name: 'Angelo Gang',
        type: 'CRIMINAL',
        hold: 'weak',
        reputation: 2,
        notes: 'Small-time criminals with supernatural connections'
      },
      {
        id: 4,
        name: 'Higashikata Family',
        type: 'NOBLE',
        hold: 'strong',
        reputation: 4,
        notes: 'Wealthy family with hidden Stand heritage'
      },
      {
        id: 5,
        name: 'Kira Industries',
        type: 'MERCHANT',
        hold: 'strong',
        reputation: 3,
        notes: 'Corporate front for Stand user activities'
      },
      {
        id: 6,
        name: 'Red Hot Chili Pepper Cult',
        type: 'CRIMINAL',
        hold: 'weak',
        reputation: 1,
        notes: 'Electric Stand user fanatics'
      }
    ],
    relationships: [
      { sourceId: 1, targetId: 2, value: 1, notes: 'Cooperative relationship' },
      { sourceId: 1, targetId: 3, value: -3, notes: 'Actively opposing' },
      { sourceId: 2, targetId: 3, value: -2, notes: 'Criminal investigation' },
      { sourceId: 4, targetId: 1, value: 2, notes: 'Financial support' }
    ],
    crewRelationships: [
      { factionId: 1, value: 2, notes: 'Aided in investigation' },
      { factionId: 2, value: 0, notes: 'Neutral standing' },
      { factionId: 3, value: -1, notes: 'Disrupted operations' },
      { factionId: 4, value: 1, notes: 'Family connections' }
    ]
  });
  
  const searchRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const isAuthenticated = true; // Mock authentication

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

  const handleSave = () => {
    if (activeMode === 'FACTION MODE') {
      // Save faction data
      const updatedFactionData = {
        ...factionData,
        lastModified: new Date().toISOString()
      };
      
      console.log('Saving faction data:', updatedFactionData);
      alert('Faction data saved! (Check console for details)');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-black text-white font-mono text-sm max-w-7xl w-full">
        {/* Header */}
        <header className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-600 sticky top-0 z-10">
          <div className="text-xl font-bold text-white cursor-pointer">
            1(800)BIZARRE - {activeMode}
          </div>
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
              onClick={() => alert('Demo closed')}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </header>

        <div className="p-4">
          {/* Debug indicator */}
          <div className="mb-2 text-xs text-gray-400">
            Active Mode: {activeMode} | Try switching modes and interacting with factions!
          </div>
          
          {activeMode === 'CHARACTER MODE' && (
            <div className="text-center py-20">
              <h2 className="text-2xl text-white mb-4">Character Mode</h2>
              <p className="text-gray-400">Switch to FACTION MODE to see the faction management system!</p>
            </div>
          )}
          
          {activeMode === 'CREW MODE' && (
            <div className="text-center py-20">
              <h2 className="text-2xl text-white mb-4">Crew Mode</h2>
              <p className="text-gray-400">Switch to FACTION MODE to see the faction management system!</p>
            </div>
          )}
          
          {activeMode === 'FACTION MODE' && (
            <div className="faction-sheet">
              {/* Header */}
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <div className="text-white font-bold text-lg tracking-wider">
                    FACTIONS OF {factionData.campaignName.toUpperCase() || 'CAMPAIGN'}
                  </div>
                  <div className="flex items-center space-x-4">
                    <button 
                      onClick={() => {
                        // Roll fortune for a random faction
                        const factionNames = factionData.factions.map(f => f.name);
                        if (factionNames.length > 0) {
                          const randomFaction = factionNames[Math.floor(Math.random() * factionNames.length)];
                          const fortuneRoll = Math.floor(Math.random() * 6) + 1;
                          alert(`Fortune Roll for ${randomFaction}: ${fortuneRoll}`);
                        } else {
                          alert('No factions available for fortune roll');
                        }
                      }}
                      className="bg-gray-600 hover:bg-gray-700 px-3 py-1 border border-gray-500 text-sm"
                    >
                      Roll Fortune
                    </button>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={factionData.isGM}
                        onChange={(e) => setFactionData(prev => ({ ...prev, isGM: e.target.checked }))}
                        className="w-3 h-3" 
                      />
                      <span className="text-xs text-gray-300">GM Mode</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Clocks Section */}
              <div className="mb-4">
                <div className="bg-gray-700 border border-gray-600 p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">CLOCKS</span>
                    {factionData.isGM && (
                      <button className="text-xs text-gray-400 hover:text-white">🕘</button>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    Faction progress clocks appear here
                  </div>
                </div>
              </div>

              {/* Main Faction Grid */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                {/* Stand Users & Bizarre Forces */}
                <div>
                  <div className="bg-gray-700 border border-gray-600 p-2 mb-2">
                    <div className="text-xs font-bold text-center text-white mb-1">STAND USERS</div>
                    <div className="grid grid-cols-3 gap-1 text-xs text-center">
                      <div className="text-gray-400">TIER</div>
                      <div className="text-gray-400">HOLD</div>
                      <div className="text-gray-400">STATUS</div>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    {factionData.factions.filter(f => f.type === 'CRIMINAL' || f.type === 'OTHER').map((faction, index) => (
                      <div key={faction.id} className="flex items-center text-xs">
                        <div className="flex items-center space-x-1 flex-1">
                          <span className="text-xs cursor-pointer">🕘</span>
                          <span className="text-white hover:text-purple-400 cursor-pointer" title={faction.notes}>
                            {faction.name}
                          </span>
                        </div>
                        <div className="w-8 text-center text-white">
                          {factionData.isGM ? (
                            <select 
                              value={faction.reputation || 3}
                              onChange={(e) => {
                                setFactionData(prev => ({
                                  ...prev,
                                  factions: prev.factions.map(f => 
                                    f.id === faction.id ? { ...f, reputation: parseInt(e.target.value) } : f
                                  )
                                }));
                              }}
                              className="bg-gray-700 text-white text-xs w-full text-center"
                            >
                              {[1,2,3,4,5,6].map(tier => (
                                <option key={tier} value={tier}>{['I','II','III','IV','V','VI'][tier-1]}</option>
                              ))}
                            </select>
                          ) : (
                            ['I','II','III','IV','V','VI'][faction.reputation - 1] || 'III'
                          )}
                        </div>
                        <div className="w-8 text-center text-white">
                          {factionData.isGM ? (
                            <select 
                              value={faction.hold || 'S'}
                              onChange={(e) => {
                                setFactionData(prev => ({
                                  ...prev,
                                  factions: prev.factions.map(f => 
                                    f.id === faction.id ? { ...f, hold: e.target.value } : f
                                  )
                                }));
                              }}
                              className="bg-gray-700 text-white text-xs w-full text-center"
                            >
                              <option value="S">S</option>
                              <option value="W">W</option>
                            </select>
                          ) : (
                            faction.hold === 'strong' ? 'S' : 'W'
                          )}
                        </div>
                        {factionData.isGM && (
                          <button 
                            onClick={() => {
                              setFactionData(prev => ({
                                ...prev,
                                factions: prev.factions.filter(f => f.id !== faction.id)
                              }));
                            }}
                            className="text-red-400 hover:text-red-300 ml-2 text-xs"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    
                    {factionData.isGM && (
                      <button 
                        onClick={() => {
                          const name = prompt('Stand User/Group name:');
                          if (name) {
                            setFactionData(prev => ({
                              ...prev,
                              factions: [...prev.factions, {
                                id: Date.now(),
                                name,
                                type: 'CRIMINAL',
                                hold: 'strong',
                                reputation: 3,
                                notes: ''
                              }]
                            }));
                          }
                        }}
                        className="text-gray-400 hover:text-white text-xs"
                      >
                        + Add Stand User
                      </button>
                    )}
                  </div>
                </div>

                {/* Institutions */}
                <div>
                  <div className="bg-gray-700 border border-gray-600 p-2 mb-2">
                    <div className="text-xs font-bold text-center text-white mb-1">INSTITUTIONS</div>
                    <div className="grid grid-cols-3 gap-1 text-xs text-center">
                      <div className="text-gray-400">TIER</div>
                      <div className="text-gray-400">HOLD</div>
                      <div className="text-gray-400">STATUS</div>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    {factionData.factions.filter(f => f.type === 'POLITICAL' || f.type === 'RELIGIOUS').map((faction, index) => (
                      <div key={faction.id} className="flex items-center text-xs">
                        <div className="flex items-center space-x-1 flex-1">
                          <span className="text-xs cursor-pointer">🕘</span>
                          <span className="text-white hover:text-purple-400 cursor-pointer" title={faction.notes}>
                            {faction.name}
                          </span>
                        </div>
                        <div className="w-8 text-center text-white">
                          {factionData.isGM ? (
                            <select 
                              value={faction.reputation || 3}
                              onChange={(e) => {
                                setFactionData(prev => ({
                                  ...prev,
                                  factions: prev.factions.map(f => 
                                    f.id === faction.id ? { ...f, reputation: parseInt(e.target.value) } : f
                                  )
                                }));
                              }}
                              className="bg-gray-700 text-white text-xs w-full text-center"
                            >
                              {[1,2,3,4,5,6].map(tier => (
                                <option key={tier} value={tier}>{['I','II','III','IV','V','VI'][tier-1]}</option>
                              ))}
                            </select>
                          ) : (
                            ['I','II','III','IV','V','VI'][faction.reputation - 1] || 'III'
                          )}
                        </div>
                        <div className="w-8 text-center text-white">
                          {factionData.isGM ? (
                            <select 
                              value={faction.hold || 'S'}
                              onChange={(e) => {
                                setFactionData(prev => ({
                                  ...prev,
                                  factions: prev.factions.map(f => 
                                    f.id === faction.id ? { ...f, hold: e.target.value } : f
                                  )
                                }));
                              }}
                              className="bg-gray-700 text-white text-xs w-full text-center"
                            >
                              <option value="S">S</option>
                              <option value="W">W</option>
                            </select>
                          ) : (
                            faction.hold === 'strong' ? 'S' : 'W'
                          )}
                        </div>
                        {factionData.isGM && (
                          <button 
                            onClick={() => {
                              setFactionData(prev => ({
                                ...prev,
                                factions: prev.factions.filter(f => f.id !== faction.id)
                              }));
                            }}
                            className="text-red-400 hover:text-red-300 ml-2 text-xs"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    
                    {factionData.isGM && (
                      <button 
                        onClick={() => {
                          const name = prompt('Institution name:');
                          if (name) {
                            setFactionData(prev => ({
                              ...prev,
                              factions: [...prev.factions, {
                                id: Date.now(),
                                name,
                                type: 'POLITICAL',
                                hold: 'strong',
                                reputation: 4,
                                notes: ''
                              }]
                            }));
                          }
                        }}
                        className="text-gray-400 hover:text-white text-xs"
                      >
                        + Add Institution
                      </button>
                    )}
                  </div>
                </div>

                {/* Labor & Trade */}
                <div>
                  <div className="bg-gray-700 border border-gray-600 p-2 mb-2">
                    <div className="text-xs font-bold text-center text-white mb-1">LABOR & TRADE</div>
                    <div className="grid grid-cols-3 gap-1 text-xs text-center">
                      <div className="text-gray-400">TIER</div>
                      <div className="text-gray-400">HOLD</div>
                      <div className="text-gray-400">STATUS</div>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    {factionData.factions.filter(f => f.type === 'MERCHANT').map((faction, index) => (
                      <div key={faction.id} className="flex items-center text-xs">
                        <div className="flex items-center space-x-1 flex-1">
                          <span className="text-xs cursor-pointer">🕘</span>
                          <span className="text-white hover:text-purple-400 cursor-pointer" title={faction.notes}>
                            {faction.name}
                          </span>
                        </div>
                        <div className="w-8 text-center text-white">
                          {factionData.isGM ? (
                            <select 
                              value={faction.reputation || 3}
                              onChange={(e) => {
                                setFactionData(prev => ({
                                  ...prev,
                                  factions: prev.factions.map(f => 
                                    f.id === faction.id ? { ...f, reputation: parseInt(e.target.value) } : f
                                  )
                                }));
                              }}
                              className="bg-gray-700 text-white text-xs w-full text-center"
                            >
                              {[1,2,3,4,5,6].map(tier => (
                                <option key={tier} value={tier}>{['I','II','III','IV','V','VI'][tier-1]}</option>
                              ))}
                            </select>
                          ) : (
                            ['I','II','III','IV','V','VI'][faction.reputation - 1] || 'III'
                          )}
                        </div>
                        <div className="w-8 text-center text-white">
                          {factionData.isGM ? (
                            <select 
                              value={faction.hold || 'S'}
                              onChange={(e) => {
                                setFactionData(prev => ({
                                  ...prev,
                                  factions: prev.factions.map(f => 
                                    f.id === faction.id ? { ...f, hold: e.target.value } : f
                                  )
                                }));
                              }}
                              className="bg-gray-700 text-white text-xs w-full text-center"
                            >
                              <option value="S">S</option>
                              <option value="W">W</option>
                            </select>
                          ) : (
                            faction.hold === 'strong' ? 'S' : 'W'
                          )}
                        </div>
                        {factionData.isGM && (
                          <button 
                            onClick={() => {
                              setFactionData(prev => ({
                                ...prev,
                                factions: prev.factions.filter(f => f.id !== faction.id)
                              }));
                            }}
                            className="text-red-400 hover:text-red-300 ml-2 text-xs"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    
                    {factionData.isGM && (
                      <button 
                        onClick={() => {
                          const name = prompt('Business/Trade name:');
                          if (name) {
                            setFactionData(prev => ({
                              ...prev,
                              factions: [...prev.factions, {
                                id: Date.now(),
                                name,
                                type: 'MERCHANT',
                                hold: 'strong',
                                reputation: 2,
                                notes: ''
                              }]
                            }));
                          }
                        }}
                        className="text-gray-400 hover:text-white text-xs"
                      >
                        + Add Business
                      </button>
                    )}
                  </div>
                </div>

                {/* Citizenry */}
                <div>
                  <div className="bg-gray-700 border border-gray-600 p-2 mb-2">
                    <div className="text-xs font-bold text-center text-white mb-1">CITIZENRY</div>
                    <div className="grid grid-cols-3 gap-1 text-xs text-center">
                      <div className="text-gray-400">TIER</div>
                      <div className="text-gray-400">HOLD</div>
                      <div className="text-gray-400">STATUS</div>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    {factionData.factions.filter(f => f.type === 'NOBLE').map((faction, index) => (
                      <div key={faction.id} className="flex items-center text-xs">
                        <div className="flex items-center space-x-1 flex-1">
                          <span className="text-xs cursor-pointer">🕘</span>
                          <span className="text-white hover:text-purple-400 cursor-pointer" title={faction.notes}>
                            {faction.name}
                          </span>
                        </div>
                        <div className="w-8 text-center text-white">
                          {factionData.isGM ? (
                            <select 
                              value={faction.reputation || 3}
                              onChange={(e) => {
                                setFactionData(prev => ({
                                  ...prev,
                                  factions: prev.factions.map(f => 
                                    f.id === faction.id ? { ...f, reputation: parseInt(e.target.value) } : f
                                  )
                                }));
                              }}
                              className="bg-gray-700 text-white text-xs w-full text-center"
                            >
                              {[1,2,3,4,5,6].map(tier => (
                                <option key={tier} value={tier}>{['I','II','III','IV','V','VI'][tier-1]}</option>
                              ))}
                            </select>
                          ) : (
                            ['I','II','III','IV','V','VI'][faction.reputation - 1] || 'III'
                          )}
                        </div>
                        <div className="w-8 text-center text-white">
                          {factionData.isGM ? (
                            <select 
                              value={faction.hold || 'S'}
                              onChange={(e) => {
                                setFactionData(prev => ({
                                  ...prev,
                                  factions: prev.factions.map(f => 
                                    f.id === faction.id ? { ...f, hold: e.target.value } : f
                                  )
                                }));
                              }}
                              className="bg-gray-700 text-white text-xs w-full text-center"
                            >
                              <option value="S">S</option>
                              <option value="W">W</option>
                            </select>
                          ) : (
                            faction.hold === 'strong' ? 'S' : 'W'
                          )}
                        </div>
                        {factionData.isGM && (
                          <button 
                            onClick={() => {
                              setFactionData(prev => ({
                                ...prev,
                                factions: prev.factions.filter(f => f.id !== faction.id)
                              }));
                            }}
                            className="text-red-400 hover:text-red-300 ml-2 text-xs"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    
                    {factionData.isGM && (
                      <button 
                        onClick={() => {
                          const name = prompt('Noble House/Family name:');
                          if (name) {
                            setFactionData(prev => ({
                              ...prev,
                              factions: [...prev.factions, {
                                id: Date.now(),
                                name,
                                type: 'NOBLE',
                                hold: 'strong',
                                reputation: 3,
                                notes: ''
                              }]
                            }));
                          }
                        }}
                        className="text-gray-400 hover:text-white text-xs"
                      >
                        + Add Noble House
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Section */}
              <div className="grid grid-cols-3 gap-6">
                {/* Left - Notes */}
                <div>
                  <div className="text-red-400 text-xs font-bold mb-2">Notes</div>
                  <div className="bg-gray-800 border border-gray-600 p-3 h-48">
                    <textarea 
                      placeholder="Campaign faction notes and relationships..."
                      className="w-full h-full bg-transparent text-xs text-white resize-none leading-relaxed"
                    />
                  </div>
                </div>

                {/* Center - The Fringe */}
                <div>
                  <div className="bg-gray-700 border border-gray-600 p-2 mb-2">
                    <div className="text-xs font-bold text-center text-white mb-1">THE FRINGE</div>
                    <div className="grid grid-cols-3 gap-1 text-xs text-center">
                      <div className="text-gray-400">TIER</div>
                      <div className="text-gray-400">HOLD</div>
                      <div className="text-gray-400">STATUS</div>
                    </div>
                  </div>
                  
                  <div className="space-y-1 mb-4">
                    {/* Default fringe factions */}
                    <div className="flex items-center text-xs">
                      <div className="flex items-center space-x-1 flex-1">
                        <span className="text-xs cursor-pointer">🕘</span>
                        <span className="text-white">The Church of Ecstasy</span>
                      </div>
                      <div className="w-8 text-center text-white">IV</div>
                      <div className="w-8 text-center text-white">S</div>
                    </div>
                    <div className="flex items-center text-xs">
                      <div className="flex items-center space-x-1 flex-1">
                        <span className="text-xs cursor-pointer">🕘</span>
                        <span className="text-white">The Horde</span>
                      </div>
                      <div className="w-8 text-center text-white">III</div>
                      <div className="w-8 text-center text-white">S</div>
                    </div>
                    <div className="flex items-center text-xs">
                      <div className="flex items-center space-x-1 flex-1">
                        <span className="text-xs cursor-pointer">🕘</span>
                        <span className="text-white">The Path of Echoes</span>
                      </div>
                      <div className="w-8 text-center text-white">III</div>
                      <div className="w-8 text-center text-white">S</div>
                    </div>

                    {factionData.isGM && (
                      <>
                        <div className="border-t border-gray-600 my-2"></div>
                        <button 
                          onClick={() => {
                            const name = prompt('Fringe group name:');
                            if (name) {
                              setFactionData(prev => ({
                                ...prev,
                                factions: [...prev.factions, {
                                  id: Date.now(),
                                  name,
                                  type: 'OTHER',
                                  hold: 'weak',
                                  reputation: 1,
                                  notes: 'Fringe faction'
                                }]
                              }));
                            }
                          }}
                          className="text-gray-400 hover:text-white text-xs"
                        >
                          + Add Fringe Group
                        </button>
                      </>
                    )}
                  </div>

                  {/* Crew Relations */}
                  <div className="bg-gray-800 border border-gray-600 p-3">
                    <div className="text-red-400 text-xs font-bold mb-2">CREW STANDINGS</div>
                    <div className="space-y-1">
                      {factionData.crewRelationships.map((rel, index) => {
                        const faction = factionData.factions.find(f => f.id === rel.factionId);
                        if (!faction) return null;
                        
                        return (
                          <div key={index} className="flex items-center justify-between text-xs">
                            <span className="text-white">{faction.name}</span>
                            <span className={`px-1 py-0.5 rounded font-bold ${
                              rel.value >= 2 ? 'bg-green-600 text-white' :
                              rel.value >= 1 ? 'bg-blue-600 text-white' :
                              rel.value === 0 ? 'bg-gray-600 text-white' :
                              rel.value >= -1 ? 'bg-yellow-600 text-black' :
                              'bg-red-600 text-white'
                            }`}>
                              {rel.value >= 0 ? '+' : ''}{rel.value}
                            </span>
                          </div>
                        );
                      })}
                      
                      {factionData.isGM && (
                        <button 
                          onClick={() => {
                            if (factionData.factions.length === 0) {
                              alert('Add factions first!');
                              return;
                            }
                            const factionName = prompt(`Select faction: ${factionData.factions.map(f => f.name).join(', ')}`);
                            const faction = factionData.factions.find(f => f.name === factionName);
                            const value = parseInt(prompt('Reputation value (-3 to +3):') || '0');
                            
                            if (faction && value >= -3 && value <= 3) {
                              setFactionData(prev => ({
                                ...prev,
                                crewRelationships: [...prev.crewRelationships, {
                                  factionId: faction.id,
                                  value,
                                  notes: ''
                                }]
                              }));
                            }
                          }}
                          className="text-gray-400 hover:text-white text-xs mt-2"
                        >
                          + Add Standing
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right - War */}
                <div>
                  <div className="bg-gray-700 border border-gray-600 p-3">
                    <div className="text-red-400 text-xs font-bold mb-2">WAR</div>
                    <div className="text-xs text-gray-300 space-y-2">
                      <div>
                        When you're at war with any number of factions (status -3), 
                        the following penalties apply:
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-start space-x-1">
                          <span className="text-purple-400">◆</span>
                          <span>Lose 1 hold (temporarily, while the war persists). This may knock you down a Tier.</span>
                        </div>
                        <div className="flex items-start space-x-1">
                          <span className="text-purple-400">◆</span>
                          <span>PCs get only one free downtime action instead of two.</span>
                        </div>
                        <div className="flex items-start space-x-1">
                          <span className="text-purple-400">◆</span>
                          <span>Take +1 heat from each score.</span>
                        </div>
                        <div className="flex items-start space-x-1">
                          <span className="text-purple-400">◆</span>
                          <span>Your claims which generate coin (vice dens, fighting pits, fences, etc.) produce only half their normal income (round down).</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* War Status */}
                  <div className="mt-4 bg-gray-800 border border-gray-600 p-3">
                    <div className="text-red-400 text-xs font-bold mb-2">CURRENT WARS</div>
                    <div className="space-y-1">
                      {factionData.crewRelationships
                        .filter(rel => rel.value === -3)
                        .map((rel, index) => {
                          const faction = factionData.factions.find(f => f.id === rel.factionId);
                          if (!faction) return null;
                          
                          return (
                            <div key={index} className="flex items-center justify-between text-xs">
                              <span className="text-red-400 font-bold">{faction.name}</span>
                              <span className="bg-red-600 text-white px-2 py-1 rounded font-bold">WAR</span>
                            </div>
                          );
                        })}
                      
                      {factionData.crewRelationships.filter(rel => rel.value === -3).length === 0 && (
                        <div className="text-gray-500 text-xs">No active wars</div>
                      )}
                    </div>
                  </div>

                  {/* GM Actions */}
                  {factionData.isGM && (
                    <div className="mt-4 space-y-2">
                      <button 
                        onClick={() => alert('Rolling faction action!')}
                        className="w-full bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-xs"
                      >
                        Roll Faction Action
                      </button>
                      <button 
                        onClick={() => alert('Advancing faction clock!')}
                        className="w-full bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded text-xs"
                      >
                        Advance Faction Clock
                      </button>
                      <button 
                        onClick={() => alert('Rolling entanglement!')}
                        className="w-full bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-xs"
                      >
                        Roll Entanglement
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Demo component that shows the faction mode
const FactionModeDemo = () => {
  return (
    <div className="w-full h-screen">
      <CharacterSheetWrapper />
    </div>
  );
};

export default FactionModeDemo;
import React, { useState, useEffect, useRef } from 'react';
import { Plus, ArrowRight, Zap, Users, Dice6, BookOpen, Settings, LogOut } from 'lucide-react';
import '../styles/Home.css';
import { useCharacterSheet, useReferenceData, characterAPI, transformBackendToFrontend } from '../features/character-sheet';
import { useAuth } from '../features/auth';

// Main Home Page Component
const HomePage = () => {
  const { user, logout } = useAuth();
  const [showCharacterSheet, setShowCharacterSheet] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Define handleSaveCharacter before using it in the hook
  const handleSaveCharacter = async (characterData) => {
    try {
      if (selectedCharacter) {
        // Edit existing character
        await characterAPI.updateCharacter(selectedCharacter.id, characterData);
        setCharacters(characters.map(char => 
          char.id === selectedCharacter.id ? characterData : char
        ));
      } else {
        // Create new character
        const newCharacter = await characterAPI.createCharacter(characterData);
        setCharacters([...characters, newCharacter]);
      }
      setShowCharacterSheet(false);
      setSelectedCharacter(null);
    } catch (err) {
      console.error('Failed to save character:', err);
      // Fallback to local state update if backend fails
      if (selectedCharacter) {
        setCharacters(characters.map(char => 
          char.id === selectedCharacter.id ? characterData : char
        ));
      } else {
        setCharacters([...characters, { ...characterData, id: Date.now() }]);
      }
      setShowCharacterSheet(false);
      setSelectedCharacter(null);
    }
  };
  
  // Character sheet hooks - moved to top level to avoid conditional hook calls
  const {
    characterData,
    setCharacterData,
    stressBoxes,
    setStressBoxes,
    traumaChecks,
    setTraumaChecks,
    armorUses,
    setArmorUses,
    harmEntries,
    setHarmEntries,
    coinBoxes,
    setCoinBoxes,
    stashBoxes,
    setStashBoxes,
    healingClock,
    setHealingClock,
    actionRatings,
    setActionRatings,
    standStats,
    setStandStats,
    xpTracks,
    setXpTracks,
    selectedAbilities,
    setSelectedAbilities,
    customClocks,
    setCustomClocks,
    loading: sheetLoading,
    saving,
    error: sheetError,
    handleSave,
    rollAction,
    addXP,
    takeHarm,
    healHarm,
    indulgeVice,
    logArmorExpenditure,
    addProgressClock,
    updateProgressClock,
    loadCharacter
  } = useCharacterSheet(selectedCharacter?.id, handleSaveCharacter);

  // Load character data when selectedCharacter changes
  useEffect(() => {
    if (selectedCharacter && showCharacterSheet) {
      setCharacterData({
        name: selectedCharacter.name || '',
        standName: selectedCharacter.standName || '',
        heritage: selectedCharacter.heritage || 'Human',
        background: selectedCharacter.background || '',
        look: selectedCharacter.look || '',
        vice: selectedCharacter.vice || '',
        crew: selectedCharacter.crew || ''
      });
      setActionRatings(selectedCharacter.actionRatings || {
        HUNT: 0, STUDY: 0, SURVEY: 0, TINKER: 0,
        FINESSE: 0, PROWL: 0, SKIRMISH: 0, WRECK: 0,
        BIZARRE: 0, COMMAND: 0, CONSORT: 0, SWAY: 0
      });
      setStandStats(selectedCharacter.standStats || {
        power: 1, speed: 1, range: 1, durability: 1, precision: 1, development: 1
      });
      setXpTracks(selectedCharacter.xp || {
        insight: 0, prowess: 0, resolve: 0, heritage: 0, playbook: 0
      });
      setSelectedAbilities(selectedCharacter.abilities || []);
      setCustomClocks(selectedCharacter.clocks || []);
    }
  }, [selectedCharacter, showCharacterSheet]);
  
  // Load characters from backend on component mount
  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const backendCharacters = await characterAPI.getCharacters();
      const frontendCharacters = backendCharacters.map(transformBackendToFrontend);
      setCharacters(frontendCharacters);
    } catch (err) {
      console.error('Failed to load characters:', err);
      setError(err.message);
      // Fallback to example characters if backend fails
      setCharacters([
    {
      id: 1,
      name: 'METAL FINGERS',
      standName: 'MADVILLAINY',
      heritage: 'Cyborg',
      background: 'Underground Rapper',
      look: 'Terminator Robot with a TV static look',
      vice: 'Art',
      crew: 'DOOM SQUAD',
      actionRatings: {
        HUNT: 2, STUDY: 1, SURVEY: 1, TINKER: 3,
        FINESSE: 2, PROWL: 1, SKIRMISH: 2, WRECK: 1,
        BIZARRE: 1, COMMAND: 2, CONSORT: 1, SWAY: 2
      },
      standStats: { power: 3, speed: 2, range: 1, durability: 2, precision: 1, development: 1 }
    }
  ]);
    } finally {
      setLoading(false);
    }
  };

  const [campaigns] = useState([
    // Example campaigns
    {
      id: 1,
      name: 'Diamond is Unbreakable',
      role: 'Player',
      gmName: 'Hirohiko Araki',
      playerCount: 4,
      maxPlayers: 5,
      nextSession: '2024-01-15 19:00',
      description: 'A bizarre murder mystery in the town of Morioh',
      status: 'Active',
      characterName: 'METAL FINGERS'
    },
    {
      id: 2,
      name: 'Steel Ball Run',
      role: 'GM',
      playerCount: 3,
      maxPlayers: 4,
      nextSession: '2024-01-18 20:00',
      description: 'Cross-country race across America with supernatural powers',
      status: 'Active'
    },
    {
      id: 3,
      name: 'Stone Ocean Chronicles',
      role: 'Player',
      gmName: 'DIO Brando',
      playerCount: 2,
      maxPlayers: 6,
      nextSession: 'TBD',
      description: 'Prison break adventure with cosmic stakes',
      status: 'Recruiting',
      characterName: null
    }
  ]);

  const handleCreateCharacter = () => {
    setSelectedCharacter(null);
    setShowCharacterSheet(true);
  };

  const handleCreateNewFromSheet = () => {
    // Save current character first if there are changes
    setSelectedCharacter(null);
    // Keep the sheet open but clear the character data for a new one
  };

  const handleSwitchCharacter = (character) => {
    setSelectedCharacter(character);
  };

  const handleEditCharacter = (character) => {
    setSelectedCharacter(character);
    setShowCharacterSheet(true);
  };

  const handleCloseSheet = () => {
    setShowCharacterSheet(false);
    setSelectedCharacter(null);
  };

  const handleDeleteCharacter = async (characterId) => {
    try {
      await characterAPI.deleteCharacter(characterId);
      setCharacters(characters.filter(char => char.id !== characterId));
    } catch (err) {
      console.error('Failed to delete character:', err);
      // Fallback to local state update if backend fails
    setCharacters(characters.filter(char => char.id !== characterId));
    }
  };

  const handleJoinCampaign = (campaignId) => {
    // Logic for joining a campaign
    console.log('Joining campaign:', campaignId);
  };

  const handleCreateCampaign = () => {
    // Logic for creating a new campaign
    console.log('Creating new campaign');
  };

  const handleManageCampaign = (campaignId) => {
    // Logic for managing a campaign (GM view)
    console.log('Managing campaign:', campaignId);
  };

  // Character Sheet Component using the new feature system
  const CharacterSheetModal = () => {
    if (!showCharacterSheet) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex items-start justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-black text-white font-mono text-sm max-w-7xl w-full">
          {/* Header */}
          <header className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-600 sticky top-0 z-10">
            <div className="text-xl font-bold text-white">
              1(800)BIZARRE - CHARACTER SHEET
            </div>
            <div className="flex items-center space-x-4">
              {sheetError && (
                <div className="text-red-400 text-xs">
                  Error: {sheetError}
                </div>
              )}
              <button 
                onClick={handleSave}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-xs font-bold disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button 
                onClick={handleCloseSheet}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          </header>

          <div className="p-4">
            {sheetLoading ? (
              <div className="text-center py-8">
                <div className="text-gray-400">Loading character...</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-8 mb-6">
                {/* Left Side - Character Info */}
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
                            onChange={(e) => setCharacterData(prev => ({ ...prev, name: e.target.value }))}
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
                            onChange={(e) => setCharacterData(prev => ({ ...prev, crew: e.target.value }))}
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
                            onChange={(e) => setCharacterData(prev => ({ ...prev, standName: e.target.value }))}
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
                          onChange={(e) => setCharacterData(prev => ({ ...prev, look: e.target.value }))}
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
                            onChange={(e) => setCharacterData(prev => ({ ...prev, heritage: e.target.value }))}
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
                            onChange={(e) => setCharacterData(prev => ({ ...prev, background: e.target.value }))}
                            className="bg-transparent w-full text-white" 
                            placeholder="Background"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-red-400 text-xs font-bold">VICE</div>
                      <div className="border-b border-gray-600 pb-1">
                        <input 
                          type="text" 
                          value={characterData.vice}
                          onChange={(e) => setCharacterData(prev => ({ ...prev, vice: e.target.value }))}
                          className="bg-transparent w-full text-white" 
                          placeholder="Vice"
                        />
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
                            onClick={() => {
                              const newStress = [...stressBoxes];
                              newStress[i] = !newStress[i];
                              setStressBoxes(newStress);
                            }}
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
                              onChange={() => setTraumaChecks(prev => ({ ...prev, [trauma]: !checked }))}
                            />
                            <span>{trauma}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side - Stand Stats & Actions */}
                <div className="bg-gray-800 p-4 border border-gray-600">
                  <h2 className="text-xl font-bold text-gray-400 mb-4">STAND COIN STATS</h2>
                  
                  {/* Stand Coin Stats */}
                  <div className="mb-6">
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
                  <div className="grid grid-cols-3 gap-6">
                    {/* Insight */}
                    <div>
                      <div className="text-xs font-bold mb-2">INSIGHT</div>
                      <div className="space-y-1">
                        {['HUNT', 'STUDY', 'SURVEY', 'TINKER'].map((action) => (
                          <div key={action} className="flex items-center justify-between">
                            <span className="text-xs">{action}</span>
                            <div className="flex space-x-1">
                              {[1, 2, 3, 4].map((dot) => (
                                <div 
                                  key={dot} 
                                  className={`w-3 h-3 rounded-full border border-gray-500 cursor-pointer hover:bg-purple-400 ${
                                    dot <= actionRatings[action] ? 'bg-purple-600' : 'bg-gray-700'
                                  }`}
                                  onClick={() => setActionRatings(prev => ({ 
                                    ...prev, 
                                    [action]: dot <= actionRatings[action] ? dot - 1 : dot 
                                  }))}
                                ></div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Prowess */}
                    <div>
                      <div className="text-xs font-bold mb-2">PROWESS</div>
                      <div className="space-y-1">
                        {['FINESSE', 'PROWL', 'SKIRMISH', 'WRECK'].map((action) => (
                          <div key={action} className="flex items-center justify-between">
                            <span className="text-xs">{action}</span>
                            <div className="flex space-x-1">
                              {[1, 2, 3, 4].map((dot) => (
                                <div 
                                  key={dot} 
                                  className={`w-3 h-3 rounded-full border border-gray-500 cursor-pointer hover:bg-purple-400 ${
                                    dot <= actionRatings[action] ? 'bg-purple-600' : 'bg-gray-700'
                                  }`}
                                  onClick={() => setActionRatings(prev => ({ 
                                    ...prev, 
                                    [action]: dot <= actionRatings[action] ? dot - 1 : dot 
                                  }))}
                                ></div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Resolve */}
                    <div>
                      <div className="text-xs font-bold mb-2">RESOLVE</div>
                      <div className="space-y-1">
                        {['BIZARRE', 'COMMAND', 'CONSORT', 'SWAY'].map((action) => (
                          <div key={action} className="flex items-center justify-between">
                            <span className="text-xs">{action}</span>
                            <div className="flex space-x-1">
                              {[1, 2, 3, 4].map((dot) => (
                                <div 
                                  key={dot} 
                                  className={`w-3 h-3 rounded-full border border-gray-500 cursor-pointer hover:bg-purple-400 ${
                                    dot <= actionRatings[action] ? 'bg-purple-600' : 'bg-gray-700'
                                  }`}
                                  onClick={() => setActionRatings(prev => ({ 
                                    ...prev, 
                                    [action]: dot <= actionRatings[action] ? dot - 1 : dot 
                                  }))}
                                ></div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="home-container">
      {/* Header */}
      <header className="header">
        <div className="header-title">
          1(800)BIZARRE - HOME
        </div>
        <div className="header-actions">
          <div className="flex items-center space-x-4">
            <span className="text-gray-300 text-sm">Welcome, {user?.username}</span>
          <button 
            onClick={handleCreateCharacter}
            className="btn-primary"
          >
            Create Character
          </button>
          <button className="btn-secondary">
            <Settings className="icon" />
          </button>
            <button 
              onClick={logout}
              className="btn-secondary text-red-400 hover:text-red-300"
              title="Logout"
            >
              <LogOut className="icon" />
            </button>
          </div>
        </div>
      </header>

      <div className="main-content">
        {/* Hero Section */}
        <section className="hero-section">
          {/* Background Effects */}
          <div className="hero-bg-effects">
            <div className="hero-bg-effect-1"></div>
            <div className="hero-bg-effect-2"></div>
            <div className="hero-bg-effect-3"></div>
          </div>

        <div className="hero-content">
          {/* Main Title */}
          <h1 className="hero-title">
            <span className="gradient-text">
              1(800)BIZARRE
            </span>
          </h1>
          
          {/* Subtitle */}
          <h2 className="hero-subtitle">
            A JoJo's Bizarre Adventure TTRPG
          </h2>
          
          {/* Description */}
          <p className="hero-description">
            Create <span className="highlight-purple">stylish weirdos</span> with 
            <span className="highlight-red"> supernatural powers</span>, embark on 
            <span className="highlight-yellow"> bizarre missions</span>, and discover whether 
            your crew can hold it together when everything—and everyone—starts to fall apart.
          </p>
          
          {/* Main CTA Button */}
          <div className="hero-cta">
            <button 
              onClick={handleCreateCharacter}
              className="btn-hero"
            >
              <Plus className="icon" />
              Create Character
              <ArrowRight className="icon" />
            </button>
          </div>

          {/* Character Gallery */}
          {loading ? (
            <div className="character-section">
              <h3 className="section-title">Your Characters</h3>
              <div className="text-center py-8">
                <div className="text-gray-400">Loading characters...</div>
              </div>
            </div>
          ) : error ? (
            <div className="character-section">
              <h3 className="section-title">Your Characters</h3>
              <div className="text-center py-8">
                <div className="text-red-400">Error loading characters: {error}</div>
                <button 
                  onClick={loadCharacters}
                  className="mt-2 bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-xs"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : characters.length > 0 ? (
            <div className="character-section">
              <h3 className="section-title">Your Characters</h3>
              <div className="character-grid">
                {characters.map((character) => (
                  <div key={character.id} className="character-card">
                    <div className="character-info">
                      <h4 className="character-name">{character.name}</h4>
                      <p className="stand-name">「{character.standName}」</p>
                      <p className="character-heritage">{character.heritage}</p>
                      <p className="character-background">{character.background}</p>
                    </div>
                    <div className="character-actions">
                      <button 
                        onClick={() => handleEditCharacter(character)}
                        className="btn-character-edit"
                      >
                        Edit Sheet
                      </button>
                      <button 
                        onClick={() => handleDeleteCharacter(character.id)}
                        className="btn-character-delete"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="character-section">
              <h3 className="section-title">Your Characters</h3>
              <div className="text-center py-8">
                <div className="text-gray-400 mb-4">No characters yet</div>
                <button 
                  onClick={handleCreateCharacter}
                  className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded text-sm"
                >
                  Create Your First Character
                </button>
              </div>
            </div>
          )}

          {/* Campaign Gallery */}
          {campaigns.length > 0 && (
            <div className="campaign-section">
              <h3 className="section-title">Your Campaigns</h3>
              <div className="campaign-grid">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="campaign-card">
                    <div className="campaign-header">
                      <div className="campaign-title-row">
                        <h4 className="campaign-title">{campaign.name}</h4>
                        <span className={`status-badge ${
                          campaign.status === 'Active' ? 'status-active' :
                          campaign.status === 'Recruiting' ? 'status-recruiting' :
                          'status-inactive'
                        }`}>
                          {campaign.status}
                        </span>
                      </div>
                      <p className="campaign-description">{campaign.description}</p>
                      
                      <div className="campaign-details">
                        <div className="detail-row">
                          <span>Role:</span>
                          <span className={campaign.role === 'GM' ? 'detail-gm' : 'detail-player'}>{campaign.role}</span>
                        </div>
                        {campaign.gmName && (
                          <div className="detail-row">
                            <span>GM:</span>
                            <span>{campaign.gmName}</span>
                          </div>
                        )}
                        <div className="detail-row">
                          <span>Players:</span>
                          <span>{campaign.playerCount}/{campaign.maxPlayers}</span>
                        </div>
                        {campaign.characterName && (
                          <div className="detail-row">
                            <span>Character:</span>
                            <span className="detail-character">{campaign.characterName}</span>
                          </div>
                        )}
                        <div className="detail-row">
                          <span>Next Session:</span>
                          <span>{campaign.nextSession}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="campaign-actions">
                      <button 
                        onClick={() => campaign.role === 'GM' ? handleManageCampaign(campaign.id) : handleJoinCampaign(campaign.id)}
                        className="btn-campaign-primary"
                      >
                        {campaign.role === 'GM' ? 'Manage' : 'Join Session'}
                      </button>
                      <button className="btn-campaign-secondary">
                        ⚙️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </section>

        {/* Features Section */}
        <section className="features-section">
          <div className="features-container">
            <h3 className="features-title">
              Why <span className="highlight-red">1(800)BIZARRE</span>?
            </h3>
            
            <div className="features-grid">
              {/* Feature 1 */}
              <div className="feature-card purple">
                <div className="feature-icon purple">
                  <Zap className="icon" />
                </div>
                <h4 className="feature-title">Unique Stands</h4>
                <p className="feature-description">
                  Create supernatural abilities as unique as your character. From time manipulation to reality bending, 
                  your Stand reflects your inner self and fighting style.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="feature-card red">
                <div className="feature-icon red">
                  <Users className="icon" />
                </div>
                <h4 className="feature-title">Team Dynamics</h4>
                <p className="feature-description">
                  Collaborate with your crew through teamwork mechanics. Assist allies, lead group actions, 
                  and discover the power of friendship in the face of bizarre threats.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="feature-card yellow">
                <div className="feature-icon yellow">
                  <Dice6 className="icon" />
                </div>
                <h4 className="feature-title">Interactive Sheets</h4>
                <p className="feature-description">
                  Full-featured digital character sheets with dice rolling, progress tracking, and all the tools 
                  you need for an epic JoJo adventure.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Actions Section */}
        <section className="quick-actions-section">
          <div className="quick-actions-container">
            <h3 className="quick-actions-title">
              Quick <span className="highlight-purple">Actions</span>
            </h3>
            
            <div className="quick-actions-grid">
              <button 
                onClick={handleCreateCharacter}
                className="quick-action-card purple"
              >
                <Plus className="quick-action-icon" />
                <h4 className="quick-action-title">Create Character</h4>
                <p className="quick-action-description">Build your next Stand user and start your bizarre adventure.</p>
                <ArrowRight className="quick-action-arrow" />
              </button>

              <div className="quick-action-card yellow">
                <Users className="quick-action-icon" />
                <h4 className="quick-action-title">Join Campaign</h4>
                <p className="quick-action-description">Find other players and embark on group adventures.</p>
                <ArrowRight className="quick-action-arrow" />
              </div>

              <div className="quick-action-card red">
                <BookOpen className="quick-action-icon" />
                <h4 className="quick-action-title">Learn Rules</h4>
                <p className="quick-action-description">Master the mechanics of Stands, Hamon, and Spin techniques.</p>
                <ArrowRight className="quick-action-arrow" />
              </div>

              <button 
                onClick={handleCreateCampaign}
                className="quick-action-card green"
              >
                <Settings className="quick-action-icon" />
                <h4 className="quick-action-title">Create Campaign</h4>
                <p className="quick-action-description">Start your own bizarre adventure as Game Master.</p>
                <ArrowRight className="quick-action-arrow" />
              </button>
            </div>
          </div>
        </section>

      </div>

      {/* Character Sheet Modal */}
      <CharacterSheetModal />
    </div>
  );
};

export default HomePage;
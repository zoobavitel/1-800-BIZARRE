import React, { useState, useEffect, useRef } from 'react';
import { Plus, ArrowRight, Zap, Users, Dice6, BookOpen, Settings } from 'lucide-react';
import '../styles/Home.css';

// Main Home Page Component
const HomePage = () => {
  const [showCharacterSheet, setShowCharacterSheet] = useState(false);
  const [characters, setCharacters] = useState([
    // Example character
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
  const [selectedCharacter, setSelectedCharacter] = useState(null);

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

  const handleSaveCharacter = (characterData) => {
    if (selectedCharacter) {
      // Edit existing character
      setCharacters(characters.map(char => 
        char.id === selectedCharacter.id ? characterData : char
      ));
    } else {
      // Create new character
      setCharacters([...characters, characterData]);
    }
    setShowCharacterSheet(false);
    setSelectedCharacter(null);
  };

  const handleDeleteCharacter = (characterId) => {
    // Replace window.confirm with a modal or other UI element
    console.log(`Request to delete character ${characterId}`);
    setCharacters(characters.filter(char => char.id !== characterId));
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

  return (
    <div className="home-container">
      {/* Header */}
      <header className="header">
        <div className="header-title">
          1(800)BIZARRE - HOME
        </div>
        <div className="header-actions">
          <button 
            onClick={handleCreateCharacter}
            className="btn-primary"
          >
            Create Character
          </button>
          <button className="btn-secondary">
            <Settings className="icon" />
          </button>
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
          {characters.length > 0 && (
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
    </div>
  );
};

export default HomePage;
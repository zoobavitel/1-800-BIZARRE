import React, { useState, useEffect } from 'react';
import { Plus, ArrowRight, Zap, Users, Dice6, BookOpen, Settings, LogOut, Menu } from 'lucide-react';
import '../styles/Home.css';
import { characterAPI, campaignAPI, transformBackendToFrontend } from '../features/character-sheet';
import { useAuth } from '../features/auth';

// Main Home Page Component — character create/edit goes to Character page
const HomePage = ({ onNavigateToCharacter, onNavigateToCampaign, onHamburgerClick }) => {
  const { user, logout } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load characters and campaigns from backend on component mount
  useEffect(() => {
    loadCharacters();
  }, []);

  useEffect(() => {
    if (!user) {
      setCampaigns([]);
      setCampaignsLoading(false);
      return;
    }
    setCampaignsLoading(true);
    campaignAPI.getCampaigns()
      .then((list) => {
        const mapped = (list || []).map((c) => ({
          id: c.id,
          name: c.name || '',
          description: c.description || '',
          role: c.gm?.id === user?.id ? 'GM' : 'Player',
          gmName: c.gm?.username || '',
          playerCount: Array.isArray(c.players) ? c.players.length : 0,
          maxPlayers: null,
          nextSession: null,
          status: 'Active',
          characterName: null,
        }));
        setCampaigns(mapped);
      })
      .catch((err) => {
        console.error('Failed to load campaigns:', err);
        setCampaigns([]);
      })
      .finally(() => setCampaignsLoading(false));
  }, [user]);

  const loadCharacters = async () => {
    setLoading(true);
    setError(null);
    try {
      const backendCharacters = await characterAPI.getCharacters();
      const frontendCharacters = (backendCharacters || []).map(transformBackendToFrontend);
      setCharacters(frontendCharacters);
    } catch (err) {
      console.error('Failed to load characters:', err);
      setError(err.message);
      setCharacters([]);
    } finally {
      setLoading(false);
    }
  };

  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);

  // Navigate to Character page: new sheet (create) or edit existing (load from account)
  const handleCreateCharacter = () => {
    if (typeof onNavigateToCharacter === 'function') onNavigateToCharacter(null);
  };

  const handleEditCharacter = (character) => {
    if (typeof onNavigateToCharacter === 'function' && character?.id) onNavigateToCharacter(character.id);
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
    if (typeof onNavigateToCampaign === 'function') onNavigateToCampaign(campaignId);
  };

  return (
    <div className="home-container">
      {/* Header */}
      <header className="header">
        <div className="header-left flex items-center gap-3">
          {typeof onHamburgerClick === 'function' && (
            <button
              type="button"
              onClick={onHamburgerClick}
              aria-label="Open menu"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="header-title">
            1(800)BIZARRE - HOME
          </div>
        </div>
        <div className="header-center">
          <span className="text-gray-300 text-sm">Welcome, {user?.username}</span>
        </div>
        <div className="header-actions">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => typeof onNavigateToCharacter === 'function' && onNavigateToCharacter(null)}
              className="btn-secondary"
            >
              Character Options
            </button>
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

          {/* Campaign Gallery - populated when GM creates campaigns */}
          <div className="campaign-section">
            <h3 className="section-title">Your Campaigns</h3>
            {campaignsLoading ? (
              <div className="text-center py-8 text-gray-400">Loading campaigns...</div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No campaigns yet. Create one as GM or wait to be invited.
              </div>
            ) : (
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
                      <p className="campaign-description">{campaign.description || '—'}</p>
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
                          <span>{campaign.playerCount}{campaign.maxPlayers != null ? `/${campaign.maxPlayers}` : ''}</span>
                        </div>
                        {campaign.characterName && (
                          <div className="detail-row">
                            <span>Character:</span>
                            <span className="detail-character">{campaign.characterName}</span>
                          </div>
                        )}
                        {campaign.nextSession && (
                          <div className="detail-row">
                            <span>Next Session:</span>
                            <span>{campaign.nextSession}</span>
                          </div>
                        )}
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
            )}
          </div>
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
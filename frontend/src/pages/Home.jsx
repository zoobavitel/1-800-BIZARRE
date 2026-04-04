import React, { useState, useEffect } from 'react';
import { Plus, ArrowRight } from 'lucide-react';
import '../styles/Home.css';
import { characterAPI, campaignAPI, transformBackendToFrontend } from '../features/character-sheet';
import { useAuth } from '../features/auth';

// Main Home Page Component — character create/edit goes to Character page
const HomePage = ({ onNavigateToCharacter, onNavigateToCharacterOptions, onNavigateToCampaign }) => {
  const { user } = useAuth();
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

  const handleManageCampaign = (campaignId) => {
    if (typeof onNavigateToCampaign === 'function') onNavigateToCampaign(campaignId);
  };

  return (
    <div className="home-container">
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
                      <p className="character-heritage">{character.heritageName ?? character.heritage ?? '—'}</p>
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

      </div>
    </div>
  );
};

export default HomePage;
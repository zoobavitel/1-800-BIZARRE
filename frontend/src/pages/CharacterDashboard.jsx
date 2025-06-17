// src/pages/CharacterDashboard.jsx - Enhanced Character Dashboard
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import Layout from '../components/Layout';

export default function CharacterDashboard() {
  const [characters, setCharacters] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [heritages, setHeritages] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_newest');
  const [filterByCampaign, setFilterByCampaign] = useState('');
  const [filterByPlaybook, setFilterByPlaybook] = useState('');
  const [loading, setLoading] = useState(true);
  const [showStats, setShowStats] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [charactersRes, campaignsRes, heritagesRes] = await Promise.all([
          api.get('/characters/'),
          api.get('/campaigns/'),
          api.get('/heritages/')
        ]);
        
        // Use API data directly - no mock data fallback
        setCharacters(charactersRes.data || []);
        setCampaigns(campaignsRes.data || []);
        setHeritages(heritagesRes.data);
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this character?")) {
      try {
        await api.delete(`/characters/${id}/`);
        setCharacters(prev => prev.filter(c => c.id !== id));
      } catch (err) {
        console.error("Failed to delete character", err);
      }
    }
  };

  const handleLeaveCampaign = async (characterId, campaignName) => {
    if (window.confirm(`Are you sure you want to leave the campaign "${campaignName}"?`)) {
      try {
        await api.patch(`/characters/${characterId}/`, { campaign: null });
        setCharacters(prev => 
          prev.map(char => 
            char.id === characterId 
              ? { ...char, campaign: null }
              : char
          )
        );
      } catch (err) {
        console.error("Failed to leave campaign", err);
        // For demo, update locally
        setCharacters(prev => 
          prev.map(char => 
            char.id === characterId 
              ? { ...char, campaign: null }
              : char
          )
        );
      }
    }
  };

  // Filter characters based on search and filters
  const filteredCharacters = characters.filter(char => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch = (
        (char.true_name || '').toLowerCase().includes(search) ||
        (char.alias || '').toLowerCase().includes(search) ||
        (char.heritage?.name || '').toLowerCase().includes(search) ||
        (char.playbook || '').toLowerCase().includes(search) ||
        (char.stand_name || '').toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }
    
    // Campaign filter
    if (filterByCampaign && char.campaign !== parseInt(filterByCampaign)) {
      return false;
    }
    
    // Playbook filter
    if (filterByPlaybook && char.playbook !== filterByPlaybook) {
      return false;
    }
    
    return true;
  });

  // Sort characters based on selected option
  const sortedCharacters = [...filteredCharacters].sort((a, b) => {
    switch (sortBy) {
      case 'created_newest':
        return (b.id || 0) - (a.id || 0);
      case 'created_oldest':
        return (a.id || 0) - (b.id || 0);
      case 'name_az':
        return (a.true_name || '').localeCompare(b.true_name || '');
      case 'name_za':
        return (b.true_name || '').localeCompare(a.true_name || '');
      case 'level_high':
        return (b.coin_stats?.development || 0) - (a.coin_stats?.development || 0);
      case 'level_low':
        return (a.coin_stats?.development || 0) - (b.coin_stats?.development || 0);
      default:
        return (b.id || 0) - (a.id || 0);
    }
  });

  // Character statistics
  const stats = {
    total: characters.length,
    byPlaybook: characters.reduce((acc, char) => {
      const playbook = char.playbook || 'STAND';
      acc[playbook] = (acc[playbook] || 0) + 1;
      return acc;
    }, {}),
    byCampaign: characters.reduce((acc, char) => {
      const campaignName = campaigns.find(c => c.id === char.campaign)?.name || 'No Campaign';
      acc[campaignName] = (acc[campaignName] || 0) + 1;
      return acc;
    }, {}),
    averageLevel: characters.length > 0 
      ? (characters.reduce((sum, char) => sum + (char.coin_stats?.development || 1), 0) / characters.length).toFixed(1)
      : 0
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-xl">Loading characters...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 bg-gray-900 text-white min-h-screen">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-4xl font-bold text-yellow-400">📊 My Characters</h1>
          <Link 
            to="/create-character" 
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg text-lg"
          >
            ✨ CREATE A CHARACTER
          </Link>
        </div>

        {/* Character Statistics */}
        {showStats && (
          <div className="mb-8 p-6 bg-gray-800 rounded-lg border border-green-500">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-green-400">Character Statistics</h2>
              <button 
                onClick={() => setShowStats(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{stats.total}</div>
                <div className="text-green-400">Total Characters</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{stats.averageLevel}</div>
                <div className="text-green-400">Average Level</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{Object.keys(stats.byCampaign).length}</div>
                <div className="text-green-400">Active Campaigns</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{Object.keys(stats.byPlaybook).length}</div>
                <div className="text-green-400">Playbook Types</div>
              </div>
            </div>
            
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-green-400 font-bold mb-2">By Playbook</h3>
                {Object.entries(stats.byPlaybook).map(([playbook, count]) => (
                  <div key={playbook} className="flex justify-between text-sm">
                    <span>{playbook}</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="text-green-400 font-bold mb-2">By Campaign</h3>
                {Object.entries(stats.byCampaign).slice(0, 5).map(([campaign, count]) => (
                  <div key={campaign} className="flex justify-between text-sm">
                    <span className="truncate mr-2">{campaign}</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex items-center mb-6 space-x-4">
          <span className="text-green-400">Slots: {characters.length}/∞ Used</span>
          
          <a 
            href="/media/1(800)Bizarre Character Sheet.png" 
            download
            className="text-yellow-400 hover:text-yellow-300 flex items-center"
          >
            <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12l-5-5 1.41-1.41L10 9.17l3.59-3.58L15 7l-5 5z"/>
            </svg>
            Download Blank Character Sheet
          </a>
          
          {!showStats && (
            <button 
              onClick={() => setShowStats(true)}
              className="text-green-400 hover:text-green-300"
            >
              📊 Show Statistics
            </button>
          )}
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <input
            type="text"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400"
            placeholder="🔍 Search by Name, Heritage, Stand Name, Alias..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-green-400">Sort By:</span>
              <select
                className="bg-gray-800 border border-gray-600 rounded py-2 px-4 text-white"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
              >
                <option value="created_newest">Created: Newest</option>
                <option value="created_oldest">Created: Oldest</option>
                <option value="name_az">Name: A-Z</option>
                <option value="name_za">Name: Z-A</option>
                <option value="level_high">Level: High to Low</option>
                <option value="level_low">Level: Low to High</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-green-400">Campaign:</span>
              <select
                className="bg-gray-800 border border-gray-600 rounded py-2 px-4 text-white"
                value={filterByCampaign}
                onChange={e => setFilterByCampaign(e.target.value)}
              >
                <option value="">All Campaigns</option>
                {campaigns.map(campaign => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-green-400">Playbook:</span>
              <select
                className="bg-gray-800 border border-gray-600 rounded py-2 px-4 text-white"
                value={filterByPlaybook}
                onChange={e => setFilterByPlaybook(e.target.value)}
              >
                <option value="">All Playbooks</option>
                <option value="STAND">STAND</option>
                <option value="HAMON">HAMON</option>
                <option value="SPIN">SPIN</option>
              </select>
            </div>
          </div>
        </div>

        {sortedCharacters.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">
              {searchTerm ? "No characters match your search." : "You haven't created any characters yet."}
            </p>
            {!searchTerm && (
              <Link 
                to="/create-character"
                className="mt-4 inline-block bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
              >
                Create Your First Character
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {sortedCharacters.map(character => (
              <div key={character.id} className="bg-gray-800 p-6 rounded-lg border border-gray-700 hover:border-green-500 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {character.true_name || 'Unnamed Character'}
                      {character.alias && (
                        <span className="text-green-400 ml-2">"{character.alias}"</span>
                      )}
                    </h2>
                    <div className="flex items-center space-x-4 text-gray-400 mt-1">
                      <span>Level {character.coin_stats?.development || 1}</span>
                      <span>•</span>
                      <span>{character.heritage?.name || 'Human'}</span>
                      <span>•</span>
                      <span className="text-yellow-400">{character.playbook || 'STAND'} User</span>
                    </div>
                    <p className="text-yellow-400 mt-1">
                      🌟 Stand: {character.stand_name || 'Unnamed Stand'}
                    </p>
                    {character.campaign && (
                      <p className="text-green-400 text-sm mt-1">
                        📞 Campaign: {campaigns.find(c => c.id === character.campaign)?.name || 'Unknown'}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex flex-col space-y-2">
                    <Link 
                      to={`/characters/${character.id}`} 
                      className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded text-center"
                    >
                      VIEW/EDIT
                    </Link>
                    {character.campaign && (
                      <button 
                        onClick={() => handleLeaveCampaign(
                          character.id, 
                          campaigns.find(c => c.id === character.campaign)?.name || 'Unknown'
                        )}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2 px-4 rounded text-sm"
                      >
                        LEAVE CAMPAIGN
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(character.id)}
                      className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded"
                    >
                      DELETE
                    </button>
                  </div>
                </div>
                
                {/* Character Stats Display */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-700">
                  <div className="text-center">
                    <div className="text-lg font-bold text-white">{character.stress || 0}/9</div>
                    <div className="text-sm text-gray-400">Stress</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-white flex items-center justify-center gap-1">
                      {Array.from({ length: 4 }, (_, i) => (
                        <span 
                          key={i} 
                          style={{ 
                            color: i < (character.wanted || 0) ? '#fbbf24' : '#6b7280',
                            opacity: i < (character.wanted || 0) ? 1 : 0.3,
                            filter: i < (character.wanted || 0) ? 'drop-shadow(0 0 2px #fbbf24)' : 'grayscale(1)'
                          }}
                        >
                          ⭐
                        </span>
                      ))}
                    </div>
                    <div className="text-sm text-gray-400">Wanted ({character.wanted || 0}/4)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-white">{character.coin_stats?.coin || 0}</div>
                    <div className="text-sm text-gray-400">Coin</div>
                  </div>
                </div>

                {/* Quick character info */}
                {character.background_note && (
                  <div className="mt-4 p-3 bg-gray-700 rounded">
                    <h4 className="text-green-400 font-bold text-sm mb-1">Background:</h4>
                    <p className="text-gray-300 text-sm">{character.background_note}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
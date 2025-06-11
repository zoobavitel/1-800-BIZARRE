// src/pages/CampaignDashboard.jsx - Campaign Browser for Players and GMs
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import Layout from '../components/Layout';

export default function CampaignDashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [filterByRole, setFilterByRole] = useState('all'); // 'all', 'player', 'gm'
  const [filterByStatus, setFilterByStatus] = useState('all'); // 'all', 'open', 'closed'

  // New campaign form state
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    description: '',
    max_players: 6,
    open_to_new_players: true
  });

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      
      // In a real app, this would come from the API
      const campaignsRes = await api.get('/campaigns/').catch(() => ({ data: [] }));
      const userRes = await api.get('/auth/user/').catch(() => ({ data: { username: 'TestUser' } }));
      
      // Mock data for demonstration
      const mockCampaigns = [
        {
          id: 1,
          name: "1(800)BIZARRE",
          description: "A bizarre adventure through modern-day stands and mysteries in Morioh town",
          created_date: "2024-01-15",
          gm_name: "DM_JoJo",
          player_count: 4,
          max_players: 6,
          open_to_new_players: true,
          user_role: "player",
          status: "active",
          characters: [
            { name: "Josuke", avatar: "/api/placeholder/40/40" },
            { name: "Okuyasu", avatar: "/api/placeholder/40/40" },
            { name: "Koichi", avatar: "/api/placeholder/40/40" },
            { name: "Jotaro", avatar: "/api/placeholder/40/40" }
          ],
          last_session: "2024-12-15",
          next_session: "2024-12-22"
        },
        {
          id: 2,
          name: "A History of Bad Men",
          description: "Dark intrigue and conspiracy in the JoJo universe set in the American Wild West",
          created_date: "2024-02-20",
          gm_name: "ArthurMorgan",
          player_count: 3,
          max_players: 5,
          open_to_new_players: true,
          user_role: "gm",
          status: "active",
          characters: [
            { name: "Giorno", avatar: "/api/placeholder/40/40" },
            { name: "Mista", avatar: "/api/placeholder/40/40" },
            { name: "Bruno", avatar: "/api/placeholder/40/40" }
          ],
          last_session: "2024-12-10",
          next_session: "2024-12-17"
        },
        {
          id: 3,
          name: "Stone Ocean Escape",
          description: "Prison break with stands and determination in Green Dolphin Street Prison",
          created_date: "2024-03-01",
          gm_name: "PrisonWarden",
          player_count: 6,
          max_players: 6,
          open_to_new_players: false,
          user_role: "player",
          status: "active",
          characters: [
            { name: "Jolyne", avatar: "/api/placeholder/40/40" },
            { name: "Ermes", avatar: "/api/placeholder/40/40" },
            { name: "Foo Fighters", avatar: "/api/placeholder/40/40" },
            { name: "Weather", avatar: "/api/placeholder/40/40" },
            { name: "Anasui", avatar: "/api/placeholder/40/40" },
            { name: "Emporio", avatar: "/api/placeholder/40/40" }
          ],
          last_session: "2024-12-12",
          next_session: "2024-12-19"
        },
        {
          id: 4,
          name: "Golden Wind Chronicles",
          description: "Gangster adventures in Naples with Passione",
          created_date: "2024-11-01",
          gm_name: "TestUser",
          player_count: 2,
          max_players: 5,
          open_to_new_players: true,
          user_role: "gm",
          status: "recruiting",
          characters: [
            { name: "Narancia", avatar: "/api/placeholder/40/40" },
            { name: "Abbacchio", avatar: "/api/placeholder/40/40" }
          ],
          last_session: null,
          next_session: "2024-12-20"
        },
        {
          id: 5,
          name: "Stardust Crusaders Redux",
          description: "A retelling of the journey to Egypt with new twists",
          created_date: "2024-10-15",
          gm_name: "StarPlatinum",
          player_count: 5,
          max_players: 5,
          open_to_new_players: false,
          user_role: "player",
          status: "hiatus",
          characters: [
            { name: "Joseph", avatar: "/api/placeholder/40/40" },
            { name: "Avdol", avatar: "/api/placeholder/40/40" },
            { name: "Kakyoin", avatar: "/api/placeholder/40/40" },
            { name: "Polnareff", avatar: "/api/placeholder/40/40" },
            { name: "Iggy", avatar: "/api/placeholder/40/40" }
          ],
          last_session: "2024-11-20",
          next_session: null
        }
      ];

      // Use mock data if API call fails or returns empty
      const campaignsData = campaignsRes.data.length > 0 ? campaignsRes.data : mockCampaigns;
      setCampaigns(campaignsData);
      setCurrentUser(userRes.data);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
      setError('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/campaigns/', newCampaign);
      setCampaigns(prev => [...prev, { ...response.data, user_role: 'gm' }]);
      setShowCreateCampaign(false);
      setNewCampaign({
        name: '',
        description: '',
        max_players: 6,
        open_to_new_players: true
      });
    } catch (err) {
      console.error('Failed to create campaign:', err);
      // For demo purposes, add mock campaign
      const mockCampaign = {
        id: Date.now(),
        ...newCampaign,
        created_date: new Date().toISOString().split('T')[0],
        gm_name: currentUser?.username || 'TestUser',
        player_count: 0,
        user_role: 'gm',
        status: 'recruiting',
        characters: [],
        last_session: null,
        next_session: null
      };
      setCampaigns(prev => [...prev, mockCampaign]);
      setShowCreateCampaign(false);
      setNewCampaign({
        name: '',
        description: '',
        max_players: 6,
        open_to_new_players: true
      });
    }
  };

  const handleJoinCampaign = async (campaignId) => {
    try {
      await api.post(`/campaigns/${campaignId}/join/`);
      setCampaigns(prev => 
        prev.map(campaign => 
          campaign.id === campaignId 
            ? { ...campaign, player_count: campaign.player_count + 1 }
            : campaign
        )
      );
    } catch (err) {
      console.error('Failed to join campaign:', err);
    }
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    const roleMatch = filterByRole === 'all' || campaign.user_role === filterByRole;
    const statusMatch = filterByStatus === 'all' || 
      (filterByStatus === 'open' && campaign.open_to_new_players) ||
      (filterByStatus === 'closed' && !campaign.open_to_new_players);
    return roleMatch && statusMatch;
  });

  const getStatusBadge = (campaign) => {
    if (campaign.status === 'recruiting') return 'bg-green-600 text-white';
    if (campaign.status === 'active') return 'bg-blue-600 text-white';
    if (campaign.status === 'hiatus') return 'bg-yellow-600 text-black';
    if (campaign.status === 'completed') return 'bg-gray-600 text-white';
    return 'bg-gray-600 text-white';
  };

  const getRoleBadge = (role) => {
    return role === 'gm' ? 'bg-purple-600 text-white' : 'bg-green-600 text-white';
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-xl">Loading campaigns...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 bg-gray-900 text-white min-h-screen">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-yellow-400">📞 My Campaigns</h1>
            <p className="text-gray-400 mt-2">Browse and manage your active campaigns</p>
          </div>
          <div className="flex space-x-4">
            <Link 
              to="/create-character" 
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              ✨ Create Character
            </Link>
            <button
              onClick={() => setShowCreateCampaign(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              + Create Campaign
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4 items-center">
          <div className="flex items-center space-x-2">
            <span className="text-green-400">Role:</span>
            <select
              className="bg-gray-800 border border-gray-600 rounded py-2 px-4 text-white"
              value={filterByRole}
              onChange={e => setFilterByRole(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="player">Player</option>
              <option value="gm">Game Master</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-green-400">Status:</span>
            <select
              className="bg-gray-800 border border-gray-600 rounded py-2 px-4 text-white"
              value={filterByStatus}
              onChange={e => setFilterByStatus(e.target.value)}
            >
              <option value="all">All Campaigns</option>
              <option value="open">Open to Join</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          
          <div className="text-sm text-gray-400">
            Showing {filteredCampaigns.length} of {campaigns.length} campaigns
          </div>
        </div>

        {/* Campaign Grid */}
        {filteredCampaigns.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4 text-lg">
              {campaigns.length === 0 
                ? "No campaigns yet. Create one to get started!" 
                : "No campaigns match your filters."}
            </p>
            {campaigns.length === 0 && (
              <button
                onClick={() => setShowCreateCampaign(true)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg"
              >
                Create Your First Campaign
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCampaigns.map(campaign => (
              <div 
                key={campaign.id} 
                className="bg-gray-800 rounded-lg border border-gray-700 hover:border-green-500 transition-colors p-6"
              >
                {/* Campaign Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2 truncate">
                      {campaign.name}
                    </h3>
                    <div className="flex gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleBadge(campaign.user_role)}`}>
                        {campaign.user_role === 'gm' ? 'GM' : 'PLAYER'}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(campaign)}`}>
                        {campaign.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-gray-400 text-sm mb-4 line-clamp-3">
                  {campaign.description}
                </p>

                {/* Campaign Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">GM:</span>
                    <span className="text-green-400 font-medium">{campaign.gm_name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Players:</span>
                    <span className="text-yellow-400">
                      {campaign.player_count}/{campaign.max_players}
                      {campaign.open_to_new_players && campaign.player_count < campaign.max_players && (
                        <span className="text-green-400 ml-1">(Open)</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Created:</span>
                    <span className="text-gray-300">
                      {new Date(campaign.created_date).toLocaleDateString()}
                    </span>
                  </div>
                  {campaign.last_session && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Last Session:</span>
                      <span className="text-gray-300">
                        {new Date(campaign.last_session).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {campaign.next_session && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Next Session:</span>
                      <span className="text-green-400">
                        {new Date(campaign.next_session).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Player Avatars */}
                {campaign.characters.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-gray-400 mb-2">Characters:</div>
                    <div className="flex -space-x-2 overflow-hidden">
                      {campaign.characters.slice(0, 6).map((character, index) => (
                        <div
                          key={index}
                          className="inline-block h-8 w-8 rounded-full bg-gray-600 border-2 border-gray-800 flex items-center justify-center text-xs font-medium text-white"
                          title={character.name}
                        >
                          {character.name.charAt(0)}
                        </div>
                      ))}
                      {campaign.characters.length > 6 && (
                        <div className="inline-block h-8 w-8 rounded-full bg-gray-600 border-2 border-gray-800 flex items-center justify-center text-xs font-medium text-gray-400">
                          +{campaign.characters.length - 6}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  {campaign.user_role === 'gm' ? (
                    <Link
                      to={`/campaigns/${campaign.id}/manage`}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-center py-2 px-3 rounded text-sm font-medium"
                    >
                      Manage Campaign
                    </Link>
                  ) : (
                    <Link
                      to={`/campaigns/${campaign.id}`}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-center py-2 px-3 rounded text-sm font-medium"
                    >
                      View Campaign
                    </Link>
                  )}
                  
                  {campaign.user_role !== 'gm' && campaign.open_to_new_players && campaign.player_count < campaign.max_players && (
                    <button
                      onClick={() => handleJoinCampaign(campaign.id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded text-sm font-medium"
                    >
                      Join
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Campaign Modal */}
        {showCreateCampaign && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 p-6 rounded-lg border border-green-500 w-full max-w-md">
              <h3 className="text-xl font-bold text-green-400 mb-4">Create New Campaign</h3>
              <form onSubmit={handleCreateCampaign}>
                <div className="mb-4">
                  <label className="block text-green-400 mb-2">Campaign Name</label>
                  <input
                    type="text"
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign({...newCampaign, name: e.target.value})}
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                    placeholder="Enter campaign name..."
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-green-400 mb-2">Description</label>
                  <textarea
                    value={newCampaign.description}
                    onChange={(e) => setNewCampaign({...newCampaign, description: e.target.value})}
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                    rows="3"
                    placeholder="Describe your campaign..."
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-green-400 mb-2">Max Players</label>
                  <select
                    value={newCampaign.max_players}
                    onChange={(e) => setNewCampaign({...newCampaign, max_players: parseInt(e.target.value)})}
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                  >
                    <option value={3}>3 Players</option>
                    <option value={4}>4 Players</option>
                    <option value={5}>5 Players</option>
                    <option value={6}>6 Players</option>
                    <option value={7}>7 Players</option>
                    <option value={8}>8 Players</option>
                  </select>
                </div>
                <div className="mb-6">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={newCampaign.open_to_new_players}
                      onChange={(e) => setNewCampaign({...newCampaign, open_to_new_players: e.target.checked})}
                      className="rounded"
                    />
                    <span className="text-green-400">Open to new players</span>
                  </label>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateCampaign(false)}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
                  >
                    Create Campaign
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

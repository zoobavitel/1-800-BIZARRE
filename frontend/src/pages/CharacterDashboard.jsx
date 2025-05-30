// src/pages/CharacterDashboard.jsx - FIXED
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import Layout from '../components/Layout';

export default function CharacterDashboard() {
  const [characters, setCharacters] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_newest');

  useEffect(() => {
    api.get('/characters/')
      .then(res => setCharacters(res.data))
      .catch(console.error);
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

  // Filter characters based on search
  const filteredCharacters = characters.filter(char => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      (char.true_name || '').toLowerCase().includes(search) ||
      (char.heritage?.name || '').toLowerCase().includes(search) ||
      (char.playbook || '').toLowerCase().includes(search) ||
      (char.stand_name || '').toLowerCase().includes(search)
    );
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
      default:
        return (b.id || 0) - (a.id || 0);
    }
  });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">My Characters</h1>
          <Link 
            to="/create-character" 
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
          >
            CREATE A CHARACTER
          </Link>
        </div>

        <div className="flex items-center mb-4">
          <span>Slots: {characters.length}/∞ Used</span>
          
          <a 
            href="/media/1(800)Bizarre Character Sheet.png" 
            download
            className="ml-6 text-red-600 hover:text-red-800 flex items-center"
          >
            <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 12l-5-5 1.41-1.41L10 9.17l3.59-3.58L15 7l-5 5z"/>
            </svg>
            Download a blank character sheet
          </a>
        </div>

        <div className="mb-6">
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded mb-4"
            placeholder="Search by Name, Heritage, Stand Name..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          
          <div className="flex items-center">
            <span className="mr-2">Sort By</span>
            <select
              className="border border-gray-300 rounded py-2 px-4 bg-white"
              style={{ width: "250px" }}
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="created_newest">Created: Newest</option>
              <option value="created_oldest">Created: Oldest</option>
              <option value="name_az">Name: A-Z</option>
              <option value="name_za">Name: Z-A</option>
            </select>
          </div>
        </div>

        {sortedCharacters.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">
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
              <div key={character.id} className="border-b border-gray-200 pb-4">
                <h2 className="text-2xl font-bold">{character.true_name || 'Unnamed Character'}</h2>
                <p>
                  Level {character.coin_stats?.development || 1} | 
                  {character.heritage ? character.heritage.name : 'Human'} | 
                  {character.playbook || 'STAND'}
                </p>
                <p className="mb-2">Stand: {character.stand_name || 'Unnamed Stand'}</p>
                
                <div className="flex justify-between mt-2">
                  <div className="space-x-4">
                    <Link 
                      to={`/characters/${character.id}`} 
                      className="text-red-600 hover:text-red-800 font-medium"
                    >
                      VIEW/EDIT
                    </Link>
                  </div>
                  <button 
                    onClick={() => handleDelete(character.id)}
                    className="text-red-600 hover:text-red-800 border border-red-300 hover:border-red-500 px-3 py-1 rounded"
                  >
                    DELETE
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
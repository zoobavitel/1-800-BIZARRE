import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import Home from './pages/Home.jsx';
import CharacterPage from './pages/Character.jsx';
import ResponsiveTest from './pages/ResponsiveTest.jsx';
import NPCSheetPage from './pages/NPCSheet.jsx';
import { AuthProvider } from './features/auth';
import ProtectedRoute from './components/ProtectedRoute';

const App = () => {
  const [currentPage, setCurrentPage] = useState('home');
  // When on character page: null = create new, number = edit that id
  const [characterPageId, setCharacterPageId] = useState(null);

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (hash === 'test') setCurrentPage('test');
    else if (hash === 'npcs') setCurrentPage('npcs');
    else if (hash === 'character' || hash.startsWith('character/')) {
      setCurrentPage('character');
      const idPart = hash.replace(/^character\/?/, '');
      setCharacterPageId(idPart ? parseInt(idPart, 10) : null);
    } else if (hash) setCurrentPage('home');
  }, []);

  const handlePageChange = (page, payload) => {
    setCurrentPage(page);
    if (page === 'character') {
      setCharacterPageId(payload?.characterId ?? null);
      window.location.hash = payload?.characterId != null ? `character/${payload.characterId}` : 'character';
    } else {
      setCharacterPageId(null);
      window.location.hash = page === 'home' ? '' : page;
    }
  };

  const handleBackFromCharacter = () => {
    setCurrentPage('home');
    setCharacterPageId(null);
    window.location.hash = '';
  };

  return (
    <ProtectedRoute>
      <div>
        <div className="fixed top-4 left-4 z-50 flex gap-2">
          <button 
            onClick={() => handlePageChange('home')}
            className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
              currentPage === 'home' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Home
          </button>
          <button 
            onClick={() => handlePageChange('character')}
            className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
              currentPage === 'character' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Characters
          </button>
          <button 
            onClick={() => handlePageChange('npcs')}
            className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
              currentPage === 'npcs' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            GM — NPCs
          </button>
          <button 
            onClick={() => handlePageChange('test')}
            className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
              currentPage === 'test' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Responsive Test
          </button>
        </div>

        {currentPage === 'home' && (
          <Home onNavigateToCharacter={(characterId) => handlePageChange('character', { characterId })} />
        )}
        {currentPage === 'character' && (
          <CharacterPage
            initialCharacterId={characterPageId}
            onBack={handleBackFromCharacter}
          />
        )}
        {currentPage === 'npcs' && <NPCSheetPage />}
        {currentPage === 'test' && <ResponsiveTest />}
      </div>
    </ProtectedRoute>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

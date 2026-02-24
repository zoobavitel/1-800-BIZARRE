import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import Home from './pages/Home.jsx';
import CharacterPage from './pages/Character.jsx';
import ResponsiveTest from './pages/ResponsiveTest.jsx';
import NPCSheetPage from './pages/NPCSheet.jsx';
import { AuthProvider } from './features/auth';
import ProtectedRoute from './components/ProtectedRoute';
import HamburgerMenu from './components/HamburgerMenu.jsx';
import { characterAPI, transformBackendToFrontend } from './features/character-sheet';

const App = () => {
  const [currentPage, setCurrentPage] = useState('home');
  // When on character page: null = create new, number = edit that id
  const [characterPageId, setCharacterPageId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuCharacters, setMenuCharacters] = useState([]);

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

  const loadMenuCharacters = useCallback(async () => {
    try {
      const list = await characterAPI.getCharacters();
      const front = (list || []).map(transformBackendToFrontend);
      setMenuCharacters(front);
    } catch {
      setMenuCharacters([]);
    }
  }, []);

  useEffect(() => {
    if (menuOpen) loadMenuCharacters();
  }, [menuOpen, loadMenuCharacters]);

  const handleMenuSelectCharacter = useCallback((id) => {
    handlePageChange('character', { characterId: id });
  }, []);

  const handleMenuNewCharacter = useCallback(() => {
    const base = typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`.replace(/\/?$/, '')
      : '';
    const url = base ? `${base}#character` : '#character';
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <ProtectedRoute>
      <div>
        <HamburgerMenu
          open={menuOpen}
          onToggle={() => setMenuOpen((o) => !o)}
          onClose={() => setMenuOpen(false)}
          hideBuiltInButton={currentPage === 'home' || currentPage === 'character'}
          currentPage={currentPage}
          onPageChange={handlePageChange}
          characters={menuCharacters}
          onSelectCharacter={handleMenuSelectCharacter}
          onNewCharacter={handleMenuNewCharacter}
        />
        {currentPage !== 'home' && currentPage !== 'character' && (
          <div className="fixed top-4 left-14 z-50 flex items-center gap-2">
            <span className="text-sm font-bold text-gray-300" style={{ fontFamily: 'monospace' }}>1(800) BIZARRE</span>
          </div>
        )}

        {currentPage === 'home' && (
          <Home
            onNavigateToCharacter={(characterId) => handlePageChange('character', { characterId })}
            onHamburgerClick={() => setMenuOpen((o) => !o)}
          />
        )}
        {currentPage === 'character' && (
          <CharacterPage
            initialCharacterId={characterPageId}
            onBack={handleBackFromCharacter}
            onHamburgerClick={() => setMenuOpen((o) => !o)}
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

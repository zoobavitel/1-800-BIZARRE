import './styles/global.css';
import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { Menu } from 'lucide-react';
import Home from './pages/Home.jsx';
import CharacterPage from './pages/CharacterPage.jsx';
import ResponsiveTest from './pages/ResponsiveTest.jsx';
import NPCSheetPage from './pages/NPCSheet.jsx';
import CampaignManagement from './pages/CampaignManagement.jsx';
import AbilityBrowser from './pages/AbilityBrowser.jsx';
import CharacterOptionsPage from './pages/CharacterOptionsPage.jsx';
import { AuthProvider, useAuth } from './features/auth';
import ProtectedRoute from './components/ProtectedRoute';
import HamburgerMenu from './components/HamburgerMenu.jsx';
import { characterAPI, transformBackendToFrontend } from './features/character-sheet';

const PAGE_TITLES = {
  character:        'CHARACTERS',
  'character-options': 'CHARACTER OPTIONS',
  campaigns:         'CAMPAIGN MANAGEMENT',
  abilities:         'ABILITY BROWSER',
  npcs:              'GM — NPCs',
  test:              'RESPONSIVE TEST',
};

const barStyles = {
  bar: {
    background: '#1f2937', padding: '8px 16px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    borderBottom: '1px solid #4b5563', position: 'sticky', top: 0, zIndex: 20,
    fontFamily: "'Roboto Mono', 'Consolas', monospace", fontSize: '13px',
  },
  hamburger: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '36px', height: '36px', border: 'none', borderRadius: '4px',
    background: '#374151', color: '#9ca3af', cursor: 'pointer',
  },
  back: {
    padding: '6px 12px', border: '1px solid #4b5563', borderRadius: '4px',
    background: 'transparent', color: '#9ca3af', cursor: 'pointer',
    fontFamily: 'monospace', fontSize: '12px',
  },
};

function AppBar({ onHamburgerClick, onBack, pageTitle }) {
  return (
    <header style={barStyles.bar}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button type="button" onClick={onHamburgerClick} aria-label="Open menu" style={barStyles.hamburger}>
          <Menu style={{ width: 20, height: 20 }} />
        </button>
        {onBack && (
          <button type="button" onClick={onBack} style={barStyles.back}>← Back</button>
        )}
        <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>1(800) BIZARRE</span>
        {pageTitle && (
          <>
            <span style={{ color: '#6b7280' }}>—</span>
            <span style={{ color: '#9ca3af', fontSize: '14px' }}>{pageTitle}</span>
          </>
        )}
      </div>
    </header>
  );
}

const App = () => {
  const { isAuthenticated, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState('home');
  const [characterPageId, setCharacterPageId] = useState(null);
  const [campaignPageId, setCampaignPageId] = useState(null);
  const [abilityFilter, setAbilityFilter] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuCharacters, setMenuCharacters] = useState([]);

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (hash === 'test') setCurrentPage('test');
    else if (hash === 'npcs') setCurrentPage('npcs');
    else if (hash === 'character-options') setCurrentPage('character-options');
    else if (hash === 'campaigns' || hash.startsWith('campaigns/')) {
      setCurrentPage('campaigns');
      const idPart = hash.replace(/^campaigns\/?/, '');
      setCampaignPageId(idPart ? parseInt(idPart, 10) : null);
    }
    else if (hash === 'abilities' || hash.startsWith('abilities-')) {
      setCurrentPage('abilities');
      const filterPart = hash.replace(/^abilities-?/, '');
      setAbilityFilter(filterPart || null);
    }
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
      setCampaignPageId(null);
      setAbilityFilter(null);
      window.location.hash = payload?.characterId != null ? `character/${payload.characterId}` : 'character';
    } else if (page === 'campaigns') {
      setCampaignPageId(payload?.campaignId ?? null);
      setCharacterPageId(null);
      setAbilityFilter(null);
      window.location.hash = payload?.campaignId != null ? `campaigns/${payload.campaignId}` : 'campaigns';
    } else if (page === 'abilities') {
      setCharacterPageId(null);
      setCampaignPageId(null);
      const filter = payload?.filter || null;
      setAbilityFilter(filter);
      window.location.hash = filter ? `abilities-${filter}` : 'abilities';
    } else if (page === 'character-options') {
      setCharacterPageId(null);
      setCampaignPageId(null);
      setAbilityFilter(null);
      window.location.hash = 'character-options';
    } else {
      setCharacterPageId(null);
      setCampaignPageId(null);
      setAbilityFilter(null);
      window.location.hash = page === 'home' ? '' : page;
    }
  };

  const handleBack = () => {
    setCurrentPage('home');
    setCharacterPageId(null);
    setCampaignPageId(null);
    setAbilityFilter(null);
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

  const toggleMenu = () => setMenuOpen((o) => !o);

  return (
    <ProtectedRoute>
      <div>
        <HamburgerMenu
          open={menuOpen}
          onToggle={toggleMenu}
          onClose={() => setMenuOpen(false)}
          hideBuiltInButton
          currentPage={currentPage}
          onPageChange={handlePageChange}
          characters={menuCharacters}
          onSelectCharacter={handleMenuSelectCharacter}
          onNewCharacter={handleMenuNewCharacter}
          isAuthenticated={isAuthenticated}
          onLogin={() => handlePageChange('home')}
          onLogout={logout}
        />

        {currentPage !== 'home' && (
          <AppBar
            onHamburgerClick={toggleMenu}
            onBack={handleBack}
            pageTitle={PAGE_TITLES[currentPage]}
          />
        )}

        {currentPage === 'home' && (
          <Home
            onNavigateToCharacter={(characterId) => handlePageChange('character', { characterId })}
            onNavigateToCharacterOptions={() => handlePageChange('character-options')}
            onNavigateToCampaign={(campaignId) => handlePageChange('campaigns', { campaignId })}
            onHamburgerClick={toggleMenu}
          />
        )}
        {currentPage === 'character' && (
          <CharacterPage initialCharacterId={characterPageId} />
        )}
        {currentPage === 'character-options' && (
          <CharacterOptionsPage
            onNavigateToAbilities={(filter) => handlePageChange('abilities', { filter })}
          />
        )}
        {currentPage === 'npcs' && <NPCSheetPage />}
        {currentPage === 'campaigns' && <CampaignManagement initialCampaignId={campaignPageId} />}
        {currentPage === 'abilities' && <AbilityBrowser initialFilter={abilityFilter} />}
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

import "./styles/global.css";
import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom/client";
import Home from "./pages/Home.jsx";
import CharacterPage from "./pages/CharacterPage.jsx";
import ResponsiveTest from "./pages/ResponsiveTest.jsx";
import CampaignManagement from "./pages/CampaignManagement.jsx";
import AbilityBrowser from "./pages/AbilityBrowser.jsx";
import CharacterOptionsPage from "./pages/CharacterOptionsPage.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import MessagesPage from "./pages/MessagesPage.jsx";
import AccountSettingsPage from "./pages/AccountSettingsPage.jsx";
import PatchNotesPage from "./pages/PatchNotesPage.jsx";
import RulesPage from "./pages/RulesPage.jsx";
import LicensesPage from "./pages/LicensesPage.jsx";
import UserMenu from "./components/UserMenu.jsx";
import { AuthProvider, useAuth } from "./features/auth";
import { ThemeProvider } from "./features/theme/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import HamburgerMenu from "./components/HamburgerMenu.jsx";
import {
  characterAPI,
  transformBackendToFrontend,
} from "./features/character-sheet";
import { buildRouteHref, buildRouteHash, handleSpaNavClick } from "./utils/spaNavigation";

const PAGE_TITLES = {
  home: "HOME",
  character: "CHARACTERS",
  "character-options": "CHARACTER OPTIONS",
  campaigns: "CAMPAIGN MANAGEMENT",
  abilities: "ABILITY BROWSER",
  npcs: "GM — NPCs",
  test: "RESPONSIVE TEST",
  search: "SEARCH",
  notifications: "NOTIFICATIONS",
  messages: "MESSAGES",
  "account-settings": "ACCOUNT SETTINGS",
  "patch-notes": "PATCH NOTES",
  licenses: "LICENSES",
  rules: "GAME RULES",
};

const barStyles = {
  bar: {
    background: "var(--hftf-black)",
    padding: "10px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid var(--hftf-border)",
    position: "sticky",
    top: 0,
    zIndex: 100,
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
  },
  hamburger: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: "8px",
    zIndex: 1001,
  },
  hamburgerLine: {
    display: "block",
    height: "2px",
    transition: "all 0.3s ease",
  },
  hamburgerLine1: {
    width: "22px",
    background: "var(--hftf-gold)",
  },
  hamburgerLine2: {
    width: "18px",
    background: "#c0392b",
  },
  hamburgerLine3: {
    width: "14px",
    background: "var(--hftf-purple)",
  },
  back: {
    padding: "5px 12px",
    border: "1px solid var(--hftf-border)",
    borderRadius: 0,
    background: "transparent",
    color: "var(--hftf-gold-muted)",
    cursor: "pointer",
    fontFamily: "var(--font-heading)",
    fontSize: "10px",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  actionBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    border: "none",
    borderRadius: "4px",
    background: "var(--hftf-panel)",
    color: "var(--hftf-text-cream)",
    cursor: "pointer",
  },
};

function AppBar({ onHamburgerClick, onBack, onHome, pageTitle, rightContent }) {
  return (
    <header style={barStyles.bar}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <button
          type="button"
          onClick={onHamburgerClick}
          aria-label="Open menu"
          style={barStyles.hamburger}
        >
          <span
            style={{ ...barStyles.hamburgerLine, ...barStyles.hamburgerLine1 }}
          />
          <span
            style={{ ...barStyles.hamburgerLine, ...barStyles.hamburgerLine2 }}
          />
          <span
            style={{ ...barStyles.hamburgerLine, ...barStyles.hamburgerLine3 }}
          />
        </button>
        {onBack && (
          <button type="button" onClick={onBack} style={barStyles.back}>
            ← Back
          </button>
        )}
        <a
          href={buildRouteHref("home")}
          onClick={(e) => handleSpaNavClick(e, onHome)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            fontSize: "26px",
            fontWeight: 400,
            color: "var(--hftf-text-cream)",
            fontFamily: "var(--font-display)",
            letterSpacing: "0.06em",
            textDecoration: "none",
          }}
          aria-label="Go to home"
        >
          <span style={{ color: "var(--hftf-purple)" }}>1(800)</span>
          <span style={{ color: "var(--hftf-text-cream)" }}>BIZARRE</span>
        </a>
        {pageTitle && (
          <>
            <span style={{ color: "var(--hftf-gold-muted)" }}>—</span>
            <span
              style={{
                color: "var(--hftf-gold-muted)",
                fontSize: "11px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {pageTitle}
            </span>
          </>
        )}
      </div>
      {rightContent && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {rightContent}
        </div>
      )}
    </header>
  );
}

/** Positive integer id from hash segment, or null if missing/invalid. */
function parseHashId(segment) {
  if (!segment) return null;
  const n = parseInt(segment, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Parse #hash into route state. Used for lazy useState (first paint) and on hashchange. */
function routeStateFromHash(hash) {
  const base = {
    currentPage: "home",
    characterPageId: null,
    campaignPageId: null,
    npcPageId: null,
    abilityFilter: null,
    rulesSection: null,
  };
  if (!hash) return base;
  if (hash === "test") return { ...base, currentPage: "test" };
  if (hash === "npcs" || hash.startsWith("npcs/")) {
    const idPart = hash.replace(/^npcs\/?/, "");
    return {
      ...base,
      currentPage: "npcs",
      npcPageId: parseHashId(idPart),
    };
  }
  if (hash === "search") return { ...base, currentPage: "search" };
  if (hash === "notifications")
    return { ...base, currentPage: "notifications" };
  if (hash === "messages") return { ...base, currentPage: "messages" };
  if (hash === "account-settings")
    return { ...base, currentPage: "account-settings" };
  if (hash === "character-options")
    return { ...base, currentPage: "character-options" };
  if (hash === "patch-notes") return { ...base, currentPage: "patch-notes" };
  if (hash === "licenses") return { ...base, currentPage: "licenses" };
  if (hash === "rules" || hash.startsWith("rules-")) {
    return {
      ...base,
      currentPage: "rules",
      rulesSection: hash === "rules" ? null : hash.replace(/^rules-/, ""),
    };
  }
  if (hash === "campaigns" || hash.startsWith("campaigns/")) {
    const idPart = hash.replace(/^campaigns\/?/, "");
    return {
      ...base,
      currentPage: "campaigns",
      campaignPageId: parseHashId(idPart),
    };
  }
  if (hash === "abilities" || hash.startsWith("abilities-")) {
    const filterPart = hash.replace(/^abilities-?/, "");
    return {
      ...base,
      currentPage: "abilities",
      abilityFilter: filterPart || null,
    };
  }
  if (hash === "character" || hash.startsWith("character/")) {
    const idPart = hash.replace(/^character\/?/, "");
    return {
      ...base,
      currentPage: "character",
      characterPageId: parseHashId(idPart),
    };
  }
  return base;
}

const App = () => {
  const { isAuthenticated, logout } = useAuth();
  const initialRoute =
    typeof window !== "undefined"
      ? routeStateFromHash(window.location.hash.substring(1))
      : routeStateFromHash("");
  const [currentPage, setCurrentPage] = useState(initialRoute.currentPage);
  const [characterPageId, setCharacterPageId] = useState(
    initialRoute.characterPageId,
  );
  const [campaignPageId, setCampaignPageId] = useState(
    initialRoute.campaignPageId,
  );
  const [campaignFactionId, setCampaignFactionId] = useState(null);
  const [npcPageId, setNpcPageId] = useState(initialRoute.npcPageId);
  const [abilityFilter, setAbilityFilter] = useState(
    initialRoute.abilityFilter,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [menuCharacters, setMenuCharacters] = useState([]);
  const [rulesSection, setRulesSection] = useState(initialRoute.rulesSection);
  const navigationGuardRef = useRef(null);
  const setNavigationGuard = useCallback((guardFn) => {
    navigationGuardRef.current = typeof guardFn === "function" ? guardFn : null;
  }, []);

  const parseHash = useCallback(() => {
    const s = routeStateFromHash(window.location.hash.substring(1));
    setCurrentPage(s.currentPage);
    setCharacterPageId(s.characterPageId);
    setCampaignPageId(s.campaignPageId);
    setNpcPageId(s.npcPageId);
    setAbilityFilter(s.abilityFilter);
    setRulesSection(s.rulesSection);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [
    currentPage,
    characterPageId,
    campaignPageId,
    npcPageId,
    abilityFilter,
    rulesSection,
  ]);

  useEffect(() => {
    parseHash();
  }, [parseHash]);

  useEffect(() => {
    const onHashChange = () => parseHash();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [parseHash]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentPage]);

  const handlePageChange = async (page, payload) => {
    if (navigationGuardRef.current) {
      const ok = await navigationGuardRef.current();
      if (!ok) return;
    }
    setCurrentPage(page);
    if (page === "character") {
      setCharacterPageId(payload?.characterId ?? null);
      setCampaignPageId(null);
      setAbilityFilter(null);
      window.location.hash = buildRouteHash(page, payload);
    } else if (page === "campaigns") {
      setCampaignPageId(payload?.campaignId ?? null);
      setCampaignFactionId(payload?.factionId ?? null);
      setCharacterPageId(null);
      setAbilityFilter(null);
      window.location.hash = buildRouteHash(page, payload);
    } else if (page === "abilities") {
      setCharacterPageId(null);
      setCampaignPageId(null);
      const filter = payload?.filter || null;
      setAbilityFilter(filter);
      window.location.hash = buildRouteHash(page, { filter });
    } else if (page === "character-options") {
      setCharacterPageId(null);
      setCampaignPageId(null);
      setAbilityFilter(null);
      window.location.hash = buildRouteHash(page, payload);
    } else if (page === "rules") {
      setCharacterPageId(null);
      setCampaignPageId(null);
      setAbilityFilter(null);
      const section = payload?.section || null;
      setRulesSection(section);
      window.location.hash = buildRouteHash(page, { section });
    } else if (page === "npcs") {
      setCharacterPageId(null);
      setCampaignPageId(null);
      const npcId = payload?.npcId ?? null;
      setNpcPageId(npcId);
      window.location.hash = buildRouteHash(page, { npcId });
    } else {
      setCharacterPageId(null);
      setCampaignPageId(null);
      setNpcPageId(null);
      setAbilityFilter(null);
      setRulesSection(null);
      window.location.hash = buildRouteHash(page, payload);
    }
  };

  const handleBack = () => {
    window.history.back();
  };

  const loadMenuCharacters = useCallback(async () => {
    try {
      const list = await characterAPI.getCharacters({ mine: true });
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
    handlePageChange("character", { characterId: id });
  }, []);

  const handleMenuNewCharacter = useCallback(() => {
    handlePageChange("character", { characterId: null });
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
          onLogin={() => handlePageChange("home")}
          onLogout={logout}
        />

        {currentPage !== "home" && (
            <AppBar
              onHamburgerClick={toggleMenu}
              onBack={handleBack}
              onHome={() => handlePageChange("home")}
              pageTitle={PAGE_TITLES[currentPage]}
            />
          )}

        {currentPage === "home" && (
          <>
            <UserMenu
              open={userMenuOpen}
              onClose={() => setUserMenuOpen(false)}
              onNavigateToNotifications={() =>
                handlePageChange("notifications")
              }
              onNavigateToMessages={() => handlePageChange("messages")}
              onNavigateToAccountSettings={() =>
                handlePageChange("account-settings")
              }
              onLogout={logout}
            />
            <Home
              menuOpen={menuOpen}
              onToggleMenu={toggleMenu}
              onSearch={() => handlePageChange("search")}
              onOpenAccountMenu={() => setUserMenuOpen(true)}
              onNavigateToCharacter={(characterId) =>
                handlePageChange("character", { characterId })
              }
              onNavigateToCharacterOptions={() =>
                handlePageChange("character-options")
              }
              onNavigateToCampaign={(campaignId, opts) =>
                handlePageChange("campaigns", {
                  campaignId,
                  factionId: opts?.factionId ?? null,
                })
              }
              onNavigateToRules={() => handlePageChange("rules")}
              onNavigateToPatchNotes={() => handlePageChange("patch-notes")}
              onNavigateToLicenses={() => handlePageChange("licenses")}
              onNavigateToNPC={(npcId) => handlePageChange("npcs", { npcId })}
            />
          </>
        )}
        {currentPage === "character" && (
          <CharacterPage
            initialCharacterId={characterPageId}
            onRegisterNavigationGuard={setNavigationGuard}
          />
        )}
        {currentPage === "character-options" && (
          <CharacterOptionsPage
            onNavigateToAbilities={(filter) =>
              handlePageChange("abilities", { filter })
            }
          />
        )}
        {currentPage === "npcs" && (
          <CharacterPage
            initialCharacterId={null}
            initialNpcId={npcPageId}
            preferNpcMode
            onRegisterNavigationGuard={setNavigationGuard}
          />
        )}
        {currentPage === "campaigns" && (
          <CampaignManagement
            initialCampaignId={campaignPageId}
            initialFactionId={campaignFactionId}
            onNavigateToCharacter={(id) =>
              handlePageChange("character", { characterId: id })
            }
            onNavigateToNPC={(id) => handlePageChange("npcs", { npcId: id })}
            onCampaignSelect={(id) =>
              handlePageChange("campaigns", { campaignId: id })
            }
          />
        )}
        {currentPage === "abilities" && (
          <AbilityBrowser initialFilter={abilityFilter} />
        )}
        {currentPage === "search" && (
          <SearchPage
            onBack={handleBack}
            onNavigateToCharacter={(id) =>
              handlePageChange("character", { characterId: id })
            }
            onNavigateToCampaign={(id) =>
              handlePageChange("campaigns", { campaignId: id })
            }
            onNavigateToAbilities={(filter) =>
              handlePageChange("abilities", { filter })
            }
          />
        )}
        {currentPage === "notifications" && <NotificationsPage />}
        {currentPage === "messages" && <MessagesPage />}
        {currentPage === "account-settings" && <AccountSettingsPage />}
        {currentPage === "patch-notes" && (
          <PatchNotesPage onBack={handleBack} />
        )}
        {currentPage === "licenses" && <LicensesPage onBack={handleBack} />}
        {currentPage === "rules" && (
          <RulesPage
            onBack={handleBack}
            initialSection={rulesSection}
            onNavigateSection={(slug) =>
              handlePageChange("rules", slug != null ? { section: slug } : {})
            }
          />
        )}
        {currentPage === "test" && <ResponsiveTest />}
      </div>
    </ProtectedRoute>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>,
);

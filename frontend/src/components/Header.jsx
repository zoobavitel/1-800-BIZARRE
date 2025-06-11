// src/components/Header.jsx - Enhanced with Search
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import '../styles/Header.css';

const Header = ({ isAuthenticated }) => {
  const [navOpen, setNavOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    gameRules: false,
    collections: false,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  
  // Close navigation when route changes
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);
  
  // Handle search functionality
  const performSearch = async (query) => {
    if (!query.trim() || !isAuthenticated) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await api.get(`/search/?q=${encodeURIComponent(query)}`);
      setSearchResults(response.data.results || []);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search - wait 300ms after user stops typing
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);
  };

  const handleSearchResultClick = (result) => {
    setShowSearchResults(false);
    setSearchQuery('');
    navigate(result.url);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    }
  };

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Clear search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);
  
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  // Prevent scrolling when nav is open
  useEffect(() => {
    if (navOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
    };
  }, [navOpen]);

  return (
    <>
      {/* Fixed Header */}
      <header className="header">
        <Link to="/" className="logo">1(800)BIZARRE</Link>
        <div className="header-right">
          {isAuthenticated && (
            <div className="search-container desktop-search" ref={searchRef}>
              <form onSubmit={handleSearchSubmit}>
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder="Search characters, campaigns, abilities..." 
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => searchQuery && setShowSearchResults(true)}
                />
                <button type="submit" className="search-icon">🔍</button>
              </form>
              
              {/* Search Results Dropdown */}
              {showSearchResults && (
                <div className="search-results">
                  {searchLoading ? (
                    <div className="search-loading">Searching...</div>
                  ) : searchResults.length > 0 ? (
                    <>
                      <div className="search-results-header">
                        Search Results ({searchResults.length})
                      </div>
                      {searchResults.map((result, index) => (
                        <div 
                          key={`${result.type}-${result.id}-${index}`}
                          className="search-result-item"
                          onClick={() => handleSearchResultClick(result)}
                        >
                          <div className="search-result-type">{result.type}</div>
                          <div className="search-result-title">{result.title}</div>
                          <div className="search-result-subtitle">{result.subtitle}</div>
                          {result.description && (
                            <div className="search-result-description">{result.description}</div>
                          )}
                        </div>
                      ))}
                    </>
                  ) : searchQuery ? (
                    <div className="search-no-results">
                      No results found for "{searchQuery}"
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
          <button 
            className="hamburger" 
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </header>

      {/* Mobile Search */}
      <div className="mobile-search">
        <div className="search-container">
          <input type="text" className="search-input" placeholder="Search..." />
          <span className="search-icon">🔍</span>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className={`navigation ${navOpen ? 'open' : ''}`}>
        <div className="navigation-header">
          <div className="nav-header-top">
            <h2>Menu</h2>
            <button 
              className="close-button" 
              onClick={() => setNavOpen(false)}
              aria-label="Close menu"
            >
              &times;
            </button>
          </div>
          
          {/* Auth Buttons */}
          {isAuthenticated ? (
            <div className="auth-buttons">
              <Link to="/account" className="auth-button sign-in">Account Settings</Link>
              <button 
                onClick={() => {
                  localStorage.removeItem('token');
                  window.location.href = '/';
                }} 
                className="auth-button sign-up"
              >
                Log Out
              </button>
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="auth-button sign-in">Sign In</Link>
              <Link to="/signup" className="auth-button sign-up">Sign Up</Link>
            </div>
          )}
        </div>
        
        <div className="nav-links">
          {/* Game Rules */}
          <div className="nav-category">
            <button 
              className="nav-category-button" 
              onClick={() => toggleSection('gameRules')}
            >
              <span>Game Rules (SRD)</span>
              <span>{expandedSections.gameRules ? '−' : '+'}</span>
            </button>
            
            <div className={`nav-subcategories ${expandedSections.gameRules ? 'open' : ''}`}>
              <div className="nav-subcategory">
                <Link to="/rules/basics" className="nav-link">The Basics</Link>
              </div>
              <div className="nav-subcategory">
                <Link to="/rules/characters" className="nav-link">The Characters</Link>
              </div>
              <div className="nav-subcategory">
                <Link to="/rules/crew" className="nav-link">The Crew</Link>
              </div>
              <div className="nav-subcategory">
                <Link to="/rules/score" className="nav-link">The Score</Link>
                <div className="sub-subcategories">
                  <Link to="/rules/planning" className="nav-link">Planning & Engagement</Link>
                  <Link to="/rules/teamwork" className="nav-link">Teamwork</Link>
                </div>
              </div>
              <div className="nav-subcategory">
                <Link to="/rules/downtime" className="nav-link">Downtime</Link>
              </div>
            </div>
          </div>
          
          {/* Collections */}
          <div className="nav-category">
            <button 
              className="nav-category-button" 
              onClick={() => toggleSection('collections')}
            >
              <span>Collections</span>
              <span>{expandedSections.collections ? '−' : '+'}</span>
            </button>
            
            <div className={`nav-subcategories ${expandedSections.collections ? 'open' : ''}`}>
              <div className="nav-subcategory">
                <Link to="/characters" className="nav-link">My Characters</Link>
              </div>
              <div className="nav-subcategory">
                <Link to="/campaigns" className="nav-link">My Campaigns</Link>
              </div>
              <div className="nav-subcategory">
                <Link to="/collections" className="nav-link">My Creations</Link>
              </div>
            </div>
          </div>
          
          {/* Other Links */}
          <Link to="/collections" className="nav-link">Sources</Link>
          <Link to="/rules" className="nav-link">Game Rules</Link>
          <Link to="/learn" className="nav-link">Learn to Play</Link>
          <Link to="/create-character" className="nav-link">Create a Character</Link>
          <Link to="/resources" className="nav-link">Resources</Link>
        </div>
      </nav>

      {/* Overlay */}
      <div 
        className={`overlay ${navOpen ? 'open' : ''}`} 
        onClick={() => setNavOpen(false)}
      />
    </>
  );
};

export default Header;
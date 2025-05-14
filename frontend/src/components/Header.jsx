// src/components/Header.jsx
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/Header.css';

const Header = ({ isAuthenticated }) => {
  const [navOpen, setNavOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    gameRules: false,
    collections: false,
  });
  const location = useLocation();
  
  // Close navigation when route changes
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);
  
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
          <div className="search-container desktop-search">
            <input type="text" className="search-input" placeholder="Search..." />
            <span className="search-icon">🔍</span>
          </div>
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
              <Link to="/characters" className="auth-button sign-in">My Characters</Link>
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
// src/pages/Home.jsx - UPDATED
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../utils/AuthContext';
import CampaignCreator from '../components/CampaignCreator';
import '../styles/Home.css';
import '../styles/CampaignCreator.css';

export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const [showCampaignCreator, setShowCampaignCreator] = useState(false);

  const handleCreateCharacterClick = (e) => {
    if (!isAuthenticated) {
      e.preventDefault();
      localStorage.setItem('redirectAfterLogin', '/create-character');
      navigate('/login');
    }
  };

  const handleCampaignClick = (e) => {
    if (!isAuthenticated) {
      e.preventDefault();
      localStorage.setItem('redirectAfterLogin', '/campaigns');
      navigate('/login');
    }
  };

  const handleCreateCampaign = () => {
    setShowCampaignCreator(true);
  };

  const handleCloseCampaignCreator = () => {
    setShowCampaignCreator(false);
  };

  const handleCampaignCreated = (newCampaign) => {
    console.log('New campaign created:', newCampaign);
    // Optionally redirect to the campaigns page or show a success message
    navigate('/campaigns');
  };

  return (
    <Layout>
      <div className="home-content">
        <div className="home-hero">
          <h1 className="hero-title">1(800)BIZARRE</h1>
          <p className="hero-description">
            A tabletop RPG about stylish weirdos, personal powers, and missions that never go according to plan. 
            We play to find out whether they can hold it together when everything—and everyone—starts to fall apart.
          </p>
        </div>
        
        <div className="card-grid">
          {/* Use proper conditional rendering instead of click handlers */}
          {isAuthenticated ? (
            <Link to="/create-character" className="card">
              <h2>Create a Character</h2>
              <p>Start your next JoJo-style adventure with a custom-built PC.</p>
            </Link>
          ) : (
            <div 
              onClick={handleCreateCharacterClick}
              className="card cursor-pointer"
            >
              <h2>Create a Character</h2>
              <p>Start your next JoJo-style adventure with a custom-built PC.</p>
            </div>
          )}
          
          {isAuthenticated ? (
            <Link to="/campaigns" className="card">
              <h2>Campaign Dashboard</h2>
              <p>Manage your games, track NPCs, control the narrative, and create engaging stories for your players as a Game Master.</p>
            </Link>
          ) : (
            <div 
              onClick={handleCampaignClick}
              className="card cursor-pointer"
            >
              <h2>Campaign Dashboard</h2>
              <p>Manage your games, track NPCs, control the narrative, and create engaging stories for your players as a Game Master.</p>
            </div>
          )}

          {/* Campaign Creation Card - Only show for authenticated users */}
          {isAuthenticated && (
            <div 
              onClick={handleCreateCampaign}
              className="card cursor-pointer campaign-creator-card"
            >
              <h2>+ Create Campaign</h2>
              <p>Start a new campaign and invite players to join your next adventure.</p>
            </div>
          )}
          
        </div>
      </div>

      {/* Campaign Creator Modal */}
      {showCampaignCreator && (
        <CampaignCreator
          onClose={handleCloseCampaignCreator}
          onCampaignCreated={handleCampaignCreated}
        />
      )}
    </Layout>
  );
}
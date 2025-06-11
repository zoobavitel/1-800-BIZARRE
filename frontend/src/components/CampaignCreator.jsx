import React, { useState } from 'react';
import api from '../api/axios';

const CampaignCreator = ({ onClose, onCampaignCreated }) => {
  const [campaignData, setCampaignData] = useState({
    name: '',
    description: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/campaigns/', {
        name: campaignData.name,
        description: campaignData.description,
        gm: null, // Will be set by the backend to the current user
        players: [] // Empty initially
      });

      if (onCampaignCreated) {
        onCampaignCreated(response.data);
      }
      
      // Reset form
      setCampaignData({ name: '', description: '' });
      
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error('Campaign creation error:', err);
      setError(
        err.response?.data?.message || 
        err.response?.data?.error || 
        'Failed to create campaign. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    setCampaignData({
      ...campaignData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="campaign-creator-overlay">
      <div className="campaign-creator-modal">
        <div className="campaign-creator-header">
          <h2>Create New Campaign</h2>
          <button 
            onClick={onClose}
            className="close-button"
            type="button"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="campaign-creator-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="name">Campaign Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={campaignData.name}
              onChange={handleChange}
              required
              placeholder="Enter campaign name..."
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={campaignData.description}
              onChange={handleChange}
              placeholder="Describe your campaign..."
              rows="4"
              disabled={isLoading}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              className="cancel-button"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="create-button"
              disabled={isLoading || !campaignData.name.trim()}
            >
              {isLoading ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CampaignCreator;

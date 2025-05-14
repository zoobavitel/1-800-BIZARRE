import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CharacterSheetAscii from '../components/CharacterSheetAscii';
import api from '../api/axios';

const CharacterSheetPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');

  // Load character data
  useEffect(() => {
    const loadCharacter = async () => {
      try {
        setLoading(true);
        if (id) {
          const response = await api.get(`/characters/${id}/`);
          setCharacter(response.data);
        }
        setError(null);
      } catch (err) {
        console.error('Error loading character:', err);
        setError('Failed to load character data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadCharacter();
  }, [id]);

  // Handle character updates
  const handleCharacterUpdate = async (updatedData) => {
    // Don't save while still loading
    if (loading) return;
    
    // Update local state immediately for responsive UI
    setCharacter(updatedData);
    
    // Debounced save - only save after 1 second of inactivity
    setSaveStatus('Saving...');
    
    try {
      if (id) {
        await api.patch(`/characters/${id}/`, updatedData);
        setSaveStatus('Saved');
        
        // Clear save status after a few seconds
        setTimeout(() => {
          setSaveStatus('');
        }, 2000);
      }
    } catch (err) {
      console.error('Error saving character:', err);
      setSaveStatus('Error saving!');
    }
  };

  // Handle character creation
  const handleCreateCharacter = async (characterData) => {
    try {
      setSaveStatus('Creating character...');
      const response = await api.post('/characters/', characterData);
      
      // Navigate to the new character's page
      navigate(`/characters/${response.data.id}`);
    } catch (err) {
      console.error('Error creating character:', err);
      setSaveStatus('Error creating character!');
    }
  };

  // Handle print button
  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto mt-10 p-4 bg-red-50 border border-red-200 rounded text-center">
        <p className="text-red-700">{error}</p>
        <button 
          onClick={() => navigate('/characters')}
          className="mt-4 px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
        >
          Back to Characters
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {id ? 'Edit Character Sheet' : 'Create New Character'}
        </h1>
        
        <div className="flex items-center gap-4">
          {saveStatus && (
            <span className={`text-sm ${
              saveStatus.includes('Error') 
                ? 'text-red-600' 
                : saveStatus === 'Saved' 
                  ? 'text-green-600' 
                  : 'text-gray-600'
            }`}>
              {saveStatus}
            </span>
          )}
          
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Print Sheet
          </button>
          
          <button
            onClick={() => navigate('/characters')}
            className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
          >
            Back to Characters
          </button>
        </div>
      </div>
      
      <CharacterSheetAscii 
        character={character} 
        onUpdate={id ? handleCharacterUpdate : handleCreateCharacter}
      />
    </div>
  );
};

export default CharacterSheetPage;
import { useState, useEffect } from 'react';
import { referenceAPI } from '../services/api';

export const useReferenceData = () => {
  const [heritages, setHeritages] = useState([]);
  const [vices, setVices] = useState([]);
  const [abilities, setAbilities] = useState([]);
  const [hamonAbilities, setHamonAbilities] = useState([]);
  const [spinAbilities, setSpinAbilities] = useState([]);
  const [traumas, setTraumas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadReferenceData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load all reference data in parallel
      const [
        heritagesData,
        vicesData,
        abilitiesData,
        hamonAbilitiesData,
        spinAbilitiesData,
        traumasData
      ] = await Promise.all([
        referenceAPI.getHeritages(),
        referenceAPI.getVices(),
        referenceAPI.getAbilities(),
        referenceAPI.getHamonAbilities(),
        referenceAPI.getSpinAbilities(),
        referenceAPI.getTraumas()
      ]);

      setHeritages(heritagesData);
      setVices(vicesData);
      setAbilities(abilitiesData);
      setHamonAbilities(hamonAbilitiesData);
      setSpinAbilities(spinAbilitiesData);
      setTraumas(traumasData);

    } catch (err) {
      setError(err.message);
      console.error('Failed to load reference data:', err);
      
      // Set fallback data if backend fails
      setHeritages([
        { id: 1, name: 'Human', base_hp: 0, description: 'Standard human heritage' }
      ]);
      setVices([
        { id: 1, name: 'Gambling', description: 'Risk-taking and chance' },
        { id: 2, name: 'Violence', description: 'Physical conflict and aggression' }
      ]);
      setAbilities([
        { id: 1, name: 'Iron Will', description: 'Resist mental effects', type: 'standard' },
        { id: 2, name: 'Shadow', description: 'Hide in darkness', type: 'standard' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getAvailablePlaybookAbilities = async (playbook, coinStats) => {
    try {
      const abilities = await referenceAPI.getAvailablePlaybookAbilities(playbook, coinStats);
      return abilities;
    } catch (err) {
      console.error('Failed to get available playbook abilities:', err);
      return [];
    }
  };

  // Load reference data on mount
  useEffect(() => {
    loadReferenceData();
  }, []);

  return {
    heritages,
    vices,
    abilities,
    hamonAbilities,
    spinAbilities,
    traumas,
    loading,
    error,
    loadReferenceData,
    getAvailablePlaybookAbilities
  };
}; 
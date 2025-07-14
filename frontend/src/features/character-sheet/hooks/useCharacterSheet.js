import { useState, useEffect } from 'react';
import { createDefaultCharacter } from '../utils/characterUtils';
import { characterAPI, transformBackendToFrontend, transformFrontendToBackend } from '../services/api';

export const useCharacterSheet = (characterId, onSave) => {
  const [characterData, setCharacterData] = useState(createDefaultCharacter());
  const [stressBoxes, setStressBoxes] = useState(Array(9).fill(false));
  const [traumaChecks, setTraumaChecks] = useState({
    COLD: false, HAUNTED: false, OBSESSED: false, PARANOID: false,
    RECKLESS: false, SOFT: false, UNSTABLE: false, VICIOUS: false
  });
  const [armorUses, setArmorUses] = useState({ armor: false, heavy: false, special: false });
  const [harmEntries, setHarmEntries] = useState({
    level3: [''],
    level2: ['', ''],
    level1: ['', '']
  });
  const [coinBoxes, setCoinBoxes] = useState(Array(4).fill(false));
  const [stashBoxes, setStashBoxes] = useState(Array(40).fill(false));
  const [healingClock, setHealingClock] = useState(0);
  const [actionRatings, setActionRatings] = useState({
    HUNT: 0, STUDY: 0, SURVEY: 0, TINKER: 0,
    FINESSE: 0, PROWL: 0, SKIRMISH: 0, WRECK: 0,
    BIZARRE: 0, COMMAND: 0, CONSORT: 0, SWAY: 0
  });
  const [standStats, setStandStats] = useState({
    power: 1, speed: 1, range: 1, durability: 1, precision: 1, development: 1
  });
  const [xpTracks, setXpTracks] = useState({
    insight: 0, prowess: 0, resolve: 0, heritage: 0, playbook: 0
  });
  const [selectedAbilities, setSelectedAbilities] = useState([]);
  const [customClocks, setCustomClocks] = useState([]);
  
  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Load character from backend
  const loadCharacter = async (id) => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const backendCharacter = await characterAPI.getCharacter(id);
      const frontendCharacter = transformBackendToFrontend(backendCharacter);
      
      // Update all state with backend data
      setCharacterData({
        name: frontendCharacter.name,
        standName: frontendCharacter.standName,
        heritage: frontendCharacter.heritage,
        background: frontendCharacter.background,
        look: frontendCharacter.look,
        vice: frontendCharacter.vice,
        crew: frontendCharacter.crew
      });
      
      setStressBoxes(frontendCharacter.stress);
      setTraumaChecks(frontendCharacter.trauma);
      setArmorUses(frontendCharacter.armor);
      setHarmEntries(frontendCharacter.harmEntries);
      setCoinBoxes(frontendCharacter.coin);
      setStashBoxes(frontendCharacter.stash);
      setHealingClock(frontendCharacter.healingClock);
      setActionRatings(frontendCharacter.actionRatings);
      setStandStats(frontendCharacter.standStats);
      setXpTracks(frontendCharacter.xp);
      setSelectedAbilities(frontendCharacter.abilities);
      setCustomClocks(frontendCharacter.clocks);
      
    } catch (err) {
      setError(err.message);
      console.error('Failed to load character:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load character when characterId changes
  useEffect(() => {
    if (characterId) {
      loadCharacter(characterId);
    } else {
      // Reset to default values for new character
      const defaultChar = createDefaultCharacter();
      setCharacterData(defaultChar);
      setStressBoxes(defaultChar.stress);
      setTraumaChecks(defaultChar.trauma);
      setArmorUses(defaultChar.armor);
      setHarmEntries(defaultChar.harmEntries);
      setCoinBoxes(defaultChar.coin);
      setStashBoxes(defaultChar.stash);
      setHealingClock(defaultChar.healingClock);
      setActionRatings(defaultChar.actionRatings);
      setStandStats(defaultChar.standStats);
      setXpTracks(defaultChar.xp);
      setSelectedAbilities(defaultChar.abilities);
      setCustomClocks(defaultChar.clocks);
    }
  }, [characterId]);

  // Save character to backend
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    
    try {
      const frontendCharacter = {
        ...characterData,
        actionRatings,
        standStats,
        stress: stressBoxes,
        trauma: traumaChecks,
        armor: armorUses,
        harmEntries,
        coin: coinBoxes,
        stash: stashBoxes,
        healingClock,
        xp: xpTracks,
        abilities: selectedAbilities,
        clocks: customClocks,
        id: characterId,
        lastModified: new Date().toISOString()
      };
      
      const backendCharacter = transformFrontendToBackend(frontendCharacter);
      
      if (characterId) {
        // Update existing character
        await characterAPI.updateCharacter(characterId, backendCharacter);
      } else {
        // Create new character
        const newCharacter = await characterAPI.createCharacter(backendCharacter);
        // Update the characterId so future saves will update instead of create
        if (onSave) {
          onSave(newCharacter);
        }
      }
      
      if (onSave) {
        onSave(frontendCharacter);
      }
      
    } catch (err) {
      setError(err.message);
      console.error('Failed to save character:', err);
    } finally {
      setSaving(false);
    }
  };

  // Roll action dice
  const rollAction = async (actionName, diceCount, isResistanceRoll = false, isDesperateAction = false) => {
    if (!characterId) {
      console.warn('Cannot roll dice without a character ID');
      return null;
    }
    
    try {
      const result = await characterAPI.rollAction(characterId, {
        action: actionName,
        dice_count: diceCount,
        is_resistance_roll: isResistanceRoll,
        is_desperate_action: isDesperateAction
      });
      
      // Reload character to get updated state
      await loadCharacter(characterId);
      
      return result;
    } catch (err) {
      setError(err.message);
      console.error('Failed to roll action:', err);
      return null;
    }
  };

  // Add XP
  const addXP = async (xpType, amount, reason = '') => {
    if (!characterId) {
      console.warn('Cannot add XP without a character ID');
      return false;
    }
    
    try {
      await characterAPI.addXP(characterId, {
        xp_type: xpType,
        amount: amount,
        reason: reason
      });
      
      // Reload character to get updated state
      await loadCharacter(characterId);
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Failed to add XP:', err);
      return false;
    }
  };

  // Take harm
  const takeHarm = async (harmLevel, harmName, stressCost = 0) => {
    if (!characterId) {
      console.warn('Cannot take harm without a character ID');
      return false;
    }
    
    try {
      await characterAPI.takeHarm(characterId, {
        harm_level: harmLevel,
        harm_name: harmName,
        stress_cost: stressCost
      });
      
      // Reload character to get updated state
      await loadCharacter(characterId);
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Failed to take harm:', err);
      return false;
    }
  };

  // Heal harm
  const healHarm = async (harmLevel, healingMethod = 'recovery') => {
    if (!characterId) {
      console.warn('Cannot heal harm without a character ID');
      return false;
    }
    
    try {
      await characterAPI.healHarm(characterId, {
        harm_level: harmLevel,
        healing_method: healingMethod
      });
      
      // Reload character to get updated state
      await loadCharacter(characterId);
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Failed to heal harm:', err);
      return false;
    }
  };

  // Indulge vice
  const indulgeVice = async (viceName, stressRelieved) => {
    if (!characterId) {
      console.warn('Cannot indulge vice without a character ID');
      return false;
    }
    
    try {
      await characterAPI.indulgeVice(characterId, {
        vice_name: viceName,
        stress_relieved: stressRelieved
      });
      
      // Reload character to get updated state
      await loadCharacter(characterId);
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Failed to indulge vice:', err);
      return false;
    }
  };

  // Log armor expenditure
  const logArmorExpenditure = async (armorType) => {
    if (!characterId) {
      console.warn('Cannot log armor expenditure without a character ID');
      return false;
    }
    
    try {
      await characterAPI.logArmorExpenditure(characterId, {
        armor_type: armorType
      });
      
      // Reload character to get updated state
      await loadCharacter(characterId);
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Failed to log armor expenditure:', err);
      return false;
    }
  };

  // Add progress clock
  const addProgressClock = async (clockData) => {
    if (!characterId) {
      console.warn('Cannot add progress clock without a character ID');
      return false;
    }
    
    try {
      await characterAPI.addProgressClock(characterId, clockData);
      
      // Reload character to get updated state
      await loadCharacter(characterId);
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Failed to add progress clock:', err);
      return false;
    }
  };

  // Update progress clock
  const updateProgressClock = async (clockId, newFilled) => {
    if (!characterId) {
      console.warn('Cannot update progress clock without a character ID');
      return false;
    }
    
    try {
      await characterAPI.updateProgressClock(characterId, {
        clock_id: clockId,
        filled_segments: newFilled
      });
      
      // Reload character to get updated state
      await loadCharacter(characterId);
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Failed to update progress clock:', err);
      return false;
    }
  };

  return {
    // State
    characterData,
    setCharacterData,
    stressBoxes,
    setStressBoxes,
    traumaChecks,
    setTraumaChecks,
    armorUses,
    setArmorUses,
    harmEntries,
    setHarmEntries,
    coinBoxes,
    setCoinBoxes,
    stashBoxes,
    setStashBoxes,
    healingClock,
    setHealingClock,
    actionRatings,
    setActionRatings,
    standStats,
    setStandStats,
    xpTracks,
    setXpTracks,
    selectedAbilities,
    setSelectedAbilities,
    customClocks,
    setCustomClocks,
    
    // Loading states
    loading,
    saving,
    error,
    
    // Actions
    handleSave,
    rollAction,
    addXP,
    takeHarm,
    healHarm,
    indulgeVice,
    logArmorExpenditure,
    addProgressClock,
    updateProgressClock,
    loadCharacter,
  };
}; 
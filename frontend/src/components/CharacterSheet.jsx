import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import Layout from './Layout';
import Clock from './Clock';
import api from '../api/axios';
import { getDefaultCharacter } from '../utils/characterValidation';

const CharacterSheet = () => {
  // State for dynamic data loading
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  // Trauma options will be fetched from backend

  // Tab management state
  const [tabs, setTabs] = useState([{
    id: 'tab-1',
    name: 'New Character',
    character: getDefaultCharacter()
  }]);

  const [activeTab, setActiveTab] = useState('tab-1');

  // Get current character
  const getCurrentCharacter = () => tabs.find(tab => tab.id === activeTab)?.character || tabs[0].character;
  const setCurrentCharacter = useCallback((newCharacterOrUpdater) => {
    setTabs(prev => prev.map(tab => {
      if (tab.id === activeTab) {
        const newCharacter = typeof newCharacterOrUpdater === 'function' 
          ? newCharacterOrUpdater(tab.character)
          : newCharacterOrUpdater;
        return { ...tab, character: newCharacter, name: newCharacter.trueName || 'New Character' };
      }
      return tab;
    }));
  }, [activeTab]);

  const character = getCurrentCharacter();

  const [gameState, setGameState] = useState({
    showDiceRoller: false,
    showHeritagePanel: false,
    showAbilitiesPanel: false,
    showAdvancementPanel: false,
    showFactionPanel: false,
    showGMPanel: false,
    activeAbilityTab: 'standard',
    position: 'risky',
    effect: 'standard',
    lastRoll: null,
    lastResistanceRoll: null,
    newFactionName: ''
  });

  const [saveStatus, setSaveStatus] = useState('');

  // Dynamic data loading states - all options loaded from API
  const [traumaOptions, setTraumaOptions] = useState([]);
  const [vices, setVices] = useState([]);
  const [heritages, setHeritages] = useState({});
  const [heritagesLoading, setHeritagesLoading] = useState(true);
  const [vicesLoading, setVicesLoading] = useState(true);
  const [standardAbilities, setStandardAbilities] = useState({});
  const [playbookAbilities, setPlaybookAbilities] = useState({});
  const [abilitiesLoading, setAbilitiesLoading] = useState(true);

  // Auto-save functionality
  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      localStorage.setItem('jojoCharacter', JSON.stringify(character));
      setSaveStatus('Auto-saved');
      setTimeout(() => setSaveStatus(''), 2000);
    }, 1000);
    return () => clearTimeout(saveTimeout);
  }, [character]);

  // Load dynamic data (campaigns, heritages, vices, abilities)
  useEffect(() => {
    const loadGameData = async () => {
      try {
        // Load campaigns
        setCampaignsLoading(true);
        const campaignsResponse = await api.get('/campaigns/');
        setCampaigns(campaignsResponse.data || []);
        
        // Load trauma options
        const traumaResponse = await api.get('/traumas/');
        const traumaData = traumaResponse.data || [];
        setTraumaOptions(traumaData);
        
        // Load heritages
        setHeritagesLoading(true);
        const heritagesResponse = await api.get('/heritages/');
        const heritageData = heritagesResponse.data || [];
        
        // Convert heritages array to object for easier lookup
        const heritagesMap = {};
        heritageData.forEach(heritage => {
          heritagesMap[heritage.name] = {
            baseHP: heritage.base_hp,
            description: heritage.description,
            requiredBenefits: heritage.benefits?.filter(b => b.required) || [],
            requiredDetriments: heritage.detriments?.filter(d => d.required) || [],
            optionalDetriments: heritage.detriments?.filter(d => !d.required) || [],
            benefits: heritage.benefits?.filter(b => !b.required) || []
          };
        });
        setHeritages(heritagesMap);
        
        // Load vices
        setVicesLoading(true);
        const vicesResponse = await api.get('/vices/');
        const viceData = vicesResponse.data || [];
        const viceNames = viceData.map(vice => vice.name);
        if (viceNames.length > 0) {
          setVices(viceNames);
        }
        
        // Load abilities
        setAbilitiesLoading(true);
        
        // Load standard abilities
        const standardAbilitiesResponse = await api.get('/abilities/');
        const standardAbilitiesData = standardAbilitiesResponse.data || [];
        const standardAbilitiesMap = {};
        standardAbilitiesData.forEach(ability => {
          standardAbilitiesMap[ability.name] = ability.description;
        });
        setStandardAbilities(standardAbilitiesMap);
        
        // Load playbook-specific abilities
        const playbookAbilitiesMap = { Stand: {}, Hamon: {}, Spin: {} };
        
        // Playbook abilities will be loaded dynamically based on A-rank coin stats
        // when the user opens the abilities panel
        
        setPlaybookAbilities(playbookAbilitiesMap);
        
      } catch (error) {
        console.error('Failed to load game data:', error);
        setCampaigns([]);
        // Minimal fallback data - user should see loading indicators if API fails
        setTraumaOptions([]);
        setVices([]);
        setHeritages({});
        setStandardAbilities({});
        setPlaybookAbilities({ Stand: {}, Hamon: {}, Spin: {} });
      } finally {
        setCampaignsLoading(false);
        setHeritagesLoading(false);
        setVicesLoading(false);
        setAbilitiesLoading(false);
      }
    };
    
    loadGameData();
  }, []);

  // Load saved character
  useEffect(() => {
    const saved = localStorage.getItem('jojoCharacter');
    if (saved && saved !== 'undefined' && saved !== 'null') {
      try {
        const parsedCharacter = JSON.parse(saved);
        // Ensure all required properties exist
        const safeCharacter = {
          ...parsedCharacter,
          harm: parsedCharacter.harm || { level3: '', level2_0: '', level2_1: '', level1_0: '', level1_1: '' },
          stress: parsedCharacter.stress || Array(12).fill(false),
          trauma: parsedCharacter.trauma || [],
          selectedDetriments: parsedCharacter.selectedDetriments || [],
          selectedBenefits: parsedCharacter.selectedBenefits || [],
          standardAbilities: parsedCharacter.standardAbilities || [],
          playbookAbilities: parsedCharacter.playbookAbilities || [],
          equipment: parsedCharacter.equipment || [],
          xp: parsedCharacter.xp || { insight: 0, prowess: 0, resolve: 0, playbook: 0 },
          coinStats: parsedCharacter.coinStats || { power: 0, speed: 0, range: 0, durability: 0, precision: 0, development: 0 },
          skills: parsedCharacter.skills || {
            insight: { hunt: 0, study: 0, survey: 0, tinker: 0 },
            prowess: { finesse: 0, prowl: 0, skirmish: 0, wreck: 0 },
            resolve: { bizarre: 0, command: 0, consort: 0, sway: 0 }
          },
          clocks: parsedCharacter.clocks || [
            { id: 'health', name: 'Health', segments: 4, filled: 4, type: 'health', isRequired: true }
          ]
        };
        setCurrentCharacter(safeCharacter);
        setSaveStatus('Character loaded');
        setTimeout(() => setSaveStatus(''), 2000);
      } catch (error) {
        console.error('Error loading character:', error);
        // Clear corrupted data
        localStorage.removeItem('jojoCharacter');
        setSaveStatus('Corrupted save data cleared');
        setTimeout(() => setSaveStatus(''), 3000);
      }
    }
  }, [setCurrentCharacter]);

  // Helper functions
  
  /**
   * Calculate attribute dice rating based on allocated skill points
   * Each category starts with 3 dice, then counts how many skills have 2+ dice allocated
   * @param {string} category - The attribute category (insight, prowess, resolve)
   * @returns {number} The total dice available for this attribute
   */
  const getAttributeRating = (category) => {
    const skills = (character.skills || {})[category] || {};
    // Count how many skills in this category have at least 1 die allocated
    const skillsWithAtLeastOneDie = Object.values(skills).filter(rating => rating >= 1).length;
    return skillsWithAtLeastOneDie; // Return the count of skills with dice allocated
  };
  
  /**
   * Convert a numeric rating to a letter grade
   * @param {number} value - The numeric rating (0-5)
   * @returns {string} The corresponding letter grade
   */
  const getGradeLetter = (value) => ({ 0: 'F', 1: 'D', 2: 'C', 3: 'B', 4: 'A', 5: 'S' }[value] || 'F');
  
  /**
   * Calculate total coin points used across all coin stats
   * @returns {number} Total coin points spent
   */
  const coinPointsUsed = Object.values(character.coinStats || {}).reduce((a, b) => a + b, 0);
  
  /**
   * Calculate total skill points used across all skills
   * @returns {number} Total skill points spent
   */
  const skillPointsUsed = Object.values(character.skills || {}).flatMap(category => Object.values(category || {})).reduce((a, b) => a + b, 0);
  
  /**
   * Calculate maximum stress based on durability coin stat
   * @returns {number} Maximum stress capacity
   */
  const maxStress = 9 + ((character.coinStats || {}).durability || 0);
  
  /**
   * Calculate total XP across all tracks
   * @returns {number} Total experience points
   */
  const getTotalXP = () => Object.values(character.xp || {}).reduce((a, b) => a + b, 0);

  /**
   * Calculate total heritage HP including base HP and detriment bonuses
   * @returns {number} Total heritage HP available
   */
  const getHeritageHP = () => {
    const heritage = heritages[character.heritage];
    if (!heritage) return 0;
    const requiredDetrimentHP = (heritage.requiredDetriments || []).reduce((sum, det) => sum + (det.hp || 0), 0);
    const optionalDetrimentHP = (character.selectedDetriments || []).reduce((sum, det) => sum + (det.hp || 0), 0);
    return heritage.baseHP + requiredDetrimentHP + optionalDetrimentHP + (character.heritageHP || 0);
  };

  /**
   * Calculate heritage HP spent on benefits
   * @returns {number} Heritage HP used for benefits
   */
  const getUsedHeritageHP = () => (character.selectedBenefits || []).reduce((sum, benefit) => sum + (benefit.cost || 0), 0);

  // Clock management functions
  
  /**
   * Add a new clock to the character
   * @param {string} name - Name of the clock
   * @param {string} type - Type of clock (custom, project, wanted, health)
   * @param {number} segments - Number of segments in the clock (4, 6, 8)
   */
  const addClock = (name, type = 'custom', segments = 4) => {
    const newClock = {
      id: `clock-${Date.now()}`,
      name,
      segments,
      filled: 0,
      type,
      isRequired: false
    };
    
    setCurrentCharacter(prev => ({
      ...prev,
      clocks: [...(prev.clocks || []), newClock]
    }));
  };

  /**
   * Update an existing clock with new properties
   * @param {string} clockId - ID of the clock to update
   * @param {Object} updates - Object containing properties to update
   */
  const updateClock = (clockId, updates) => {
    setCurrentCharacter(prev => ({
      ...prev,
      clocks: (prev.clocks || []).map(clock => 
        clock.id === clockId ? { ...clock, ...updates } : clock
      )
    }));
  };

  /**
   * Delete a clock (cannot delete required clocks like health)
   * @param {string} clockId - ID of the clock to delete
   */
  const deleteClock = (clockId) => {
    setCurrentCharacter(prev => ({
      ...prev,
      clocks: (prev.clocks || []).filter(clock => clock.id !== clockId && !clock.isRequired)
    }));
  };

  // Advancement Functions
  
  /**
   * Check if character has enough XP to advance a skill (5 XP required)
   * @returns {boolean} True if character can advance
   */
  const canAdvance5XP = () => getTotalXP() >= 5;
  
  /**
   * Check if character has enough playbook XP to advance coin stats (10 XP required)
   * @returns {boolean} True if character can advance
   */
  const canAdvancePlaybook = () => (character.xp || {}).playbook >= 10;

  /**
   * Spend 5 XP from attribute tracks to improve a skill by 1 dot
   * @param {string} category - The attribute category (insight, prowess, resolve)
   * @param {string} skill - The specific skill to improve
   */
  /**
   * Spend XP to improve a skill, properly resetting complete XP tracks
   * @param {string} category - The skill category
   * @param {string} skill - The specific skill 
   */
  const spendXPForSkill = (category, skill) => {
    if (!canAdvance5XP()) return;
    
    const currentValue = ((character.skills || {})[category] || {})[skill] || 0;
    if (currentValue >= 4) return;
    
    // Find which tracks to reset (those that total 5+ XP)
    const newXP = { ...character.xp };
    const tracksToReset = [];
    let remaining = 5;
    
    // Check which complete tracks can be used
    ['insight', 'prowess', 'resolve'].forEach(track => {
      if (newXP[track] >= 5 && remaining > 0) {
        tracksToReset.push(track);
        remaining -= 5;
        newXP[track] = 0; // Reset complete tracks
      }
    });
    
    // If we still need XP, partial tracks can be used
    if (remaining > 0) {
      ['insight', 'prowess', 'resolve'].forEach(track => {
        if (remaining > 0 && newXP[track] > 0) {
          const toSubtract = Math.min(remaining, newXP[track]);
          newXP[track] -= toSubtract;
          remaining -= toSubtract;
          if (newXP[track] === 0) tracksToReset.push(track);
        }
      });
    }
    
    setCurrentCharacter(prev => ({
      ...prev,
      xp: newXP,
      skills: {
        ...(prev.skills || {}),
        [category]: {
          ...((prev.skills || {})[category] || {}),
          [skill]: currentValue + 1
        }
      }
    }));
    
    setGameState(prev => ({...prev, showAdvancementPanel: false}));
    setSaveStatus(`Skill improved! Reset XP tracks: ${tracksToReset.join(', ')}`);
    setTimeout(() => setSaveStatus(''), 3000);
  };

  /**
   * Spend 10 playbook XP to improve a coin stat by 1 level
   * @param {string} stat - The coin stat to improve (power, speed, range, etc.)
   */
  const spendPlaybookXPForCoinStat = (stat) => {
    if (!canAdvancePlaybook()) return;
    
    const currentValue = (character.coinStats || {})[stat] || 0;
    if (currentValue >= 5) return; // Max coin stat
    
    // Spend 10 XP from playbook track - reset to 0 after spending
    const newXP = { ...character.xp };
    newXP.playbook = 0; // Reset to 0 after advancement
    
    setCurrentCharacter(prev => ({
      ...prev,
      xp: newXP,
      coinStats: {
        ...(prev.coinStats || {}),
        [stat]: currentValue + 1
      }
    }));
    
    setGameState(prev => ({...prev, showAdvancementPanel: false}));
    setSaveStatus('Coin stat improved! Playbook XP reset to 0.');
    setTimeout(() => setSaveStatus(''), 2000);
  };

  /**
   * Roll resistance dice and display results
   * @param {string} attribute - The attribute being used (insight, prowess, resolve)
   */
  const rollResistance = (attribute) => {
    const diceCount = getAttributeRating(attribute);
    const dice = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1);
    const highest = Math.max(...dice);
    
    let result, resultColor, stressReduction;
    if (highest === 6) {
      const sixes = dice.filter(d => d === 6).length;
      if (sixes >= 2) {
        result = 'Critical: Clear all stress or reduce harm by 2 levels';
        resultColor = '#10b981';
        stressReduction = 'all';
      } else {
        result = 'Success: Clear 1 stress or reduce harm by 1 level';
        resultColor = '#10b981'; 
        stressReduction = 1;
      }
    } else if (highest >= 4) {
      result = 'Partial: Take 1 stress to clear 1 stress or reduce harm';
      resultColor = '#fbbf24';
      stressReduction = 1;
    } else {
      result = 'Failure: Take 2 stress';
      resultColor = '#ef4444';
      stressReduction = 0;
    }
    
    setGameState(prev => ({
      ...prev,
      lastResistanceRoll: {
        attribute,
        dice,
        highest,
        result,
        resultColor,
        stressReduction,
        timestamp: Date.now()
      }
    }));
    
    // Clear after 15 seconds
    setTimeout(() => {
      setGameState(prev => {
        if (prev.lastResistanceRoll && prev.lastResistanceRoll.timestamp === Date.now()) {
          return { ...prev, lastResistanceRoll: null };
        }
        return prev;
      });
    }, 15000);
  };

  /**
   * Get coin stat bonus for rolls based on skill type
   * @param {string} skillName - The skill being rolled
   * @returns {object} Enhanced coin stat effects
   */
  const getCoinStatBonus = (skillName) => {
    const coinStats = character.coinStats || {};
    const skillLower = skillName.toLowerCase();
    
    // Map skills to coin stats
    const skillToCoinStat = {
      'finesse': 'precision',
      'prowl': 'speed', 
      'skirmish': 'power',
      'wreck': 'power',
      'hunt': 'precision',
      'study': 'development',
      'survey': 'range',
      'tinker': 'development',
      'bizarre': 'development',
      'command': 'power',
      'consort': 'development',
      'sway': 'precision'
    };
    
    const relevantStat = skillToCoinStat[skillLower];
    if (!relevantStat) return { dice: 0, effects: [] };
    
    const statValue = coinStats[relevantStat] || 0;
    const gradeLetter = getGradeLetter(statValue);
    
    // Calculate dice bonus (each point above 2 gives +1d, max +2d)
    const diceBonus = Math.min(2, Math.max(0, statValue - 2));
    
    // Enhanced effects based on stat grade
    const effects = [];
    
    switch (relevantStat) {
      case 'power':
        if (statValue >= 3) effects.push('+1 Effect on destructive actions');
        if (statValue >= 4) effects.push('+1 Harm when attacking');
        if (statValue >= 5) effects.push('Critical hits cause knockback');
        break;
        
      case 'speed':
        if (statValue >= 3) effects.push('+1 Effect on movement/escape');
        if (statValue >= 4) effects.push('Act first in combat');
        if (statValue >= 5) effects.push('Extra action on 6');
        break;
        
      case 'range':
        if (statValue >= 3) effects.push('+1 Zone reach for abilities');
        if (statValue >= 4) effects.push('Ignore range penalties');
        if (statValue >= 5) effects.push('Affect multiple zones');
        break;
        
      case 'durability':
        if (statValue >= 3) effects.push('+1 Resistance to consequences');
        if (statValue >= 4) effects.push('Reduce harm by 1 level');
        if (statValue >= 5) effects.push('Ignore first harm per scene');
        break;
        
      case 'precision':
        if (statValue >= 3) effects.push('+1 Effect on targeted actions');
        if (statValue >= 4) effects.push('Crits on 5-6 instead of just 6');
        if (statValue >= 5) effects.push('Ignore armor/cover penalties');
        break;
        
      case 'development':
        if (statValue >= 3) effects.push('+1 Effect on complex actions');
        if (statValue >= 4) effects.push('Partial success counts as success');
        if (statValue >= 5) effects.push('Learn enemy weaknesses on Study');
        break;
      default:
        // No effects for unknown stat types
        break;
    }
    
    return { 
      dice: diceBonus, 
      effects, 
      grade: gradeLetter,
      statName: relevantStat 
    };
  };

  /**
   * Get clock color based on clock type
   * @param {string} clockType - The type of clock
   * @returns {string} Color hex code
   */
  const getClockColor = (clockType) => {
    switch (clockType) {
      case 'healing': return '#ef4444'; // Red
      case 'health': return '#ef4444'; // Red (legacy support)
      case 'project': return '#3b82f6'; // Blue  
      case 'wanted': return '#fbbf24'; // Yellow
      case 'custom': return '#8b5cf6'; // Purple
      default: return '#10b981';
    }
  };

  // Trauma toggle function
  const toggleTrauma = (condition) => {
    setCurrentCharacter(prev => {
      const current = prev.trauma || [];
      const updated = current.includes(condition)
        ? current.filter(t => t !== condition)
        : [...current, condition];
      return { ...prev, trauma: updated };
    });
  };

  // Add state for trauma selection prompt
  const [traumaSelection, setTraumaSelection] = useState({ show: false, forced: false });

  /**
   * Handle coin stat changes and update character state
   * @param {string} stat - The coin stat to change (power, speed, etc.)
   * @param {number} newValue - The new value for the stat
   */
  const handleCoinStatChange = (stat, newValue) => {
    const currentValue = (character.coinStats || {})[stat] || 0;
    const currentTotal = Object.values(character.coinStats || {}).reduce((a, b) => a + b, 0);
    const newTotal = currentTotal - currentValue + newValue;
    
    // Check if we have enough coin points (max 10)
    if (newTotal > 10) {
      alert('Maximum 10 coin points can be allocated');
      return;
    }
    
    setCurrentCharacter(prev => ({
      ...prev,
      coinStats: {
        ...(prev.coinStats || {}),
        [stat]: newValue
      }
    }));
  };

  /**
   * Roll dice and display results in the header
   * @param {number} diceCount - Number of dice to roll
   * @param {string} skillName - Name of the skill being rolled
   * @param {string} note - Optional note about the roll
   */
  const rollDice = (diceCount, skillName, note = '') => {
    // Apply coin stat bonuses based on skill type
    const coinStatBonus = getCoinStatBonus(skillName);
    let finalDiceCount = Math.max(1, diceCount + coinStatBonus.dice);
    
    if (finalDiceCount <= 0) finalDiceCount = 2; // Desperate roll
    
    const dice = Array.from({ length: finalDiceCount }, () => Math.floor(Math.random() * 6) + 1);
    const highest = Math.max(...dice);
    
    let result, resultColor;
    if (highest === 6) {
      const sixes = dice.filter(d => d === 6).length;
      if (sixes >= 2) {
        result = 'Critical Success!';
        resultColor = '#10b981';
      } else {
        result = 'Full Success';
        resultColor = '#10b981';
      }
    } else if (highest >= 4) {
      result = 'Partial Success';
      resultColor = '#fbbf24';
    } else {
      result = 'Bad Outcome';
      resultColor = '#ef4444';
    }
    
    // Build enhanced note with coin stat effects
    let enhancedNote = note || '';
    if (coinStatBonus.dice > 0) {
      enhancedNote += (enhancedNote ? ' | ' : '') + `+${coinStatBonus.dice}d from ${coinStatBonus.statName} (${coinStatBonus.grade})`;
    }
    if (coinStatBonus.effects.length > 0) {
      enhancedNote += (enhancedNote ? ' | ' : '') + coinStatBonus.effects.join(', ');
    }
    
    const rollResult = {
      skill: skillName,
      dice,
      highest,
      result,
      resultColor,
      coinStatBonus: coinStatBonus.dice,
      coinStatEffects: coinStatBonus.effects,
      note: enhancedNote,
      timestamp: Date.now()
    };
    
    setGameState(prev => ({ ...prev, lastRoll: rollResult }));
    
    // Auto-show dice roller if it's hidden to display the result
    if (!gameState.showDiceRoller) {
      setGameState(prev => ({ ...prev, showDiceRoller: true }));
    }
    
    // Clear the roll result after 10 seconds to keep UI clean
    setTimeout(() => {
      setGameState(prev => {
        if (prev.lastRoll && prev.lastRoll.timestamp === rollResult.timestamp) {
          return { ...prev, lastRoll: null };
        }
        return prev;
      });
    }, 10000);
  };

  /**
   * Handle skill level changes when clicking skill dots
   * @param {string} category - The skill category (insight, prowess, resolve)
   * @param {string} skill - The specific skill name
   * @param {number} newValue - The new skill level
   */
  const handleSkillChange = (category, skill, newValue) => {
    const currentValue = ((character.skills || {})[category] || {})[skill] || 0;

    // Calculate skill points before and after the change
    const skillsBefore = Object.values(character.skills || {}).flatMap(cat => Object.values(cat || {})).reduce((a, b) => a + b, 0);
    const skillsAfter = skillsBefore - currentValue + newValue;

    // Check if we have enough skill points (max 7)
    if (skillsAfter > 7) {
      alert('Maximum 7 skill points can be allocated');
      return;
    }

    setCurrentCharacter(prev => {
      const updatedSkills = {
        ...(prev.skills || {}),
        [category]: {
          ...((prev.skills || {})[category] || {}),
          [skill]: newValue
        }
      };

      return {
        ...prev,
        skills: updatedSkills
      };
    });
  };

  /**
   * Export character data as JSON file
   */
  const exportCharacter = () => {
    const dataStr = JSON.stringify(character, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `${character.trueName || 'character'}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    setSaveStatus('Character exported!');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  /**
   * Import character data from JSON file
   * @param {Event} event - File input change event
   */
  const importCharacter = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          setCurrentCharacter(imported);
          setSaveStatus('Character imported!');
          setTimeout(() => setSaveStatus(''), 3000);
        } catch (error) {
          setSaveStatus('Import failed');
          setTimeout(() => setSaveStatus(''), 3000);
        }
      };
      reader.readAsText(file);
    }
  };

  // Tab management functions
  
  /**
   * Add a new character tab
   */
  const addNewTab = () => {
    const newId = `tab-${Date.now()}`;
    const newTab = {
      id: newId,
      name: 'New Character',
      character: getDefaultCharacter()
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTab(newId);
  };

  /**
   * Close a character tab
   * @param {string} tabId - ID of the tab to close
   */
  const closeTab = (tabId) => {
    if (tabs.length === 1) return; // Don't close the last tab
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);
    if (activeTab === tabId) {
      setActiveTab(newTabs[0].id);
    }
  };

  // Component definitions
  
  /**
   * Reusable checkbox group component for tracking progress
   * @param {number} count - Number of checkboxes
   * @param {number} filled - Number of filled checkboxes
   * @param {function} onChange - Callback when checkbox is clicked
   * @param {string} size - Size variant ('small' or 'large')
   */
  const CheckboxGroup = ({ count, filled = 0, onChange, size = 'small' }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      {Array.from({ length: count }, (_, i) => (
        <div 
          key={i}
          onClick={() => onChange && onChange(i < filled ? i : i + 1)}
          style={{
            width: size === 'large' ? '16px' : '12px',
            height: size === 'large' ? '16px' : '12px',
            border: '1px solid #10b981',
            backgroundColor: i < filled ? '#10b981' : 'transparent',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        />
      ))}
    </div>
  );

  /**
   * Star group component for wanted levels
   * @param {number} count - Number of stars
   * @param {number} filled - Number of filled stars
   * @param {function} onChange - Callback when star is clicked
   * @param {boolean} disabled - Whether interaction is disabled
   */
  const StarGroup = ({ count, filled = 0, onChange, disabled = false }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          onClick={() => !disabled && onChange && onChange(i < filled ? i : i + 1)}
          style={{
            fontSize: '16px',
            color: i < filled ? '#fbbf24' : '#374151',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'color 0.2s',
            userSelect: 'none'
          }}
        >
          {i < filled ? '★' : '☆'}
        </span>
      ))}
    </div>
  );

  const SkillDots = ({ category, skill, value, max = 4 }) => {
    const isLastRolled = gameState.lastRoll && gameState.lastRoll.skill === skill;
    const coinBonus = getCoinStatBonus(skill);
    
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '4px 0', 
        borderBottom: '1px solid #374151',
        backgroundColor: isLastRolled ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
        transition: 'background-color 0.3s'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', width: '60px' }}>{skill}</span>
          <button
            onClick={() => {
              const button = document.activeElement;
              button.style.transform = 'scale(0.95)';
              setTimeout(() => {
                button.style.transform = 'scale(1)';
              }, 100);
              rollDice(Math.max(value, 0), skill);
            }}
            style={{
              fontSize: '9px',
              backgroundColor: value === 0 ? '#ef4444' : isLastRolled ? '#fbbf24' : '#10b981',
              color: '#000',
              padding: '2px 6px',
              border: 'none',
              cursor: 'pointer',
              opacity: 0.7,
              transition: 'opacity 0.2s, background-color 0.3s, transform 0.1s'
            }}
            onMouseOver={(e) => e.target.style.opacity = 1}
            onMouseOut={(e) => e.target.style.opacity = 0.7}
            title={coinBonus.effects.length > 0 ? `Coin effects: ${coinBonus.effects.join(', ')}` : ''}
          >
            {value === 0 ? '2d⬇' : `${value}d`}
            {coinBonus.dice > 0 && <span style={{ fontSize: '7px', color: '#fbbf24' }}>+{coinBonus.dice}</span>}
          </button>
          {isLastRolled && (
            <div style={{ 
              fontSize: '8px', 
              color: gameState.lastRoll.resultColor, 
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              [{gameState.lastRoll.dice.join(', ')}] → {gameState.lastRoll.result}
              {gameState.lastRoll.coinStatEffects && gameState.lastRoll.coinStatEffects.length > 0 && (
                <div style={{ fontSize: '7px', color: '#fbbf24', marginLeft: '4px' }}>
                  {gameState.lastRoll.coinStatEffects.slice(0, 1).join('')}
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '2px' }}>
          {Array.from({ length: max }, (_, i) => (
            <div
              key={i}
              onClick={() => handleSkillChange(category, skill, i + 1 === value ? 0 : i + 1)}
              style={{
                width: '12px',
                height: '12px',
                border: '1px solid #10b981',
                backgroundColor: value > i ? '#10b981' : 'transparent',
                cursor: 'pointer',
                opacity: i >= 2 && value === 0 ? 0.3 : 1
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  /**
   * Calculate current trauma count and check if character is dead
   * @returns {object} Trauma status information
   */
  const getTraumaStatus = () => {
    const traumaCount = (character.trauma || []).length;
    const stressCount = (character.stress || []).filter(Boolean).length;
    const isDead = traumaCount >= 4;
    const shouldTakeTrauma = stressCount >= maxStress && traumaCount < 4;
    
    return {
      count: traumaCount,
      maxTrauma: 4,
      isDead,
      shouldTakeTrauma
    };
  };

  /**
   * Calculate maximum allowed abilities based on coin stats (3 base + 2 per A-rank coin stat)
   * @returns {number} Maximum abilities allowed
   */
  const getMaxAllowedAbilities = () => {
    const coinStats = character.coinStats || {};
    const aRankStats = Object.values(coinStats).filter(value => value >= 4).length; // A = 4, S = 5
    return 3 + (aRankStats * 2);
  };

  /**
   * Calculate total abilities currently selected
   * @returns {number} Total abilities selected
   */
  const getTotalAbilities = () => {
    return (character.standardAbilities || []).length + 
           (character.playbookAbilities || []).length + 
           (character.customAbilities || []).length;
  };

  /**
   * Check if we can add more abilities
   * @returns {boolean} True if we can add more abilities
   */
  const canAddMoreAbilities = () => getTotalAbilities() < getMaxAllowedAbilities();

  // Add state for harm selection prompt
  const [harmSelection, setHarmSelection] = useState({ show: false, level: null, options: [], onSelect: null });

  // Helper to get harm entries by level
  const getHarmEntriesByLevel = (level) => {
    return Object.entries(character.harm || {})
      .filter(([key, value]) => key.startsWith(`level${level}`) && value && value.trim() !== '')
      .map(([key, value]) => ({ key, value }));
  };

  // Function to handle harm reduction after resistance roll
  const handleReduceHarm = (level, reduction = 1) => {
    const harmEntries = getHarmEntriesByLevel(level);
    if (harmEntries.length === 0) return;
    if (harmEntries.length === 1) {
      // Only one harm, auto-reduce
      setCurrentCharacter(prev => ({
        ...prev,
        harm: { ...prev.harm, [harmEntries[0].key]: '' }
      }));
    } else {
      // Multiple harms, prompt user
      setHarmSelection({
        show: true,
        level,
        options: harmEntries,
        onSelect: (selectedKey) => {
          setCurrentCharacter(prev => ({
            ...prev,
            harm: { ...prev.harm, [selectedKey]: '' }
          }));
          setHarmSelection({ show: false, level: null, options: [], onSelect: null });
        }
      });
    }
  };

  // Helper function to render harm options for selection
  const renderHarmOptions = (level) => {
    const harmEntries = getHarmEntriesByLevel(level);
    return harmEntries.map(opt => (
      <button
        key={opt.key}
        style={{ display: 'block', width: '100%', marginBottom: '8px', background: '#10b981', color: '#000', border: 'none', borderRadius: '4px', padding: '6px', fontWeight: 'bold', cursor: 'pointer' }}
        onClick={() => harmSelection.onSelect(opt.key)}
      >
        {opt.value}
      </button>
    ));
  };

  /**
   * Load playbook abilities dynamically based on A-rank coin stats
   * @param {string} playbook - The playbook type ('Hamon' or 'Spin')
   * @param {object} coinStats - Current coin stats
   */
  const loadDynamicPlaybookAbilities = async (playbook, coinStats) => {
    if (!playbook || !['Hamon', 'Spin'].includes(playbook)) return;
    
    try {
      const coinStatsParam = encodeURIComponent(JSON.stringify(coinStats || {}));
      const response = await api.get(`/get_available_playbook_abilities/?playbook=${playbook}&coin_stats=${coinStatsParam}`);
      const data = response.data;
      
      if (data && data.abilities) {
        const abilitiesMap = {};
        data.abilities.forEach(ability => {
          abilitiesMap[ability.name] = ability.description;
        });
        
        setPlaybookAbilities(prev => ({
          ...prev,
          [playbook]: abilitiesMap
        }));
      }
    } catch (error) {
      console.error(`Failed to load ${playbook} abilities:`, error);
      // Keep existing abilities or use fallback
    }
  };

  // Load dynamic playbook abilities when coin stats change or abilities panel is opened
  useEffect(() => {
    if (character.playbook && ['Hamon', 'Spin'].includes(character.playbook) && gameState.showAbilitiesPanel) {
      loadDynamicPlaybookAbilities(character.playbook, character.coinStats);
    }
  }, [character.playbook, character.coinStats, gameState.showAbilitiesPanel]);

  return (
    <Layout>
      <div style={{ backgroundColor: '#000', color: '#10b981', fontFamily: 'monospace', minHeight: '100vh', fontSize: '14px', paddingTop: '80px' }}>
      {/* Character Info Header - positioned below main header */}
      <div style={{ 
        backgroundColor: '#1f2937', 
        borderBottom: '2px solid #10b981', 
        padding: '16px',
        margin: '0 16px 16px 16px',
        borderRadius: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fbbf24' }}>
                {character.trueName || 'New Character'} {character.alias && `"${character.alias}"`}
              </div>
              <div style={{ fontSize: '12px', color: '#6ee7b7' }}>
                {character.heritage} • {character.playbook} User
                {character.campaign && ` • Campaign: ${character.campaign}`}
              </div>
            </div>
            
            {/* Campaign Assignment */}
            <div style={{ fontSize: '10px' }}>
              <div style={{ marginBottom: '4px', color: '#6ee7b7', fontWeight: 'bold' }}>CAMPAIGN:</div>
              <select 
                value={character.campaign || ''}
                onChange={(e) => setCurrentCharacter(prev => ({...prev, campaign: e.target.value}))}
                style={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #10b981',
                  color: '#10b981',
                  fontSize: '10px',
                  padding: '4px',
                  width: '120px'
                }}
              >
                <option value="">None</option>
                {campaignsLoading ? (
                  <option disabled>Loading campaigns...</option>
                ) : (
                  campaigns.map(campaign => (
                    <option key={campaign.id} value={campaign.name}>
                      {campaign.name}
                    </option>
                  ))
                )}
              </select>
              <div style={{ marginTop: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox"
                    checked={character.isGM || false}
                    onChange={(e) => setCurrentCharacter(prev => ({...prev, isGM: e.target.checked}))}
                    style={{ accentColor: '#10b981' }}
                  />
                  <span style={{ color: '#6ee7b7' }}>GM Character</span>
                </label>
              </div>
            </div>
          </div>

          {/* Game Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>          <div style={{ fontSize: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>WANTED:</span>
                <StarGroup 
                  count={4} 
                  filled={character.wanted}
                  disabled={character.campaign && !character.isGM}
                  onChange={(val) => {
                    // Only allow GM or character owner to edit wanted level
                    if (character.isGM || !character.campaign) {
                      setCurrentCharacter(prev => ({...prev, wanted: val}));
                    }
                  }}
                />
                {character.campaign && !character.isGM && (
                  <span style={{ fontSize: '8px', color: '#f59e0b' }}>(GM only)</span>
                )}
              </div>
            </div>

            <div style={{ fontSize: '10px', borderLeft: '1px solid #10b981', paddingLeft: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span>POSITION:</span>
                <select 
                  value={gameState.position || 'risky'}
                  onChange={(e) => setGameState({...gameState, position: e.target.value})}
                  style={{ backgroundColor: '#1f2937', color: '#10b981', border: '1px solid #10b981', fontSize: '10px', padding: '2px' }}
                >
                  <option value="controlled">Controlled</option>
                  <option value="risky">Risky</option>
                  <option value="desperate">Desperate</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>EFFECT:</span>
                <select 
                  value={gameState.effect || 'standard'}
                  onChange={(e) => setGameState({...gameState, effect: e.target.value})}
                  style={{ backgroundColor: '#1f2937', color: '#10b981', border: '1px solid #10b981', fontSize: '10px', padding: '2px' }}
                >
                  <option value="limited">Limited</option>
                  <option value="standard">Standard</option>
                  <option value="great">Great</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setGameState(prev => ({...prev, showDiceRoller: !prev.showDiceRoller}))}
                style={{
                  backgroundColor: '#10b981',
                  color: '#000',
                  border: 'none',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                🎲 Dice
              </button>
              {(canAdvance5XP() || canAdvancePlaybook()) && (
                <button
                  onClick={() => setGameState(prev => ({...prev, showAdvancementPanel: !prev.showAdvancementPanel}))}
                  style={{
                    backgroundColor: '#8b5cf6',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  ⬆️ Advance
                </button>
              )}
              {character.isGM && (
                <button
                  onClick={() => setGameState(prev => ({...prev, showGMPanel: !prev.showGMPanel}))}
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  🛡️ GM
                </button>
              )}
              <button
                onClick={() => setGameState(prev => ({...prev, showFactionPanel: !prev.showFactionPanel}))}
                style={{
                  backgroundColor: '#7c3aed',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                🏛️ Factions
              </button>
              <input 
                type="file" 
                accept=".json"
                onChange={importCharacter}
                style={{ display: 'none' }}
                id="import-file"
              />
              <label 
                htmlFor="import-file"
                style={{
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                📁 Import
              </label>
              <button
                onClick={exportCharacter}
                style={{
                  backgroundColor: '#f59e0b',
                  color: '#000',
                  border: 'none',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                💾 Export
              </button>
            </div>
          </div>
        </div>

        {/* Status Line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '10px', color: '#6ee7b7' }}>
          <span>Coin Points: <strong style={{ color: coinPointsUsed > 10 ? '#ef4444' : '#fbbf24' }}>{10 - coinPointsUsed}/10</strong></span>
          <span>Skill Points: <strong style={{ color: skillPointsUsed > 7 ? '#ef4444' : '#fbbf24' }}>{7 - skillPointsUsed}/7</strong></span>
          <span>Heritage HP: <strong style={{ color: '#a855f7' }}>{getHeritageHP() - getUsedHeritageHP()}/{getHeritageHP()}</strong></span>
          <span>Total XP: <strong style={{ color: '#8b5cf6' }}>{getTotalXP()}</strong></span>
          <span>Abilities: <strong style={{ color: '#3b82f6' }}>{(character.standardAbilities || []).length + (character.playbookAbilities || []).length + (character.customAbilities || []).length}</strong></span>
          {saveStatus && <span style={{ color: '#3b82f6' }}>💾 {saveStatus}</span>}
        </div>

        {/* Character Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginTop: '8px' }}>
          {tabs.map(tab => (
            <div
              key={tab.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: activeTab === tab.id ? '#10b981' : '#374151',
                color: activeTab === tab.id ? '#000' : '#10b981',
                padding: '4px 8px',
                fontSize: '10px',
                cursor: 'pointer',
                border: `1px solid ${activeTab === tab.id ? '#10b981' : '#6b7280'}`,
                maxWidth: '150px'
              }}
            >
              <span
                onClick={() => setActiveTab(tab.id)}
                style={{ 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  flex: 1
                }}
              >
                {tab.name}
              </span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: activeTab === tab.id ? '#000' : '#10b981',
                    marginLeft: '4px',
                    cursor: 'pointer',
                    padding: '0',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addNewTab}
            style={{
              backgroundColor: '#6366f1',
              color: '#fff',
              border: 'none',
              padding: '4px 6px',
              fontSize: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '2px'
            }}
          >
            <Plus size={12} /> New
          </button>
        </div>

        {/* Advancement Panel */}
        {gameState.showAdvancementPanel && (
          <div style={{ 
            marginTop: '12px', 
            padding: '12px', 
            backgroundColor: '#111827', 
            border: '2px solid #8b5cf6',
            borderRadius: '4px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#8b5cf6', fontSize: '12px', fontWeight: 'bold' }}>
                CHARACTER ADVANCEMENT
              </h3>
              <button
                onClick={() => setGameState(prev => ({...prev, showAdvancementPanel: false}))}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}
              >
                ×
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Skill Advancement */}
              {canAdvance5XP() && (
                <div>
                  <h4 style={{ color: '#10b981', fontSize: '11px', margin: '0 0 8px 0' }}>SPEND 5 XP: +1d TO SKILL</h4>
                  <div style={{ fontSize: '9px', marginBottom: '8px', color: '#6ee7b7' }}>
                    Available from Attribute XP: {(character.xp?.insight || 0) + (character.xp?.prowess || 0) + (character.xp?.resolve || 0)}
                  </div>
                  <div style={{ fontSize: '9px' }}>
                    {Object.entries(character.skills || {}).map(([category, skills]) => (
                      <div key={category} style={{ marginBottom: '8px' }}>
                        <div style={{ fontWeight: 'bold', textTransform: 'uppercase', color: '#6ee7b7', marginBottom: '4px' }}>
                          {category}
                        </div>
                        {Object.entries(skills || {}).map(([skill, value]) => (
                          <button
                            key={skill}
                            onClick={() => spendXPForSkill(category, skill)}
                            disabled={value >= 4}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '4px 8px',
                              marginBottom: '2px',
                              backgroundColor: value >= 4 ? '#374151' : '#1f2937',
                              color: value >= 4 ? '#6b7280' : '#10b981',
                              border: '1px solid #374151',
                              cursor: value >= 4 ? 'not-allowed' : 'pointer',
                              fontSize: '9px'
                            }}
                          >
                            {skill} ({value}d → {Math.min(value + 1, 4)}d)
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coin Stat Advancement */}
              {canAdvancePlaybook() && (
                <div>
                  <h4 style={{ color: '#fbbf24', fontSize: '11px', margin: '0 0 8px 0' }}>SPEND 10 PLAYBOOK XP: +1 COIN STAT</h4>
                  <div style={{ fontSize: '9px', marginBottom: '8px', color: '#6ee7b7' }}>
                    Available Playbook XP: {character.xp?.playbook || 0}
                  </div>
                  <div style={{ fontSize: '9px' }}>
                    {Object.entries(character.coinStats || {}).map(([stat, value]) => (
                      <button
                        key={stat}
                        onClick={() => spendPlaybookXPForCoinStat(stat)}
                        disabled={value >= 5}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '4px 8px',
                          marginBottom: '4px',
                          backgroundColor: value >= 5 ? '#374151' : '#1f2937',
                          fontSize: '9px',
                          textTransform: 'uppercase'
                        }}
                      >
                        {stat} ({getGradeLetter(value)} → {getGradeLetter(Math.min(value + 1, 5))})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dice Roller */}
        {gameState.showDiceRoller && (
          <div style={{ 
            marginTop: '12px', 
            padding: '12px', 
            backgroundColor: '#111827', 
            border: '2px solid #10b981',
            borderRadius: '4px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                <span style={{ fontWeight: 'bold', color: '#10b981' }}>Quick Roll:</span>
                {[1,2,3,4,5,6].map(count => (
                  <button
                    key={count}
                    onClick={() => rollDice(count, `${count}d6`)}
                    style={{
                      backgroundColor: '#10b981',
                      color: '#000',
                      border: 'none',
                      padding: '6px 10px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      borderRadius: '3px',
                      transition: 'transform 0.1s',
                      ':hover': { transform: 'scale(1.05)' }
                    }}
                    onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                  >
                    {count}d
                  </button>
                ))}
              </div>
              {gameState.lastRoll && (
                <div style={{ 
                  fontSize: '12px', 
                  padding: '8px 12px', 
                  backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                  border: '1px solid #10b981', 
                  borderRadius: '4px',
                  minWidth: '200px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 'bold', color: '#10b981' }}>{gameState.lastRoll.skill}:</span>
                    <span style={{ color: '#6ee7b7' }}>Rolled [{gameState.lastRoll.dice.join(', ')}]</span>
                  </div>
                  <div style={{ 
                    color: gameState.lastRoll.resultColor, 
                    fontWeight: 'bold', 
                    fontSize: '13px' 
                  }}>
                    → {gameState.lastRoll.result}
                  </div>
                  {gameState.lastRoll.note && (
                    <div style={{ fontSize: '9px', color: '#9ca3af', marginTop: '4px', fontStyle: 'italic' }}>
                      {gameState.lastRoll.note}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Character Sheet */}
      <div style={{ padding: '16px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Basic Character Info */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#6ee7b7', marginBottom: '4px' }}>NAME</div>
            <input 
              value={character.trueName || ''}
              onChange={(e) => setCurrentCharacter(prev => ({...prev, trueName: e.target.value}))}
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: '1px solid #10b981',
                color: '#10b981',
                fontSize: '12px',
                padding: '4px 0',
                outline: 'none'
              }}
              placeholder="Character Name"
            />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#6ee7b7', marginBottom: '4px' }}>ALIAS</div>
            <input 
              value={character.alias || ''}
              onChange={(e) => setCurrentCharacter(prev => ({...prev, alias: e.target.value}))}
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: '1px solid #10b981',
                color: '#10b981',
                fontSize: '12px',
                padding: '4px 0',
                outline: 'none'
              }}
              placeholder="Street Name"
            />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#6ee7b7', marginBottom: '4px' }}>CREW</div>
            <input 
              value={character.crew || ''}
              onChange={(e) => setCurrentCharacter(prev => ({...prev, crew: e.target.value}))}
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: '1px solid #10b981',
                color: '#10b981',
                fontSize: '12px',
                padding: '4px 0',
                outline: 'none'
              }}
              placeholder="Crew Name"
            />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#6ee7b7', marginBottom: '4px' }}>HERITAGE</div>
            <select 
              value={character.heritage || ''}
              onChange={(e) => setCurrentCharacter(prev => ({...prev, heritage: e.target.value, selectedDetriments: [], selectedBenefits: []}))}
              style={{
                width: '100%',
                backgroundColor: '#1f2937',
                border: '1px solid #10b981',
                color: '#10b981',
                fontSize: '11px',
                padding: '4px'
              }}
              disabled={heritagesLoading}
            >
              {heritagesLoading ? (
                <option value="">Loading heritages...</option>
              ) : (
                <>
                  <option value="">Select Heritage</option>
                  {Object.keys(heritages).map(heritage => (
                    <option key={heritage} value={heritage}>{heritage}</option>
                  ))}
                </>
              )}
            </select>
            <button
              onClick={() => setGameState(prev => ({...prev, showHeritagePanel: !prev.showHeritagePanel}))}
              style={{
                fontSize: '9px',
                backgroundColor: '#6366f1',
                color: '#fff',
                border: 'none',
                padding: '2px 6px',
                marginTop: '4px',
                cursor: 'pointer'
              }}
            >
              Configure Heritage
            </button>
          </div>
        </div>

        {/* Heritage Configuration Panel */}
        {gameState.showHeritagePanel && (
          <div style={{ 
            marginBottom: '20px',
            border: '2px solid #a855f7',
            backgroundColor: 'rgba(168, 85, 247, 0.05)',
            padding: '16px',
            borderRadius: '4px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#a855f7', fontSize: '14px', fontWeight: 'bold' }}>
                {character.heritage.toUpperCase()} HERITAGE
              </h3>
              <button
                onClick={() => setGameState(prev => ({...prev, showHeritagePanel: false}))}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}
              >
                ×
              </button>
            </div>
            <div style={{ fontSize: '11px', color: '#c084fc', marginBottom: '12px' }}>
              {heritages[character.heritage].description}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#10b981', marginBottom: '8px' }}>
                  Available HP: {getHeritageHP() - getUsedHeritageHP()}/{getHeritageHP()}
                </div>
                
                {/* Required Benefits */}
                {heritages[character.heritage].requiredBenefits?.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '10px', color: '#10b981', margin: '0 0 4px 0' }}>REQUIRED BENEFITS</h4>
                    {heritages[character.heritage].requiredBenefits.map((benefit, index) => (
                      <div key={index} style={{ fontSize: '9px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 'bold' }}>{benefit.name}:</span> {benefit.description}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Required Detriments */}
                {heritages[character.heritage].requiredDetriments?.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '10px', color: '#ef4444', margin: '0 0 4px 0' }}>REQUIRED DETRIMENTS</h4>
                    {heritages[character.heritage].requiredDetriments.map((detriment, index) => (
                      <div key={index} style={{ fontSize: '9px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 'bold' }}>{detriment.name} (+{detriment.hp} HP):</span> {detriment.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                {/* Optional Detriments */}
                {heritages[character.heritage].optionalDetriments?.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '10px', color: '#f59e0b', margin: '0 0 4px 0' }}>OPTIONAL DETRIMENTS</h4>
                    {heritages[character.heritage].optionalDetriments.map((detriment, index) => (
                      <label key={index} style={{ display: 'block', fontSize: '9px', marginBottom: '6px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox"
                          checked={(character.selectedDetriments || []).some(d => d.name === detriment.name)}
                          onChange={() => {
                            const isSelected = (character.selectedDetriments || []).some(d => d.name === detriment.name);
                            setCurrentCharacter(prev => ({
                              ...prev,
                              selectedDetriments: isSelected 
                                ? (prev.selectedDetriments || []).filter(d => d.name !== detriment.name)
                                : [...(prev.selectedDetriments || []), detriment]
                            }));
                          }}
                          style={{ marginRight: '6px', accentColor: '#f59e0b' }}
                        />
                        <span style={{ fontWeight: 'bold' }}>{detriment.name} (+{detriment.hp} HP):</span> {detriment.description}
                      </label>
                    ))}
                  </div>
                )}
                
                {/* Benefits */}
                {heritages[character.heritage].benefits?.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '10px', color: '#10b981', margin: '0 0 4px 0' }}>BENEFITS</h4>
                    {heritages[character.heritage].benefits.map((benefit, index) => (
                      <label key={index} style={{ display: 'block', fontSize: '9px', marginBottom: '6px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox"
                          checked={(character.selectedBenefits || []).some(b => b.name === benefit.name)}
                          disabled={getHeritageHP() - getUsedHeritageHP() < benefit.cost}
                          onChange={() => {
                            const isSelected = (character.selectedBenefits || []).some(b => b.name === benefit.name);
                            setCurrentCharacter(prev => ({
                              ...prev,
                              selectedBenefits: isSelected 
                                ? (prev.selectedBenefits || []).filter(b => b.name !== benefit.name)
                                : [...(prev.selectedBenefits || []), benefit]
                            }));
                          }}
                          style={{ marginRight: '6px', accentColor: '#10b981' }}
                        />
                        <span style={{ fontWeight: 'bold' }}>{benefit.name} ({benefit.cost} HP):</span> {benefit.description}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Look and Vice */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#6ee7b7', marginBottom: '4px' }}>LOOK</div>
            <input 
              value={character.look || ''}
              onChange={(e) => setCurrentCharacter(prev => ({...prev, look: e.target.value}))}
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: '1px solid #10b981',
                color: '#10b981',
                fontSize: '12px',
                padding: '4px 0',
                outline: 'none'
              }}
              placeholder="Describe appearance"
            />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#6ee7b7', marginBottom: '4px' }}>VICE</div>
            <select 
              value={character.vice || ''}
              onChange={(e) => setCurrentCharacter(prev => ({...prev, vice: e.target.value}))}
              style={{
                width: '100%',
                backgroundColor: '#1f2937',
                border: '1px solid #10b981',
                color: '#10b981',
                fontSize: '11px',
                padding: '4px'
              }}
              disabled={vicesLoading}
            >
              {vicesLoading ? (
                <option value="">Loading vices...</option>
              ) : (
                <>
                  <option value="">Select Vice</option>
                  {vices.map(vice => (
                    <option key={vice} value={vice}>{vice}</option>
                  ))}
                </>
              )}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#6ee7b7', marginBottom: '4px' }}>PLAYBOOK</div>
            <select 
              value={character.playbook || ''}
              onChange={(e) => setCurrentCharacter(prev => ({...prev, playbook: e.target.value}))}
              style={{
                width: '100%',
                backgroundColor: '#1f2937',
                border: '1px solid #10b981',
                color: '#10b981',
                fontSize: '11px',
                padding: '4px'
              }}
            >
              <option value="">Select Playbook</option>
              <option value="Stand">Stand</option>
              <option value="Hamon">Hamon</option>
              <option value="Spin">Spin</option>
            </select>
          </div>
        </div>

        {/* Stand Name (if Stand user) */}
        {character.playbook === 'Stand' && (
          <div style={{ marginBottom: '20px', textAlign: 'center' }}>
            <input 
              value={character.standName || ''}
              onChange={(e) => setCurrentCharacter(prev => ({...prev, standName: e.target.value}))}
              style={{
                backgroundColor: 'transparent',
                border: '2px solid #ef4444',
                color: '#ef4444',
                fontSize: '18px',
                fontWeight: 'bold',
                textAlign: 'center',
                padding: '8px 16px',
                outline: 'none',
                width: '300px'
              }}
              placeholder="「STAND NAME」"
            />
          </div>
        )}

        {/* Main Content Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
          {/* Left Column - Coin Stats & Stress */}
          <div>
            {/* Stand Coin Stats */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                backgroundColor: '#10b981', 
                color: '#000', 
                padding: '6px 12px', 
                fontSize: '11px', 
                fontWeight: 'bold',
                marginBottom: '8px'
              }}>
                STAND COIN ({coinPointsUsed}/10 pts)
              </div>
              <div style={{ border: '1px solid #10b981', padding: '12px' }}>
                {Object.entries(character.coinStats || {}).map(([stat, value]) => (
                  <div key={stat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', width: '80px' }}>{stat}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <select 
                        value={value || 0}
                        onChange={(e) => handleCoinStatChange(stat, parseInt(e.target.value))}
                        style={{
                          backgroundColor: '#1f2937',
                          color: '#10b981',
                          border: '1px solid #10b981',
                          fontSize: '10px',
                          padding: '2px'
                        }}
                      >
                        {[0,1,2,3,4,5].map(v => (
                          <option key={v} value={v}>{v} ({getGradeLetter(v)})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stress */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                backgroundColor: '#10b981', 
                color: '#000', 
                padding: '6px 12px', 
                fontSize: '11px', 
                fontWeight: 'bold',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>STRESS ({(character.stress || []).filter(Boolean).length}/{maxStress})</span>
                {getTraumaStatus().shouldTakeTrauma && (
                  <span style={{ color: '#ef4444', fontSize: '9px' }}>TAKE TRAUMA!</span>
                )}
              </div>
              <CheckboxGroup 
                count={maxStress} 
                filled={(character.stress || []).filter(Boolean).length}
                size="large"
                onChange={(val) => {
                  const newStress = Array(maxStress).fill(false);
                  for(let i = 0; i < val; i++) newStress[i] = true;
                  setCurrentCharacter(prev => ({...prev, stress: newStress}));
                  
                  // Check if stress has reached maximum capacity and trauma should be selected
                  if (val >= maxStress && (character.trauma || []).length < 4) {
                    setTraumaSelection({ show: true, forced: true });
                  }
                }}
              />
            </div>

            {/* Trauma */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                backgroundColor: getTraumaStatus().isDead ? '#ef4444' : '#10b981',
                color: getTraumaStatus().isDead ? '#fff' : '#000',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 'bold',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>TRAUMA ({getTraumaStatus().count}/4)</span>
                {getTraumaStatus().isDead && (
                  <span style={{ fontSize: '9px' }}>DEAD</span>
                )}
                {character.campaign && !character.isGM && (
                  <span style={{ fontSize: '8px', color: getTraumaStatus().isDead ? '#fbbf24' : '#f59e0b' }}>(GM View)</span>
                )}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px'
              }}>
                {traumaOptions.map(trauma => {
                  const isActive = (character.trauma || []).includes(trauma.name);
                  return (
                    <button
                      key={trauma.name}
                      title={trauma.description}
                      onClick={() => toggleTrauma(trauma.name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      <div style={{
                        width: '12px',
                        height: '12px',
                        border: '1px solid #10b981',
                        backgroundColor: isActive ? '#10b981' : 'transparent',
                        transition: 'background-color 0.2s'
                      }} />
                      <span style={{ fontSize: '9px', color: '#10b981' }}>{trauma.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Clocks */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#10b981',
                color: '#000',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 'bold',
                marginBottom: '8px'
              }}>
                <span>CLOCKS</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => addClock('Healing Clock', 'healing', 4)}
                    style={{
                      backgroundColor: '#000',
                      color: '#ef4444',
                      border: '1px solid #ef4444',
                      padding: '2px 6px',
                      fontSize: '9px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    + Healing
                  </button>
                  <button
                    onClick={() => addClock('Project Clock', 'project', 8)}
                    style={{
                      backgroundColor: '#000',
                      color: '#3b82f6',
                      border: '1px solid #3b82f6',
                      padding: '2px 6px',
                      fontSize: '9px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    + Project
                  </button>
                  <button
                    onClick={() => {
                      const name = prompt('Clock name:');
                      if (name) {
                        const segments = parseInt(prompt('Number of segments (4, 6, or 8):', '4')) || 4;
                        addClock(name, 'custom', segments);
                      }
                    }}
                    style={{
                      backgroundColor: '#000',
                      color: '#8b5cf6',
                      border: '1px solid #8b5cf6',
                      padding: '2px 6px',
                      fontSize: '9px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    + Custom
                  </button>
                </div>
              </div>
              <div style={{ border: '1px solid #10b981', padding: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                  {(character.clocks || []).map(clock => (
                    <div key={clock.id} style={{ textAlign: 'center' }}>
                      <div style={{ 
                        fontSize: '9px', 
                        fontWeight: 'bold', 
                        marginBottom: '4px',
                        color: getClockColor(clock.type),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}>
                        {clock.name}
                        {!clock.isRequired && (
                          <button
                            onClick={() => deleteClock(clock.id)}
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              fontSize: '8px'
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <Clock
                        total={clock.segments}
                        filled={clock.filled}
                        size={60}
                        strokeWidth={8}
                        color={getClockColor(clock.type)}
                        onSegmentClick={(segmentIndex) => {
                          const newFilled = segmentIndex + 1 === clock.filled ? Math.max(0, clock.filled - 1) : segmentIndex + 1;
                          updateClock(clock.id, { filled: newFilled });
                        }}
                      />
                      <div style={{ fontSize: '8px', marginTop: '2px', color: '#6ee7b7' }}>
                        {clock.filled}/{clock.segments}
                        {clock.type === 'wanted' && clock.filled > 0 && (
                          <div style={{ color: '#fbbf24', marginTop: '2px' }}>
                            {'★'.repeat(clock.filled)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {(character.clocks || []).length === 0 && (
                  <div style={{ fontSize: '10px', color: '#6b7280', fontStyle: 'italic', textAlign: 'center' }}>
                    No clocks created yet
                  </div>
                )}
              </div>
            </div>

            {/* Harm */}
            <div>
              <div style={{ 
                backgroundColor: '#10b981', 
                color: '#000', 
                padding: '6px 12px', 
                fontSize: '11px', 
                fontWeight: 'bold',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>HARM</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => rollResistance('insight')}
                    style={{
                      backgroundColor: '#000',
                      color: '#10b981',
                      border: '1px solid #10b981',
                      padding: '2px 4px',
                      fontSize: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    Insight ({getAttributeRating('insight')}d)
                  </button>
                  <button
                    onClick={() => rollResistance('prowess')}
                    style={{
                      backgroundColor: '#000',
                      color: '#10b981',
                      border: '1px solid #10b981',
                      padding: '2px 4px',
                      fontSize: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    Prowess ({getAttributeRating('prowess')}d)
                  </button>
                  <button
                    onClick={() => rollResistance('resolve')}
                    style={{
                      backgroundColor: '#000',
                      color: '#10b981',
                      border: '1px solid #10b981',
                      padding: '2px 4px',
                      fontSize: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    Resolve ({getAttributeRating('resolve')}d)
                  </button>
                </div>
              </div>

              {/* Resistance Roll Display */}
              {gameState.lastResistanceRoll && (
                <div style={{ 
                  marginTop: '8px',
                  padding: '8px',
                  border: `1px solid ${gameState.lastResistanceRoll.resultColor}`,
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  fontSize: '10px'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    {gameState.lastResistanceRoll.attribute.toUpperCase()} Resistance Roll
                  </div>
                  <div style={{ marginBottom: '4px' }}>
                    Dice: [{gameState.lastResistanceRoll.dice.join(', ')}] Highest: {gameState.lastResistanceRoll.highest}
                  </div>
                  <div style={{ color: gameState.lastResistanceRoll.resultColor, fontWeight: 'bold' }}>
                    {gameState.lastResistanceRoll.result}
                  </div>
                  {/* Show explicit stress cost info */}
                  {gameState.lastResistanceRoll.highest === 6 && (
                    <div style={{ color: '#10b981', fontWeight: 'bold' }}>No stress cost!</div>
                  )}
                  {gameState.lastResistanceRoll.highest >= 4 && gameState.lastResistanceRoll.highest < 6 && (
                    <div style={{ color: '#fbbf24' }}>Pay 1 stress.</div>
                  )}
                  {gameState.lastResistanceRoll.highest < 4 && (
                    <div style={{ color: '#ef4444' }}>Pay 2 stress.</div>
                  )}
                  {/* Harm reduction button if applicable */}
                  {(gameState.lastResistanceRoll.result && (gameState.lastResistanceRoll.result.includes('reduce harm') || gameState.lastResistanceRoll.result.includes('Critical'))) && (
                    <div style={{ marginTop: '6px' }}>
                      <button
                        style={{ backgroundColor: '#10b981', color: '#000', border: 'none', padding: '4px 8px', fontSize: '9px', cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={() => {
                          // Determine which harm level to reduce (prefer highest)
                          let level = 3;
                          while (level > 0 && getHarmEntriesByLevel(level).length === 0) level--;
                          if (level > 0) handleReduceHarm(level);
                        }}
                      >
                        Reduce Harm
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div style={{ border: '1px solid #10b981', padding: '8px' }}>
                {[
                  { level: 3, label: 'SEVERE', effect: 'Need Help' },
                  { level: 2, label: 'MODERATE', effect: '-1d' },
                  { level: 2, label: 'MODERATE', effect: '-1d' },
                  { level: 1, label: 'LESSER', effect: 'Less Effect' },
                  { level: 1, label: 'LESSER', effect: 'Less Effect' }
                ].map(({level, label, effect}, index) => (
                  <div key={`${level}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', width: '8px' }}>{level}</span>
                    <input
                      value={(character.harm || {})[`level${level}_${index}`] || ''}
                      onChange={(e) => setCurrentCharacter(prev => ({
                        ...prev,
                        harm: {...(prev.harm || {}), [`level${level}_${index}`]: e.target.value}
                      }))}
                      style={{
                        flex: 1,
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid #10b981',
                        color: '#10b981',
                        fontSize: '10px',
                        padding: '2px 0',
                        outline: 'none'
                      }}
                      placeholder={`${label} harm`}
                    />
                    <span style={{ fontSize: '8px', color: '#6ee7b7', width: '60px' }}>{effect}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Middle Column - Action Ratings */}
          <div>
            {/* Insight Actions */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                backgroundColor: '#10b981', 
                color: '#000', 
                padding: '6px 12px', 
                fontSize: '11px', 
                fontWeight: 'bold',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>INSIGHT ({getAttributeRating('insight')}d)</span>
                <button
                  onClick={() => rollDice(getAttributeRating('insight'), 'Insight Attribute Roll')}
                  style={{
                    backgroundColor: '#000',
                    color: '#10b981',
                    border: '1px solid #10b981',
                    padding: '2px 6px',
                    fontSize: '9px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Roll
                </button>
              </div>
              <div style={{ border: '1px solid #10b981', padding: '8px' }}>
                {Object.entries((character.skills || {}).insight || {}).map(([skill, rating]) => (
                  <SkillDots key={skill} category="insight" skill={skill} value={rating} />
                ))}
              </div>
            </div>

            {/* Prowess Actions */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                backgroundColor: '#10b981', 
                color: '#000', 
                padding: '6px 12px', 
                fontSize: '11px', 
                fontWeight: 'bold',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>PROWESS ({getAttributeRating('prowess')}d)</span>
                <button
                  onClick={() => rollDice(getAttributeRating('prowess'), 'Prowess Attribute Roll')}
                  style={{
                    backgroundColor: '#000',
                    color: '#10b981',
                    border: '1px solid #10b981',
                    padding: '2px 6px',
                    fontSize: '9px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Roll
                </button>
              </div>
              <div style={{ border: '1px solid #10b981', padding: '8px' }}>
                {Object.entries((character.skills || {}).prowess || {}).map(([skill, rating]) => (
                  <SkillDots key={skill} category="prowess" skill={skill} value={rating} />
                ))}
              </div>
            </div>

            {/* Resolve Actions */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                backgroundColor: '#10b981', 
                color: '#000', 
                padding: '6px 12px', 
                fontSize: '11px', 
                fontWeight: 'bold',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>RESOLVE ({getAttributeRating('resolve')}d)</span>
                <button
                  onClick={() => rollDice(getAttributeRating('resolve'), 'Resolve Attribute Roll')}
                  style={{
                    backgroundColor: '#000',
                    color: '#10b981',
                    border: '1px solid #10b981',
                    padding: '2px 6px',
                    fontSize: '9px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Roll
                </button>
              </div>
              <div style={{ border: '1px solid #10b981', padding: '8px' }}>
                {Object.entries((character.skills || {}).resolve || {}).map(([skill, rating]) => (
                  <SkillDots key={skill} category="resolve" skill={skill} value={rating} />
                ))}
              </div>
            </div>

            {/* XP Tracks */}
            <div>
              <div style={{ 
                backgroundColor: '#10b981', 
                color: '#000', 
                padding: '6px 12px', 
                fontSize: '11px', 
                fontWeight: 'bold',
                marginBottom: '8px'
              }}>
                EXPERIENCE
              </div>
              <div style={{ border: '1px solid #10b981', padding: '8px', fontSize: '10px' }}>
                {Object.entries(character.xp || {}).map(([track, xp]) => (
                  <div key={track} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{track}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckboxGroup 
                        count={track === 'playbook' ? 10 : 5}
                        filled={xp || 0}
                        onChange={(val) => setCurrentCharacter(prev => ({
                          ...prev,
                          xp: {...(prev.xp || {}), [track]: val}
                        }))}
                      />
                      <span>{xp || 0}/{track === 'playbook' ? 10 : 5}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Abilities & Notes */}
          <div>
            {/* Abilities */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ 
                  backgroundColor: '#10b981', 
                  color: '#000', 
                  padding: '6px 12px', 
                  fontSize: '11px', 
                  fontWeight: 'bold',
                  marginBottom: '8px'
                }}>
                  ABILITIES ({(character.standardAbilities || []).length + (character.playbookAbilities || []).length + (character.customAbilities || []).length})
                </div>
                <button
                  onClick={() => setGameState(prev => ({...prev, showAbilitiesPanel: !prev.showAbilitiesPanel}))}
                  style={{
                    fontSize: '9px',
                    backgroundColor: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    padding: '4px 8px',
                    cursor: 'pointer'
                  }}
                >
                  Manage
                </button>
              </div>
              <div style={{ border: '1px solid #10b981', padding: '8px', minHeight: '120px' }}>
                {[
                  ...(character.standardAbilities || []).map(ability => ({ ...ability, type: 'standard' })),
                  ...(character.playbookAbilities || []).map(ability => ({ ...ability, type: 'playbook' })),
                  ...(character.customAbilities || []).map(ability => ({ ...ability, type: 'custom' }))
                ].map((ability, index) => (
                  <div key={index} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #374151' }}>
                    <div style={{ fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ 
                        color: ability.type === 'custom' ? '#f59e0b' : 
                               ability.type === 'playbook' ? '#8b5cf6' : '#3b82f6' 
                      }}>
                        {ability.name}
                      </span>
                      <span style={{ 
                        fontSize: '7px', 
                        backgroundColor: ability.type === 'custom' ? '#f59e0b' : 
                                         ability.type === 'playbook' ? '#8b5cf6' : '#3b82f6',
                        color: '#000',
                        padding: '1px 4px',
                        borderRadius: '2px',
                        textTransform: 'uppercase'
                      }}>
                        {ability.type}
                      </span>
                    </div>
                    <div style={{ fontSize: '9px', color: '#6ee7b7', marginTop: '2px' }}>{ability.description}</div>
                  </div>
                ))}
                {((character.standardAbilities || []).length + (character.playbookAbilities || []).length + (character.customAbilities || []).length) === 0 && (
                  <div style={{ fontSize: '10px', color: '#6b7280', fontStyle: 'italic' }}>No abilities selected</div>
                )}
              </div>
            </div>

            {/* Abilities Panel */}
            {gameState.showAbilitiesPanel && (
              <div style={{ 
                marginBottom: '20px',
                border: '2px solid #3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                padding: '12px',
                borderRadius: '4px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, color: '#3b82f6', fontSize: '12px' }}>
                    ABILITY MANAGEMENT
                  </h4>
                  <button
                    onClick={() => setGameState(prev => ({...prev, showAbilitiesPanel: false}))}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }}
                  >
                    ×
                  </button>
                </div>
                
                {/* Ability Type Tabs */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                  {['standard', 'custom', 'playbook'].map(type => (
                    <button
                      key={type}
                      onClick={() => setGameState(prev => ({...prev, activeAbilityTab: type}))}
                      style={{
                        backgroundColor: (gameState.activeAbilityTab || 'standard') === type ? '#3b82f6' : '#374151',
                        color: '#fff',
                        border: 'none',
                        padding: '4px 8px',
                        fontSize: '9px',
                        cursor: 'pointer',
                        textTransform: 'capitalize'
                      }}
                    >
                      {type} Abilities
                    </button>
                  ))}
                </div>

                <div style={{ maxHeight: '300px', overflowY: 'auto', fontSize: '9px' }}>
                  {/* Standard Abilities Tab */}
                  {(gameState.activeAbilityTab || 'standard') === 'standard' && (
                    <div>
                      <div style={{ fontSize: '10px', color: '#6ee7b7', marginBottom: '8px' }}>
                        Select abilities (Max: {getMaxAllowedAbilities()}, Selected: {getTotalAbilities()})
                      </div>
                      {abilitiesLoading ? (
                        <div style={{ fontSize: '10px', color: '#6b7280', fontStyle: 'italic', textAlign: 'center', padding: '16px' }}>
                          Loading standard abilities...
                        </div>
                      ) : Object.keys(standardAbilities).length === 0 ? (
                        <div style={{ fontSize: '10px', color: '#6b7280', fontStyle: 'italic', textAlign: 'center', padding: '16px' }}>
                          No standard abilities available. Check your connection.
                        </div>
                      ) : (
                        Object.entries(standardAbilities).map(([name, description]) => {
                        const isSelected = (character.standardAbilities || []).some(a => a.name === name);
                        const canSelect = isSelected || canAddMoreAbilities();
                        return (
                          <label key={name} style={{ 
                            display: 'block', 
                            marginBottom: '8px', 
                            cursor: canSelect ? 'pointer' : 'not-allowed',
                            opacity: canSelect ? 1 : 0.5
                          }}>
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              disabled={!canSelect}
                              onChange={() => {
                                if (!canSelect) return;
                                const abilityObj = { name, description };
                                setCurrentCharacter(prev => ({
                                  ...prev,
                                  standardAbilities: isSelected 
                                    ? (prev.standardAbilities || []).filter(a => a.name !== name)
                                    : [...(prev.standardAbilities || []), abilityObj]
                                }));
                              }}
                              style={{ marginRight: '6px', accentColor: '#3b82f6' }}
                            />
                            <span style={{ fontWeight: 'bold' }}>{name}</span>
                            <div style={{ marginLeft: '18px', color: '#6ee7b7', fontSize: '8px' }}>{description}</div>
                          </label>
                        );
                      }))}
                    </div>
                  )}

                  {/* Custom Abilities Tab */}
                  {gameState.activeAbilityTab === 'custom' && (
                    <div>
                      <div style={{ fontSize: '10px', color: '#6ee7b7', marginBottom: '8px' }}>
                        Create your own unique abilities with custom names and descriptions
                      </div>
                      
                      {/* Add New Custom Ability */}
                      <div style={{ 
                        backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                        border: '1px solid #10b981', 
                        padding: '8px', 
                        marginBottom: '12px',
                        borderRadius: '4px'
                      }}>
                        <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#10b981', marginBottom: '6px' }}>
                          CREATE NEW ABILITY
                        </div>
                        <input 
                          type="text"
                          placeholder="Ability Name"
                          style={{
                            width: '100%',
                            backgroundColor: '#1f2937',
                            border: '1px solid #10b981',
                            color: '#10b981',
                            fontSize: '9px',
                            padding: '4px',
                            marginBottom: '4px'
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              const name = e.target.value.trim();
                              const description = e.target.nextElementSibling.value.trim();
                              if (name && description) {
                                const newAbility = { id: Date.now(), name, description };
                                setCurrentCharacter(prev => ({
                                  ...prev,
                                  customAbilities: [...(prev.customAbilities || []), newAbility]
                                }));
                                e.target.value = '';
                                e.target.nextElementSibling.value = '';
                              }
                            }
                          }}
                        />
                        <textarea 
                          placeholder="Ability Description"
                          rows="2"
                          style={{
                            width: '100%',
                            backgroundColor: '#1f2937',
                            border: '1px solid #10b981',
                            color: '#10b981',
                            fontSize: '9px',
                            padding: '4px',
                            resize: 'vertical',
                            marginBottom: '4px'
                          }}
                        />
                        <button
                          onClick={(e) => {
                            if (!canAddMoreAbilities()) return;
                            const nameInput = e.target.parentElement.querySelector('input');
                            const descInput = e.target.parentElement.querySelector('textarea');
                            const name = nameInput.value.trim();
                            const description = descInput.value.trim();
                            if (name && description) {
                              const newAbility = { id: Date.now(), name, description };
                              setCurrentCharacter(prev => ({
                                ...prev,
                                customAbilities: [...(prev.customAbilities || []), newAbility]
                              }));
                              nameInput.value = '';
                              descInput.value = '';
                            }
                          }}
                          disabled={!canAddMoreAbilities()}
                          style={{
                            backgroundColor: canAddMoreAbilities() ? '#10b981' : '#374151',
                            color: canAddMoreAbilities() ? '#000' : '#6b7280',
                            border: 'none',
                            padding: '4px 8px',
                            fontSize: '8px',
                            cursor: canAddMoreAbilities() ? 'pointer' : 'not-allowed',
                            fontWeight: 'bold'
                          }}
                        >
                          Add Custom Ability
                        </button>
                      </div>

                      {/* Existing Custom Abilities */}
                      {(character.customAbilities || []).map((ability) => (
                        <div key={ability.id} style={{ 
                          display: 'flex', 
                          alignItems: 'flex-start', 
                          marginBottom: '8px',
                          backgroundColor: 'rgba(16, 185, 129, 0.05)',
                          padding: '6px',
                          borderRadius: '4px'
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', color: '#10b981', fontSize: '9px' }}>{ability.name}</div>
                            <div style={{ color: '#6ee7b7', fontSize: '8px', marginTop: '2px' }}>{ability.description}</div>
                          </div>
                          <button
                            onClick={() => {
                              setCurrentCharacter(prev => ({
                                ...prev,
                                customAbilities: (prev.customAbilities || []).filter(a => a.id !== ability.id)
                              }));
                            }}
                            style={{
                              backgroundColor: '#ef4444',
                              color: '#fff',
                              border: 'none',
                              padding: '2px 4px',
                              fontSize: '8px',
                              cursor: 'pointer',
                              marginLeft: '8px'
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      
                      {(character.customAbilities || []).length === 0 && (
                        <div style={{ fontSize: '9px', color: '#6b7280', fontStyle: 'italic', textAlign: 'center', padding: '16px' }}>
                          No custom abilities created yet. Use the form above to create your first custom ability.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Playbook Abilities Tab */}
                  {gameState.activeAbilityTab === 'playbook' && (
                    <div>
                      <div style={{ fontSize: '10px', color: '#6ee7b7', marginBottom: '8px' }}>
                        Abilities specific to {character.playbook} users
                      </div>
                      {abilitiesLoading ? (
                        <div style={{ fontSize: '10px', color: '#6b7280', fontStyle: 'italic', textAlign: 'center', padding: '16px' }}>
                          Loading {character.playbook} abilities...
                        </div>
                      ) : Object.keys(playbookAbilities[character.playbook] || {}).length === 0 ? (
                        <div style={{ fontSize: '10px', color: '#6b7280', fontStyle: 'italic', textAlign: 'center', padding: '16px' }}>
                          No {character.playbook} abilities available. Check your connection.
                        </div>
                      ) : (
                        Object.entries(playbookAbilities[character.playbook] || {}).map(([name, description]) => {
                        const isSelected = (character.playbookAbilities || []).some(a => a.name === name);
                        const canSelect = isSelected || canAddMoreAbilities();
                        return (
                          <label key={name} style={{ 
                            display: 'block', 
                            marginBottom: '8px', 
                            cursor: canSelect ? 'pointer' : 'not-allowed',
                            opacity: canSelect ? 1 : 0.5
                          }}>
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              disabled={!canSelect}
                              onChange={() => {
                                if (!canSelect) return;
                                const abilityObj = { name, description };
                                setCurrentCharacter(prev => ({
                                  ...prev,
                                  playbookAbilities: isSelected 
                                    ? (prev.playbookAbilities || []).filter(a => a.name !== name)
                                    : [...(prev.playbookAbilities || []), abilityObj]
                                }));
                              }}
                              style={{ marginRight: '6px', accentColor: '#8b5cf6' }}
                            />
                            <span style={{ fontWeight: 'bold' }}>{name}</span>
                            <div style={{ marginLeft: '18px', color: '#6ee7b7', fontSize: '8px' }}>{description}</div>
                          </label>
                        );
                      }))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <div style={{ 
                backgroundColor: '#10b981', 
                color: '#000', 
                padding: '6px 12px', 
                fontSize: '11px', 
                fontWeight: 'bold',
                marginBottom: '8px'
              }}>
                NOTES
              </div>
              <textarea
                value={character.notes || ''}
                onChange={(e) => setCurrentCharacter(prev => ({...prev, notes: e.target.value}))}
                style={{
                  width: '100%',
                  height: '120px',
                  backgroundColor: '#1f2937',
                  border: '1px solid #10b981',
                  color: '#10b981',
                  fontSize: '10px',
                  padding: '8px',
                  resize: 'none',
                  outline: 'none'
                }}
                placeholder="Character background, equipment, relationships..."
              />
            </div>

            {/* Quick Reference */}
            <div style={{ marginTop: '16px', fontSize: '9px', color: '#6b7280' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>QUICK REFERENCE</div>
              <div><strong>6:</strong> Full success</div>
              <div><strong>4-5:</strong> Partial success</div>
              <div><strong>1-3:</strong> Bad outcome</div>
              <div style={{ marginTop: '4px' }}>
                <strong>Resistance:</strong> 6 - highest die = stress
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Harm selection prompt modal */}
      {harmSelection.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1f2937', border: '2px solid #10b981', borderRadius: '8px', padding: '24px', minWidth: '300px' }}>
            <div style={{ fontWeight: 'bold', color: '#10b981', marginBottom: '12px' }}>
              Select which harm to reduce (Level {harmSelection.level})
            </div>
            {renderHarmOptions(harmSelection.level)}
            <button
              style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px', fontWeight: 'bold', marginTop: '8px', width: '100%' }}
              onClick={() => setHarmSelection({ show: false, level: null, options: [], onSelect: null })}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Trauma selection modal when stress reaches maximum */}
      {traumaSelection.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1f2937', border: '2px solid #ef4444', borderRadius: '8px', padding: '24px', minWidth: '350px', maxWidth: '500px' }}>
            <div style={{ fontWeight: 'bold', color: '#ef4444', marginBottom: '12px', fontSize: '14px', textAlign: 'center' }}>
              ⚠️ STRESS MAXED OUT ⚠️
            </div>
            <div style={{ color: '#fbbf24', marginBottom: '16px', fontSize: '12px', textAlign: 'center' }}>
              Your stress track is full! You must take a trauma condition to continue.
            </div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 'bold', color: '#10b981', marginBottom: '8px', fontSize: '12px' }}>
                Choose a trauma condition:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {traumaOptions.filter(trauma => !(character.trauma || []).includes(trauma.name)).map(trauma => (
                  <button
                    key={trauma.name}
                    title={trauma.description}
                    onClick={() => {
                      toggleTrauma(trauma.name);
                      // Completely reset stress track after taking trauma
                      const newStress = Array(maxStress).fill(false);
                      setCurrentCharacter(prev => ({...prev, stress: newStress}));
                      setTraumaSelection({ show: false, forced: false });
                    }}
                    style={{
                      background: '#374151',
                      border: '1px solid #10b981',
                      color: '#10b981',
                      padding: '8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '9px',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#4b5563'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#374151'}
                  >
                    {trauma.name}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ fontSize: '9px', color: '#6b7280', fontStyle: 'italic', textAlign: 'center' }}>
              Taking trauma will reset your stress track and allow you to continue.
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default CharacterSheet;
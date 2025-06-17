// Character data validation and error recovery utilities
export class CharacterValidationError extends Error {
  constructor(message, field, value) {
    super(message);
    this.name = 'CharacterValidationError';
    this.field = field;
    this.value = value;
  }
}

// Deep clone utility to prevent reference issues
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const clonedObj = {};
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
};

// Default character template with empty defaults
export const getDefaultCharacter = () => ({
  trueName: '',
  alias: '',
  crew: '',
  look: '',
  heritage: '',
  playbook: '',
  vice: '',
  standName: '',
  coinStats: {
    power: 0,
    speed: 0,
    range: 0,
    durability: 0,
    precision: 0,
    development: 0
  },
  skills: {
    insight: { hunt: 0, study: 0, survey: 0, tinker: 0 },
    prowess: { finesse: 0, prowl: 0, skirmish: 0, wreck: 0 },
    resolve: { bizarre: 0, command: 0, consort: 0, sway: 0 }
  },
  specialAbilities: [],
  standardAbilities: [],
  playbookAbilities: [],
  customAbilities: [],
  selectedDetriments: [],
  selectedBenefits: [],
  xp: {
    insight: 0,
    prowess: 0,
    resolve: 0,
    playbook: 0
  },
  stress: Array(12).fill(false),
  trauma: [],
  harm: { level3: '', level2_0: '', level2_1: '', level1_0: '', level1_1: '' },
  wanted: 0,
  friend: '',
  rival: '',
  description: '',
  equipment: [],
  background: '',
  notes: ''
});

// Validation functions
export const validateSkillPoints = (skills) => {
  if (!skills || typeof skills !== 'object') return { valid: false, error: 'Skills must be an object' };
  
  let totalPoints = 0;
  const maxPointsPerSkill = 2; // At character creation
  
  for (const [category, categorySkills] of Object.entries(skills)) {
    if (!categorySkills || typeof categorySkills !== 'object') {
      return { valid: false, error: `Skills category ${category} must be an object` };
    }
    
    for (const [skill, points] of Object.entries(categorySkills)) {
      if (typeof points !== 'number' || points < 0 || points > 4) {
        return { valid: false, error: `Skill ${skill} must be a number between 0-4` };
      }
      
      if (points > maxPointsPerSkill) {
        return { valid: false, error: `Skill ${skill} cannot exceed ${maxPointsPerSkill} points at creation` };
      }
      
      totalPoints += points;
    }
  }
  
  if (totalPoints > 7) {
    return { valid: false, error: `Total skill points (${totalPoints}) cannot exceed 7` };
  }
  
  return { valid: true, totalPoints };
};

export const validateCoinStats = (coinStats, characterXP = null) => {
  if (!coinStats || typeof coinStats !== 'object') return { valid: false, error: 'Coin stats must be an object' };
  
  const requiredStats = ['power', 'speed', 'range', 'durability', 'precision', 'development'];
  let totalPoints = 0;
  
  for (const stat of requiredStats) {
    if (!(stat in coinStats)) {
      return { valid: false, error: `Missing coin stat: ${stat}` };
    }
    
    const value = coinStats[stat];
    if (typeof value !== 'number' || value < 0 || value > 5) {
      return { valid: false, error: `Coin stat ${stat} must be a number between 0-5` };
    }
    
    totalPoints += value;
  }
  
  // Base limit is 10 points, but can be increased with XP
  let maxPoints = 10;
  if (characterXP?.playbook) {
    // Each 10 playbook XP spent allows +1 to coin stats
    const bonusPoints = Math.floor(characterXP.playbook / 10);
    maxPoints += bonusPoints;
  }
  
  if (totalPoints > maxPoints) {
    return { valid: false, error: `Total coin points (${totalPoints}) cannot exceed ${maxPoints}` };
  }
  
  return { valid: true, totalPoints, maxPoints };
};

export const validateHeritageHP = (heritage, selectedBenefits = [], selectedDetriments = [], bonusHPFromXP = 0, heritageData = null) => {
  // Use dynamic heritage data - no hardcoded fallbacks to ensure everything is dynamic
  let baseHP = 0;
  if (heritageData && heritageData[heritage]) {
    baseHP = heritageData[heritage].baseHP || 0;
  }
  // If no dynamic data available, base HP remains 0 - this encourages proper API loading
  
  let detrimentHP = 0;
  let benefitCost = 0;
  
  for (const detriment of selectedDetriments) {
    if (typeof detriment.hp === 'number') {
      detrimentHP += detriment.hp;
    }
  }
  
  for (const benefit of selectedBenefits) {
    if (typeof benefit.cost === 'number') {
      benefitCost += benefit.cost;
    }
  }
  
  const totalHP = baseHP + detrimentHP + bonusHPFromXP;
  const remainingHP = totalHP - benefitCost;
  
  if (remainingHP < 0) {
    return { 
      valid: false, 
      error: `Insufficient HP. Have ${totalHP}, need ${benefitCost}`,
      totalHP,
      usedHP: benefitCost,
      remainingHP
    };
  }
  
  return { 
    valid: true, 
    totalHP,
    usedHP: benefitCost,
    remainingHP
  };
};

export const validateXPSpending = (currentXP, spendingTrack, amount) => {
  if (!currentXP || typeof currentXP !== 'object') {
    return { valid: false, error: 'XP data must be an object' };
  }
  
  const available = currentXP[spendingTrack] || 0;
  if (available < amount) {
    return { 
      valid: false, 
      error: `Insufficient ${spendingTrack} XP. Have ${available}, need ${amount}` 
    };
  }
  
  return { valid: true, available, remaining: available - amount };
};

// Character sanitization - fixes common data corruption issues
export const sanitizeCharacter = (character) => {
  if (!character || typeof character !== 'object') {
    console.warn('Invalid character data, returning default');
    return getDefaultCharacter();
  }
  
  const sanitized = deepClone(getDefaultCharacter());
  
  // Safely copy each field with validation
  try {
    // Basic string fields
    const stringFields = ['trueName', 'alias', 'crew', 'look', 'heritage', 'playbook', 'vice', 'standName', 'friend', 'rival', 'description', 'background', 'notes'];
    for (const field of stringFields) {
      if (typeof character[field] === 'string') {
        sanitized[field] = character[field];
      }
    }
    
    // Coin stats with validation
    if (character.coinStats && typeof character.coinStats === 'object') {
      for (const [stat, value] of Object.entries(character.coinStats)) {
        if (stat in sanitized.coinStats && typeof value === 'number' && value >= 0 && value <= 5) {
          sanitized.coinStats[stat] = value;
        }
      }
    }
    
    // Skills with validation
    if (character.skills && typeof character.skills === 'object') {
      for (const [category, categorySkills] of Object.entries(character.skills)) {
        if (sanitized.skills[category] && typeof categorySkills === 'object') {
          for (const [skill, value] of Object.entries(categorySkills)) {
            if (skill in sanitized.skills[category] && typeof value === 'number' && value >= 0 && value <= 4) {
              sanitized.skills[category][skill] = value;
            }
          }
        }
      }
    }
    
    // Arrays
    const arrayFields = ['specialAbilities', 'standardAbilities', 'playbookAbilities', 'customAbilities', 'selectedDetriments', 'selectedBenefits', 'trauma', 'equipment'];
    for (const field of arrayFields) {
      if (Array.isArray(character[field])) {
        sanitized[field] = character[field].filter(item => item != null);
      }
    }
    
    // XP with validation
    if (character.xp && typeof character.xp === 'object') {
      for (const [track, value] of Object.entries(character.xp)) {
        if (track in sanitized.xp && typeof value === 'number' && value >= 0) {
          sanitized.xp[track] = Math.min(value, track === 'playbook' ? 100 : 50); // Reasonable caps
        }
      }
    }
    
    // Stress array
    if (Array.isArray(character.stress)) {
      sanitized.stress = character.stress.slice(0, 12).map(val => Boolean(val));
      // Pad if too short
      while (sanitized.stress.length < 12) {
        sanitized.stress.push(false);
      }
    }
    
    // Harm object
    if (character.harm && typeof character.harm === 'object') {
      const harmFields = ['level3', 'level2_0', 'level2_1', 'level1_0', 'level1_1'];
      for (const field of harmFields) {
        if (typeof character.harm[field] === 'string') {
          sanitized.harm[field] = character.harm[field];
        }
      }
    }
    
    // Numeric fields
    const numericFields = ['wanted'];
    for (const field of numericFields) {
      if (typeof character[field] === 'number' && character[field] >= 0) {
        sanitized[field] = Math.min(character[field], 20); // Reasonable cap
      }
    }
    
  } catch (error) {
    console.error('Error sanitizing character:', error);
    return getDefaultCharacter();
  }
  
  return sanitized;
};

// Validate entire character
export const validateCharacter = (character) => {
  const errors = [];
  
  try {
    // Validate skills
    const skillValidation = validateSkillPoints(character.skills);
    if (!skillValidation.valid) {
      errors.push(`Skills: ${skillValidation.error}`);
    }
    
    // Validate coin stats
    const coinValidation = validateCoinStats(character.coinStats, character.xp);
    if (!coinValidation.valid) {
      errors.push(`Coin Stats: ${coinValidation.error}`);
    }
    
    // Validate heritage HP
    const hpValidation = validateHeritageHP(
      character.heritage,
      character.selectedBenefits,
      character.selectedDetriments,
      character.bonusHPFromXP || 0
    );
    if (!hpValidation.valid) {
      errors.push(`Heritage HP: ${hpValidation.error}`);
    }
    
    return { valid: errors.length === 0, errors };
  } catch (error) {
    return { valid: false, errors: [`Validation error: ${error.message}`] };
  }
};

// Safe localStorage operations with error recovery
export const safeLoadFromStorage = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    
    const parsed = JSON.parse(item);
    return parsed;
  } catch (error) {
    console.error(`Error loading from localStorage key "${key}":`, error);
    // Clear corrupted data
    try {
      localStorage.removeItem(key);
    } catch (clearError) {
      console.error('Error clearing corrupted localStorage:', clearError);
    }
    return defaultValue;
  }
};

export const safeSaveToStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error saving to localStorage key "${key}":`, error);
    return false;
  }
};

// State consistency checker for rapid updates
export class StateConsistencyChecker {
  constructor() {
    this.lastValidState = null;
    this.updateCount = 0;
    this.errorCount = 0;
  }
  
  checkConsistency(newState) {
    this.updateCount++;
    
    try {
      const validation = validateCharacter(newState);
      if (!validation.valid) {
        this.errorCount++;
        console.warn('State consistency check failed:', validation.errors);
        
        // If we have too many errors or no last valid state, return sanitized version
        if (this.errorCount > 3 || !this.lastValidState) {
          const sanitized = sanitizeCharacter(newState);
          this.lastValidState = sanitized;
          this.errorCount = 0;
          return sanitized;
        }
        
        // Return last known valid state
        return this.lastValidState;
      }
      
      // State is valid, update our reference
      this.lastValidState = deepClone(newState);
      this.errorCount = 0;
      return newState;
    } catch (error) {
      console.error('State consistency check error:', error);
      return this.lastValidState || sanitizeCharacter(newState);
    }
  }
  
  getStats() {
    return {
      updateCount: this.updateCount,
      errorCount: this.errorCount,
      hasValidState: !!this.lastValidState
    };
  }
}

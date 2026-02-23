// API service for character sheet backend integration

import { gradeToIndex, indexToGrade, DUR_TABLE, DEFAULT_TRAUMA } from '../constants/srd';

const API_BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:8000/api').replace(/\/+$/, '');

// Helper function for API requests
const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('authToken');
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Token ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${path}`;

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = (Array.isArray(errorData.non_field_errors) && errorData.non_field_errors[0])
        || errorData.detail
        || errorData.error
        || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(message);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// Character API functions
export const characterAPI = {
  // Get all characters for current user
  getCharacters: () => apiRequest('/characters/'),
  
  // Get single character by ID
  getCharacter: (id) => apiRequest(`/characters/${id}/`),
  
  // Create new character
  createCharacter: (characterData) => apiRequest('/characters/', {
    method: 'POST',
    body: JSON.stringify(characterData),
  }),
  
  // Update character
  updateCharacter: (id, characterData) => apiRequest(`/characters/${id}/`, {
    method: 'PUT',
    body: JSON.stringify(characterData),
  }),
  
  // Partial update character
  patchCharacter: (id, characterData) => apiRequest(`/characters/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(characterData),
  }),
  
  // Delete character
  deleteCharacter: (id) => apiRequest(`/characters/${id}/`, {
    method: 'DELETE',
  }),
  
  // Roll action dice
  rollAction: (id, actionData) => apiRequest(`/characters/${id}/roll-action/`, {
    method: 'POST',
    body: JSON.stringify(actionData),
  }),
  
  // Add XP to character
  addXP: (id, xpData) => apiRequest(`/characters/${id}/add-xp/`, {
    method: 'POST',
    body: JSON.stringify(xpData),
  }),
  
  // Take harm
  takeHarm: (id, harmData) => apiRequest(`/characters/${id}/take-harm/`, {
    method: 'POST',
    body: JSON.stringify(harmData),
  }),
  
  // Heal harm
  healHarm: (id, healData) => apiRequest(`/characters/${id}/heal-harm/`, {
    method: 'POST',
    body: JSON.stringify(healData),
  }),
  
  // Indulge vice
  indulgeVice: (id, viceData) => apiRequest(`/characters/${id}/indulge-vice/`, {
    method: 'POST',
    body: JSON.stringify(viceData),
  }),
  
  // Log armor expenditure
  logArmorExpenditure: (id, armorData) => apiRequest(`/characters/${id}/log-armor-expenditure/`, {
    method: 'POST',
    body: JSON.stringify(armorData),
  }),
  
  // Add progress clock
  addProgressClock: (id, clockData) => apiRequest(`/characters/${id}/add-progress-clock/`, {
    method: 'POST',
    body: JSON.stringify(clockData),
  }),
  
  // Update progress clock
  updateProgressClock: (id, clockData) => apiRequest(`/characters/${id}/update-progress-clock/`, {
    method: 'POST',
    body: JSON.stringify(clockData),
  }),
};

// Reference data API functions
export const referenceAPI = {
  // Get all heritages
  getHeritages: () => apiRequest('/heritages/'),
  
  // Get all vices
  getVices: () => apiRequest('/vices/'),
  
  // Get all abilities
  getAbilities: () => apiRequest('/abilities/'),
  
  // Get all hamon abilities
  getHamonAbilities: () => apiRequest('/hamon-abilities/'),
  
  // Get all spin abilities
  getSpinAbilities: () => apiRequest('/spin-abilities/'),
  
  // Get all trauma conditions
  getTraumas: () => apiRequest('/traumas/'),
  
  // Get available playbook abilities
  getAvailablePlaybookAbilities: (playbook, coinStats) => apiRequest('/get-available-playbook-abilities/', {
    method: 'POST',
    body: JSON.stringify({ playbook, coin_stats: coinStats }),
  }),
};

// Campaign API functions
export const campaignAPI = {
  // Get all campaigns for current user
  getCampaigns: () => apiRequest('/campaigns/'),
  
  // Get single campaign
  getCampaign: (id) => apiRequest(`/campaigns/${id}/`),
  
  // Create campaign
  createCampaign: (campaignData) => apiRequest('/campaigns/', {
    method: 'POST',
    body: JSON.stringify(campaignData),
  }),
  
  // Update campaign
  updateCampaign: (id, campaignData) => apiRequest(`/campaigns/${id}/`, {
    method: 'PUT',
    body: JSON.stringify(campaignData),
  }),
};

// Faction API functions (factions are per-campaign, created by GM)
export const factionAPI = {
  getFactions: (campaignId) =>
    campaignId
      ? apiRequest(`/factions/?campaign=${campaignId}`)
      : apiRequest('/factions/'),
  getFaction: (id) => apiRequest(`/factions/${id}/`),
  createFaction: (data) => apiRequest('/factions/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateFaction: (id, data) => apiRequest(`/factions/${id}/`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteFaction: (id) => apiRequest(`/factions/${id}/`, { method: 'DELETE' }),
};

// Crew API functions
export const crewAPI = {
  // Get all crews
  getCrews: () => apiRequest('/crews/'),
  
  // Get single crew
  getCrew: (id) => apiRequest(`/crews/${id}/`),
  
  // Create crew
  createCrew: (crewData) => apiRequest('/crews/', {
    method: 'POST',
    body: JSON.stringify(crewData),
  }),
  
  // Update crew
  updateCrew: (id, crewData) => apiRequest(`/crews/${id}/`, {
    method: 'PUT',
    body: JSON.stringify(crewData),
  }),
};

// NPC API functions (GM / campaign NPCs)
export const npcAPI = {
  getNPCs: (campaignId) =>
    campaignId
      ? apiRequest(`/npcs/?campaign=${campaignId}`)
      : apiRequest('/npcs/'),
  getNPC: (id) => apiRequest(`/npcs/${id}/`),
  createNPC: (data) => apiRequest('/npcs/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateNPC: (id, data) => apiRequest(`/npcs/${id}/`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteNPC: (id) => apiRequest(`/npcs/${id}/`, { method: 'DELETE' }),
};

// Session API functions
export const sessionAPI = {
  // Get sessions for campaign
  getSessions: (campaignId) => apiRequest(`/sessions/?campaign=${campaignId}`),
  
  // Get single session
  getSession: (id) => apiRequest(`/sessions/${id}/`),
  
  // Create session
  createSession: (sessionData) => apiRequest('/sessions/', {
    method: 'POST',
    body: JSON.stringify(sessionData),
  }),
  
  // Update session
  updateSession: (id, sessionData) => apiRequest(`/sessions/${id}/`, {
    method: 'PUT',
    body: JSON.stringify(sessionData),
  }),
};

// Global search
export const searchAPI = {
  globalSearch: (query) => apiRequest(`/global-search/?q=${encodeURIComponent(query)}`),
};

// Authentication API functions
export const authAPI = {
  // Login
  login: (credentials) => apiRequest('/login/', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),
  
  // Register
  register: (userData) => apiRequest('/register/', {
    method: 'POST',
    body: JSON.stringify(userData),
  }),
  
  // Logout (clear token)
  logout: () => {
    localStorage.removeItem('authToken');
  },
  
  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('authToken');
  },
};

// Data transformation helpers
export const transformBackendToFrontend = (backendCharacter) => {
  return {
    id: backendCharacter.id,
    name: backendCharacter.true_name || '',
    standName: backendCharacter.stand_name || '',
    heritage: backendCharacter.heritage?.name || 'Human',
    background: backendCharacter.background_note || '',
    look: backendCharacter.appearance || '',
    vice: backendCharacter.vice?.name || '',
    crew: backendCharacter.crew?.name || '',
    
    // Action ratings (convert from action_dots)
    actionRatings: {
      HUNT: backendCharacter.action_dots?.hunt || 0,
      STUDY: backendCharacter.action_dots?.study || 0,
      SURVEY: backendCharacter.action_dots?.survey || 0,
      TINKER: backendCharacter.action_dots?.tinker || 0,
      FINESSE: backendCharacter.action_dots?.finesse || 0,
      PROWL: backendCharacter.action_dots?.prowl || 0,
      SKIRMISH: backendCharacter.action_dots?.skirmish || 0,
      WRECK: backendCharacter.action_dots?.wreck || 0,
      BIZARRE: backendCharacter.action_dots?.attune || 0, // Note: backend uses 'attune'
      COMMAND: backendCharacter.action_dots?.command || 0,
      CONSORT: backendCharacter.action_dots?.consort || 0,
      SWAY: backendCharacter.action_dots?.sway || 0,
    },
    
    // Stand stats: backend uses grade letters (F–A/S), frontend uses index 0–4
    standStats: {
      power: gradeToIndex(backendCharacter.stand?.power),
      speed: gradeToIndex(backendCharacter.stand?.speed),
      range: gradeToIndex(backendCharacter.stand?.range),
      durability: gradeToIndex(backendCharacter.stand?.durability),
      precision: gradeToIndex(backendCharacter.stand?.precision),
      development: gradeToIndex(backendCharacter.stand?.development),
    },
    
    // Stress: backend integer; frontend uses filled count + array for compatibility
    stressFilled: Math.max(0, backendCharacter.stress ?? 0),
    stress: (() => {
      const dur = gradeToIndex(backendCharacter.stand?.durability);
      const maxStress = 9 + (DUR_TABLE[dur]?.stressBonus ?? 0);
      const filled = Math.min(backendCharacter.stress ?? 0, maxStress);
      return Array(maxStress).fill(false).map((_, i) => i < filled);
    })(),
    // Trauma: backend list of IDs; build checkbox object from trauma_details
    trauma: (() => {
      const details = backendCharacter.trauma_details || [];
      const names = details.map((t) => (t.name || '').toUpperCase());
      return { ...DEFAULT_TRAUMA, ...Object.fromEntries(names.map((n) => [n, true])) };
    })(),
    
    // Armor
    regularArmorUsed: 0, // derived from light_armor_used + heavy_armor_used if needed
    specialArmorUsed: false,
    armor: {
      armor: backendCharacter.light_armor_used || false,
      heavy: backendCharacter.heavy_armor_used || false,
      special: false,
    },
    
    // Harm: backend has level1/2/3_used + _name (single); frontend uses arrays
    harm: {
      level3: [backendCharacter.harm_level3_used ? (backendCharacter.harm_level3_name || '') : ''],
      level2: [
        backendCharacter.harm_level2_used ? (backendCharacter.harm_level2_name || '') : '',
        '',
      ],
      level1: [
        backendCharacter.harm_level1_used ? (backendCharacter.harm_level1_name || '') : '',
        '',
      ],
    },
    harmEntries: {
      level3: [backendCharacter.harm_level3_used ? (backendCharacter.harm_level3_name || '') : ''],
      level2: [
        backendCharacter.harm_level2_used ? (backendCharacter.harm_level2_name || '') : '',
        '',
      ],
      level1: [
        backendCharacter.harm_level1_used ? (backendCharacter.harm_level1_name || '') : '',
        '',
      ],
    },
    
    // Coin and stash
    coin: Array(4).fill(false), // Not in backend model
    stash: Array(40).fill(false), // Not in backend model
    
    // Healing clock
    healingClock: backendCharacter.healing_clock_filled || 0,
    
    // XP tracks
    xp: backendCharacter.xp_clocks || {
      insight: 0, prowess: 0, resolve: 0, heritage: 0, playbook: 0
    },
    
    // Abilities
    abilities: [
      ...(backendCharacter.standard_ability_details || []),
      ...(backendCharacter.hamon_ability_details || []),
      ...(backendCharacter.spin_ability_details || []),
    ],
    
    // Progress clocks
    clocks: backendCharacter.progress_clocks || [],
    
    // Additional backend fields
    campaign: backendCharacter.campaign,
    playbook: backendCharacter.playbook,
    level: backendCharacter.level,
    loadout: backendCharacter.loadout,
    inventory: backendCharacter.inventory || [],
    reputation_status: backendCharacter.reputation_status || {},
  };
};

export const transformFrontendToBackend = (frontendCharacter) => {
  const viceVal = frontendCharacter.vice;
  const isViceName = typeof viceVal === 'string' && viceVal.trim() !== '';
  return {
    true_name: frontendCharacter.name,
    stand_name: frontendCharacter.standName,
    heritage: frontendCharacter.heritage,
    background_note: frontendCharacter.background,
    appearance: frontendCharacter.look,
    ...(isViceName ? { custom_vice: viceVal } : { vice: viceVal }),
    
    // Action dots
    action_dots: {
      hunt: frontendCharacter.actionRatings.HUNT,
      study: frontendCharacter.actionRatings.STUDY,
      survey: frontendCharacter.actionRatings.SURVEY,
      tinker: frontendCharacter.actionRatings.TINKER,
      finesse: frontendCharacter.actionRatings.FINESSE,
      prowl: frontendCharacter.actionRatings.PROWL,
      skirmish: frontendCharacter.actionRatings.SKIRMISH,
      wreck: frontendCharacter.actionRatings.WRECK,
      attune: frontendCharacter.actionRatings.BIZARRE, // Note: backend uses 'attune'
      command: frontendCharacter.actionRatings.COMMAND,
      consort: frontendCharacter.actionRatings.CONSORT,
      sway: frontendCharacter.actionRatings.SWAY,
    },
    
    // Stand: backend may use coin_stats (JSON) and/or nested stand; send grade letters (F–A)
    coin_stats: {
      power: indexToGrade(frontendCharacter.standStats?.power),
      speed: indexToGrade(frontendCharacter.standStats?.speed),
      range: indexToGrade(frontendCharacter.standStats?.range),
      durability: indexToGrade(frontendCharacter.standStats?.durability),
      precision: indexToGrade(frontendCharacter.standStats?.precision),
      development: indexToGrade(frontendCharacter.standStats?.development),
    },
    stand: {
      name: frontendCharacter.standName,
      power: indexToGrade(frontendCharacter.standStats?.power),
      speed: indexToGrade(frontendCharacter.standStats?.speed),
      range: indexToGrade(frontendCharacter.standStats?.range),
      durability: indexToGrade(frontendCharacter.standStats?.durability),
      precision: indexToGrade(frontendCharacter.standStats?.precision),
      development: indexToGrade(frontendCharacter.standStats?.development),
    },
    
    // Stress: backend integer; accept stressFilled or array length
    stress: typeof frontendCharacter.stressFilled === 'number'
      ? frontendCharacter.stressFilled
      : Array.isArray(frontendCharacter.stress)
        ? frontendCharacter.stress.filter(Boolean).length
        : (frontendCharacter.stress || 0),
    // Trauma: backend expects list of Trauma IDs (caller should resolve object keys to IDs via reference)
    trauma: Array.isArray(frontendCharacter.trauma)
      ? frontendCharacter.trauma
      : [],
    
    // Armor
    light_armor_used: frontendCharacter.armor.armor,
    heavy_armor_used: frontendCharacter.armor.heavy,
    
    // Harm (first slot per level; backend has single name per level)
    harm_level3_used: (frontendCharacter.harmEntries?.level3?.[0] ?? frontendCharacter.harm?.level3?.[0] ?? '') !== '',
    harm_level3_name: (frontendCharacter.harmEntries?.level3?.[0] ?? frontendCharacter.harm?.level3?.[0] ?? '') || '',
    harm_level2_used: (frontendCharacter.harmEntries?.level2?.[0] ?? frontendCharacter.harm?.level2?.[0] ?? '') !== '',
    harm_level2_name: (frontendCharacter.harmEntries?.level2?.[0] ?? frontendCharacter.harm?.level2?.[0] ?? '') || '',
    harm_level1_used: (frontendCharacter.harmEntries?.level1?.[0] ?? frontendCharacter.harm?.level1?.[0] ?? '') !== '',
    harm_level1_name: (frontendCharacter.harmEntries?.level1?.[0] ?? frontendCharacter.harm?.level1?.[0] ?? '') || '',
    
    // XP clocks
    xp_clocks: frontendCharacter.xp,
    
    // Progress clocks
    progress_clocks: frontendCharacter.clocks,
    
    // Additional fields (safe defaults for new character)
    inventory: frontendCharacter.inventory ?? [],
    reputation_status: frontendCharacter.reputation_status ?? {},
  };
}; 
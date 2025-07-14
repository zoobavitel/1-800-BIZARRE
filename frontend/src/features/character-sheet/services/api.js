// API service for character sheet backend integration

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

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

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
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
    
    // Stand stats (convert from coin_stats)
    standStats: {
      power: backendCharacter.stand?.power || 1,
      speed: backendCharacter.stand?.speed || 1,
      range: backendCharacter.stand?.range || 1,
      durability: backendCharacter.stand?.durability || 1,
      precision: backendCharacter.stand?.precision || 1,
      development: backendCharacter.stand?.development || 1,
    },
    
    // Stress and trauma
    stress: Array(backendCharacter.stress || 9).fill(false),
    trauma: backendCharacter.trauma || [],
    
    // Armor
    armor: {
      armor: backendCharacter.light_armor_used || false,
      heavy: backendCharacter.heavy_armor_used || false,
      special: false, // Not in backend model
    },
    
    // Harm entries
    harmEntries: {
      level3: backendCharacter.harm_level3_used ? [backendCharacter.harm_level3_name || ''] : [''],
      level2: backendCharacter.harm_level2_used ? [backendCharacter.harm_level2_name || ''] : [''],
      level1: backendCharacter.harm_level1_used ? [backendCharacter.harm_level1_name || ''] : [''],
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
    crew: backendCharacter.crew,
    playbook: backendCharacter.playbook,
    level: backendCharacter.level,
    loadout: backendCharacter.loadout,
    inventory: backendCharacter.inventory || [],
    reputation_status: backendCharacter.reputation_status || {},
  };
};

export const transformFrontendToBackend = (frontendCharacter) => {
  return {
    true_name: frontendCharacter.name,
    stand_name: frontendCharacter.standName,
    heritage: frontendCharacter.heritage,
    background_note: frontendCharacter.background,
    appearance: frontendCharacter.look,
    vice: frontendCharacter.vice,
    
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
    
    // Stand data
    stand: {
      name: frontendCharacter.standName,
      power: frontendCharacter.standStats.power,
      speed: frontendCharacter.standStats.speed,
      range: frontendCharacter.standStats.range,
      durability: frontendCharacter.standStats.durability,
      precision: frontendCharacter.standStats.precision,
      development: frontendCharacter.standStats.development,
    },
    
    // Stress and trauma
    stress: frontendCharacter.stress.filter(Boolean).length,
    trauma: frontendCharacter.trauma,
    
    // Armor
    light_armor_used: frontendCharacter.armor.armor,
    heavy_armor_used: frontendCharacter.armor.heavy,
    
    // Harm
    harm_level3_used: frontendCharacter.harmEntries.level3[0] !== '',
    harm_level3_name: frontendCharacter.harmEntries.level3[0] || '',
    harm_level2_used: frontendCharacter.harmEntries.level2[0] !== '',
    harm_level2_name: frontendCharacter.harmEntries.level2[0] || '',
    harm_level1_used: frontendCharacter.harmEntries.level1[0] !== '',
    harm_level1_name: frontendCharacter.harmEntries.level1[0] || '',
    
    // XP clocks
    xp_clocks: frontendCharacter.xp,
    
    // Progress clocks
    progress_clocks: frontendCharacter.clocks,
    
    // Additional fields
    inventory: frontendCharacter.inventory,
    reputation_status: frontendCharacter.reputation_status,
  };
}; 
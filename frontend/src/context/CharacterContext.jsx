// Character management context
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { useCharacterValidation, useLocalStorage } from '../hooks';
import { sanitizeCharacter, getDefaultCharacter } from '../utils/characterValidation';

const CharacterContext = createContext();

// Character actions
const CHARACTER_ACTIONS = {
  SET_CHARACTER: 'SET_CHARACTER',
  UPDATE_SKILL: 'UPDATE_SKILL',
  UPDATE_COIN_STAT: 'UPDATE_COIN_STAT',
  UPDATE_HERITAGE: 'UPDATE_HERITAGE',
  ADD_TAB: 'ADD_TAB',
  CLOSE_TAB: 'CLOSE_TAB',
  SET_ACTIVE_TAB: 'SET_ACTIVE_TAB',
  SET_SAVE_STATUS: 'SET_SAVE_STATUS',
  RECOVER_CHARACTER: 'RECOVER_CHARACTER'
};

// Character reducer
const characterReducer = (state, action) => {
  switch (action.type) {
    case CHARACTER_ACTIONS.SET_CHARACTER:
      return {
        ...state,
        tabs: state.tabs.map(tab => 
          tab.id === state.activeTab 
            ? { ...tab, character: action.payload }
            : tab
        )
      };

    case CHARACTER_ACTIONS.UPDATE_SKILL:
      const { category, skill, value } = action.payload;
      return {
        ...state,
        tabs: state.tabs.map(tab => 
          tab.id === state.activeTab 
            ? {
                ...tab,
                character: {
                  ...tab.character,
                  skills: {
                    ...tab.character.skills,
                    [category]: {
                      ...tab.character.skills[category],
                      [skill]: value
                    }
                  }
                }
              }
            : tab
        )
      };

    case CHARACTER_ACTIONS.UPDATE_COIN_STAT:
      const { stat, value: statValue } = action.payload;
      return {
        ...state,
        tabs: state.tabs.map(tab => 
          tab.id === state.activeTab 
            ? {
                ...tab,
                character: {
                  ...tab.character,
                  coinStats: {
                    ...tab.character.coinStats,
                    [stat]: statValue
                  }
                }
              }
            : tab
        )
      };

    case CHARACTER_ACTIONS.ADD_TAB:
      const newTab = {
        id: `tab-${Date.now()}`,
        name: 'New Character',
        character: getDefaultCharacter()
      };
      return {
        ...state,
        tabs: [...state.tabs, newTab],
        activeTab: newTab.id
      };

    case CHARACTER_ACTIONS.CLOSE_TAB:
      const filteredTabs = state.tabs.filter(tab => tab.id !== action.payload);
      const newActiveTab = state.activeTab === action.payload 
        ? (filteredTabs[0]?.id || null)
        : state.activeTab;
      
      return {
        ...state,
        tabs: filteredTabs,
        activeTab: newActiveTab
      };

    case CHARACTER_ACTIONS.SET_ACTIVE_TAB:
      return {
        ...state,
        activeTab: action.payload
      };

    case CHARACTER_ACTIONS.SET_SAVE_STATUS:
      return {
        ...state,
        saveStatus: action.payload
      };

    case CHARACTER_ACTIONS.RECOVER_CHARACTER:
      return {
        ...state,
        tabs: state.tabs.map(tab => 
          tab.id === state.activeTab 
            ? { ...tab, character: sanitizeCharacter(tab.character) }
            : tab
        )
      };

    default:
      return state;
  }
};

// Initial state
const initialState = {
  tabs: [{
    id: 'default-tab',
    name: 'New Character',
    character: getDefaultCharacter()
  }],
  activeTab: 'default-tab',
  saveStatus: ''
};

// Character provider component
export const CharacterProvider = ({ children }) => {
  const [state, dispatch] = useReducer(characterReducer, initialState);
  const [storedTabs, setStoredTabs] = useLocalStorage('characterTabs', []);
  
  // Get current character
  const currentCharacter = state.tabs.find(tab => tab.id === state.activeTab)?.character;
  
  // Use validation hook
  const { validation, validateAndSanitize, stateChecker } = useCharacterValidation(currentCharacter);

  // Load saved data on mount
  useEffect(() => {
    if (storedTabs.length > 0) {
      const sanitizedTabs = storedTabs.map(tab => ({
        ...tab,
        character: sanitizeCharacter(tab.character)
      }));
      
      dispatch({ 
        type: CHARACTER_ACTIONS.SET_CHARACTER, 
        payload: { tabs: sanitizedTabs, activeTab: sanitizedTabs[0].id }
      });
    }
  }, []);

  // Auto-save when tabs change
  useEffect(() => {
    if (state.tabs.length > 0) {
      setStoredTabs(state.tabs);
    }
  }, [state.tabs, setStoredTabs]);

  // Actions
  const actions = {
    setCharacter: (character) => {
      const { character: validatedCharacter } = validateAndSanitize(character);
      dispatch({ type: CHARACTER_ACTIONS.SET_CHARACTER, payload: validatedCharacter });
    },

    updateSkill: (category, skill, value) => {
      dispatch({ 
        type: CHARACTER_ACTIONS.UPDATE_SKILL, 
        payload: { category, skill, value }
      });
    },

    updateCoinStat: (stat, value) => {
      dispatch({ 
        type: CHARACTER_ACTIONS.UPDATE_COIN_STAT, 
        payload: { stat, value }
      });
    },

    updateHeritage: (heritage) => {
      dispatch({
        type: CHARACTER_ACTIONS.UPDATE_HERITAGE,
        payload: heritage
      });
    },

    addTab: () => {
      dispatch({ type: CHARACTER_ACTIONS.ADD_TAB });
    },

    closeTab: (tabId) => {
      if (state.tabs.length > 1) {
        dispatch({ type: CHARACTER_ACTIONS.CLOSE_TAB, payload: tabId });
      }
    },

    setActiveTab: (tabId) => {
      dispatch({ type: CHARACTER_ACTIONS.SET_ACTIVE_TAB, payload: tabId });
    },

    setSaveStatus: (status) => {
      dispatch({ type: CHARACTER_ACTIONS.SET_SAVE_STATUS, payload: status });
    },

    recoverCharacter: () => {
      dispatch({ type: CHARACTER_ACTIONS.RECOVER_CHARACTER });
    }
  };

  const value = {
    ...state,
    currentCharacter,
    validation,
    actions,
    stateChecker
  };

  return (
    <CharacterContext.Provider value={value}>
      {children}
    </CharacterContext.Provider>
  );
};

// Custom hook to use character context
export const useCharacter = () => {
  const context = useContext(CharacterContext);
  if (!context) {
    throw new Error('useCharacter must be used within a CharacterProvider');
  }
  return context;
};

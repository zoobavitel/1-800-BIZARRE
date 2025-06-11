// Custom hook for debouncing values
import { useState, useEffect } from 'react';

export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Custom hook for localStorage with error handling
export const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
};

// Custom hook for character validation
import { 
  validateCharacter, 
  StateConsistencyChecker,
  sanitizeCharacter 
} from '../utils/characterValidation';

export const useCharacterValidation = (character) => {
  const [validation, setValidation] = useState({ valid: true, errors: [] });
  const [stateChecker] = useState(() => new StateConsistencyChecker());

  useEffect(() => {
    if (character) {
      const result = validateCharacter(character);
      setValidation(result);
    }
  }, [character]);

  const validateAndSanitize = (newCharacter) => {
    try {
      const consistentCharacter = stateChecker.checkConsistency(newCharacter);
      const validation = validateCharacter(consistentCharacter);
      
      return {
        character: consistentCharacter,
        validation,
        isValid: validation.valid
      };
    } catch (error) {
      console.error('Validation error:', error);
      const sanitized = sanitizeCharacter(newCharacter);
      return {
        character: sanitized,
        validation: { valid: false, errors: ['Character data was corrupted and recovered'] },
        isValid: false
      };
    }
  };

  return {
    validation,
    validateAndSanitize,
    stateChecker
  };
};

// Custom hook for auto-save functionality
export const useAutoSave = (data, key, delay = 1000) => {
  const debouncedData = useDebounce(data, delay);
  const [, setStoredData] = useLocalStorage(key, null);
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    if (debouncedData) {
      try {
        setStoredData(debouncedData);
        setSaveStatus('Saved');
        const timer = setTimeout(() => setSaveStatus(''), 2000);
        return () => clearTimeout(timer);
      } catch (error) {
        console.error('Auto-save failed:', error);
        setSaveStatus('Save failed');
        const timer = setTimeout(() => setSaveStatus(''), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [debouncedData, setStoredData]);

  return saveStatus;
};

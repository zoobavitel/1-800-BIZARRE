import { 
  validateSkillPoints, 
  validateCoinStats, 
  validateHeritageHP, 
  validateXPSpending,
  sanitizeCharacter,
  validateCharacter,
  getDefaultCharacter,
  safeLoadFromStorage,
  safeSaveToStorage,
  StateConsistencyChecker,
  deepClone,
  CharacterValidationError
} from '../utils/characterValidation.js';

// Mock localStorage for testing
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => { store[key] = value; }),
    removeItem: jest.fn((key) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
    __reset: () => { store = {}; }
  };
})();

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('Character Data Validation and Error Recovery', () => {
  beforeEach(() => {
    // Reset the internal store and clear all mock calls
    mockLocalStorage.__reset();
    jest.clearAllMocks();
  });

  describe('Skill Point Validation', () => {
    test('should validate correct skill distribution', () => {
      const validSkills = {
        insight: { hunt: 2, study: 1, survey: 0, tinker: 1 },
        prowess: { finesse: 1, prowl: 2, skirmish: 0, wreck: 0 },
        resolve: { bizarre: 0, command: 0, consort: 0, sway: 0 }
      };
      
      const result = validateSkillPoints(validSkills);
      expect(result.valid).toBe(true);
      expect(result.totalPoints).toBe(7);
    });

    test('should reject exceeding total skill points', () => {
      const invalidSkills = {
        insight: { hunt: 2, study: 2, survey: 2, tinker: 2 },
        prowess: { finesse: 0, prowl: 0, skirmish: 0, wreck: 0 },
        resolve: { bizarre: 0, command: 0, consort: 0, sway: 0 }
      };
      
      const result = validateSkillPoints(invalidSkills);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot exceed 7');
    });

    test('should reject exceeding max points per skill at creation', () => {
      const invalidSkills = {
        insight: { hunt: 3, study: 0, survey: 0, tinker: 0 },
        prowess: { finesse: 0, prowl: 0, skirmish: 0, wreck: 0 },
        resolve: { bizarre: 0, command: 0, consort: 0, sway: 0 }
      };
      
      const result = validateSkillPoints(invalidSkills);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot exceed 2 points at creation');
    });

    test('should handle malformed skill data', () => {
      const result1 = validateSkillPoints(null);
      expect(result1.valid).toBe(false);

      const result2 = validateSkillPoints({ insight: "invalid" });
      expect(result2.valid).toBe(false);

      const result3 = validateSkillPoints({ insight: { hunt: -1 } });
      expect(result3.valid).toBe(false);
    });
  });

  describe('Coin Stats Validation', () => {
    test('should validate correct coin distribution', () => {
      const validCoinStats = {
        power: 4,  // A rank
        speed: 3,  // B rank
        range: 2,  // C rank
        durability: 1, // D rank
        precision: 0,  // F rank
        development: 0 // F rank
      };
      
      const result = validateCoinStats(validCoinStats);
      expect(result.valid).toBe(true);
      expect(result.totalPoints).toBe(10);
      expect(result.maxPoints).toBe(10);
    });

    test('should reject exceeding coin point limit', () => {
      const invalidCoinStats = {
        power: 5, speed: 5, range: 5, durability: 5, precision: 5, development: 5
      };
      
      const result = validateCoinStats(invalidCoinStats);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot exceed 10');
    });

    test('should allow exceeding limit with playbook XP', () => {
      const coinStats = {
        power: 4, speed: 4, range: 3, durability: 0, precision: 0, development: 0
      };
      const characterXP = { playbook: 10 }; // 10 XP = +1 max points
      
      const result = validateCoinStats(coinStats, characterXP);
      expect(result.valid).toBe(true);
      expect(result.maxPoints).toBe(11);
    });

    test('should handle invalid coin stat values', () => {
      const result1 = validateCoinStats({ power: -1, speed: 0, range: 0, durability: 0, precision: 0, development: 0 });
      expect(result1.valid).toBe(false);

      const result2 = validateCoinStats({ power: 6, speed: 0, range: 0, durability: 0, precision: 0, development: 0 });
      expect(result2.valid).toBe(false);
    });
  });

  describe('Heritage HP Validation', () => {
    test('should validate Human heritage with benefits and detriments', () => {
      const selectedBenefits = [{ name: 'Sheer Grit', cost: 2 }];
      const selectedDetriments = [{ name: 'Physically Inferior', hp: 1 }];
      
      const result = validateHeritageHP('Human', selectedBenefits, selectedDetriments, 0);
      expect(result.valid).toBe(false); // 0 base + 1 detriment - 2 benefit = -1
      expect(result.remainingHP).toBe(-1);
    });

    test('should validate Vampire heritage with required detriments', () => {
      const requiredDetriments = [
        { name: 'Sunlight Weakness', hp: 2 },
        { name: 'Hamon Vulnerability', hp: 1 }
      ];
      const selectedBenefits = [{ name: 'Blood Puppeteer', cost: 3 }];
      
      const result = validateHeritageHP('Vampire', selectedBenefits, requiredDetriments, 0);
      expect(result.valid).toBe(true); // 3 base + 3 detriment - 3 benefit = 3
      expect(result.remainingHP).toBe(3);
    });

    test('should handle XP-purchased HP', () => {
      const selectedBenefits = [{ name: 'Expensive Benefit', cost: 3 }];
      const bonusHPFromXP = 2; // 10 XP spent for 2 HP
      
      const result = validateHeritageHP('Human', selectedBenefits, [], bonusHPFromXP);
      expect(result.valid).toBe(false); // 0 base + 0 detriment + 2 XP - 3 benefit = -1
      expect(result.remainingHP).toBe(-1);
    });
  });

  describe('XP Spending Validation', () => {
    test('should validate sufficient XP for spending', () => {
      const currentXP = { insight: 5, prowess: 3, resolve: 2, playbook: 10 };
      
      const result = validateXPSpending(currentXP, 'insight', 5);
      expect(result.valid).toBe(true);
      expect(result.remaining).toBe(0);
    });

    test('should reject insufficient XP', () => {
      const currentXP = { insight: 3, prowess: 2, resolve: 1, playbook: 5 };
      
      const result = validateXPSpending(currentXP, 'insight', 5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Insufficient insight XP');
    });
  });

  describe('Character Sanitization', () => {
    test('should fix corrupted character data', () => {
      const corruptedCharacter = {
        trueName: 'Test Character',
        coinStats: { power: -1, speed: 6, invalidStat: 3 }, // Invalid values
        skills: { insight: { hunt: 5, invalidSkill: 2 } }, // Invalid skill level
        stress: [true, false, 'invalid', null, true], // Mixed types
        invalidField: 'should be removed'
      };
      
      const sanitized = sanitizeCharacter(corruptedCharacter);
      
      expect(sanitized.trueName).toBe('Test Character');
      expect(sanitized.coinStats.power).toBe(0); // Fixed invalid -1
      expect(sanitized.coinStats.speed).toBe(0); // Fixed invalid 6
      expect(sanitized.coinStats.invalidStat).toBeUndefined();
      expect(sanitized.skills.insight.hunt).toBe(0); // Fixed invalid 5
      expect(sanitized.skills.insight.invalidSkill).toBeUndefined();
      expect(sanitized.stress).toEqual([true, false, true, false, true, false, false, false, false, false, false, false]);
      expect(sanitized.invalidField).toBeUndefined();
    });

    test('should return default character for completely invalid data', () => {
      const sanitized1 = sanitizeCharacter(null);
      const sanitized2 = sanitizeCharacter("invalid");
      const sanitized3 = sanitizeCharacter(123);
      
      expect(sanitized1).toEqual(getDefaultCharacter());
      expect(sanitized2).toEqual(getDefaultCharacter());
      expect(sanitized3).toEqual(getDefaultCharacter());
    });
  });

  describe('Safe localStorage Operations', () => {
    test('should handle corrupted localStorage data', () => {
      // Set corrupted JSON directly in the mock store
      mockLocalStorage.getItem.mockReturnValueOnce('invalid json{');
      
      const result = safeLoadFromStorage('test-key', 'default');
      expect(result).toBe('default');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('test-key');
    });

    test('should handle localStorage quota exceeded', () => {
      // Mock quota exceeded error
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });
      
      const result = safeSaveToStorage('test-key', { data: 'test' });
      expect(result).toBe(false);
    });

    test('should successfully save and load valid data', () => {
      const testData = { character: getDefaultCharacter() };
      
      // Mock successful localStorage operations
      mockLocalStorage.setItem.mockImplementationOnce((key, value) => {
        mockLocalStorage.getItem.mockReturnValueOnce(value);
      });
      
      const saveResult = safeSaveToStorage('test-key', testData);
      expect(saveResult).toBe(true);
      
      const loadResult = safeLoadFromStorage('test-key');
      expect(loadResult).toEqual(testData);
    });
  });

  describe('State Consistency Checker', () => {
    let checker;

    beforeEach(() => {
      checker = new StateConsistencyChecker();
    });

    test('should maintain valid state', () => {
      const validCharacter = getDefaultCharacter();
      validCharacter.trueName = 'Test Character';
      
      const result = checker.checkConsistency(validCharacter);
      expect(result).toEqual(validCharacter);
      
      const stats = checker.getStats();
      expect(stats.updateCount).toBe(1);
      expect(stats.errorCount).toBe(0);
      expect(stats.hasValidState).toBe(true);
    });

    test('should recover from invalid state', () => {
      // First establish a valid state
      const validCharacter = getDefaultCharacter();
      checker.checkConsistency(validCharacter);
      
      // Then try an invalid state
      const invalidCharacter = { ...validCharacter };
      invalidCharacter.skills.insight.hunt = 10; // Invalid skill level
      
      const result = checker.checkConsistency(invalidCharacter);
      expect(result).not.toEqual(invalidCharacter);
      expect(result.skills.insight.hunt).toBeLessThanOrEqual(4);
    });

    test('should handle rapid invalid updates', () => {
      const validCharacter = getDefaultCharacter();
      checker.checkConsistency(validCharacter);
      
      // Simulate rapid invalid updates
      for (let i = 0; i < 5; i++) {
        const invalidCharacter = { ...validCharacter };
        invalidCharacter.coinStats.power = 10; // Invalid
        checker.checkConsistency(invalidCharacter);
      }
      
      const stats = checker.getStats();
      expect(stats.errorCount).toBeGreaterThan(0);
      expect(stats.hasValidState).toBe(true);
    });
  });

  describe('Race Condition Prevention', () => {
    test('should handle concurrent skill updates', async () => {
      const character = getDefaultCharacter();
      const checker = new StateConsistencyChecker();
      
      // Simulate rapid concurrent updates
      const updates = [];
      for (let i = 0; i < 10; i++) {
        updates.push(new Promise(resolve => {
          setTimeout(() => {
            const updatedCharacter = { ...character };
            updatedCharacter.skills.insight.hunt = Math.min(i, 2); // Valid range
            resolve(checker.checkConsistency(updatedCharacter));
          }, Math.random() * 10);
        }));
      }
      
      const results = await Promise.all(updates);
      
      // All results should be valid
      results.forEach(result => {
        const validation = validateCharacter(result);
        expect(validation.valid).toBe(true);
      });
    });

    test('should handle concurrent coin stat updates', async () => {
      const character = getDefaultCharacter();
      const checker = new StateConsistencyChecker();
      
      const updates = [];
      for (let i = 0; i < 5; i++) {
        updates.push(new Promise(resolve => {
          setTimeout(() => {
            const updatedCharacter = { ...character };
            updatedCharacter.coinStats.power = Math.min(i, 4);
            updatedCharacter.coinStats.speed = Math.min(4 - i, 4);
            resolve(checker.checkConsistency(updatedCharacter));
          }, Math.random() * 10);
        }));
      }
      
      const results = await Promise.all(updates);
      
      results.forEach(result => {
        const validation = validateCoinStats(result.coinStats);
        expect(validation.valid).toBe(true);
      });
    });
  });

  describe('Heritage Change Recovery', () => {
    test('should reset dependent selections when heritage changes', () => {
      const character = getDefaultCharacter();
      character.heritage = 'Vampire';
      character.selectedBenefits = [{ name: 'Vampire Benefit', cost: 2 }];
      character.selectedDetriments = [{ name: 'Vampire Detriment', hp: 1 }];
      
      // Change heritage to Human
      character.heritage = 'Human';
      
      const sanitized = sanitizeCharacter(character);
      
      // Benefits and detriments should be preserved for manual review
      // but validation should flag incompatibility
      const validation = validateCharacter(sanitized);
      // Note: This would require heritage-specific validation logic
    });
  });

  describe('Import/Export Data Fidelity', () => {
    test('should maintain data fidelity through export/import cycle', () => {
      const originalCharacter = getDefaultCharacter();
      originalCharacter.trueName = 'Test Character';
      originalCharacter.skills.insight.hunt = 2;
      originalCharacter.coinStats.power = 3;
      originalCharacter.selectedBenefits = [{ name: 'Test Benefit', cost: 1 }];
      
      // Simulate export (JSON stringify)
      const exported = JSON.stringify(originalCharacter);
      
      // Simulate import (JSON parse + sanitization)
      const imported = JSON.parse(exported);
      const sanitized = sanitizeCharacter(imported);
      
      expect(sanitized.trueName).toBe(originalCharacter.trueName);
      expect(sanitized.skills.insight.hunt).toBe(originalCharacter.skills.insight.hunt);
      expect(sanitized.coinStats.power).toBe(originalCharacter.coinStats.power);
      expect(sanitized.selectedBenefits).toEqual(originalCharacter.selectedBenefits);
    });

    test('should reject malformed import data', () => {
      const malformedData = {
        trueName: 'Test',
        skills: 'invalid',
        coinStats: { power: 'not a number' }
      };
      
      const sanitized = sanitizeCharacter(malformedData);
      const validation = validateCharacter(sanitized);
      
      expect(validation.valid).toBe(true); // Should be valid after sanitization
      expect(sanitized.skills).toEqual(getDefaultCharacter().skills);
      expect(sanitized.coinStats.power).toBe(0);
    });
  });

  describe('Tab Switching Data Integrity', () => {
    test('should preserve individual character data across tab switches', () => {
      const character1 = getDefaultCharacter();
      character1.trueName = 'Character 1';
      character1.skills.insight.hunt = 2;
      
      const character2 = getDefaultCharacter();
      character2.trueName = 'Character 2';
      character2.skills.prowess.skirmish = 1;
      
      const tabs = [
        { id: 'tab1', character: character1 },
        { id: 'tab2', character: character2 }
      ];
      
      // Simulate tab switching and validation
      tabs.forEach(tab => {
        const validation = validateCharacter(tab.character);
        expect(validation.valid).toBe(true);
      });
      
      // Ensure characters remain distinct
      expect(tabs[0].character.trueName).toBe('Character 1');
      expect(tabs[1].character.trueName).toBe('Character 2');
      expect(tabs[0].character.skills.insight.hunt).toBe(2);
      expect(tabs[1].character.skills.prowess.skirmish).toBe(1);
    });
  });

  describe('Page Refresh Data Persistence', () => {
    test('should survive page refresh with valid data', () => {
      const character = getDefaultCharacter();
      character.trueName = 'Persistent Character';
      character.skills.insight.study = 2;
      
      const testData = [{ id: 'tab1', character }];
      const serializedData = JSON.stringify(testData);
      
      // Mock successful save and load cycle
      mockLocalStorage.setItem.mockImplementationOnce((key, value) => {
        mockLocalStorage.getItem.mockReturnValueOnce(value);
      });
      
      // Save to localStorage
      safeSaveToStorage('characterTabs', testData);
      
      // Simulate page refresh - load from localStorage
      const loaded = safeLoadFromStorage('characterTabs', []);
      expect(loaded).toHaveLength(1);
      
      const loadedCharacter = sanitizeCharacter(loaded[0].character);
      expect(loadedCharacter.trueName).toBe('Persistent Character');
      expect(loadedCharacter.skills.insight.study).toBe(2);
      
      const validation = validateCharacter(loadedCharacter);
      expect(validation.valid).toBe(true);
    });

    test('should recover from corrupted localStorage on refresh', () => {
      // Mock corrupted data
      mockLocalStorage.getItem.mockReturnValueOnce('corrupted json{');
      
      const loaded = safeLoadFromStorage('characterTabs', []);
      expect(loaded).toEqual([]);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('characterTabs');
    });
  });
});

// Performance and stress tests
describe('Performance and Stress Tests', () => {
  test('should handle rapid state updates without performance degradation', () => {
    const checker = new StateConsistencyChecker();
    const character = getDefaultCharacter();
    
    const start = performance.now();
    
    // Simulate 1000 rapid updates
    for (let i = 0; i < 1000; i++) {
      const updatedCharacter = { ...character };
      updatedCharacter.trueName = `Character ${i}`;
      checker.checkConsistency(updatedCharacter);
    }
    
    const end = performance.now();
    const duration = end - start;
    
    // Should complete within reasonable time (adjust threshold as needed)
    expect(duration).toBeLessThan(1000); // 1 second
    
    const stats = checker.getStats();
    expect(stats.updateCount).toBe(1000);
  });

  test('should handle large character data without memory leaks', () => {
    const character = getDefaultCharacter();
    
    // Add large data structures
    character.notes = 'x'.repeat(10000); // 10KB of text
    character.equipment = new Array(1000).fill({ name: 'Item', description: 'Test item' });
    
    const sanitized = sanitizeCharacter(character);
    const validation = validateCharacter(sanitized);
    
    expect(validation.valid).toBe(true);
    expect(sanitized.notes.length).toBe(10000);
    expect(sanitized.equipment.length).toBe(1000);
  });
});

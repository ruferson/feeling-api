import { describe, it, expect } from '@jest/globals';
import { LobbyNameGenerator } from './lobby-name-generator';

// ============================================================================
// TEST SUITE: LobbyNameGenerator
// ============================================================================
describe('LobbyNameGenerator', () => {
  // ==========================================================================
  // TESTS: generateName()
  // ==========================================================================
  describe('generateName', () => {
    it('should generate a valid thematic lobby name matching the version format', () => {
      // Act: generate a new lobby name
      const name = LobbyNameGenerator.generateName();

      // Assert: verify type, non-empty state, and semantic regex pattern
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);

      // Matches pattern: "[Spatial] [Tonal] [Musical] vX.Y.Z"
      const regex = /^[A-Z][a-z]+\s[A-Z][a-z]+\s[A-Z][a-z]+\sv\d+\.\d+\.\d+$/;
      expect(name).toMatch(regex);
    });

    it('should generate different names on successive calls', () => {
      // Act: generate two consecutive lobby names
      const name1 = LobbyNameGenerator.generateName();
      const name2 = LobbyNameGenerator.generateName();

      // Assert: verify uniqueness across consecutive generations
      expect(name1).not.toEqual(name2);
    });
  });
});

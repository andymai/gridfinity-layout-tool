/**
 * Tests for name suggestion generation logic.
 */

import { describe, it, expect } from 'vitest';
import { generateSuggestions } from './generateSuggestions';
import { hashName, editDistance } from './stringUtils';
import type { SuggestionInput } from '../types';

describe('generateSuggestions', () => {
  const baseInput: SuggestionInput = {
    labels: [],
    categories: [],
    drawer: { width: 6, depth: 4, height: 6 },
    purpose: null,
    locale: 'en',
  };

  describe('label-based suggestions', () => {
    it('generates suggestions based on tool labels', () => {
      const input: SuggestionInput = {
        ...baseInput,
        labels: ['screwdriver', 'pliers', 'hammer', 'wrench', 'tape measure'],
      };

      const result = generateSuggestions(input);

      expect(result.primary).not.toBeNull();
      expect(result.primary?.source).toBe('labels');
      // Should be a tool-related name (creative or standard)
      const allNames = [result.primary?.name, ...result.alternatives.map((a) => a.name)]
        .join(' ')
        .toLowerCase();
      const hasToolRelated =
        allNames.includes('tool') ||
        allNames.includes('workshop') ||
        allNames.includes('fix') ||
        allNames.includes('build') ||
        allNames.includes('diy') ||
        allNames.includes('workbench') ||
        allNames.includes('tinker');
      expect(hasToolRelated).toBe(true);
    });

    it('generates suggestions based on electronics labels', () => {
      const input: SuggestionInput = {
        ...baseInput,
        labels: ['resistor', 'capacitor', 'LED', 'Arduino', 'wire'],
      };

      const result = generateSuggestions(input);

      expect(result.primary).not.toBeNull();
      // Should be an electronics-related name (creative or standard)
      const allNames = [result.primary?.name, ...result.alternatives.map((a) => a.name)]
        .join(' ')
        .toLowerCase();
      const hasElectronicsRelated =
        allNames.includes('electronic') ||
        allNames.includes('circuit') ||
        allNames.includes('maker') ||
        allNames.includes('tech') ||
        allNames.includes('lab') ||
        allNames.includes('component') ||
        allNames.includes('tinker');
      expect(hasElectronicsRelated).toBe(true);
    });

    it('generates suggestions based on fastener labels', () => {
      const input: SuggestionInput = {
        ...baseInput,
        labels: ['M3 screw', 'M4 bolt', 'washer', 'nut', 'M5x10'],
      };

      const result = generateSuggestions(input);

      expect(result.primary).not.toBeNull();
      // Should recognize as fasteners domain or specific metric hardware subcategory
      const allSuggestions = [result.primary?.name, ...result.alternatives.map((a) => a.name)];
      const hasFastenerRelated = allSuggestions.some(
        (name) =>
          name?.toLowerCase().includes('fastener') ||
          name?.toLowerCase().includes('hardware') ||
          name?.toLowerCase().includes('screw')
      );
      expect(hasFastenerRelated).toBe(true);
    });

    it('handles mixed domain labels with secondary domain', () => {
      const input: SuggestionInput = {
        ...baseInput,
        labels: ['screwdriver', 'pliers', 'hammer', 'resistor', 'capacitor', 'LED'],
      };

      const result = generateSuggestions(input);

      expect(result.primary).not.toBeNull();
      // Should have alternatives including mixed domain suggestion
      expect(result.alternatives.length).toBeGreaterThan(0);
    });
  });

  describe('purpose-based suggestions', () => {
    it('uses purpose when provided', () => {
      const input: SuggestionInput = {
        ...baseInput,
        purpose: 'workshop',
      };

      const result = generateSuggestions(input);

      const purposeSuggestion = [result.primary, ...result.alternatives].find(
        (s) => s?.source === 'purpose'
      );
      expect(purposeSuggestion).not.toBeUndefined();
      expect(purposeSuggestion?.name).toContain('Workshop');
    });
  });

  describe('category-based suggestions', () => {
    it('uses custom category names when dominant', () => {
      const input: SuggestionInput = {
        ...baseInput,
        categories: [
          { name: 'Woodworking', count: 15 },
          { name: 'General', count: 3 },
        ],
      };

      const result = generateSuggestions(input);

      const categorySuggestion = [result.primary, ...result.alternatives].find(
        (s) => s?.source === 'categories'
      );
      expect(categorySuggestion).not.toBeUndefined();
      expect(categorySuggestion?.name).toContain('Woodworking');
    });

    it('ignores generic color category names', () => {
      const input: SuggestionInput = {
        ...baseInput,
        categories: [
          { name: 'Coral', count: 15 },
          { name: 'Sky', count: 5 },
        ],
      };

      const result = generateSuggestions(input);

      // Should fall back to dimensions-based suggestions
      const categorySuggestion = [result.primary, ...result.alternatives].find(
        (s) => s?.source === 'categories'
      );
      expect(categorySuggestion).toBeUndefined();
    });
  });

  describe('dimension-based suggestions', () => {
    it('generates size-based fallback for small drawers', () => {
      const input: SuggestionInput = {
        ...baseInput,
        drawer: { width: 3, depth: 3, height: 4 },
      };

      const result = generateSuggestions(input);

      const dimSuggestion = [result.primary, ...result.alternatives].find(
        (s) => s?.source === 'dimensions'
      );
      expect(dimSuggestion).not.toBeUndefined();
      // Should suggest size-related name for small drawer
      expect(
        dimSuggestion?.name.includes('Tiny') ||
          dimSuggestion?.name.includes('Small') ||
          dimSuggestion?.name.includes('Compact') ||
          dimSuggestion?.name.includes('Little')
      ).toBe(true);
    });

    it('generates size-based fallback for large drawers', () => {
      const input: SuggestionInput = {
        ...baseInput,
        drawer: { width: 10, depth: 10, height: 8 },
      };

      const result = generateSuggestions(input);

      const dimSuggestion = [result.primary, ...result.alternatives].find(
        (s) => s?.source === 'dimensions'
      );
      expect(dimSuggestion).not.toBeUndefined();
      // Should suggest size-related name for large drawer
      expect(
        dimSuggestion?.name.includes('Extra Large') ||
          dimSuggestion?.name.includes('Large') ||
          dimSuggestion?.name.includes('Big') ||
          dimSuggestion?.name.includes('Room for More')
      ).toBe(true);
    });
  });

  describe('confidence scoring', () => {
    it('assigns higher confidence to label-based suggestions with concentration', () => {
      const input: SuggestionInput = {
        ...baseInput,
        labels: ['screwdriver', 'pliers', 'hammer', 'wrench', 'tape measure'],
      };

      const result = generateSuggestions(input);

      expect(result.primary?.confidence).toBeGreaterThan(0.5);
    });

    it('assigns lower confidence to dimension-only suggestions', () => {
      const result = generateSuggestions(baseInput);

      expect(result.primary?.source).toBe('dimensions');
      expect(result.primary?.confidence).toBeLessThan(0.4);
    });
  });

  describe('result structure', () => {
    it('returns primary suggestion and alternatives', () => {
      const input: SuggestionInput = {
        ...baseInput,
        labels: ['screwdriver', 'pliers', 'hammer', 'wrench', 'tape measure'],
        purpose: 'workshop',
      };

      const result = generateSuggestions(input);

      expect(result.primary).not.toBeNull();
      expect(Array.isArray(result.alternatives)).toBe(true);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('deduplicates suggestions by name', () => {
      const input: SuggestionInput = {
        ...baseInput,
        labels: ['screwdriver', 'pliers', 'hammer'],
        purpose: 'workshop',
      };

      const result = generateSuggestions(input);

      const allNames = [result.primary?.name, ...result.alternatives.map((s) => s.name)].filter(
        Boolean
      );
      const uniqueNames = new Set(allNames.map((n) => n?.toLowerCase()));

      expect(uniqueNames.size).toBe(allNames.length);
    });

    it('limits to 5 total suggestions', () => {
      const input: SuggestionInput = {
        ...baseInput,
        labels: ['screwdriver', 'pliers', 'hammer', 'wrench', 'tape measure'],
        purpose: 'workshop',
        categories: [{ name: 'Tools', count: 20 }],
      };

      const result = generateSuggestions(input);

      const totalSuggestions = 1 + result.alternatives.length;
      expect(totalSuggestions).toBeLessThanOrEqual(5);
    });
  });
});

describe('hashName', () => {
  it('produces consistent hashes for the same input', () => {
    const hash1 = hashName('Test Layout');
    const hash2 = hashName('Test Layout');
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = hashName('Layout A');
    const hash2 = hashName('Layout B');
    expect(hash1).not.toBe(hash2);
  });

  it('is case insensitive', () => {
    const hash1 = hashName('My Layout');
    const hash2 = hashName('my layout');
    expect(hash1).toBe(hash2);
  });

  it('trims whitespace', () => {
    const hash1 = hashName('Test Layout');
    const hash2 = hashName('  Test Layout  ');
    expect(hash1).toBe(hash2);
  });

  it('produces 8-character hex strings', () => {
    const hash = hashName('Any Layout Name');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('editDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(editDistance('hello', 'hello')).toBe(0);
  });

  it('returns length for empty string comparison', () => {
    expect(editDistance('', 'hello')).toBe(5);
    expect(editDistance('hello', '')).toBe(5);
  });

  it('calculates single character differences', () => {
    expect(editDistance('cat', 'hat')).toBe(1);
    expect(editDistance('cat', 'cats')).toBe(1);
    expect(editDistance('cat', 'ca')).toBe(1);
  });

  it('is case insensitive', () => {
    expect(editDistance('Hello', 'hello')).toBe(0);
    expect(editDistance('WORLD', 'world')).toBe(0);
  });

  it('calculates multi-character differences', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('saturday', 'sunday')).toBe(3);
  });
});

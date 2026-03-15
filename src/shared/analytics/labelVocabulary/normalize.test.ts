import { describe, it, expect, beforeEach } from 'vitest';
import {
  processLabel,
  getCanonicalTerms,
  isKnownTerm,
  getTermDomain,
  clearLabelCache,
  VOCAB_VERSION,
} from '@/shared/analytics/labelVocabulary';

describe('labelVocabulary', () => {
  describe('processLabel', () => {
    describe('exact matches', () => {
      it('matches English terms exactly', () => {
        const result = processLabel('screwdriver');
        expect(result.normalized).toBe('screwdriver');
        expect(result.domain).toBe('tools');
        expect(result.confidence).toBe(1.0);
        expect(result.hash).toBeTruthy();
      });

      it('matches German terms', () => {
        const result = processLabel('Schraubenzieher');
        expect(result.normalized).toBe('screwdriver');
        expect(result.domain).toBe('tools');
        expect(result.confidence).toBe(1.0);
      });

      it('matches French terms', () => {
        const result = processLabel('tournevis');
        expect(result.normalized).toBe('screwdriver');
        expect(result.domain).toBe('tools');
      });

      it('matches Spanish terms', () => {
        const result = processLabel('destornillador');
        expect(result.normalized).toBe('screwdriver');
      });

      it('is case insensitive', () => {
        const result = processLabel('SCREWDRIVER');
        expect(result.normalized).toBe('screwdriver');
      });

      it('trims whitespace', () => {
        const result = processLabel('  screwdriver  ');
        expect(result.normalized).toBe('screwdriver');
      });
    });

    describe('partial matches', () => {
      it('matches when label contains alias (forward partial)', () => {
        const result = processLabel('my phillips screwdriver set');
        expect(result.normalized).toBe('screwdriver');
        expect(result.confidence).toBe(0.8);
      });

      it('matches when alias contains label (reverse partial)', () => {
        // "nozzl" is not an alias itself, but "nozzle" contains it
        const result = processLabel('nozzl');
        expect(result.normalized).toBe('nozzle');
        expect(result.domain).toBe('printing_3d');
        expect(result.confidence).toBe(0.7);
      });
    });

    describe('unknown labels', () => {
      it('returns null normalized for unknown labels', () => {
        const result = processLabel('my custom thing xyz123');
        expect(result.normalized).toBeNull();
        expect(result.domain).toBeNull();
        expect(result.confidence).toBe(0);
      });

      it('still returns a hash for unknown labels', () => {
        const result = processLabel('totally unknown item');
        expect(result.hash).toBeTruthy();
        expect(result.hash.length).toBe(8);
      });

      it('returns consistent hashes for identical labels', () => {
        const result1 = processLabel('my unique label');
        const result2 = processLabel('my unique label');
        expect(result1.hash).toBe(result2.hash);
      });

      it('returns different hashes for different labels', () => {
        const result1 = processLabel('label one');
        const result2 = processLabel('label two');
        expect(result1.hash).not.toBe(result2.hash);
      });
    });

    describe('empty labels', () => {
      it('handles empty string', () => {
        const result = processLabel('');
        expect(result.normalized).toBeNull();
        expect(result.confidence).toBe(0);
      });

      it('handles whitespace-only string', () => {
        const result = processLabel('   ');
        expect(result.normalized).toBeNull();
        expect(result.confidence).toBe(0);
      });
    });

    describe('domain categories', () => {
      it('assigns tools domain', () => {
        expect(processLabel('wrench').domain).toBe('tools');
        expect(processLabel('pliers').domain).toBe('tools');
        expect(processLabel('hammer').domain).toBe('tools');
      });

      it('assigns fasteners domain', () => {
        expect(processLabel('screw').domain).toBe('fasteners');
        expect(processLabel('bolt').domain).toBe('fasteners');
        expect(processLabel('nut').domain).toBe('fasteners');
      });

      it('assigns electronics domain', () => {
        expect(processLabel('resistor').domain).toBe('electronics');
        expect(processLabel('capacitor').domain).toBe('electronics');
        expect(processLabel('led').domain).toBe('electronics');
      });

      it('assigns office domain', () => {
        expect(processLabel('pen').domain).toBe('office');
        expect(processLabel('scissors').domain).toBe('office');
      });

      it('assigns craft domain', () => {
        expect(processLabel('paint').domain).toBe('craft');
        expect(processLabel('brush').domain).toBe('craft');
      });

      it('assigns 3d printing domain', () => {
        expect(processLabel('nozzle').domain).toBe('printing_3d');
        expect(processLabel('bearing').domain).toBe('printing_3d');
      });
    });
  });

  describe('getCanonicalTerms', () => {
    it('returns an array of terms', () => {
      const terms = getCanonicalTerms();
      expect(Array.isArray(terms)).toBe(true);
      expect(terms.length).toBeGreaterThan(0);
    });

    it('includes expected terms', () => {
      const terms = getCanonicalTerms();
      expect(terms).toContain('screwdriver');
      expect(terms).toContain('pen');
      expect(terms).toContain('battery_aa');
    });

    it('returns sorted terms', () => {
      const terms = getCanonicalTerms();
      const sorted = [...terms].sort();
      expect(terms).toEqual(sorted);
    });
  });

  describe('isKnownTerm', () => {
    it('returns true for known terms', () => {
      expect(isKnownTerm('screwdriver')).toBe(true);
      expect(isKnownTerm('pen')).toBe(true);
    });

    it('returns false for unknown terms', () => {
      expect(isKnownTerm('unknown_term_xyz')).toBe(false);
      expect(isKnownTerm('')).toBe(false);
    });

    it('returns false for Object.prototype properties', () => {
      expect(isKnownTerm('toString')).toBe(false);
      expect(isKnownTerm('constructor')).toBe(false);
      expect(isKnownTerm('hasOwnProperty')).toBe(false);
    });
  });

  describe('getTermDomain', () => {
    it('returns domain for known terms', () => {
      expect(getTermDomain('screwdriver')).toBe('tools');
      expect(getTermDomain('pen')).toBe('office');
    });

    it('returns null for unknown terms', () => {
      expect(getTermDomain('unknown')).toBeNull();
    });
  });

  describe('VOCAB_VERSION', () => {
    it('is defined', () => {
      expect(VOCAB_VERSION).toBeDefined();
      expect(typeof VOCAB_VERSION).toBe('string');
    });
  });

  describe('label cache', () => {
    beforeEach(() => {
      clearLabelCache();
    });

    it('clearLabelCache clears the cache', () => {
      // Process a label to populate cache
      const result1 = processLabel('screwdriver');
      expect(result1.normalized).toBe('screwdriver');

      // Clear the cache
      clearLabelCache();

      // Should still work after cache clear (cache is rebuilt)
      const result2 = processLabel('screwdriver');
      expect(result2.normalized).toBe('screwdriver');
      expect(result2.hash).toBe(result1.hash);
    });

    it('cached results are identical to original', () => {
      // First call populates cache
      const result1 = processLabel('my phillips screwdriver');

      // Second call should return cached result
      const result2 = processLabel('my phillips screwdriver');

      expect(result2).toBe(result1); // Same object reference (cached)
      expect(result2.normalized).toBe(result1.normalized);
      expect(result2.hash).toBe(result1.hash);
      expect(result2.confidence).toBe(result1.confidence);
    });

    it('caches unknown labels', () => {
      const result1 = processLabel('totally unknown xyz123');
      const result2 = processLabel('totally unknown xyz123');

      expect(result2).toBe(result1); // Same object reference (cached)
      expect(result2.normalized).toBeNull();
    });

    it('handles many different labels without issue', () => {
      // Process many unique labels to test cache eviction
      for (let i = 0; i < 600; i++) {
        const result = processLabel(`unique label ${i}`);
        expect(result.hash).toBeTruthy();
      }

      // Cache should still work after eviction
      const result = processLabel('screwdriver');
      expect(result.normalized).toBe('screwdriver');
    });
  });
});

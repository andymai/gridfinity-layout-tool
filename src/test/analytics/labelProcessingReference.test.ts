/**
 * Reference tests for label processing.
 *
 * These tests document the expected output of label processing functions
 * for specific inputs. They serve as regression tests to ensure that
 * changes to the vocabulary or hashing don't accidentally break
 * backwards compatibility or cause training-serving skew.
 *
 * If these tests fail after a vocabulary update, you should:
 * 1. Verify the change is intentional
 * 2. Update the expected values below
 * 3. Update VOCAB_VERSION to signal the schema change
 */

import { describe, it, expect } from 'vitest';
import { processLabel, VOCAB_VERSION } from '@/shared/analytics/labelVocabulary';
import { computeEmbeddingBucket, decodeEmbeddingBucket } from '@/shared/analytics/labelEmbedding';

describe('labelProcessingReference', () => {
  describe('VOCAB_VERSION stability', () => {
    it('tracks vocabulary version for schema evolution', () => {
      // If this test fails, it means the vocabulary version changed.
      // This is expected when vocabulary is updated - update the expected value.
      expect(VOCAB_VERSION).toBe('v1');
    });
  });

  describe('processLabel reference outputs', () => {
    // These tests document expected behavior for common terms.
    // If any fail unexpectedly, the vocabulary may have been corrupted.

    describe('tools domain', () => {
      const toolsReferenceData = [
        { input: 'screwdriver', expected: { normalized: 'screwdriver', domain: 'tools' } },
        { input: 'Schraubenzieher', expected: { normalized: 'screwdriver', domain: 'tools' } },
        { input: 'wrench', expected: { normalized: 'wrench', domain: 'tools' } },
        { input: 'pliers', expected: { normalized: 'pliers', domain: 'tools' } },
        { input: 'hammer', expected: { normalized: 'hammer', domain: 'tools' } },
        { input: 'knife', expected: { normalized: 'knife', domain: 'tools' } },
      ];

      it.each(toolsReferenceData)(
        'processLabel("$input") normalizes to $expected.normalized',
        ({ input, expected }) => {
          const result = processLabel(input);
          expect(result.normalized).toBe(expected.normalized);
          expect(result.domain).toBe(expected.domain);
        }
      );
    });

    describe('fasteners domain', () => {
      const fastenersReferenceData = [
        { input: 'screw', expected: { normalized: 'screw', domain: 'fasteners' } },
        { input: 'bolt', expected: { normalized: 'bolt', domain: 'fasteners' } },
        { input: 'nut', expected: { normalized: 'nut', domain: 'fasteners' } },
        { input: 'washer', expected: { normalized: 'washer', domain: 'fasteners' } },
      ];

      it.each(fastenersReferenceData)(
        'processLabel("$input") normalizes to $expected.normalized',
        ({ input, expected }) => {
          const result = processLabel(input);
          expect(result.normalized).toBe(expected.normalized);
          expect(result.domain).toBe(expected.domain);
        }
      );
    });

    describe('electronics domain', () => {
      const electronicsReferenceData = [
        { input: 'resistor', expected: { normalized: 'resistor', domain: 'electronics' } },
        { input: 'capacitor', expected: { normalized: 'capacitor', domain: 'electronics' } },
        { input: 'led', expected: { normalized: 'led', domain: 'electronics' } },
        { input: 'LED', expected: { normalized: 'led', domain: 'electronics' } },
      ];

      it.each(electronicsReferenceData)(
        'processLabel("$input") normalizes to $expected.normalized',
        ({ input, expected }) => {
          const result = processLabel(input);
          expect(result.normalized).toBe(expected.normalized);
          expect(result.domain).toBe(expected.domain);
        }
      );
    });
  });

  describe('hash stability', () => {
    // These tests verify that hash computation is stable.
    // The hashes should NEVER change for existing labels.

    const hashReferenceData = [
      { input: 'screwdriver', expectedHash: '5a6aae84' },
      { input: 'pen', expectedHash: '0001b119' },
      { input: 'M3x8', expectedHash: '00325aa6' },
      { input: 'unknown item xyz', expectedHash: '158381de' },
    ];

    it.each(hashReferenceData)(
      'processLabel("$input").hash equals $expectedHash',
      ({ input, expectedHash }) => {
        const result = processLabel(input);
        expect(result.hash).toBe(expectedHash);
      }
    );
  });

  describe('embedding bucket stability', () => {
    // These tests verify embedding bucket computation is stable.
    // Changes here would affect ML model clustering.

    const embeddingReferenceData = [
      {
        input: 'screwdriver',
        expectedBucket: '4019',
        expectedDecode: { length: 'medium', charClass: 'alpha', pattern: 'plain' },
      },
      {
        input: 'M3x8',
        expectedBucket: '2464',
        expectedDecode: { length: 'short', charClass: 'alphanumeric', pattern: 'measurement' },
      },
      {
        input: '608ZZ',
        expectedBucket: '68e7',
        expectedDecode: { length: 'medium', charClass: 'alphanumeric', pattern: 'code' },
      },
      {
        input: 'small red box',
        expectedBucket: '8c23',
        expectedDecode: { length: 'long', charClass: 'alpha', pattern: 'descriptive' },
      },
    ];

    it.each(embeddingReferenceData)(
      'computeEmbeddingBucket("$input") equals $expectedBucket',
      ({ input, expectedBucket, expectedDecode }) => {
        const bucket = computeEmbeddingBucket(input);
        expect(bucket).toBe(expectedBucket);

        const decoded = decodeEmbeddingBucket(bucket);
        expect(decoded.length).toBe(expectedDecode.length);
        expect(decoded.charClass).toBe(expectedDecode.charClass);
        expect(decoded.pattern).toBe(expectedDecode.pattern);
      }
    );
  });

  describe('confidence levels', () => {
    // Document expected confidence levels for different match types

    it('exact matches have confidence 1.0', () => {
      expect(processLabel('screwdriver').confidence).toBe(1.0);
      expect(processLabel('pen').confidence).toBe(1.0);
      expect(processLabel('resistor').confidence).toBe(1.0);
    });

    it('partial matches have confidence 0.8', () => {
      expect(processLabel('my phillips screwdriver set').confidence).toBe(0.8);
      expect(processLabel('blue pen holder').confidence).toBe(0.8);
    });

    it('unknown labels have confidence 0', () => {
      expect(processLabel('xyz123unknown').confidence).toBe(0);
      expect(processLabel('random gibberish text').confidence).toBe(0);
    });
  });

  describe('multilingual reference', () => {
    // These tests verify multilingual support remains stable

    const multilingualReferenceData = [
      // German
      { input: 'Schraubenzieher', expectedNormalized: 'screwdriver' },
      { input: 'Zange', expectedNormalized: 'pliers' },
      // French
      { input: 'tournevis', expectedNormalized: 'screwdriver' },
      { input: 'marteau', expectedNormalized: 'hammer' },
      // Spanish
      { input: 'destornillador', expectedNormalized: 'screwdriver' },
      { input: 'martillo', expectedNormalized: 'hammer' },
    ];

    it.each(multilingualReferenceData)(
      'processLabel("$input") normalizes to "$expectedNormalized"',
      ({ input, expectedNormalized }) => {
        const result = processLabel(input);
        expect(result.normalized).toBe(expectedNormalized);
      }
    );
  });

  describe('edge cases stability', () => {
    // Document behavior for edge cases that shouldn't change

    it('empty string returns null normalized with hash', () => {
      const result = processLabel('');
      expect(result.normalized).toBeNull();
      expect(result.domain).toBeNull();
      expect(result.confidence).toBe(0);
      // Empty string should still get a hash (even if trivial)
      expect(result.hash).toBeDefined();
    });

    it('whitespace-only returns null normalized', () => {
      const result = processLabel('   ');
      expect(result.normalized).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('case is normalized consistently', () => {
      const lower = processLabel('screwdriver');
      const upper = processLabel('SCREWDRIVER');
      const mixed = processLabel('ScReWdRiVeR');

      expect(lower.normalized).toBe(upper.normalized);
      expect(lower.normalized).toBe(mixed.normalized);
      expect(lower.hash).toBe(upper.hash);
      expect(lower.hash).toBe(mixed.hash);
    });
  });
});

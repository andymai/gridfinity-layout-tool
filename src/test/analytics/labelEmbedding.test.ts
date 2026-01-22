import { describe, it, expect } from 'vitest';
import { computeEmbeddingBucket, decodeEmbeddingBucket } from '@/shared/analytics/labelEmbedding';

describe('labelEmbedding', () => {
  describe('computeEmbeddingBucket', () => {
    it('returns 0000 for empty string', () => {
      expect(computeEmbeddingBucket('')).toBe('0000');
      expect(computeEmbeddingBucket('   ')).toBe('0000');
    });

    it('returns a 4-char hex string', () => {
      const bucket = computeEmbeddingBucket('screwdriver');
      expect(bucket).toMatch(/^[0-9a-f]{4}$/);
    });

    it('returns consistent results for same input', () => {
      const bucket1 = computeEmbeddingBucket('test label');
      const bucket2 = computeEmbeddingBucket('test label');
      expect(bucket1).toBe(bucket2);
    });

    it('returns different buckets for different inputs', () => {
      const bucket1 = computeEmbeddingBucket('screwdriver');
      const bucket2 = computeEmbeddingBucket('hammer');
      // Different labels should usually produce different buckets
      // (though collisions are possible, they should be rare for very different labels)
      expect(bucket1).not.toBe(bucket2);
    });

    it('handles short labels (1-4 chars)', () => {
      const bucket = computeEmbeddingBucket('pen');
      expect(bucket).toMatch(/^[0-9a-f]{4}$/);
      // Should be decoded as 'short' length
      const decoded = decodeEmbeddingBucket(bucket);
      expect(decoded.length).toBe('short');
    });

    it('handles medium labels (5-12 chars)', () => {
      const bucket = computeEmbeddingBucket('screwdriver');
      expect(bucket).toMatch(/^[0-9a-f]{4}$/);
      const decoded = decodeEmbeddingBucket(bucket);
      expect(decoded.length).toBe('medium');
    });

    it('handles long labels (13+ chars)', () => {
      const bucket = computeEmbeddingBucket('Phillips head screwdriver');
      expect(bucket).toMatch(/^[0-9a-f]{4}$/);
      const decoded = decodeEmbeddingBucket(bucket);
      expect(decoded.length).toBe('long');
    });

    it('detects alpha character class', () => {
      const bucket = computeEmbeddingBucket('screwdriver');
      const decoded = decodeEmbeddingBucket(bucket);
      expect(decoded.charClass).toBe('alpha');
    });

    it('detects numeric character class', () => {
      const bucket = computeEmbeddingBucket('12345');
      const decoded = decodeEmbeddingBucket(bucket);
      expect(decoded.charClass).toBe('numeric');
    });

    it('detects alphanumeric character class', () => {
      const bucket = computeEmbeddingBucket('M3x8');
      const decoded = decodeEmbeddingBucket(bucket);
      expect(decoded.charClass).toBe('alphanumeric');
    });

    it('detects special character class', () => {
      const bucket = computeEmbeddingBucket('1/4" bolt');
      const decoded = decodeEmbeddingBucket(bucket);
      expect(decoded.charClass).toBe('special');
    });

    it('detects measurement pattern', () => {
      const bucket1 = computeEmbeddingBucket('M3x8 SHCS');
      const decoded1 = decodeEmbeddingBucket(bucket1);
      expect(decoded1.pattern).toBe('measurement');

      const bucket2 = computeEmbeddingBucket('10mm bolt');
      const decoded2 = decodeEmbeddingBucket(bucket2);
      expect(decoded2.pattern).toBe('measurement');
    });

    it('avoids false positives for measurement pattern', () => {
      // Words containing "m" + digits should not match unless standalone metric screw
      const bucket1 = computeEmbeddingBucket('medium3');
      const decoded1 = decodeEmbeddingBucket(bucket1);
      expect(decoded1.pattern).not.toBe('measurement');

      const bucket2 = computeEmbeddingBucket('item30');
      const decoded2 = decodeEmbeddingBucket(bucket2);
      expect(decoded2.pattern).not.toBe('measurement');

      // But standalone M3, M4 should still match
      const bucket3 = computeEmbeddingBucket('M3');
      const decoded3 = decodeEmbeddingBucket(bucket3);
      expect(decoded3.pattern).toBe('measurement');
    });

    it('detects code pattern', () => {
      const bucket = computeEmbeddingBucket('608ZZ');
      const decoded = decodeEmbeddingBucket(bucket);
      expect(decoded.pattern).toBe('code');
    });

    it('detects descriptive pattern', () => {
      const bucket = computeEmbeddingBucket('small red box');
      const decoded = decodeEmbeddingBucket(bucket);
      expect(decoded.pattern).toBe('descriptive');
    });

    it('detects plain pattern for regular labels', () => {
      const bucket = computeEmbeddingBucket('screwdriver');
      const decoded = decodeEmbeddingBucket(bucket);
      expect(decoded.pattern).toBe('plain');
    });
  });

  describe('decodeEmbeddingBucket', () => {
    it('decodes a bucket to its components', () => {
      const bucket = computeEmbeddingBucket('screwdriver');
      const decoded = decodeEmbeddingBucket(bucket);

      expect(decoded).toHaveProperty('length');
      expect(decoded).toHaveProperty('charClass');
      expect(decoded).toHaveProperty('pattern');
      expect(decoded).toHaveProperty('ngramHash');

      expect(['short', 'medium', 'long']).toContain(decoded.length);
      expect(['alpha', 'numeric', 'alphanumeric', 'special']).toContain(decoded.charClass);
      expect(['plain', 'measurement', 'code', 'descriptive']).toContain(decoded.pattern);
      expect(typeof decoded.ngramHash).toBe('number');
    });

    it('roundtrips correctly', () => {
      const labels = ['pen', 'screwdriver', 'M3x8', '608ZZ', 'small box'];

      for (const label of labels) {
        const bucket = computeEmbeddingBucket(label);
        const decoded = decodeEmbeddingBucket(bucket);
        // Verify the bucket value matches what we expect from decoded components
        const expectedBucket = (
          ((['short', 'medium', 'long', 'long'].indexOf(decoded.length) & 0x3) << 14) |
          ((['alpha', 'numeric', 'alphanumeric', 'special'].indexOf(decoded.charClass) & 0x3) <<
            12) |
          ((['plain', 'measurement', 'code', 'descriptive'].indexOf(decoded.pattern) & 0x3) << 10) |
          (decoded.ngramHash & 0xff)
        )
          .toString(16)
          .padStart(4, '0');
        expect(bucket).toBe(expectedBucket);
      }
    });
  });

  describe('semantic similarity', () => {
    it('groups similar label structures together', () => {
      // Similar structure labels should have similar bucket prefixes
      const bucket1 = computeEmbeddingBucket('M3x6');
      const bucket2 = computeEmbeddingBucket('M4x8');
      const decoded1 = decodeEmbeddingBucket(bucket1);
      const decoded2 = decodeEmbeddingBucket(bucket2);

      // Both should be measurement patterns
      expect(decoded1.pattern).toBe('measurement');
      expect(decoded2.pattern).toBe('measurement');
    });

    it('distinguishes different label types', () => {
      const measurementBucket = computeEmbeddingBucket('M3x8');
      const codeBucket = computeEmbeddingBucket('AA');
      const plainBucket = computeEmbeddingBucket('screwdriver');

      const decoded1 = decodeEmbeddingBucket(measurementBucket);
      const decoded2 = decodeEmbeddingBucket(codeBucket);
      const decoded3 = decodeEmbeddingBucket(plainBucket);

      // Each should have a different pattern
      expect(decoded1.pattern).toBe('measurement');
      expect(decoded2.pattern).toBe('code');
      expect(decoded3.pattern).toBe('plain');
    });
  });
});

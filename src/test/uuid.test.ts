import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateUUID } from '../utils/uuid';

describe('generateUUID', () => {
  describe('with crypto.randomUUID available', () => {
    it('uses crypto.randomUUID when available', () => {
      const mockUUID = '12345678-1234-4123-8123-123456789abc';
      const randomUUIDSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue(mockUUID);

      const result = generateUUID();

      expect(result).toBe(mockUUID);
      expect(randomUUIDSpy).toHaveBeenCalledOnce();

      randomUUIDSpy.mockRestore();
    });

    it('returns different UUIDs on subsequent calls', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();

      expect(uuid1).not.toBe(uuid2);
    });

    it('returns valid UUID v4 format', () => {
      const uuid = generateUUID();
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(uuid).toMatch(uuidV4Regex);
    });
  });

  describe('fallback implementation', () => {
    let originalRandomUUID: typeof crypto.randomUUID | undefined;

    beforeEach(() => {
      // Store original and set randomUUID to undefined to trigger fallback
      originalRandomUUID = crypto.randomUUID;
      Object.defineProperty(crypto, 'randomUUID', {
        value: undefined,
        configurable: true,
        writable: true,
      });
    });

    afterEach(() => {
      // Restore randomUUID
      Object.defineProperty(crypto, 'randomUUID', {
        value: originalRandomUUID,
        configurable: true,
        writable: true,
      });
    });

    it('uses fallback when crypto.randomUUID is unavailable', () => {
      const uuid = generateUUID();

      // Should still produce valid UUID format
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidV4Regex);
    });

    it('fallback produces unique UUIDs', () => {
      const uuids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        uuids.add(generateUUID());
      }

      // All 100 should be unique
      expect(uuids.size).toBe(100);
    });

    it('fallback UUID has correct version nibble (4)', () => {
      const uuid = generateUUID();
      // The 13th character should be '4' for UUID v4
      expect(uuid[14]).toBe('4');
    });

    it('fallback UUID has correct variant nibble (8, 9, a, or b)', () => {
      const uuid = generateUUID();
      // The 17th character (19th position including hyphens) should be 8, 9, a, or b
      expect(['8', '9', 'a', 'b']).toContain(uuid[19]);
    });
  });
});

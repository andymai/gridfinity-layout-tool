import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loadSplitRatio,
  saveSplitRatio,
} from '@/features/bin-designer/components/CutoutWorkspace/splitRatioStorage';

const STORAGE_KEY = 'gridfinity-cutout-split';

describe('splitRatioStorage', () => {
  let getItemSpy: ReturnType<typeof vi.spyOn>;
  let setItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
  });

  afterEach(() => {
    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });

  describe('loadSplitRatio', () => {
    it('returns default 0.5 when nothing stored', () => {
      expect(loadSplitRatio()).toBe(0.5);
    });

    it('returns stored value when in valid range', () => {
      localStorage.setItem(STORAGE_KEY, '0.6');
      expect(loadSplitRatio()).toBe(0.6);
    });

    it('returns default for out-of-range value (too low)', () => {
      localStorage.setItem(STORAGE_KEY, '0.1');
      expect(loadSplitRatio()).toBe(0.5);
    });

    it('returns default for out-of-range value (too high)', () => {
      localStorage.setItem(STORAGE_KEY, '0.9');
      expect(loadSplitRatio()).toBe(0.5);
    });

    it('returns default for NaN', () => {
      localStorage.setItem(STORAGE_KEY, 'invalid');
      expect(loadSplitRatio()).toBe(0.5);
    });

    it('returns default on localStorage error', () => {
      getItemSpy.mockImplementationOnce(() => {
        throw new Error('Storage quota exceeded');
      });
      expect(loadSplitRatio()).toBe(0.5);
    });

    it('accepts boundary values (min)', () => {
      localStorage.setItem(STORAGE_KEY, '0.25');
      expect(loadSplitRatio()).toBe(0.25);
    });

    it('accepts boundary values (max)', () => {
      localStorage.setItem(STORAGE_KEY, '0.75');
      expect(loadSplitRatio()).toBe(0.75);
    });
  });

  describe('saveSplitRatio', () => {
    it('saves value to localStorage', () => {
      saveSplitRatio(0.6);
      expect(localStorage.getItem(STORAGE_KEY)).toBe('0.6');
    });

    it('handles localStorage error gracefully', () => {
      setItemSpy.mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });
      expect(() => saveSplitRatio(0.5)).not.toThrow();
    });
  });
});

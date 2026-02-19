import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clearAllAppData } from './clearAppData';

const mockClearIndexedDB = vi.hoisted(() => vi.fn());
const mockPruneAnalyticsData = vi.hoisted(() => vi.fn());
const mockClearLabelSizesCache = vi.hoisted(() => vi.fn());

vi.mock('./backends/indexedDB', () => ({
  clearAllData: mockClearIndexedDB,
}));

vi.mock('@/shared/analytics/posthog', () => ({
  pruneAnalyticsData: mockPruneAnalyticsData,
}));

vi.mock('@/shared/analytics/purposeInference', () => ({
  clearLabelSizesCache: mockClearLabelSizesCache,
}));

describe('clearAllAppData', () => {
  beforeEach(() => {
    mockClearIndexedDB.mockClear();
    mockPruneAnalyticsData.mockClear();
    mockClearLabelSizesCache.mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('cleanup function calls', () => {
    it('calls clearAllData (IndexedDB)', () => {
      clearAllAppData();
      expect(mockClearIndexedDB).toHaveBeenCalledTimes(1);
    });

    it('calls pruneAnalyticsData', () => {
      clearAllAppData();
      expect(mockPruneAnalyticsData).toHaveBeenCalledTimes(1);
    });

    it('calls clearLabelSizesCache', () => {
      clearAllAppData();
      expect(mockClearLabelSizesCache).toHaveBeenCalledTimes(1);
    });

    it('calls all three cleanup functions on a single invocation', () => {
      clearAllAppData();
      expect(mockClearIndexedDB).toHaveBeenCalledTimes(1);
      expect(mockPruneAnalyticsData).toHaveBeenCalledTimes(1);
      expect(mockClearLabelSizesCache).toHaveBeenCalledTimes(1);
    });
  });

  describe('localStorage clearing', () => {
    it('removes a non-preserved localStorage key', () => {
      localStorage.setItem('gridfinity-layout-abc123', '{"some":"data"}');
      clearAllAppData();
      expect(localStorage.getItem('gridfinity-layout-abc123')).toBeNull();
    });

    it('removes multiple non-preserved localStorage keys', () => {
      localStorage.setItem('gridfinity-layout-abc', '{}');
      localStorage.setItem('gridfinity-library', '[]');
      localStorage.setItem('gridfinity-onboarding', 'true');
      clearAllAppData();
      expect(localStorage.getItem('gridfinity-layout-abc')).toBeNull();
      expect(localStorage.getItem('gridfinity-library')).toBeNull();
      expect(localStorage.getItem('gridfinity-onboarding')).toBeNull();
    });

    it('preserves gridfinity-settings-v1', () => {
      const settingsValue = '{"theme":"dark","language":"en"}';
      localStorage.setItem('gridfinity-settings-v1', settingsValue);
      clearAllAppData();
      expect(localStorage.getItem('gridfinity-settings-v1')).toBe(settingsValue);
    });

    it('preserves gridfinity-settings-v1 while removing other keys', () => {
      const settingsValue = '{"theme":"dark"}';
      localStorage.setItem('gridfinity-settings-v1', settingsValue);
      localStorage.setItem('gridfinity-layout-xyz', '{"bins":[]}');
      localStorage.setItem('some-migration-flag', 'done');
      clearAllAppData();
      expect(localStorage.getItem('gridfinity-settings-v1')).toBe(settingsValue);
      expect(localStorage.getItem('gridfinity-layout-xyz')).toBeNull();
      expect(localStorage.getItem('some-migration-flag')).toBeNull();
    });

    it('handles empty localStorage gracefully', () => {
      // localStorage is already empty from beforeEach
      expect(() => clearAllAppData()).not.toThrow();
    });

    it('handles localStorage with only the preserved key', () => {
      localStorage.setItem('gridfinity-settings-v1', '{"theme":"light"}');
      clearAllAppData();
      expect(localStorage.length).toBe(1);
      expect(localStorage.getItem('gridfinity-settings-v1')).toBe('{"theme":"light"}');
    });
  });

  describe('localStorage error handling', () => {
    it('does not throw when localStorage.key throws', () => {
      const originalKey = localStorage.key.bind(localStorage);
      Object.defineProperty(localStorage, 'key', {
        configurable: true,
        value: () => {
          throw new Error('localStorage unavailable');
        },
      });

      // Even though localStorage.key throws, the function should not propagate
      expect(() => clearAllAppData()).not.toThrow();

      Object.defineProperty(localStorage, 'key', {
        configurable: true,
        value: originalKey,
      });
    });

    it('does not throw when localStorage.removeItem throws', () => {
      localStorage.setItem('some-key', 'value');

      const originalRemoveItem = localStorage.removeItem.bind(localStorage);
      Object.defineProperty(localStorage, 'removeItem', {
        configurable: true,
        value: () => {
          throw new Error('storage quota exceeded');
        },
      });

      expect(() => clearAllAppData()).not.toThrow();

      Object.defineProperty(localStorage, 'removeItem', {
        configurable: true,
        value: originalRemoveItem,
      });
    });

    it('still calls all cleanup functions even when localStorage throws', () => {
      Object.defineProperty(localStorage, 'key', {
        configurable: true,
        value: () => {
          throw new Error('storage error');
        },
      });

      clearAllAppData();

      // These run before the try/catch, so they must still be called
      expect(mockClearIndexedDB).toHaveBeenCalledTimes(1);
      expect(mockPruneAnalyticsData).toHaveBeenCalledTimes(1);
      expect(mockClearLabelSizesCache).toHaveBeenCalledTimes(1);

      Object.defineProperty(localStorage, 'key', {
        configurable: true,
        value: Storage.prototype.key,
      });
    });
  });
});

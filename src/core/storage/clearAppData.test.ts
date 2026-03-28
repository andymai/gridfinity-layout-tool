// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clearAllAppData } from './clearAppData';

const mockClearIndexedDB = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockPruneAnalyticsData = vi.hoisted(() => vi.fn());
const mockClearLabelSizesCache = vi.hoisted(() => vi.fn());

vi.mock('./backends/indexedDB', () => ({
  clearAllData: mockClearIndexedDB,
}));

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
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
    it('calls clearAllData (IndexedDB)', async () => {
      await clearAllAppData();
      expect(mockClearIndexedDB).toHaveBeenCalledTimes(1);
    });

    it('calls pruneAnalyticsData', async () => {
      await clearAllAppData();
      expect(mockPruneAnalyticsData).toHaveBeenCalledTimes(1);
    });

    it('calls clearLabelSizesCache', async () => {
      await clearAllAppData();
      expect(mockClearLabelSizesCache).toHaveBeenCalledTimes(1);
    });

    it('calls all three cleanup functions on a single invocation', async () => {
      await clearAllAppData();
      expect(mockClearIndexedDB).toHaveBeenCalledTimes(1);
      expect(mockPruneAnalyticsData).toHaveBeenCalledTimes(1);
      expect(mockClearLabelSizesCache).toHaveBeenCalledTimes(1);
    });
  });

  describe('localStorage clearing', () => {
    it('removes a non-preserved localStorage key', async () => {
      localStorage.setItem('gridfinity-layout-abc123', '{"some":"data"}');
      await clearAllAppData();
      expect(localStorage.getItem('gridfinity-layout-abc123')).toBeNull();
    });

    it('removes multiple non-preserved localStorage keys', async () => {
      localStorage.setItem('gridfinity-layout-abc', '{}');
      localStorage.setItem('gridfinity-library', '[]');
      localStorage.setItem('gridfinity-onboarding', 'true');
      await clearAllAppData();
      expect(localStorage.getItem('gridfinity-layout-abc')).toBeNull();
      expect(localStorage.getItem('gridfinity-library')).toBeNull();
      expect(localStorage.getItem('gridfinity-onboarding')).toBeNull();
    });

    it('preserves gridfinity-settings-v1', async () => {
      const settingsValue = '{"theme":"dark","language":"en"}';
      localStorage.setItem('gridfinity-settings-v1', settingsValue);
      await clearAllAppData();
      expect(localStorage.getItem('gridfinity-settings-v1')).toBe(settingsValue);
    });

    it('preserves gridfinity-settings-v1 while removing other keys', async () => {
      const settingsValue = '{"theme":"dark"}';
      localStorage.setItem('gridfinity-settings-v1', settingsValue);
      localStorage.setItem('gridfinity-layout-xyz', '{"bins":[]}');
      localStorage.setItem('some-migration-flag', 'done');
      await clearAllAppData();
      expect(localStorage.getItem('gridfinity-settings-v1')).toBe(settingsValue);
      expect(localStorage.getItem('gridfinity-layout-xyz')).toBeNull();
      expect(localStorage.getItem('some-migration-flag')).toBeNull();
    });

    it('handles empty localStorage gracefully', async () => {
      // localStorage is already empty from beforeEach
      await expect(clearAllAppData()).resolves.toBeUndefined();
    });

    it('handles localStorage with only the preserved key', async () => {
      localStorage.setItem('gridfinity-settings-v1', '{"theme":"light"}');
      await clearAllAppData();
      expect(localStorage.length).toBe(1);
      expect(localStorage.getItem('gridfinity-settings-v1')).toBe('{"theme":"light"}');
    });
  });

  describe('localStorage error handling', () => {
    it('does not throw when localStorage.key throws', async () => {
      const originalKey = localStorage.key.bind(localStorage);
      Object.defineProperty(localStorage, 'key', {
        configurable: true,
        value: () => {
          throw new Error('localStorage unavailable');
        },
      });

      // Even though localStorage.key throws, the function should not propagate
      await expect(clearAllAppData()).resolves.toBeUndefined();

      Object.defineProperty(localStorage, 'key', {
        configurable: true,
        value: originalKey,
      });
    });

    it('does not throw when localStorage.removeItem throws', async () => {
      localStorage.setItem('some-key', 'value');

      const originalRemoveItem = localStorage.removeItem.bind(localStorage);
      Object.defineProperty(localStorage, 'removeItem', {
        configurable: true,
        value: () => {
          throw new Error('storage quota exceeded');
        },
      });

      await expect(clearAllAppData()).resolves.toBeUndefined();

      Object.defineProperty(localStorage, 'removeItem', {
        configurable: true,
        value: originalRemoveItem,
      });
    });

    it('still calls all cleanup functions even when localStorage throws', async () => {
      Object.defineProperty(localStorage, 'key', {
        configurable: true,
        value: () => {
          throw new Error('storage error');
        },
      });

      await clearAllAppData();

      // Sync cleanup runs before/after the try/catch; IDB runs last but is still called
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

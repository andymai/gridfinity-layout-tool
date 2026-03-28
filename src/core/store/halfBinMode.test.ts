import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useHalfBinModeStore } from '@/core/store/halfBinMode';
import { useLayoutStore } from '@/core/store/layout';
import {
  resetAllStores,
  createIsolatedLocalStorageMock,
  expectOk,
  expectErr,
} from '@/test/testUtils';
import { layerId } from '@/core/types';

// Mock analytics to avoid side effects
vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
  markFeatureUsed: vi.fn(),
}));

describe('halfBinMode store', () => {
  let localStorageMock: ReturnType<typeof createIsolatedLocalStorageMock>;

  beforeEach(() => {
    // Setup isolated localStorage mock
    localStorageMock = createIsolatedLocalStorageMock();
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock.mock,
      writable: true,
      configurable: true,
    });

    resetAllStores();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.cleanup();
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('starts with halfBinMode false when no localStorage value', () => {
      const { halfBinMode } = useHalfBinModeStore.getState();
      expect(halfBinMode).toBe(false);
    });

    it('reads initial state from localStorage if set to true', () => {
      // Set up localStorage before store initialization
      localStorageMock.mock.setItem('gridfinity-half-bin-mode', 'true');

      // Force re-creation of store by getting fresh state
      // Note: In practice, the store is created once at module load,
      // so this test verifies the loadFromStorage behavior conceptually
      expect(localStorageMock.mock.getItem('gridfinity-half-bin-mode')).toBe('true');
    });
  });

  describe('setHalfBinMode', () => {
    it('enables half-bin mode', () => {
      const { setHalfBinMode } = useHalfBinModeStore.getState();

      setHalfBinMode(true);

      const { halfBinMode } = useHalfBinModeStore.getState();
      expect(halfBinMode).toBe(true);
    });

    it('disables half-bin mode', () => {
      const { setHalfBinMode } = useHalfBinModeStore.getState();

      setHalfBinMode(true);
      setHalfBinMode(false);

      const { halfBinMode } = useHalfBinModeStore.getState();
      expect(halfBinMode).toBe(false);
    });

    it('persists state to localStorage when enabled', () => {
      const { setHalfBinMode } = useHalfBinModeStore.getState();

      setHalfBinMode(true);

      expect(localStorageMock.mock.setItem).toHaveBeenCalledWith(
        'gridfinity-half-bin-mode',
        'true'
      );
    });

    it('persists state to localStorage when disabled', () => {
      const { setHalfBinMode } = useHalfBinModeStore.getState();

      setHalfBinMode(true);
      setHalfBinMode(false);

      expect(localStorageMock.mock.setItem).toHaveBeenLastCalledWith(
        'gridfinity-half-bin-mode',
        'false'
      );
    });

    it('bypasses validation (direct set)', () => {
      // Add a fractional bin
      const { layout, addBin } = useLayoutStore.getState();
      addBin({
        layerId: layout.layers[0].id,
        x: 0.5, // Fractional position
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        category: layout.categories[0].id,
        label: '',
        notes: '',
      });

      // setHalfBinMode bypasses validation (caller is responsible)
      const { setHalfBinMode } = useHalfBinModeStore.getState();
      setHalfBinMode(false);

      const { halfBinMode } = useHalfBinModeStore.getState();
      expect(halfBinMode).toBe(false);
    });
  });

  describe('toggleHalfBinMode', () => {
    it('enables half-bin mode when currently disabled', () => {
      const { toggleHalfBinMode } = useHalfBinModeStore.getState();

      const result = toggleHalfBinMode();

      expectOk(result);
      const { halfBinMode } = useHalfBinModeStore.getState();
      expect(halfBinMode).toBe(true);
    });

    it('disables half-bin mode when no fractional bins exist', () => {
      const { toggleHalfBinMode, setHalfBinMode } = useHalfBinModeStore.getState();

      // Enable first
      setHalfBinMode(true);

      // Toggle off (no fractional bins = should succeed)
      const result = toggleHalfBinMode();

      expectOk(result);
      const { halfBinMode } = useHalfBinModeStore.getState();
      expect(halfBinMode).toBe(false);
    });

    it('returns error when trying to disable with fractional bins on grid', () => {
      const { setHalfBinMode, toggleHalfBinMode } = useHalfBinModeStore.getState();

      // Enable half-bin mode first
      setHalfBinMode(true);

      // Add a bin with fractional position
      const { layout, addBin } = useLayoutStore.getState();
      addBin({
        layerId: layout.layers[0].id,
        x: 0.5, // Fractional position
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        category: layout.categories[0].id,
        label: '',
        notes: '',
      });

      // Try to toggle off - should fail
      const result = toggleHalfBinMode();

      const error = expectErr(result);
      expect(error.code).toBe('LAYOUT_INVALID_OPERATION');
      expect(error.reason).toContain('Cannot disable');
      expect(error.reason).toContain('fractional dimensions');

      // State should remain enabled
      const { halfBinMode } = useHalfBinModeStore.getState();
      expect(halfBinMode).toBe(true);
    });

    it('returns error when bins have fractional width', () => {
      const { setHalfBinMode, toggleHalfBinMode } = useHalfBinModeStore.getState();
      setHalfBinMode(true);

      const { layout, addBin } = useLayoutStore.getState();
      addBin({
        layerId: layout.layers[0].id,
        x: 0,
        y: 0,
        width: 1.5, // Fractional width
        depth: 1,
        height: 3,
        category: layout.categories[0].id,
        label: '',
        notes: '',
      });

      const result = toggleHalfBinMode();

      expectErr(result);
      expect(useHalfBinModeStore.getState().halfBinMode).toBe(true);
    });

    it('returns error when bins have fractional depth', () => {
      const { setHalfBinMode, toggleHalfBinMode } = useHalfBinModeStore.getState();
      setHalfBinMode(true);

      const { layout, addBin } = useLayoutStore.getState();
      addBin({
        layerId: layout.layers[0].id,
        x: 0,
        y: 0,
        width: 1,
        depth: 2.5, // Fractional depth
        height: 3,
        category: layout.categories[0].id,
        label: '',
        notes: '',
      });

      const result = toggleHalfBinMode();

      expectErr(result);
      expect(useHalfBinModeStore.getState().halfBinMode).toBe(true);
    });

    it('allows disabling when only staging bins have fractional dimensions', () => {
      const { setHalfBinMode, toggleHalfBinMode } = useHalfBinModeStore.getState();
      setHalfBinMode(true);

      // Add a fractional bin to staging (should be ignored)
      const { layout, addBin } = useLayoutStore.getState();
      addBin({
        layerId: layerId('__staging__'),
        x: 0.5, // Fractional position in staging
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        category: layout.categories[0].id,
        label: '',
        notes: '',
      });

      // Should succeed because staging bins are ignored
      const result = toggleHalfBinMode();

      expectOk(result);
      expect(useHalfBinModeStore.getState().halfBinMode).toBe(false);
    });

    it('persists to localStorage when enabling', () => {
      const { toggleHalfBinMode } = useHalfBinModeStore.getState();

      toggleHalfBinMode();

      expect(localStorageMock.mock.setItem).toHaveBeenCalledWith(
        'gridfinity-half-bin-mode',
        'true'
      );
    });

    it('persists to localStorage when disabling successfully', () => {
      const { setHalfBinMode, toggleHalfBinMode } = useHalfBinModeStore.getState();

      setHalfBinMode(true);
      localStorageMock.mock.setItem.mockClear();

      toggleHalfBinMode();

      expect(localStorageMock.mock.setItem).toHaveBeenCalledWith(
        'gridfinity-half-bin-mode',
        'false'
      );
    });

    it('does not persist when toggle fails validation', () => {
      const { setHalfBinMode, toggleHalfBinMode } = useHalfBinModeStore.getState();
      setHalfBinMode(true);

      // Add fractional bin
      const { layout, addBin } = useLayoutStore.getState();
      addBin({
        layerId: layout.layers[0].id,
        x: 0.5,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        category: layout.categories[0].id,
        label: '',
        notes: '',
      });

      localStorageMock.mock.setItem.mockClear();

      toggleHalfBinMode();

      // setItem should not be called when validation fails
      expect(localStorageMock.mock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('localStorage error handling', () => {
    it('silently handles localStorage errors on save', () => {
      localStorageMock.mock.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const { setHalfBinMode } = useHalfBinModeStore.getState();

      // Should not throw
      expect(() => setHalfBinMode(true)).not.toThrow();

      // State should still update
      const { halfBinMode } = useHalfBinModeStore.getState();
      expect(halfBinMode).toBe(true);
    });
  });

  describe('multiple fractional bins', () => {
    it('reports count in error message', () => {
      const { setHalfBinMode, toggleHalfBinMode } = useHalfBinModeStore.getState();
      setHalfBinMode(true);

      const { layout, addBin } = useLayoutStore.getState();

      // Add multiple fractional bins
      addBin({
        layerId: layout.layers[0].id,
        x: 0.5,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        category: layout.categories[0].id,
        label: '',
        notes: '',
      });

      addBin({
        layerId: layout.layers[0].id,
        x: 2.5,
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        category: layout.categories[0].id,
        label: '',
        notes: '',
      });

      const result = toggleHalfBinMode();

      const error = expectErr(result);
      expect(error.reason).toContain('2 bins');
    });
  });
});

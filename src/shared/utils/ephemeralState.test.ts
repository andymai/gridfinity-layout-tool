import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveEphemeralState,
  loadEphemeralState,
  hasEphemeralState,
  clearEphemeralState,
  type EphemeralState,
} from '@/shared/utils/ephemeralState';

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      const { [key]: _, ...rest } = store;
      store = rest;
      void _; // Suppress unused variable warning
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    // For testing
    get _store() {
      return store;
    },
  };
})();

Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

describe('ephemeralState', () => {
  const validState: Omit<EphemeralState, 'savedAt'> = {
    selectedBinIds: ['bin-1', 'bin-2'],
    activeLayerId: 'layer-1',
    activeCategoryId: 'coral',
    focusedBinId: 'bin-1',
    zoom: 1.5,
    showOtherLayers: true,
    leftPanelCollapsed: false,
    rightPanelCollapsed: true,
    showIsometricPreview: true,
    isometricRotation: 45,
    layerViewMode: 'stack',
    paintSize: { width: 2, depth: 2 },
  };

  beforeEach(() => {
    sessionStorageMock.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('saveEphemeralState', () => {
    it('saves state to sessionStorage with timestamp', () => {
      saveEphemeralState(validState);

      expect(sessionStorageMock.setItem).toHaveBeenCalledTimes(1);
      const savedData = JSON.parse(sessionStorageMock._store['gridfinity-ephemeral-state-v1']);
      expect(savedData.selectedBinIds).toEqual(['bin-1', 'bin-2']);
      expect(savedData.zoom).toBe(1.5);
      expect(savedData.savedAt).toBe(Date.now());
    });

    it('handles storage errors gracefully', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      sessionStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('QuotaExceeded');
      });

      // Should not throw
      expect(() => saveEphemeralState(validState)).not.toThrow();
      expect(consoleWarn).toHaveBeenCalledWith(
        'Failed to save ephemeral state:',
        expect.any(Error)
      );
    });

    it('includes all expected fields', () => {
      saveEphemeralState(validState);

      const savedData = JSON.parse(sessionStorageMock._store['gridfinity-ephemeral-state-v1']);

      // Verify all fields are present
      expect(savedData).toHaveProperty('selectedBinIds');
      expect(savedData).toHaveProperty('activeLayerId');
      expect(savedData).toHaveProperty('activeCategoryId');
      expect(savedData).toHaveProperty('focusedBinId');
      expect(savedData).toHaveProperty('zoom');
      expect(savedData).toHaveProperty('showOtherLayers');
      expect(savedData).toHaveProperty('leftPanelCollapsed');
      expect(savedData).toHaveProperty('rightPanelCollapsed');
      expect(savedData).toHaveProperty('showIsometricPreview');
      expect(savedData).toHaveProperty('isometricRotation');
      expect(savedData).toHaveProperty('layerViewMode');
      expect(savedData).toHaveProperty('paintSize');
      expect(savedData).toHaveProperty('savedAt');
    });
  });

  describe('loadEphemeralState', () => {
    it('returns null when no state exists', () => {
      expect(loadEphemeralState()).toBeNull();
    });

    it('loads and clears state from sessionStorage', () => {
      saveEphemeralState(validState);
      sessionStorageMock.removeItem.mockClear();

      const loaded = loadEphemeralState();

      expect(loaded).not.toBeNull();
      expect(loaded?.selectedBinIds).toEqual(['bin-1', 'bin-2']);
      expect(loaded?.zoom).toBe(1.5);
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('gridfinity-ephemeral-state-v1');
    });

    it('returns null and clears if state is older than 30 seconds', () => {
      saveEphemeralState(validState);

      // Advance time by 31 seconds
      vi.advanceTimersByTime(31 * 1000);

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const loaded = loadEphemeralState();

      expect(loaded).toBeNull();
      expect(consoleWarn).toHaveBeenCalledWith('Ephemeral state too old, discarding');
    });

    it('returns state if within 30 second window', () => {
      saveEphemeralState(validState);

      // Advance time by 29 seconds (just under threshold)
      vi.advanceTimersByTime(29 * 1000);

      const loaded = loadEphemeralState();
      expect(loaded).not.toBeNull();
      expect(loaded?.selectedBinIds).toEqual(['bin-1', 'bin-2']);
    });

    it('returns null for invalid JSON', () => {
      sessionStorageMock._store['gridfinity-ephemeral-state-v1'] = 'not valid json{{{';

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const loaded = loadEphemeralState();

      expect(loaded).toBeNull();
      expect(consoleWarn).toHaveBeenCalledWith(
        'Failed to load ephemeral state:',
        expect.any(Error)
      );
    });

    it('returns null for state missing required fields', () => {
      const invalidState = {
        selectedBinIds: 'not-an-array', // Should be array
        activeLayerId: 'layer-1',
        zoom: 1.0,
        savedAt: Date.now(),
      };
      sessionStorageMock._store['gridfinity-ephemeral-state-v1'] = JSON.stringify(invalidState);

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const loaded = loadEphemeralState();

      expect(loaded).toBeNull();
      expect(consoleWarn).toHaveBeenCalledWith('Ephemeral state validation failed, discarding');
    });

    it('clears corrupted data on error', () => {
      sessionStorageMock._store['gridfinity-ephemeral-state-v1'] = 'corrupt';
      sessionStorageMock.removeItem.mockClear();

      loadEphemeralState();

      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('gridfinity-ephemeral-state-v1');
    });
  });

  describe('hasEphemeralState', () => {
    it('returns false when no state exists', () => {
      expect(hasEphemeralState()).toBe(false);
    });

    it('returns true when state exists', () => {
      saveEphemeralState(validState);
      expect(hasEphemeralState()).toBe(true);
    });

    it('handles storage errors gracefully', () => {
      sessionStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      expect(hasEphemeralState()).toBe(false);
    });
  });

  describe('clearEphemeralState', () => {
    it('removes state from sessionStorage', () => {
      saveEphemeralState(validState);
      sessionStorageMock.removeItem.mockClear();

      clearEphemeralState();

      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('gridfinity-ephemeral-state-v1');
    });

    it('handles storage errors gracefully', () => {
      sessionStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      // Should not throw
      expect(() => clearEphemeralState()).not.toThrow();
    });
  });

  describe('round-trip', () => {
    it('preserves all state fields through save/load cycle', () => {
      const stateWithNulls: Omit<EphemeralState, 'savedAt'> = {
        ...validState,
        focusedBinId: null,
        paintSize: null,
      };

      saveEphemeralState(stateWithNulls);
      const loaded = loadEphemeralState();

      expect(loaded).not.toBeNull();
      expect(loaded?.selectedBinIds).toEqual(stateWithNulls.selectedBinIds);
      expect(loaded?.activeLayerId).toBe(stateWithNulls.activeLayerId);
      expect(loaded?.activeCategoryId).toBe(stateWithNulls.activeCategoryId);
      expect(loaded?.focusedBinId).toBe(null);
      expect(loaded?.zoom).toBe(stateWithNulls.zoom);
      expect(loaded?.showOtherLayers).toBe(stateWithNulls.showOtherLayers);
      expect(loaded?.leftPanelCollapsed).toBe(stateWithNulls.leftPanelCollapsed);
      expect(loaded?.rightPanelCollapsed).toBe(stateWithNulls.rightPanelCollapsed);
      expect(loaded?.showIsometricPreview).toBe(stateWithNulls.showIsometricPreview);
      expect(loaded?.isometricRotation).toBe(stateWithNulls.isometricRotation);
      expect(loaded?.layerViewMode).toBe(stateWithNulls.layerViewMode);
      expect(loaded?.paintSize).toBe(null);
    });

    it('state can only be loaded once (one-time use)', () => {
      saveEphemeralState(validState);

      const firstLoad = loadEphemeralState();
      const secondLoad = loadEphemeralState();

      expect(firstLoad).not.toBeNull();
      expect(secondLoad).toBeNull();
    });
  });
});

import { create } from 'zustand';
import { validateHalfBinModeToggle } from '@/utils/halfBinConstraints';
import { useLayoutStore } from './layout';
import type { Result, Unit, LayoutError } from '@/core/result';
import { err, layoutInvalidOperation, OK } from '@/core/result';
import type { OperationResult } from '@/core/types';

/**
 * Half-Bin Mode Store
 *
 * Manages the half-bin mode setting, which allows 0.5 unit increments
 * for finer positioning of bins. This is a power user feature.
 *
 * Extracted from ui.ts as part of the god object decomposition.
 *
 * Persistence: Stored in localStorage under 'gridfinity-half-bin-mode'.
 * The store handles persistence internally to keep components simple.
 */

const STORAGE_KEY = 'gridfinity-half-bin-mode';

/**
 * Load half-bin mode preference from localStorage.
 * Defaults to false if not set or on error.
 */
function loadFromStorage(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Save half-bin mode preference to localStorage.
 * Silently ignores storage errors (e.g., quota exceeded, private browsing).
 */
function saveToStorage(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled.toString());
  } catch {
    // Ignore storage errors
  }
}

interface HalfBinModeState {
  halfBinMode: boolean;
}

interface HalfBinModeActions {
  /**
   * Toggle half-bin mode with validation.
   * Returns OperationResult for legacy compatibility.
   *
   * When turning OFF, validates that no bins have fractional dimensions.
   * If validation fails, returns { success: false, error: string }.
   */
  toggleHalfBinMode: () => OperationResult<void>;

  /**
   * Toggle half-bin mode with validation.
   * Returns Result<Unit, LayoutError> for modern error handling.
   *
   * When turning OFF, validates that no bins have fractional dimensions.
   * If validation fails, returns Err with details.
   */
  toggleHalfBinModeResult: () => Result<Unit, LayoutError>;

  /**
   * Set half-bin mode directly without validation.
   * Use with caution - caller is responsible for ensuring valid state.
   */
  setHalfBinMode: (enabled: boolean) => void;
}

export type HalfBinModeStore = HalfBinModeState & HalfBinModeActions;

export const useHalfBinModeStore = create<HalfBinModeStore>((set) => ({
  halfBinMode: loadFromStorage(),

  toggleHalfBinMode: () => {
    const state = useHalfBinModeStore.getState();
    const targetState = !state.halfBinMode;

    // Turning ON: no validation needed
    if (targetState === true) {
      saveToStorage(true);
      set({ halfBinMode: true });
      return { success: true };
    }

    // Turning OFF: validate layout for fractional bins
    const layout = useLayoutStore.getState().layout;
    const result = validateHalfBinModeToggle(layout, false);

    if (!result.canDisable) {
      return {
        success: false,
        error: 'Cannot disable half-bin mode while bins with fractional dimensions exist',
      };
    }

    saveToStorage(false);
    set({ halfBinMode: false });
    return { success: true };
  },

  toggleHalfBinModeResult: () => {
    const state = useHalfBinModeStore.getState();
    const targetState = !state.halfBinMode;

    // Turning ON: no validation needed
    if (targetState === true) {
      saveToStorage(true);
      set({ halfBinMode: true });
      return OK;
    }

    // Turning OFF: validate layout for fractional bins
    const layout = useLayoutStore.getState().layout;
    const result = validateHalfBinModeToggle(layout, false);

    if (!result.canDisable) {
      return err(
        layoutInvalidOperation(
          'toggleHalfBinMode',
          `Cannot disable: ${result.violation?.count ?? 0} bins have fractional dimensions`
        )
      );
    }

    saveToStorage(false);
    set({ halfBinMode: false });
    return OK;
  },

  setHalfBinMode: (enabled) => {
    saveToStorage(enabled);
    set({ halfBinMode: enabled });
  },
}));

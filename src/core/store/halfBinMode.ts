import { create } from 'zustand';
import { validateHalfBinModeToggle } from '@/shared/utils/halfBinConstraints';
import { markFeatureUsed } from '@/shared/analytics/posthog';
import { useLayoutStore } from './layout';
import type { Result, Unit, LayoutError, StorageError } from '@/core/result';
import { err, isOk, layoutInvalidOperation, OK } from '@/core/result';
import { saveToLocalStorage, loadFromLocalStorage } from '@/core/storage/backends/localStorage';

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
  const result = loadFromLocalStorage<boolean>(STORAGE_KEY);
  if (isOk(result) && result.value !== null) {
    return result.value;
  }
  return false;
}

/**
 * Save half-bin mode preference to localStorage.
 * Returns Result to indicate if persistence succeeded.
 */
function saveToStorage(enabled: boolean): Result<void, StorageError> {
  return saveToLocalStorage(STORAGE_KEY, enabled);
}

interface HalfBinModeState {
  halfBinMode: boolean;
}

interface HalfBinModeActions {
  /**
   * Toggle half-bin mode with validation.
   * Returns Result<Unit, LayoutError> for type-safe error handling.
   *
   * When turning OFF, validates that no bins have fractional dimensions.
   * If validation fails, returns Err with details.
   */
  toggleHalfBinMode: () => Result<Unit, LayoutError>;

  /**
   * Set half-bin mode directly without validation.
   * Use with caution - caller is responsible for ensuring valid state.
   * Returns Result indicating if persistence succeeded.
   */
  setHalfBinMode: (enabled: boolean) => Result<void, StorageError>;
}

export type HalfBinModeStore = HalfBinModeState & HalfBinModeActions;

export const INITIAL_HALF_BIN_MODE_STATE = {
  halfBinMode: false,
} as const;

export const useHalfBinModeStore = create<HalfBinModeStore>((set) => ({
  halfBinMode: loadFromStorage(),

  toggleHalfBinMode: () => {
    const state = useHalfBinModeStore.getState();
    const targetState = !state.halfBinMode;

    // Turning ON: no validation needed
    if (targetState) {
      saveToStorage(true);
      set({ halfBinMode: true });
      markFeatureUsed('half_bins');
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
    const result = saveToStorage(enabled);
    set({ halfBinMode: enabled });
    return result;
  },
}));

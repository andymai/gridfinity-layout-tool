import { create } from 'zustand';
import { validateHalfGridModeToggle } from '@/shared/utils/halfGridConstraints';
import { markFeatureUsed } from '@/shared/analytics/posthog';
import { useLayoutStore } from './layout';
import { useToastStore } from './toast';
import type { Result, Unit, LayoutError, StorageError } from '@/core/result';
import { err, getUserMessage, isOk, layoutInvalidOperation, OK } from '@/core/result';
import { saveToLocalStorage, loadFromLocalStorage } from '@/core/storage/backends/localStorage';

/**
 * Half-Grid Mode Store
 *
 * Manages the half-grid mode setting: allows 0.5-unit grid increments for
 * fractional bin sizing AND seeds `base.halfSockets = true` on new bin
 * designs (see `defaultsForNewDesign` in `bin-designer/store/helpers.ts`).
 *
 * Extracted from ui.ts as part of the god object decomposition.
 *
 * Persistence: stored in localStorage under `gridfinity-half-bin-mode`.
 * The key name predates the rename and is kept to preserve existing
 * users' preference across the upgrade — don't change it without a
 * migration.
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

interface HalfGridModeState {
  halfGridMode: boolean;
}

interface HalfGridModeActions {
  /**
   * Toggle half-bin mode with validation.
   *
   * The Result channel carries the validation outcome only:
   * - Ok: toggle applied (in memory; persistence may have failed — see below).
   * - Err(LayoutError): turning OFF was blocked because bins have fractional dimensions.
   *
   * Persistence failures (quota, private browsing, etc.) are surfaced via a toast
   * inside the store rather than returned, so callers don't need to distinguish
   * storage errors from validation errors when deciding whether to show the
   * "fractional bins" blocking UI.
   */
  toggleHalfGridMode: () => Result<Unit, LayoutError>;

  /**
   * Set half-bin mode directly without validation.
   * Use with caution - caller is responsible for ensuring valid state.
   * Returns Result indicating if persistence succeeded.
   */
  setHalfGridMode: (enabled: boolean) => Result<void, StorageError>;
}

export type HalfGridModeStore = HalfGridModeState & HalfGridModeActions;

export const INITIAL_HALF_GRID_MODE_STATE = {
  halfGridMode: false,
} as const;

/**
 * Toast a storage error so the user learns the preference wasn't persisted,
 * instead of flipping silently when quota/private-browsing blocks writes.
 */
function toastStorageFailure(error: StorageError): void {
  useToastStore.getState().addToast({
    message: getUserMessage(error),
    type: 'error',
    duration: 4000,
  });
}

export const useHalfGridModeStore = create<HalfGridModeStore>((set) => ({
  halfGridMode: loadFromStorage(),

  toggleHalfGridMode: () => {
    const state = useHalfGridModeStore.getState();
    const targetState = !state.halfGridMode;

    // Turning ON: no validation needed
    if (targetState) {
      const saveResult = saveToStorage(true);
      set({ halfGridMode: true });
      markFeatureUsed('half_bins');
      if (!isOk(saveResult)) toastStorageFailure(saveResult.error);
      return OK;
    }

    // Turning OFF: validate layout for fractional bins
    const layout = useLayoutStore.getState().layout;
    const result = validateHalfGridModeToggle(layout, false);

    if (!result.canDisable) {
      return err(
        layoutInvalidOperation(
          'toggleHalfGridMode',
          `Cannot disable: ${result.violation?.count ?? 0} bins have fractional dimensions`
        )
      );
    }

    const saveResult = saveToStorage(false);
    set({ halfGridMode: false });
    if (!isOk(saveResult)) toastStorageFailure(saveResult.error);
    return OK;
  },

  setHalfGridMode: (enabled) => {
    const result = saveToStorage(enabled);
    set({ halfGridMode: enabled });
    return result;
  },
}));

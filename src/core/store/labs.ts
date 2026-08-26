/**
 * Labs feature flag store.
 *
 * Manages the state of experimental feature flags. This store is part of
 * core infrastructure, not a specific feature, because other parts of the
 * application depend on feature flag state.
 */

import { create } from 'zustand';
import type { LabsPreferences, FeatureId } from '@/core/labs';
import { createDefaultLabsPreferences, getToggleableFeatures, getFeature } from '@/core/labs';
// Deep-import the leaf module (not the barrel) to keep this store off the
// `metrics.ts` import path. metrics.ts imports `useLabsStore` from this file;
// going through the barrel would close the cycle, which under some chunking
// strategies projects to a chunk-level static-import cycle that crashes app
// boot. See.
import { trackEvent } from '@/shared/analytics/posthog/trackEvent';
import type { Result, StorageError } from '@/core/result';
import { isOk, OK } from '@/core/result';
import { saveToLocalStorage, loadFromLocalStorage } from '@/core/storage/backends/localStorage';

export const LABS_STORAGE_KEY = 'gridfinity-labs-v1';

function loadPreferences(): LabsPreferences {
  const result = loadFromLocalStorage<Partial<LabsPreferences>>(LABS_STORAGE_KEY);
  if (isOk(result) && result.value) {
    const prefs = { ...createDefaultLabsPreferences(), ...result.value };

    // Clean up orphaned keys from removed labs features
    delete prefs.enabledFeatures.handle_ledges;
    delete prefs.enabledFeatures.angled_dividers;
    delete prefs.enabledFeatures.item_kinds;

    return prefs;
  }
  return createDefaultLabsPreferences();
}

/**
 * Save labs preferences to localStorage.
 * Returns Result to let callers know if persistence succeeded.
 */
function savePreferences(prefs: LabsPreferences): Result<void, StorageError> {
  const toSave: LabsPreferences = {
    ...prefs,
    lastModified: new Date().toISOString(),
  };
  return saveToLocalStorage(LABS_STORAGE_KEY, toSave);
}

/**
 * What the stored preference says, falling back to the flag's
 * `defaultEnabled`.
 *
 * The WRITE paths resolve through here rather than reading the map, or
 * `toggleFeature` flips a default-on flag to on, and `disableFeature` reads
 * "never stored" as "already off" — the one control that turns the feature
 * off would silently do nothing. Status is deliberately not consulted:
 * enabling a graduated feature still has to write, since the stored value is
 * what remains if it is ever un-graduated.
 */
function resolveStoredEnabled(preferences: LabsPreferences, featureId: string): boolean {
  const stored = preferences.enabledFeatures[featureId];
  if (stored !== undefined) return stored;
  return getFeature(featureId)?.defaultEnabled ?? false;
}

/**
 * Whether a feature is on, for READ paths. The single answer to that
 * question: `useFeatureFlag` selects through this so a hook and a getState()
 * call can never disagree about the same flag.
 *
 * It lives here rather than beside the definitions so it calls the IMPORTED
 * `getFeature`. Inside the registry module that call would be internal, and
 * every test that mocks `getFeature` would silently stop reaching it.
 */
export function resolveFeatureEnabled(preferences: LabsPreferences, featureId: string): boolean {
  const feature = getFeature(featureId);

  // Graduated features are always enabled
  if (feature?.status === 'graduated') return true;

  return resolveStoredEnabled(preferences, featureId);
}

interface LabsState {
  preferences: LabsPreferences;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  toggleFeature: (featureId: FeatureId) => Result<void, StorageError>;
  enableFeature: (featureId: FeatureId) => Result<void, StorageError>;
  disableFeature: (featureId: FeatureId) => Result<void, StorageError>;
  isFeatureEnabled: (featureId: FeatureId) => boolean;
  getEnabledCount: () => number;
  syncFromStorage: (prefs: LabsPreferences) => void;
}

export const useLabsStore = create<LabsState>()((set, get) => ({
  preferences: loadPreferences(),
  isDrawerOpen: false,

  openDrawer: () => {
    set({ isDrawerOpen: true });
    trackEvent('labs_drawer_opened', {
      enabled_count: get().getEnabledCount(),
    });
  },

  closeDrawer: () => set({ isDrawerOpen: false }),

  toggleDrawer: () => {
    const { isDrawerOpen } = get();
    if (!isDrawerOpen) {
      trackEvent('labs_drawer_opened', {
        enabled_count: get().getEnabledCount(),
      });
    }
    set({ isDrawerOpen: !isDrawerOpen });
  },

  toggleFeature: (featureId) => {
    const { preferences } = get();
    const newEnabled = !resolveStoredEnabled(preferences, featureId);

    const newPrefs: LabsPreferences = {
      ...preferences,
      enabledFeatures: {
        ...preferences.enabledFeatures,
        [featureId]: newEnabled,
      },
      lastModified: new Date().toISOString(),
    };

    const result = savePreferences(newPrefs);
    set({ preferences: newPrefs });

    trackEvent('labs_feature_toggle', {
      feature_id: featureId,
      enabled: newEnabled,
      feature_status: getFeature(featureId)?.status ?? 'unknown',
    });

    return result;
  },

  enableFeature: (featureId) => {
    const { preferences } = get();
    if (resolveStoredEnabled(preferences, featureId)) return OK;

    const newPrefs: LabsPreferences = {
      ...preferences,
      enabledFeatures: {
        ...preferences.enabledFeatures,
        [featureId]: true,
      },
      lastModified: new Date().toISOString(),
    };

    const result = savePreferences(newPrefs);
    set({ preferences: newPrefs });

    trackEvent('labs_feature_enabled', {
      feature_id: featureId,
      feature_status: getFeature(featureId)?.status ?? 'unknown',
    });

    return result;
  },

  disableFeature: (featureId) => {
    const { preferences } = get();
    if (!resolveStoredEnabled(preferences, featureId)) return OK;

    const newPrefs: LabsPreferences = {
      ...preferences,
      enabledFeatures: {
        ...preferences.enabledFeatures,
        [featureId]: false,
      },
      lastModified: new Date().toISOString(),
    };

    const result = savePreferences(newPrefs);
    set({ preferences: newPrefs });

    trackEvent('labs_feature_disabled', {
      feature_id: featureId,
      feature_status: getFeature(featureId)?.status ?? 'unknown',
    });

    return result;
  },

  isFeatureEnabled: (featureId) => resolveFeatureEnabled(get().preferences, featureId),

  getEnabledCount: () => {
    const { preferences } = get();
    return getToggleableFeatures().filter((feature) =>
      resolveFeatureEnabled(preferences, feature.id)
    ).length;
  },

  syncFromStorage: (prefs) => {
    set({ preferences: prefs });
  },
}));

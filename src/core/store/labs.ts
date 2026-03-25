/**
 * Labs feature flag store.
 *
 * Manages the state of experimental feature flags. This store is part of
 * core infrastructure, not a specific feature, because other parts of the
 * application depend on feature flag state.
 */

import { create } from 'zustand';
import type { LabsPreferences, FeatureId } from '@/core/labs';
import { createDefaultLabsPreferences, getFeature } from '@/core/labs';
import { trackEvent } from '@/shared/analytics/posthog';
import type { Result, StorageError } from '@/core/result';
import { isOk, OK } from '@/core/result';
import { saveToLocalStorage, loadFromLocalStorage } from '@/core/storage/backends/localStorage';

export const LABS_STORAGE_KEY = 'gridfinity-labs-v1';

function loadPreferences(): LabsPreferences {
  const result = loadFromLocalStorage<Partial<LabsPreferences>>(LABS_STORAGE_KEY);
  if (isOk(result) && result.value) {
    const prefs = { ...createDefaultLabsPreferences(), ...result.value };

    // Clean up orphaned key from pre-graduation rename
    delete prefs.enabledFeatures.handle_ledges;

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
    const feature = getFeature(featureId);

    // Coming Soon features cannot be toggled
    if (feature?.comingSoon) return OK;

    const { preferences } = get();
    const currentlyEnabled = preferences.enabledFeatures[featureId] ?? false;
    const newEnabled = !currentlyEnabled;

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
    const feature = getFeature(featureId);

    // Coming Soon features cannot be enabled
    if (feature?.comingSoon) return OK;

    const { preferences } = get();
    if (preferences.enabledFeatures[featureId]) return OK;

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
    if (!preferences.enabledFeatures[featureId]) return OK;

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

  isFeatureEnabled: (featureId) => {
    const { preferences } = get();
    const feature = getFeature(featureId);

    // Graduated features are always enabled
    if (feature?.status === 'graduated') return true;

    // Deprecated features are always disabled
    if (feature?.status === 'deprecated') return false;

    // Coming Soon features are always disabled
    if (feature?.comingSoon) return false;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- featureId may not exist in enabledFeatures
    return preferences.enabledFeatures[featureId] ?? feature?.defaultEnabled ?? false;
  },

  getEnabledCount: () => {
    const { preferences } = get();
    return Object.entries(preferences.enabledFeatures).filter(([id, enabled]) => {
      if (!enabled) return false;
      const feature = getFeature(id);
      return feature?.status === 'experimental' || feature?.status === 'preview';
    }).length;
  },

  syncFromStorage: (prefs) => {
    set({ preferences: prefs });
  },
}));

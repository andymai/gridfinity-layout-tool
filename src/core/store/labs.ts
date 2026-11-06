import { create } from 'zustand';
import type { LabsPreferences, FeatureId } from '@/core/labs';
import { createDefaultLabsPreferences, getFeature } from '@/core/labs';
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
    return { ...createDefaultLabsPreferences(), ...result.value };
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
 * The single answer to whether a feature is on: `useFeatureFlag` selects through
 * this and the write paths resolve through it, so a hook, a getState() call and a
 * toggle can never disagree about one flag.
 *
 * It lives here rather than beside the definitions so it calls the IMPORTED
 * `getFeature`. Inside the registry module that call would be internal, and
 * every test that mocks `getFeature` would silently stop reaching it.
 */
export function resolveFeatureEnabled(preferences: LabsPreferences, featureId: string): boolean {
  if (Object.hasOwn(preferences.enabledFeatures, featureId)) {
    return preferences.enabledFeatures[featureId];
  }
  return getFeature(featureId)?.defaultEnabled ?? false;
}

interface LabsState {
  preferences: LabsPreferences;
  toggleFeature: (featureId: FeatureId) => Result<void, StorageError>;
  enableFeature: (featureId: FeatureId) => Result<void, StorageError>;
  disableFeature: (featureId: FeatureId) => Result<void, StorageError>;
  isFeatureEnabled: (featureId: FeatureId) => boolean;
  syncFromStorage: (prefs: LabsPreferences) => void;
}

export const useLabsStore = create<LabsState>()((set, get) => ({
  preferences: loadPreferences(),

  toggleFeature: (featureId) => {
    const { preferences } = get();
    const newEnabled = !resolveFeatureEnabled(preferences, featureId);

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
    if (resolveFeatureEnabled(preferences, featureId)) return OK;

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
    if (!resolveFeatureEnabled(preferences, featureId)) return OK;

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

  syncFromStorage: (prefs) => {
    set({ preferences: prefs });
  },
}));

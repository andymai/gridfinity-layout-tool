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
import { trackEvent } from '@/utils/analytics';

export const LABS_STORAGE_KEY = 'gridfinity-labs-v1';

function loadPreferences(): LabsPreferences {
  try {
    const stored = localStorage.getItem(LABS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...createDefaultLabsPreferences(), ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load Labs preferences:', e);
  }
  return createDefaultLabsPreferences();
}

function savePreferences(prefs: LabsPreferences): void {
  try {
    const toSave: LabsPreferences = {
      ...prefs,
      lastModified: new Date().toISOString(),
    };
    localStorage.setItem(LABS_STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn('Failed to save Labs preferences:', e);
  }
}

interface LabsState {
  preferences: LabsPreferences;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  toggleFeature: (featureId: FeatureId) => void;
  enableFeature: (featureId: FeatureId) => void;
  disableFeature: (featureId: FeatureId) => void;
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
    if (feature?.comingSoon) return;

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

    savePreferences(newPrefs);
    set({ preferences: newPrefs });

    trackEvent('labs_feature_toggle', {
      feature_id: featureId,
      enabled: newEnabled,
      feature_status: getFeature(featureId)?.status ?? 'unknown',
    });
  },

  enableFeature: (featureId) => {
    const feature = getFeature(featureId);

    // Coming Soon features cannot be enabled
    if (feature?.comingSoon) return;

    const { preferences } = get();
    if (preferences.enabledFeatures[featureId]) return;

    const newPrefs: LabsPreferences = {
      ...preferences,
      enabledFeatures: {
        ...preferences.enabledFeatures,
        [featureId]: true,
      },
      lastModified: new Date().toISOString(),
    };

    savePreferences(newPrefs);
    set({ preferences: newPrefs });

    trackEvent('labs_feature_enabled', {
      feature_id: featureId,
      feature_status: getFeature(featureId)?.status ?? 'unknown',
    });
  },

  disableFeature: (featureId) => {
    const { preferences } = get();
    if (!preferences.enabledFeatures[featureId]) return;

    const newPrefs: LabsPreferences = {
      ...preferences,
      enabledFeatures: {
        ...preferences.enabledFeatures,
        [featureId]: false,
      },
      lastModified: new Date().toISOString(),
    };

    savePreferences(newPrefs);
    set({ preferences: newPrefs });

    trackEvent('labs_feature_disabled', {
      feature_id: featureId,
      feature_status: getFeature(featureId)?.status ?? 'unknown',
    });
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

    return preferences.enabledFeatures[featureId] ?? false;
  },

  getEnabledCount: () => {
    const { preferences } = get();
    return Object.entries(preferences.enabledFeatures).filter(
      ([id, enabled]) => {
        if (!enabled) return false;
        const feature = getFeature(id);
        return feature?.status === 'experimental' || feature?.status === 'preview';
      }
    ).length;
  },

  syncFromStorage: (prefs) => {
    set({ preferences: prefs });
  },
}));

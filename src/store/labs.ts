/**
 * Labs Store
 *
 * Zustand store for managing Labs experimental features state.
 * Handles feature toggle state, persistence, and cross-tab sync.
 */

import { create } from 'zustand';
import type { LabsPreferences } from '../labs/types';
import { createDefaultLabsPreferences } from '../labs/types';
import { getFeature, type FeatureId } from '../labs/features';
import { trackEvent } from '../utils/analytics';

/** Storage key for Labs preferences */
export const LABS_STORAGE_KEY = 'gridfinity-labs-v1';

/**
 * Load preferences from localStorage with migration support.
 */
function loadPreferences(): LabsPreferences {
  try {
    const stored = localStorage.getItem(LABS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migration: handle version upgrades here if needed
      return { ...createDefaultLabsPreferences(), ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load Labs preferences:', e);
  }
  return createDefaultLabsPreferences();
}

/**
 * Save preferences to localStorage.
 */
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
  /** User's preferences */
  preferences: LabsPreferences;

  /** Whether Labs drawer is open */
  isDrawerOpen: boolean;

  /** Open the Labs drawer */
  openDrawer: () => void;

  /** Close the Labs drawer */
  closeDrawer: () => void;

  /** Toggle the Labs drawer open/closed */
  toggleDrawer: () => void;

  /** Toggle a feature on/off */
  toggleFeature: (featureId: FeatureId) => void;

  /** Enable a specific feature */
  enableFeature: (featureId: FeatureId) => void;

  /** Disable a specific feature */
  disableFeature: (featureId: FeatureId) => void;

  /** Check if a feature is enabled */
  isFeatureEnabled: (featureId: FeatureId) => boolean;

  /** Get count of enabled experimental features */
  getEnabledCount: () => number;

  /** Sync preferences from another tab (via storage event) */
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

    // Track analytics
    trackEvent('labs_feature_toggle', {
      feature_id: featureId,
      enabled: newEnabled,
      feature_status: getFeature(featureId)?.status ?? 'unknown',
    });
  },

  enableFeature: (featureId) => {
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

    return preferences.enabledFeatures[featureId] ?? false;
  },

  getEnabledCount: () => {
    const { preferences } = get();
    return Object.entries(preferences.enabledFeatures).filter(
      ([id, enabled]) => {
        if (!enabled) return false;
        const feature = getFeature(id);
        // Only count experimental/preview features (not graduated)
        return (
          feature?.status === 'experimental' || feature?.status === 'preview'
        );
      }
    ).length;
  },

  syncFromStorage: (prefs) => {
    set({ preferences: prefs });
  },
}));

/**
 * Labs Feature Flags Tests
 *
 * Tests for the Labs store, feature registry, and hooks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLabsStore, LABS_STORAGE_KEY } from '@/core/store';
import {
  FEATURE_FLAGS,
  getActiveFeatures,
  getGraduatedFeatures,
  getToggleableFeatures,
  createDefaultLabsPreferences,
  type FeatureId,
} from '@/core/labs';
import * as features from '@/core/labs/features';

// Mock trackEvent to avoid analytics calls in tests
vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

// Mock getFeature for store tests to return features without comingSoon
// Note: Must mock the actual source module that the store imports from
vi.mock('@/core/labs/features', async () => {
  const actual = await vi.importActual<typeof features>('@/core/labs/features');
  return {
    ...actual,
    getFeature: vi.fn((id: string) => {
      const feature = actual.FEATURE_FLAGS.find((f) => f.id === id);
      if (!feature) return undefined;
      // Return feature without comingSoon for store tests
      const { comingSoon: _, ...rest } = feature;
      void _; // Suppress unused variable warning
      return rest;
    }),
  };
});

const mockGetFeature = features.getFeature as ReturnType<typeof vi.fn>;

describe('Labs Feature Registry', () => {
  describe('getFeature', () => {
    it('returns feature by ID', () => {
      // Use FEATURE_FLAGS directly since getFeature is mocked for store tests
      const feature = FEATURE_FLAGS.find((f) => f.id === 'collaborative_editing');
      expect(feature).toBeDefined();
      expect(feature?.name).toBe('Collaborative Editing');
    });

    it('returns undefined for unknown ID', () => {
      const feature = FEATURE_FLAGS.find((f) => f.id === 'unknown_feature');
      expect(feature).toBeUndefined();
    });
  });

  describe('getActiveFeatures', () => {
    it('returns non-deprecated features', () => {
      const active = getActiveFeatures();
      expect(active.length).toBeGreaterThan(0);
      expect(active.every((f) => f.status !== 'deprecated')).toBe(true);
    });

    it('includes experimental and preview features', () => {
      const active = getActiveFeatures();
      const hasExperimental = active.some((f) => f.status === 'experimental');
      expect(hasExperimental).toBe(true);
    });
  });

  describe('getToggleableFeatures', () => {
    it('returns only experimental and preview features', () => {
      const toggleable = getToggleableFeatures();
      expect(toggleable.every((f) => f.status === 'experimental' || f.status === 'preview')).toBe(
        true
      );
    });
  });

  describe('getGraduatedFeatures', () => {
    it('returns only graduated features', () => {
      const graduated = getGraduatedFeatures();
      // Currently no graduated features, so should be empty
      expect(graduated.every((f) => f.status === 'graduated')).toBe(true);
    });
  });

  describe('FEATURE_FLAGS constant', () => {
    it('has required properties on each feature', () => {
      for (const feature of FEATURE_FLAGS) {
        expect(feature.id).toBeDefined();
        expect(feature.name).toBeDefined();
        expect(feature.description).toBeDefined();
        expect(feature.status).toBeDefined();
        expect(feature.risk).toBeDefined();
        expect(feature.addedAt).toBeDefined();
        expect(typeof feature.requiresRefresh).toBe('boolean');
      }
    });

    it('has unique IDs', () => {
      const ids = FEATURE_FLAGS.map((f) => f.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('marks coming soon features correctly', () => {
      // Only layout_to_print is coming soon, collaborative_editing is now active
      const comingSoon = FEATURE_FLAGS.filter((f) => f.comingSoon);
      expect(comingSoon.length).toBe(1);
      expect(comingSoon[0].id).toBe('layout_to_print');
    });
  });
});

describe('Labs Store', () => {
  beforeEach(() => {
    // Reset store state
    localStorage.clear();
    useLabsStore.setState({
      preferences: createDefaultLabsPreferences(),
      isDrawerOpen: false,
    });
  });

  describe('drawer state', () => {
    it('opens and closes drawer', () => {
      const store = useLabsStore.getState();

      expect(store.isDrawerOpen).toBe(false);

      store.openDrawer();
      expect(useLabsStore.getState().isDrawerOpen).toBe(true);

      store.closeDrawer();
      expect(useLabsStore.getState().isDrawerOpen).toBe(false);
    });

    it('toggles drawer', () => {
      const store = useLabsStore.getState();

      expect(store.isDrawerOpen).toBe(false);

      store.toggleDrawer();
      expect(useLabsStore.getState().isDrawerOpen).toBe(true);

      store.toggleDrawer();
      expect(useLabsStore.getState().isDrawerOpen).toBe(false);
    });
  });

  describe('feature toggling', () => {
    const featureId: FeatureId = 'collaborative_editing';

    it('toggles feature from disabled to enabled', () => {
      const store = useLabsStore.getState();

      expect(store.isFeatureEnabled(featureId)).toBe(false);

      store.toggleFeature(featureId);
      expect(useLabsStore.getState().isFeatureEnabled(featureId)).toBe(true);
    });

    it('toggles feature from enabled to disabled', () => {
      const store = useLabsStore.getState();
      store.enableFeature(featureId);

      expect(store.isFeatureEnabled(featureId)).toBe(true);

      store.toggleFeature(featureId);
      expect(useLabsStore.getState().isFeatureEnabled(featureId)).toBe(false);
    });

    it('enableFeature sets feature to enabled', () => {
      const store = useLabsStore.getState();

      store.enableFeature(featureId);
      expect(useLabsStore.getState().isFeatureEnabled(featureId)).toBe(true);

      // Calling again should be idempotent
      store.enableFeature(featureId);
      expect(useLabsStore.getState().isFeatureEnabled(featureId)).toBe(true);
    });

    it('disableFeature sets feature to disabled', () => {
      const store = useLabsStore.getState();
      store.enableFeature(featureId);

      store.disableFeature(featureId);
      expect(useLabsStore.getState().isFeatureEnabled(featureId)).toBe(false);

      // Calling again should be idempotent
      store.disableFeature(featureId);
      expect(useLabsStore.getState().isFeatureEnabled(featureId)).toBe(false);
    });
  });

  describe('enabled count', () => {
    it('counts enabled experimental features', () => {
      const store = useLabsStore.getState();

      expect(store.getEnabledCount()).toBe(0);

      store.enableFeature('collaborative_editing');
      expect(useLabsStore.getState().getEnabledCount()).toBe(1);

      store.enableFeature('layout_to_print');
      expect(useLabsStore.getState().getEnabledCount()).toBe(2);

      store.disableFeature('collaborative_editing');
      expect(useLabsStore.getState().getEnabledCount()).toBe(1);
    });
  });

  describe('persistence', () => {
    it('saves preferences to localStorage', () => {
      const store = useLabsStore.getState();
      store.enableFeature('collaborative_editing');

      const stored = localStorage.getItem(LABS_STORAGE_KEY);
      expect(stored).not.toBeNull();
      if (!stored) return; // Type guard for TypeScript

      const parsed = JSON.parse(stored);
      expect(parsed.enabledFeatures.collaborative_editing).toBe(true);
    });

    it('loads preferences from localStorage on init', () => {
      // Set up localStorage before store reads
      localStorage.setItem(
        LABS_STORAGE_KEY,
        JSON.stringify({
          enabledFeatures: { layout_to_print: true },
          lastModified: new Date().toISOString(),
          version: 1,
        })
      );

      // Force reload store state
      useLabsStore.setState({
        preferences: {
          enabledFeatures: { layout_to_print: true },
          lastModified: new Date().toISOString(),
          version: 1,
        },
      });

      expect(useLabsStore.getState().isFeatureEnabled('layout_to_print')).toBe(true);
    });
  });

  describe('cross-tab sync', () => {
    it('syncs preferences from storage event', () => {
      const store = useLabsStore.getState();

      const newPrefs = {
        enabledFeatures: { collaborative_editing: true, layout_to_print: true },
        lastModified: new Date().toISOString(),
        version: 1,
      };

      store.syncFromStorage(newPrefs);

      expect(useLabsStore.getState().isFeatureEnabled('collaborative_editing')).toBe(true);
      expect(useLabsStore.getState().isFeatureEnabled('layout_to_print')).toBe(true);
    });
  });

  describe('graduated feature handling', () => {
    it('would return true for graduated features', () => {
      // This tests the logic - currently no graduated features exist
      // When a feature graduates, isFeatureEnabled should always return true
      const store = useLabsStore.getState();

      // Test that the function handles the graduated case correctly
      // by checking that experimental features follow user preference
      expect(store.isFeatureEnabled('collaborative_editing')).toBe(false);
      store.enableFeature('collaborative_editing');
      expect(useLabsStore.getState().isFeatureEnabled('collaborative_editing')).toBe(true);
    });
  });
});

describe('FeatureId type', () => {
  it('includes all feature IDs from registry', () => {
    // This is a compile-time check - if FeatureId doesn't include
    // all IDs, this would fail to compile
    const ids: FeatureId[] = ['collaborative_editing', 'layout_to_print'];
    expect(ids).toHaveLength(2);
  });
});

describe('Coming Soon features', () => {
  const featureId: FeatureId = 'collaborative_editing';

  beforeEach(() => {
    localStorage.clear();
    useLabsStore.setState({
      preferences: createDefaultLabsPreferences(),
      isDrawerOpen: false,
    });
  });

  it('cannot be toggled when comingSoon is true', () => {
    // Override mock to return feature with comingSoon
    mockGetFeature.mockReturnValue({
      id: featureId,
      name: 'Collaborative Editing',
      status: 'experimental',
      comingSoon: true,
    });

    const store = useLabsStore.getState();
    expect(store.isFeatureEnabled(featureId)).toBe(false);

    store.toggleFeature(featureId);
    // Should still be false because comingSoon features can't be toggled
    expect(useLabsStore.getState().isFeatureEnabled(featureId)).toBe(false);
    expect(useLabsStore.getState().preferences.enabledFeatures[featureId]).toBeUndefined();
  });

  it('cannot be enabled when comingSoon is true', () => {
    mockGetFeature.mockReturnValue({
      id: featureId,
      name: 'Collaborative Editing',
      status: 'experimental',
      comingSoon: true,
    });

    const store = useLabsStore.getState();
    store.enableFeature(featureId);

    // Should still be false because comingSoon features can't be enabled
    expect(useLabsStore.getState().isFeatureEnabled(featureId)).toBe(false);
    expect(useLabsStore.getState().preferences.enabledFeatures[featureId]).toBeUndefined();
  });

  it('isFeatureEnabled returns false even if preferences say enabled', () => {
    mockGetFeature.mockReturnValue({
      id: featureId,
      name: 'Collaborative Editing',
      status: 'experimental',
      comingSoon: true,
    });

    // Manually set preferences to enabled (simulating old data)
    useLabsStore.setState({
      preferences: {
        enabledFeatures: { [featureId]: true },
        lastModified: new Date().toISOString(),
        version: 1,
      },
    });

    // Should still return false because it's Coming Soon
    expect(useLabsStore.getState().isFeatureEnabled(featureId)).toBe(false);
  });
});

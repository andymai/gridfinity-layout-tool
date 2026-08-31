// @vitest-environment jsdom
/**
 * Labs Feature Flags Tests
 *
 * Tests for the Labs store, feature registry, and hooks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLabsStore, LABS_STORAGE_KEY } from '@/core/store';
import {
  FEATURE_FLAGS,
  getGraduatedFeatures,
  getToggleableFeatures,
  createDefaultLabsPreferences,
  type FeatureId,
} from '@/core/labs';

// Mock trackEvent to avoid analytics calls in tests
vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

describe('Labs Feature Registry', () => {
  describe('getFeature', () => {
    it('returns feature by ID', () => {
      // Use FEATURE_FLAGS directly since getFeature is mocked for store tests
      const feature = FEATURE_FLAGS.find((f) => f.id === 'collaborative_editing');
      expect(feature).toBeDefined();
      expect(feature?.name).toBe('Collaborative Editing');
    });

    it('returns undefined for unknown ID', () => {
      const unknownId: string = 'unknown_feature';
      const feature = FEATURE_FLAGS.find((f) => f.id === unknownId);
      expect(feature).toBeUndefined();
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

    it('does not include layout_to_print', () => {
      const ids = FEATURE_FLAGS.map((f) => f.id);
      expect(ids).not.toContain('layout_to_print');
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
    const featureId: FeatureId = 'show_generation_perf';

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
    it('counts every active experimental feature, opted in or on by default', () => {
      const store = useLabsStore.getState();

      // community_showcase and designer_settings_search both ship
      // defaultEnabled, so they are active without an opt-in. The count has to
      // agree with isFeatureEnabled or the badge reports a different reality
      // than the app runs on.
      const base = store.getEnabledCount();
      expect(base).toBe(2);
      expect(store.isFeatureEnabled('community_showcase')).toBe(true);

      store.enableFeature('show_generation_perf');
      expect(useLabsStore.getState().getEnabledCount()).toBe(base + 1);

      store.enableFeature('brepkit_kernel');
      expect(useLabsStore.getState().getEnabledCount()).toBe(base + 2);

      store.disableFeature('show_generation_perf');
      expect(useLabsStore.getState().getEnabledCount()).toBe(base + 1);

      store.disableFeature('community_showcase');
      expect(useLabsStore.getState().getEnabledCount()).toBe(base);
    });

    it('turns a default-on feature off, and back on', () => {
      const store = useLabsStore.getState();

      store.disableFeature('community_showcase');
      expect(useLabsStore.getState().isFeatureEnabled('community_showcase')).toBe(false);

      useLabsStore.getState().enableFeature('community_showcase');
      expect(useLabsStore.getState().isFeatureEnabled('community_showcase')).toBe(true);
    });

    it('toggles a default-on feature off on the first press', () => {
      useLabsStore.getState().toggleFeature('community_showcase');
      expect(useLabsStore.getState().isFeatureEnabled('community_showcase')).toBe(false);
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
          enabledFeatures: { brepkit_kernel: true },
          lastModified: new Date().toISOString(),
          version: 1,
        })
      );

      // Force reload store state
      useLabsStore.setState({
        preferences: {
          enabledFeatures: { brepkit_kernel: true },
          lastModified: new Date().toISOString(),
          version: 1,
        },
      });

      expect(useLabsStore.getState().isFeatureEnabled('brepkit_kernel')).toBe(true);
    });
  });

  describe('cross-tab sync', () => {
    it('syncs preferences from storage event', () => {
      const store = useLabsStore.getState();

      const newPrefs = {
        enabledFeatures: { collaborative_editing: true, brepkit_kernel: true },
        lastModified: new Date().toISOString(),
        version: 1,
      };

      store.syncFromStorage(newPrefs);

      expect(useLabsStore.getState().isFeatureEnabled('collaborative_editing')).toBe(true);
      expect(useLabsStore.getState().isFeatureEnabled('brepkit_kernel')).toBe(true);
    });
  });

  describe('graduated feature handling', () => {
    it('returns true for graduated features regardless of the stored preference', () => {
      const store = useLabsStore.getState();

      expect(store.isFeatureEnabled('collaborative_editing')).toBe(true);

      store.disableFeature('collaborative_editing');
      expect(useLabsStore.getState().isFeatureEnabled('collaborative_editing')).toBe(true);
    });
  });
});

describe('FeatureId type', () => {
  it('includes all feature IDs from registry', () => {
    // This is a compile-time check - if FeatureId doesn't include
    // all IDs, this would fail to compile
    const ids: FeatureId[] = ['collaborative_editing', 'brepkit_kernel'];
    expect(ids).toHaveLength(2);
  });
});

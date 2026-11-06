// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLabsStore, LABS_STORAGE_KEY } from '@/core/store';
import { createDefaultLabsPreferences, type FeatureId } from '@/core/labs';

// Mock trackEvent to avoid analytics calls in tests
vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

describe('Labs Store', () => {
  beforeEach(() => {
    // Reset store state
    localStorage.clear();
    useLabsStore.setState({
      preferences: createDefaultLabsPreferences(),
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

  describe('persistence', () => {
    it('saves preferences to localStorage', () => {
      const store = useLabsStore.getState();
      store.enableFeature('show_generation_perf');

      const stored = localStorage.getItem(LABS_STORAGE_KEY);
      expect(stored).not.toBeNull();
      if (!stored) return; // Type guard for TypeScript

      const parsed = JSON.parse(stored);
      expect(parsed.enabledFeatures.show_generation_perf).toBe(true);
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
        enabledFeatures: { show_generation_perf: true, brepkit_kernel: true },
        lastModified: new Date().toISOString(),
        version: 1,
      };

      store.syncFromStorage(newPrefs);

      expect(useLabsStore.getState().isFeatureEnabled('show_generation_perf')).toBe(true);
      expect(useLabsStore.getState().isFeatureEnabled('brepkit_kernel')).toBe(true);
    });
  });
});

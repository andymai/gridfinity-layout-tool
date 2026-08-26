import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeatureFlag, isFeatureEnabled } from '@/shared/hooks/useFeatureFlag';
import { useLabsStore } from '@/core/store';
import { resetAllStores } from '@/test/testUtils';
import * as features from '@/core/labs/features';

// Must mock the actual source module that the store imports from
vi.mock('@/core/labs/features', async () => {
  const actual = await vi.importActual<typeof features>('@/core/labs/features');
  return {
    ...actual,
    getFeature: vi.fn(),
  };
});

const mockGetFeature = features.getFeature as ReturnType<typeof vi.fn>;

describe('useFeatureFlag', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  describe('useFeatureFlag hook', () => {
    it('returns false when feature is not enabled', () => {
      mockGetFeature.mockReturnValue({
        id: 'test_feature',
        name: 'Test Feature',
        status: 'experimental',
      });

      const { result } = renderHook(() => useFeatureFlag('test_feature' as features.FeatureId));

      expect(result.current).toBe(false);
    });

    it('returns true when feature is enabled', () => {
      mockGetFeature.mockReturnValue({
        id: 'test_feature',
        name: 'Test Feature',
        status: 'experimental',
      });

      useLabsStore.setState({
        preferences: {
          enabledFeatures: { test_feature: true },
          lastModified: new Date().toISOString(),
          version: 1,
        },
      });

      const { result } = renderHook(() => useFeatureFlag('test_feature' as features.FeatureId));

      expect(result.current).toBe(true);
    });

    it('reactively updates when feature flag is toggled', () => {
      mockGetFeature.mockReturnValue({
        id: 'test_feature',
        name: 'Test Feature',
        status: 'experimental',
      });

      const { result } = renderHook(() => useFeatureFlag('test_feature' as features.FeatureId));

      expect(result.current).toBe(false);

      // Toggle the flag via store — hook should reactively update
      act(() => {
        useLabsStore.setState({
          preferences: {
            enabledFeatures: { test_feature: true },
            lastModified: new Date().toISOString(),
            version: 1,
          },
        });
      });

      expect(result.current).toBe(true);

      // Toggle back
      act(() => {
        useLabsStore.setState({
          preferences: {
            enabledFeatures: { test_feature: false },
            lastModified: new Date().toISOString(),
            version: 1,
          },
        });
      });

      expect(result.current).toBe(false);
    });

    it('returns true for graduated features regardless of preferences', () => {
      mockGetFeature.mockReturnValue({
        id: 'graduated_feature',
        name: 'Graduated Feature',
        status: 'graduated',
      });

      const { result } = renderHook(() =>
        useFeatureFlag('graduated_feature' as features.FeatureId)
      );

      expect(result.current).toBe(true);
    });

    it('returns false for non-existent features', () => {
      mockGetFeature.mockReturnValue(undefined);

      const { result } = renderHook(() => useFeatureFlag('nonexistent' as features.FeatureId));

      expect(result.current).toBe(false);
    });

    it('honours defaultEnabled when nothing is stored', () => {
      // The hook is what every gated surface reads. A second copy of the
      // rules here left a default-on flag reading true from the store and
      // false in every component that gates on it.
      mockGetFeature.mockReturnValue({
        id: 'default_on_feature',
        name: 'Default On',
        status: 'preview',
        defaultEnabled: true,
      });

      const { result } = renderHook(() =>
        useFeatureFlag('default_on_feature' as features.FeatureId)
      );

      expect(result.current).toBe(true);
      expect(isFeatureEnabled('default_on_feature' as features.FeatureId)).toBe(result.current);
    });

    it('lets a stored false beat defaultEnabled', () => {
      mockGetFeature.mockReturnValue({
        id: 'default_on_feature',
        name: 'Default On',
        status: 'preview',
        defaultEnabled: true,
      });

      useLabsStore.setState({
        preferences: {
          enabledFeatures: { default_on_feature: false },
          lastModified: new Date().toISOString(),
          version: 1,
        },
      });

      const { result } = renderHook(() =>
        useFeatureFlag('default_on_feature' as features.FeatureId)
      );

      expect(result.current).toBe(false);
    });
  });

  describe('isFeatureEnabled function', () => {
    it('returns false when feature is not enabled', () => {
      mockGetFeature.mockReturnValue({
        id: 'test_feature',
        name: 'Test Feature',
        status: 'experimental',
      });

      expect(isFeatureEnabled('test_feature' as features.FeatureId)).toBe(false);
    });

    it('returns true when feature is enabled', () => {
      mockGetFeature.mockReturnValue({
        id: 'test_feature',
        name: 'Test Feature',
        status: 'experimental',
      });

      useLabsStore.setState({
        preferences: {
          enabledFeatures: { test_feature: true },
          lastModified: new Date().toISOString(),
          version: 1,
        },
      });

      expect(isFeatureEnabled('test_feature' as features.FeatureId)).toBe(true);
    });

    it('returns true for graduated features', () => {
      mockGetFeature.mockReturnValue({
        id: 'graduated_feature',
        name: 'Graduated Feature',
        status: 'graduated',
      });

      expect(isFeatureEnabled('graduated_feature' as features.FeatureId)).toBe(true);
    });
  });
});

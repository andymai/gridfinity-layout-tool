import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFeatureFlag, isFeatureEnabled } from '../../hooks/useFeatureFlag';
import { useLabsStore } from '../../store/labs';
import { resetAllStores } from '../testUtils';
import * as features from '../../labs/features';

vi.mock('../../labs/features', async () => {
  const actual = await vi.importActual<typeof features>('../../labs/features');
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

      const { result } = renderHook(() =>
        useFeatureFlag('test_feature' as features.FeatureId)
      );

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

      const { result } = renderHook(() =>
        useFeatureFlag('test_feature' as features.FeatureId)
      );

      expect(result.current).toBe(true);
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

    it('returns false for deprecated features regardless of preferences', () => {
      mockGetFeature.mockReturnValue({
        id: 'deprecated_feature',
        name: 'Deprecated Feature',
        status: 'deprecated',
      });

      useLabsStore.setState({
        preferences: {
          enabledFeatures: { deprecated_feature: true },
          lastModified: new Date().toISOString(),
          version: 1,
        },
      });

      const { result } = renderHook(() =>
        useFeatureFlag('deprecated_feature' as features.FeatureId)
      );

      expect(result.current).toBe(false);
    });

    it('returns false for Coming Soon features regardless of preferences', () => {
      mockGetFeature.mockReturnValue({
        id: 'coming_soon_feature',
        name: 'Coming Soon Feature',
        status: 'experimental',
        comingSoon: true,
      });

      useLabsStore.setState({
        preferences: {
          enabledFeatures: { coming_soon_feature: true },
          lastModified: new Date().toISOString(),
          version: 1,
        },
      });

      const { result } = renderHook(() =>
        useFeatureFlag('coming_soon_feature' as features.FeatureId)
      );

      expect(result.current).toBe(false);
    });

    it('returns false for non-existent features', () => {
      mockGetFeature.mockReturnValue(undefined);

      const { result } = renderHook(() =>
        useFeatureFlag('nonexistent' as features.FeatureId)
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

      expect(isFeatureEnabled('test_feature' as features.FeatureId)).toBe(
        false
      );
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

      expect(isFeatureEnabled('graduated_feature' as features.FeatureId)).toBe(
        true
      );
    });

    it('returns false for deprecated features', () => {
      mockGetFeature.mockReturnValue({
        id: 'deprecated_feature',
        name: 'Deprecated Feature',
        status: 'deprecated',
      });

      useLabsStore.setState({
        preferences: {
          enabledFeatures: { deprecated_feature: true },
          lastModified: new Date().toISOString(),
          version: 1,
        },
      });

      expect(isFeatureEnabled('deprecated_feature' as features.FeatureId)).toBe(
        false
      );
    });

    it('returns false for Coming Soon features', () => {
      mockGetFeature.mockReturnValue({
        id: 'coming_soon_feature',
        name: 'Coming Soon Feature',
        status: 'experimental',
        comingSoon: true,
      });

      useLabsStore.setState({
        preferences: {
          enabledFeatures: { coming_soon_feature: true },
          lastModified: new Date().toISOString(),
          version: 1,
        },
      });

      expect(
        isFeatureEnabled('coming_soon_feature' as features.FeatureId)
      ).toBe(false);
    });
  });
});

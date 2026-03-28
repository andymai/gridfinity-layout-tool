import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useLayoutStore } from '@/core/store/layout';
import { useInteractionStore } from '@/core/store/interaction';
import { resetAllStores } from '@/test/testUtils';
import { initLayoutAnalytics } from './layoutAnalytics';

vi.mock('@/shared/analytics/useMLTracking', () => ({
  mlTracking: {
    trackFill: vi.fn(),
  },
}));

vi.mock('@/shared/analytics/posthog', () => ({
  markFeatureUsed: vi.fn(),
  trackFillOperation: vi.fn(),
  trackBinCreated: vi.fn(),
  trackPaintMode: vi.fn(),
  trackEvent: vi.fn(),
}));

describe('layoutAnalytics', () => {
  let cleanup: () => void;

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    cleanup = initLayoutAnalytics();
  });

  afterEach(() => {
    cleanup();
  });

  it('returns an unsubscribe function', () => {
    expect(typeof cleanup).toBe('function');
  });

  it('tracks multi-layer usage when adding 2nd layer', async () => {
    const { markFeatureUsed } = await import('@/shared/analytics/posthog');

    useLayoutStore.getState().addLayer();

    expect(markFeatureUsed).toHaveBeenCalledWith('multi_layer');
  });

  it('tracks custom categories when adding a category', async () => {
    const { markFeatureUsed } = await import('@/shared/analytics/posthog');

    useLayoutStore.getState().addCategory({ name: 'Custom', color: '#ff0' });

    expect(markFeatureUsed).toHaveBeenCalledWith('custom_categories');
  });

  it('tracks fill operations when _fillMeta is set', async () => {
    const { trackFillOperation, trackBinCreated, markFeatureUsed } =
      await import('@/shared/analytics/posthog');
    const { mlTracking } = await import('@/shared/analytics/useMLTracking');

    const lid = useLayoutStore.getState().layout.layers[0].id;
    useLayoutStore.setState({
      _fillMeta: {
        type: 'uniform',
        count: 10,
        layerId: lid,
        width: 2,
        depth: 3,
        layerHeight: 4,
      },
    });

    expect(mlTracking.trackFill).toHaveBeenCalled();
    expect(markFeatureUsed).toHaveBeenCalledWith('fill');
    expect(trackFillOperation).toHaveBeenCalledWith('fill_layer', 10);
    expect(trackBinCreated).toHaveBeenCalled();

    // _fillMeta should be cleared after consuming
    expect(useLayoutStore.getState()._fillMeta).toBeNull();
  });

  it('tracks paint mode entry and exit', async () => {
    const { trackPaintMode } = await import('@/shared/analytics/posthog');

    // Enter paint mode
    useInteractionStore.setState({ paintSize: { width: 1, depth: 1 } });
    expect(trackPaintMode).toHaveBeenCalledWith('entered');

    // Exit paint mode
    useInteractionStore.setState({ paintSize: null });
    expect(trackPaintMode).toHaveBeenCalledWith('exited');
  });
});

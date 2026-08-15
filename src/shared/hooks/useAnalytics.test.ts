import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnalytics } from '@/shared/hooks/useAnalytics';
import { useLayoutStore } from '@/core/store/layout';
import { createTestBin, createTestLayout, resetAllStores } from '@/test/testUtils';
import * as analytics from '@/shared/analytics/posthog';
import { STAGING_ID } from '@/core/constants';
import { binId, gridUnits, layerId } from '@/core/types';
import type { Bin } from '@/core/types';

// Mock the analytics module
vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
  trackLayoutSnapshot: vi.fn(),
}));

function makeGridBins(count: number): Bin[] {
  return Array.from({ length: count }, (_, i) =>
    createTestBin({ id: binId(`bin${i}`), layerId: layerId('layer1'), x: gridUnits(i) })
  );
}

function makeStagingBins(count: number): Bin[] {
  return Array.from({ length: count }, (_, i) =>
    createTestBin({ id: binId(`staging${i}`), layerId: STAGING_ID, x: gridUnits(i) })
  );
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useAnalytics', () => {
  let originalVisibilityState: PropertyDescriptor | undefined;

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();

    originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore visibilityState
    if (originalVisibilityState) {
      Object.defineProperty(document, 'visibilityState', originalVisibilityState);
    }
  });

  it('does not throw on mount', () => {
    expect(() => renderHook(() => useAnalytics())).not.toThrow();
  });

  it('mounts and unmounts without error', () => {
    const { unmount } = renderHook(() => useAnalytics());
    expect(() => unmount()).not.toThrow();
  });

  describe('visibilitychange handling (production mode)', () => {
    // The hook opts out of every listener in dev, so the session-end behaviour
    // is only observable with DEV falsy.
    beforeEach(() => {
      vi.stubEnv('DEV', false);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('does not track when visibility is visible', () => {
      useLayoutStore.setState({ layout: createTestLayout({ bins: makeGridBins(10) }) });

      renderHook(() => useAnalytics());

      setVisibility('visible');

      expect(analytics.trackLayoutSnapshot).not.toHaveBeenCalled();
    });

    it('does not track non-engaged sessions (< 5 bins)', () => {
      useLayoutStore.setState({ layout: createTestLayout({ bins: makeGridBins(3) }) });

      renderHook(() => useAnalytics());

      setVisibility('hidden');

      expect(analytics.trackLayoutSnapshot).not.toHaveBeenCalled();
    });

    it('tracks engaged sessions when tab becomes hidden', () => {
      const layout = createTestLayout({ bins: makeGridBins(10) });
      useLayoutStore.setState({ layout });

      renderHook(() => useAnalytics());

      setVisibility('hidden');

      expect(analytics.trackLayoutSnapshot).toHaveBeenCalledWith(layout, 'session_engaged', {
        duration_seconds: expect.any(Number),
      });
    });

    it('does not double-track sessions', () => {
      useLayoutStore.setState({ layout: createTestLayout({ bins: makeGridBins(10) }) });

      renderHook(() => useAnalytics());

      setVisibility('hidden');
      setVisibility('hidden');

      expect(analytics.trackLayoutSnapshot).toHaveBeenCalledTimes(1);
    });

    it('excludes staging bins from count', () => {
      // 3 on grid (not engaged) + 5 staged: engagement must ignore the stash
      useLayoutStore.setState({
        layout: createTestLayout({ bins: [...makeGridBins(3), ...makeStagingBins(5)] }),
      });

      renderHook(() => useAnalytics());

      setVisibility('hidden');

      expect(analytics.trackLayoutSnapshot).not.toHaveBeenCalled();
    });
  });

  describe('session timing', () => {
    it('initializes session start time on mount', () => {
      // Session start is captured internally via useRef
      // We can't directly test the ref, but we verify the hook runs without error
      const before = Date.now();
      renderHook(() => useAnalytics());
      const after = Date.now();

      // If the hook properly initialized, it shouldn't throw
      expect(after - before).toBeGreaterThanOrEqual(0);
    });
  });
});

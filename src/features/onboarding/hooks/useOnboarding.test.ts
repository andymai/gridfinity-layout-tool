import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnboarding, resetOnboarding, syncOnboardingFlags } from './useOnboarding';
import { useLayoutStore, useLibraryStore } from '@/core/store';
import { createDefaultLibrary } from '@/core/store/library';
import { createDefaultLayout } from '@/core/constants';
import { gridUnits, layoutId } from '@/core/types';

// Mock analytics
vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

import { trackEvent } from '@/shared/analytics/posthog';

/** Set localStorage flags and sync the module-level cache */
function setFlags(flags: Record<string, string>) {
  for (const [key, value] of Object.entries(flags)) {
    localStorage.setItem(key, value);
  }
  syncOnboardingFlags();
}

function initStoresAsNewUser() {
  const library = createDefaultLibrary(layoutId('test-layout-id'), 'Untitled layout');
  useLibraryStore.getState().initLibrary(library);

  const layout = createDefaultLayout();
  useLayoutStore.getState().importLayout(layout, layoutId('test-layout-id'), 'init');
}

function initStoresWithBins(binCount: number) {
  initStoresAsNewUser();
  const layout = useLayoutStore.getState().layout;
  for (let i = 0; i < binCount; i++) {
    useLayoutStore.getState().addBin({
      x: gridUnits(i),
      y: gridUnits(0),
      width: gridUnits(1),
      depth: gridUnits(1),
      height: layout.layers[0].height,
      layerId: layout.layers[0].id,
      category: layout.categories[0].id,
      label: '',
      notes: '',
    });
  }
}

describe('useOnboarding', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset module-level flags cache (localStorage.clear doesn't notify)
    resetOnboarding();
    // Reset stores to default state
    initStoresAsNewUser();
    vi.mocked(trackEvent).mockClear();
  });

  describe('shouldShowDrawTutorial', () => {
    it('shows draw tutorial on empty grid for new user', () => {
      const { result } = renderHook(() => useOnboarding());
      expect(result.current.shouldShowDrawTutorial).toBe(true);
    });

    it('does not show draw tutorial when user has bins', () => {
      initStoresWithBins(1);
      const { result } = renderHook(() => useOnboarding());
      expect(result.current.shouldShowDrawTutorial).toBe(false);
    });

    it('dismisses draw tutorial on markDrawTutorialComplete', () => {
      const { result } = renderHook(() => useOnboarding());
      expect(result.current.shouldShowDrawTutorial).toBe(true);

      act(() => result.current.markDrawTutorialComplete('manual_dismiss'));
      expect(result.current.shouldShowDrawTutorial).toBe(false);
    });

    it('does not show if localStorage flag already set', () => {
      setFlags({ 'gridfinity-onboarding-draw-tutorial-seen': 'true' });
      const { result } = renderHook(() => useOnboarding());
      expect(result.current.shouldShowDrawTutorial).toBe(false);
    });
  });

  describe('shouldPulseGallery', () => {
    it('pulses for low-engagement user past the draw tutorial (0 bins)', () => {
      setFlags({ 'gridfinity-onboarding-draw-tutorial-seen': 'true' });
      const { result } = renderHook(() => useOnboarding());
      expect(result.current.shouldPulseGallery).toBe(true);
    });

    it('does not pulse for brand-new user (draw tutorial not seen)', () => {
      const { result } = renderHook(() => useOnboarding());
      expect(result.current.shouldPulseGallery).toBe(false);
    });

    it('dismisses pulse on gallery open', () => {
      setFlags({ 'gridfinity-onboarding-draw-tutorial-seen': 'true' });
      const { result } = renderHook(() => useOnboarding());
      expect(result.current.shouldPulseGallery).toBe(true);

      act(() => result.current.dismissGalleryPulse());
      expect(result.current.shouldPulseGallery).toBe(false);
    });

    it('does not pulse if dismissed flag is set', () => {
      setFlags({
        'gridfinity-onboarding-draw-tutorial-seen': 'true',
        'gridfinity-onboarding-sidebar-pulse-dismissed': 'true',
      });
      const { result } = renderHook(() => useOnboarding());
      expect(result.current.shouldPulseGallery).toBe(false);
    });
  });

  describe('auto-dismiss', () => {
    it('auto-dismisses draw tutorial when first bin is created', () => {
      const { result } = renderHook(() => useOnboarding());
      expect(result.current.shouldShowDrawTutorial).toBe(true);

      // Simulate adding a bin
      const layout = useLayoutStore.getState().layout;
      act(() => {
        useLayoutStore.getState().addBin({
          x: gridUnits(0),
          y: gridUnits(0),
          width: gridUnits(1),
          depth: gridUnits(1),
          height: layout.layers[0].height,
          layerId: layout.layers[0].id,
          category: layout.categories[0].id,
          label: '',
          notes: '',
        });
      });

      expect(result.current.shouldShowDrawTutorial).toBe(false);
      expect(localStorage.getItem('gridfinity-onboarding-draw-tutorial-seen')).toBe('true');
      expect(trackEvent).toHaveBeenCalledWith('onboarding_draw_tutorial_completed', {
        method: 'first_bin',
      });
    });

    it('sets the flag without a completion event for users who arrive with bins', () => {
      initStoresWithBins(2);
      renderHook(() => useOnboarding());

      expect(localStorage.getItem('gridfinity-onboarding-draw-tutorial-seen')).toBe('true');
      expect(trackEvent).not.toHaveBeenCalledWith(
        'onboarding_draw_tutorial_completed',
        expect.anything()
      );
    });

    it('auto-dismisses gallery pulse when engagement threshold is reached', () => {
      setFlags({ 'gridfinity-onboarding-draw-tutorial-seen': 'true' });
      const { result } = renderHook(() => useOnboarding());
      expect(result.current.shouldPulseGallery).toBe(true);

      // Add bins up to the engagement threshold (3)
      const layout = useLayoutStore.getState().layout;
      for (let i = 0; i < 3; i++) {
        act(() => {
          useLayoutStore.getState().addBin({
            x: gridUnits(i),
            y: gridUnits(0),
            width: gridUnits(1),
            depth: gridUnits(1),
            height: layout.layers[0].height,
            layerId: layout.layers[0].id,
            category: layout.categories[0].id,
            label: '',
            notes: '',
          });
        });
      }

      expect(result.current.shouldPulseGallery).toBe(false);
      expect(localStorage.getItem('gridfinity-onboarding-sidebar-pulse-dismissed')).toBe('true');
    });
  });

  describe('resetOnboarding', () => {
    it('clears all onboarding flags', () => {
      setFlags({
        'gridfinity-onboarding-draw-tutorial-seen': 'true',
        'gridfinity-onboarding-sidebar-pulse-dismissed': 'true',
      });

      resetOnboarding();

      expect(localStorage.getItem('gridfinity-onboarding-draw-tutorial-seen')).toBeNull();
      expect(localStorage.getItem('gridfinity-onboarding-sidebar-pulse-dismissed')).toBeNull();
    });
  });
});

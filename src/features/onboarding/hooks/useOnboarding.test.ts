import { afterEach, describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnboarding, resetOnboarding, syncOnboardingFlags } from './useOnboarding';
import { useLayoutStore, useLibraryStore } from '@/core/store';
import { createDefaultLibrary } from '@/core/store/library';
import { createDefaultLayout } from '@/core/constants';

// Mock analytics
vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

/** Set localStorage flags and sync the module-level cache */
function setFlags(flags: Record<string, string>) {
  for (const [key, value] of Object.entries(flags)) {
    localStorage.setItem(key, value);
  }
  syncOnboardingFlags();
}

function initStoresAsNewUser() {
  const library = createDefaultLibrary('test-layout-id', 'Untitled layout');
  useLibraryStore.getState().initLibrary(library);

  const layout = createDefaultLayout();
  useLayoutStore.getState().importLayout(layout, 'test-layout-id', 'init');
}

function initStoresWithBins(binCount: number) {
  initStoresAsNewUser();
  const layout = useLayoutStore.getState().layout;
  for (let i = 0; i < binCount; i++) {
    useLayoutStore.getState().addBin({
      x: i,
      y: 0,
      width: 1,
      depth: 1,
      height: layout.layers[0].height,
      layerId: layout.layers[0].id,
      categoryId: layout.categories[0].id,
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
  });

  describe('shouldShowWelcome', () => {
    it('shows welcome for brand-new user (1 layout, 0 bins)', () => {
      const { result } = renderHook(() => useOnboarding());
      expect(result.current.shouldShowWelcome).toBe(true);
    });

    it('does not show welcome after markWelcomeComplete', () => {
      const { result } = renderHook(() => useOnboarding());
      act(() => result.current.markWelcomeComplete('template'));
      expect(result.current.shouldShowWelcome).toBe(false);
    });

    it('does not show welcome if localStorage flag is already set', () => {
      setFlags({ 'gridfinity-onboarding-welcome-seen': 'true' });
      const { result } = renderHook(() => useOnboarding());
      expect(result.current.shouldShowWelcome).toBe(false);
    });

    it('does not show welcome if user has bins', () => {
      initStoresWithBins(1);
      const { result } = renderHook(() => useOnboarding());
      expect(result.current.shouldShowWelcome).toBe(false);
    });

    describe('deep-link routes', () => {
      const originalLocation = window.location;

      afterEach(() => {
        Object.defineProperty(window, 'location', {
          value: originalLocation,
          writable: true,
        });
      });

      function setPathname(path: string) {
        // Spreading the Location class instance is intentional here — the
        // test only reads enumerable string properties on the result, never
        // calls prototype methods (assign/replace/reload).
        Object.defineProperty(window, 'location', {
          // eslint-disable-next-line @typescript-eslint/no-misused-spread
          value: { ...originalLocation, pathname: path },
          writable: true,
        });
      }

      it('does not show welcome on /designer route', () => {
        setPathname('/designer');
        const { result } = renderHook(() => useOnboarding());
        expect(result.current.shouldShowWelcome).toBe(false);
      });

      it('does not show welcome on /baseplate route', () => {
        setPathname('/baseplate');
        const { result } = renderHook(() => useOnboarding());
        expect(result.current.shouldShowWelcome).toBe(false);
      });

      it('auto-marks welcome seen for deep-link users to prevent later popup', () => {
        setPathname('/designer');
        renderHook(() => useOnboarding());
        expect(localStorage.getItem('gridfinity-onboarding-welcome-seen')).toBe('true');
      });
    });
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
    it('pulses for returning low-engagement user (welcome seen, 0 bins)', () => {
      setFlags({ 'gridfinity-onboarding-welcome-seen': 'true' });
      const { result } = renderHook(() => useOnboarding());
      expect(result.current.shouldPulseGallery).toBe(true);
    });

    it('does not pulse for brand-new user (welcome not seen)', () => {
      const { result } = renderHook(() => useOnboarding());
      expect(result.current.shouldPulseGallery).toBe(false);
    });

    it('dismisses pulse on gallery open', () => {
      setFlags({ 'gridfinity-onboarding-welcome-seen': 'true' });
      const { result } = renderHook(() => useOnboarding());
      expect(result.current.shouldPulseGallery).toBe(true);

      act(() => result.current.dismissGalleryPulse());
      expect(result.current.shouldPulseGallery).toBe(false);
    });

    it('does not pulse if dismissed flag is set', () => {
      setFlags({
        'gridfinity-onboarding-welcome-seen': 'true',
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
          x: 0,
          y: 0,
          width: 1,
          depth: 1,
          height: layout.layers[0].height,
          layerId: layout.layers[0].id,
          categoryId: layout.categories[0].id,
        });
      });

      expect(result.current.shouldShowDrawTutorial).toBe(false);
      expect(localStorage.getItem('gridfinity-onboarding-draw-tutorial-seen')).toBe('true');
    });

    it('auto-dismisses gallery pulse when engagement threshold is reached', () => {
      setFlags({ 'gridfinity-onboarding-welcome-seen': 'true' });
      const { result } = renderHook(() => useOnboarding());
      expect(result.current.shouldPulseGallery).toBe(true);

      // Add bins up to the engagement threshold (3)
      const layout = useLayoutStore.getState().layout;
      for (let i = 0; i < 3; i++) {
        act(() => {
          useLayoutStore.getState().addBin({
            x: i,
            y: 0,
            width: 1,
            depth: 1,
            height: layout.layers[0].height,
            layerId: layout.layers[0].id,
            categoryId: layout.categories[0].id,
          });
        });
      }

      expect(result.current.shouldPulseGallery).toBe(false);
      expect(localStorage.getItem('gridfinity-onboarding-sidebar-pulse-dismissed')).toBe('true');
    });
  });

  describe('cross-instance state sharing', () => {
    it('persists choseBlankCanvas to localStorage so other hook instances see it', () => {
      const { result } = renderHook(() => useOnboarding());
      act(() => result.current.markWelcomeComplete('blank'));

      // A second hook instance should read from localStorage
      expect(localStorage.getItem('gridfinity-onboarding-chose-blank')).toBe('true');
    });

    it('shares choseBlankCanvas flag via localStorage', () => {
      setFlags({
        'gridfinity-onboarding-welcome-seen': 'true',
        'gridfinity-onboarding-chose-blank': 'true',
      });
      // Verify the flag is readable from localStorage
      expect(localStorage.getItem('gridfinity-onboarding-chose-blank')).toBe('true');
    });
  });

  describe('resetOnboarding', () => {
    it('clears all onboarding flags', () => {
      setFlags({
        'gridfinity-onboarding-welcome-seen': 'true',
        'gridfinity-onboarding-draw-tutorial-seen': 'true',
        'gridfinity-onboarding-sidebar-pulse-dismissed': 'true',
        'gridfinity-onboarding-chose-blank': 'true',
      });

      resetOnboarding();

      expect(localStorage.getItem('gridfinity-onboarding-welcome-seen')).toBeNull();
      expect(localStorage.getItem('gridfinity-onboarding-draw-tutorial-seen')).toBeNull();
      expect(localStorage.getItem('gridfinity-onboarding-sidebar-pulse-dismissed')).toBeNull();
      expect(localStorage.getItem('gridfinity-onboarding-chose-blank')).toBeNull();
    });
  });
});

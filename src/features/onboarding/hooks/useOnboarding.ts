import { useCallback, useEffect, useRef } from 'react';
import { useLayoutStore } from '@/core/store';
import { trackEvent } from '@/shared/analytics/posthog';
import { createLocalStorageFlagStore } from '@/shared/hooks/createLocalStorageFlagStore';
import { isDevRuntime } from '@/shared/utils/devRuntime';

/** Engagement threshold: sidebar pulse stops after this many bins created */
const ENGAGEMENT_BIN_THRESHOLD = 3;

const store = createLocalStorageFlagStore({
  drawTutorialSeen: 'gridfinity-onboarding-draw-tutorial-seen',
  pulseDismissed: 'gridfinity-onboarding-sidebar-pulse-dismissed',
});

/**
 * Reset all onboarding flags so the first-run flow shows again on next page load.
 * Exported as a standalone function for use in Settings modal.
 */
export const resetOnboarding = store.reset;

/**
 * Re-read flags from localStorage into the module cache and notify subscribers.
 * Needed in tests that write to localStorage directly (outside setFlag).
 * @internal — test utility only
 */
export const syncOnboardingFlags = store.sync;

// Hook

export interface UseOnboardingReturn {
  /** Whether the animated draw tutorial should show on blank canvas */
  shouldShowDrawTutorial: boolean;
  /** Whether the sidebar gallery button should pulse */
  shouldPulseGallery: boolean;
  /** Mark draw tutorial complete — call on first bin creation or manual dismiss */
  markDrawTutorialComplete: (method: 'first_bin' | 'manual_dismiss') => void;
  /** Dismiss sidebar pulse — call when gallery is opened */
  dismissGalleryPulse: () => void;
}

/**
 * Orchestrates first-visit onboarding state.
 *
 * Uses localStorage flags to ensure one-time experiences:
 * - Draw tutorial: shown on any empty grid until the user creates a first bin
 * - Sidebar pulse: shown for returning low-engagement users (< 3 bins)
 *
 * State is shared across all hook instances via useSyncExternalStore
 * backed by localStorage + module-level notify, so App, Grid, and Sidebar
 * all react to the same flag changes within a single tab.
 */
export function useOnboarding(): UseOnboardingReturn {
  const flags = store.useFlags();

  const binCount = useLayoutStore((state) => state.layout.bins.length);
  const prevBinCountRef = useRef<number | null>(null);

  const isDev = isDevRuntime();

  // Draw tutorial: show on any empty grid until user creates their first bin
  const shouldShowDrawTutorial = !isDev && !flags.drawTutorialSeen && binCount === 0;

  // Sidebar pulse: show for low-engagement users who are past the draw
  // tutorial (dismissed it or drew a bin) but haven't reached the threshold
  const shouldPulseGallery =
    !isDev &&
    !flags.pulseDismissed &&
    flags.drawTutorialSeen &&
    binCount < ENGAGEMENT_BIN_THRESHOLD;

  // Auto-dismiss pulse when engagement threshold is reached
  useEffect(() => {
    if (!flags.pulseDismissed && flags.drawTutorialSeen && binCount >= ENGAGEMENT_BIN_THRESHOLD) {
      store.setFlag('pulseDismissed');
      trackEvent('onboarding_sidebar_pulse_dismissed', {
        method: 'engagement_threshold',
        bin_count: binCount,
      });
    }
  }, [binCount, flags.pulseDismissed, flags.drawTutorialSeen]);

  // Auto-dismiss draw tutorial when first bin is created. The completion
  // event is only sent on an observed empty→non-empty transition — a user
  // who arrives with bins already present (existing layout, new browser)
  // never saw the tutorial, so only the flag is set for them.
  useEffect(() => {
    const prev = prevBinCountRef.current;
    prevBinCountRef.current = binCount;
    if (!flags.drawTutorialSeen && binCount > 0) {
      store.setFlag('drawTutorialSeen');
      if (prev === 0) {
        trackEvent('onboarding_draw_tutorial_completed', { method: 'first_bin' });
      }
    }
  }, [binCount, flags.drawTutorialSeen]);

  const markDrawTutorialComplete = useCallback(
    (method: 'first_bin' | 'manual_dismiss') => {
      if (flags.drawTutorialSeen) return;
      store.setFlag('drawTutorialSeen');
      trackEvent('onboarding_draw_tutorial_completed', { method });
    },
    [flags.drawTutorialSeen]
  );

  const dismissGalleryPulse = useCallback(() => {
    if (flags.pulseDismissed) return;
    store.setFlag('pulseDismissed');
    trackEvent('onboarding_sidebar_pulse_dismissed', {
      method: 'gallery_opened',
      bin_count: binCount,
    });
  }, [flags.pulseDismissed, binCount]);

  return {
    shouldShowDrawTutorial,
    shouldPulseGallery,
    markDrawTutorialComplete,
    dismissGalleryPulse,
  };
}

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useLayoutStore, useLibraryStore } from '@/core/store';
import { trackEvent } from '@/shared/analytics/posthog';

// localStorage Keys

const WELCOME_SEEN_KEY = 'gridfinity-onboarding-welcome-seen';
const DRAW_TUTORIAL_SEEN_KEY = 'gridfinity-onboarding-draw-tutorial-seen';
const SIDEBAR_PULSE_DISMISSED_KEY = 'gridfinity-onboarding-sidebar-pulse-dismissed';
const CHOSE_BLANK_CANVAS_KEY = 'gridfinity-onboarding-chose-blank';

const ALL_KEYS = [
  WELCOME_SEEN_KEY,
  DRAW_TUTORIAL_SEEN_KEY,
  SIDEBAR_PULSE_DISMISSED_KEY,
  CHOSE_BLANK_CANVAS_KEY,
] as const;

/** Engagement threshold: sidebar pulse stops after this many bins created */
const ENGAGEMENT_BIN_THRESHOLD = 3;

// Reactive localStorage — useSyncExternalStore so all hook instances share state

type OnboardingFlags = {
  welcomeSeen: boolean;
  drawTutorialSeen: boolean;
  pulseDismissed: boolean;
  choseBlankCanvas: boolean;
};

let flagsCache: OnboardingFlags = readFlags();
const listeners = new Set<() => void>();

/** Safe localStorage read — returns null if unavailable */
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Safe localStorage write — silently fails if unavailable */
function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

/** Safe localStorage remove — silently fails if unavailable */
function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

function readFlags(): OnboardingFlags {
  return {
    welcomeSeen: safeGetItem(WELCOME_SEEN_KEY) === 'true',
    drawTutorialSeen: safeGetItem(DRAW_TUTORIAL_SEEN_KEY) === 'true',
    pulseDismissed: safeGetItem(SIDEBAR_PULSE_DISMISSED_KEY) === 'true',
    choseBlankCanvas: safeGetItem(CHOSE_BLANK_CANVAS_KEY) === 'true',
  };
}

function notifyListeners(): void {
  flagsCache = readFlags();
  for (const listener of listeners) {
    listener();
  }
}

/** Set a localStorage flag and notify all hook instances in the same tab */
function setFlag(key: string, value: string): void {
  safeSetItem(key, value);
  notifyListeners();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): OnboardingFlags {
  return flagsCache;
}

/**
 * Reset all onboarding flags so the welcome flow shows again on next page load.
 * Exported as a standalone function for use in Settings modal.
 */
export function resetOnboarding(): void {
  for (const key of ALL_KEYS) {
    safeRemoveItem(key);
  }
  notifyListeners();
}

/**
 * Re-read flags from localStorage into the module cache and notify subscribers.
 * Needed in tests that write to localStorage directly (outside setFlag).
 * @internal — test utility only
 */
export function syncOnboardingFlags(): void {
  notifyListeners();
}

// Hook

export interface UseOnboardingReturn {
  /** Whether the welcome modal should be shown (first visit, single empty layout) */
  shouldShowWelcome: boolean;
  /** Whether the animated draw tutorial should show on blank canvas */
  shouldShowDrawTutorial: boolean;
  /** Whether the sidebar gallery button should pulse */
  shouldPulseGallery: boolean;
  /** Mark welcome complete — call when user picks template or blank canvas */
  markWelcomeComplete: (method: 'template' | 'blank') => void;
  /** Mark draw tutorial complete — call on first bin creation or manual dismiss */
  markDrawTutorialComplete: (method: 'first_bin' | 'manual_dismiss') => void;
  /** Dismiss sidebar pulse — call when gallery is opened */
  dismissGalleryPulse: () => void;
}

/**
 * Orchestrates first-visit onboarding state.
 *
 * Uses localStorage flags to ensure one-time experiences:
 * - Welcome modal: shown for brand-new users (1 default layout, 0 bins)
 * - Draw tutorial: shown after user dismisses welcome to blank canvas
 * - Sidebar pulse: shown for returning low-engagement users (< 3 bins)
 *
 * State is shared across all hook instances via useSyncExternalStore
 * backed by localStorage + module-level notify, so App, Grid, and Sidebar
 * all react to the same flag changes within a single tab.
 */
export function useOnboarding(): UseOnboardingReturn {
  const flags = useSyncExternalStore(subscribe, getSnapshot);

  // Read library/layout state to determine eligibility
  const entryCount = useLibraryStore((state) => state.library.entries.length);
  const binCount = useLayoutStore((state) => state.layout.bins.length);

  // Skip onboarding in dev mode (covers local dev and E2E tests against dev server).
  // Exclude Vitest so unit tests can still verify onboarding logic.
  const isDev = import.meta.env.DEV && !import.meta.env.VITEST;

  // Welcome: show only for brand-new users (1 layout, 0 bins, never seen)
  const shouldShowWelcome = !isDev && !flags.welcomeSeen && entryCount === 1 && binCount === 0;

  // Draw tutorial: show on any empty grid until user creates their first bin
  const shouldShowDrawTutorial = !isDev && !flags.drawTutorialSeen && binCount === 0;

  // Sidebar pulse: show for low-engagement returning users
  const shouldPulseGallery =
    !isDev && !flags.pulseDismissed && flags.welcomeSeen && binCount < ENGAGEMENT_BIN_THRESHOLD;

  // Auto-dismiss pulse when engagement threshold is reached
  useEffect(() => {
    if (!flags.pulseDismissed && flags.welcomeSeen && binCount >= ENGAGEMENT_BIN_THRESHOLD) {
      setFlag(SIDEBAR_PULSE_DISMISSED_KEY, 'true');
      trackEvent('onboarding_sidebar_pulse_dismissed', {
        method: 'engagement_threshold',
        bin_count: binCount,
      });
    }
  }, [binCount, flags.pulseDismissed, flags.welcomeSeen]);

  // Auto-dismiss draw tutorial when first bin is created
  useEffect(() => {
    if (!flags.drawTutorialSeen && binCount > 0) {
      setFlag(DRAW_TUTORIAL_SEEN_KEY, 'true');
      trackEvent('onboarding_draw_tutorial_completed', { method: 'first_bin' });
    }
  }, [binCount, flags.drawTutorialSeen]);

  const markWelcomeComplete = useCallback((method: 'template' | 'blank') => {
    setFlag(WELCOME_SEEN_KEY, 'true');

    if (method === 'blank') {
      setFlag(CHOSE_BLANK_CANVAS_KEY, 'true');
    }

    trackEvent('onboarding_welcome_completed', { method });
  }, []);

  const markDrawTutorialComplete = useCallback(
    (method: 'first_bin' | 'manual_dismiss') => {
      if (flags.drawTutorialSeen) return;
      setFlag(DRAW_TUTORIAL_SEEN_KEY, 'true');
      trackEvent('onboarding_draw_tutorial_completed', { method });
    },
    [flags.drawTutorialSeen]
  );

  const dismissGalleryPulse = useCallback(() => {
    if (flags.pulseDismissed) return;
    setFlag(SIDEBAR_PULSE_DISMISSED_KEY, 'true');
    trackEvent('onboarding_sidebar_pulse_dismissed', {
      method: 'gallery_opened',
      bin_count: binCount,
    });
  }, [flags.pulseDismissed, binCount]);

  return {
    shouldShowWelcome,
    shouldShowDrawTutorial,
    shouldPulseGallery,
    markWelcomeComplete,
    markDrawTutorialComplete,
    dismissGalleryPulse,
  };
}

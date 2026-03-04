import type { Layout } from '@/core/types';
import { flush } from './eventBuffer';
import {
  markEditActivity,
  incrementEditCount,
  getTimeSinceLastEdit,
  checkAndSetIdleTracked,
} from './sessionState';
import {
  trackLayoutSnapshot,
  trackSessionSummary,
  isSubstantialLayout,
  isEnabled,
} from './trackers';

// ============================================
// INITIALIZATION
// ============================================

// Idle detection constants
const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const IDLE_CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

// Lazy store getter to avoid circular dependencies
let layoutStoreGetter: (() => { layout: Layout; lastEditSource: string | null }) | null = null;
let layoutStoreSubscribe:
  | ((callback: (state: { lastEditSource: string | null }) => void) => () => void)
  | null = null;

let isInitialized = false;
let cleanupFunctions: (() => void)[] = [];

/**
 * Set the layout store getter (call from App initialization).
 * This avoids circular dependencies.
 */
export function setLayoutStoreRef(
  getState: () => { layout: Layout; lastEditSource: string | null },
  subscribe: (callback: (state: { lastEditSource: string | null }) => void) => () => void
): void {
  layoutStoreGetter = getState;
  layoutStoreSubscribe = subscribe;
}

/**
 * Initialize ML telemetry listeners.
 * Call once on app startup.
 *
 * @returns Cleanup function to remove event listeners (useful for testing)
 */
export function initMLTelemetry(): () => void {
  if (isInitialized) {
    return () => cleanupMLTelemetry();
  }
  if (typeof window === 'undefined') {
    return () => {};
  }
  // Skip in development mode
  if (import.meta.env.DEV) {
    return () => {};
  }

  isInitialized = true;
  cleanupFunctions = [];

  // Subscribe to layout store changes to track edit activity
  let storeUnsubscribe: (() => void) | null;
  if (layoutStoreSubscribe) {
    storeUnsubscribe = layoutStoreSubscribe((state: { lastEditSource: string | null }) => {
      if (state.lastEditSource === 'local') {
        markEditActivity();
        incrementEditCount();
      }
    });
    cleanupFunctions.push(storeUnsubscribe);
  }

  // Flush on page hide (tab switch, close, navigation)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      if (layoutStoreGetter) {
        const layout = layoutStoreGetter().layout;
        trackSessionSummary(layout, 'session_end');
        if (isSubstantialLayout(layout)) {
          trackLayoutSnapshot(layout, 'session_end');
        }
      }
      flush();
    }
  };
  window.addEventListener('visibilitychange', handleVisibilityChange);
  cleanupFunctions.push(() =>
    window.removeEventListener('visibilitychange', handleVisibilityChange)
  );

  // Flush on page unload
  window.addEventListener('pagehide', flush);
  cleanupFunctions.push(() => window.removeEventListener('pagehide', flush));

  // Also try beforeunload as fallback
  window.addEventListener('beforeunload', flush);
  cleanupFunctions.push(() => window.removeEventListener('beforeunload', flush));

  // Start idle detection
  const idleIntervalId = setInterval(() => {
    if (!isEnabled()) return;

    const timeSinceEdit = getTimeSinceLastEdit();
    if (timeSinceEdit >= IDLE_THRESHOLD_MS && checkAndSetIdleTracked()) {
      if (layoutStoreGetter) {
        const layout = layoutStoreGetter().layout;
        if (isSubstantialLayout(layout)) {
          trackLayoutSnapshot(layout, 'idle');
        }
      }
    }
  }, IDLE_CHECK_INTERVAL_MS);
  cleanupFunctions.push(() => clearInterval(idleIntervalId));

  return () => cleanupMLTelemetry();
}

/**
 * Cleanup ML telemetry listeners.
 */
export function cleanupMLTelemetry(): void {
  for (const cleanup of cleanupFunctions) {
    try {
      cleanup();
    } catch {
      // Ignore cleanup errors
    }
  }
  cleanupFunctions = [];
  isInitialized = false;
}

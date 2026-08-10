/**
 * Analytics hook for session tracking.
 * Uses visibilitychange to track engaged sessions reliably.
 */

import { useEffect, useRef } from 'react';
import { useLayoutStore } from '@/core/store';
import { trackLayoutSnapshot } from '@/shared/analytics/posthog';
import { getGridBins } from '@/shared/utils';

/**
 * Hook to track engaged sessions via visibilitychange.
 */
export function useAnalytics(): void {
  const sessionStartRef = useRef(0);
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    // Only track in production
    if (import.meta.env.DEV) return;

    // Initialize timestamps on first mount
    if (sessionStartRef.current === 0) sessionStartRef.current = Date.now();

    // --- Session End Tracking (PostHog) ---
    const handleVisibilityChange = () => {
      // Only track when tab becomes hidden (user leaves)
      if (document.visibilityState !== 'hidden') return;

      // Prevent double-tracking
      if (hasTrackedRef.current) return;

      const layout = useLayoutStore.getState().layout;
      const binCount = getGridBins(layout.bins).length;

      // Only track engaged sessions (5+ bins)
      if (binCount < 5) return;

      hasTrackedRef.current = true;
      const durationSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000);

      trackLayoutSnapshot(layout, 'session_engaged', {
        duration_seconds: durationSeconds,
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}

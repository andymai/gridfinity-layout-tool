/**
 * Analytics hook for session tracking.
 * Uses visibilitychange to track engaged sessions reliably.
 */

import { useEffect, useRef } from 'react';
import { useLayoutStore } from '../store';
import { trackLayoutSnapshot } from '../utils/analytics';
import { STAGING_ID } from '../constants';

/**
 * Hook to track engaged sessions via visibilitychange.
 * More reliable than beforeunload for analytics.
 */
export function useAnalytics(): void {
  const sessionStartRef = useRef<number | null>(null);
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    // Initialize session start time on mount (only in effect, not render)
    if (sessionStartRef.current === null) {
      sessionStartRef.current = Date.now();
    }

    // Only track in production
    if (import.meta.env.DEV) return;

    const handleVisibilityChange = () => {
      // Only track when tab becomes hidden (user leaves)
      if (document.visibilityState !== 'hidden') return;

      // Prevent double-tracking
      if (hasTrackedRef.current) return;

      const layout = useLayoutStore.getState().layout;
      const binCount = layout.bins.filter(b => b.layerId !== STAGING_ID).length;

      // Only track engaged sessions (5+ bins)
      if (binCount < 5) return;

      hasTrackedRef.current = true;
      const startTime = sessionStartRef.current ?? Date.now();
      const durationSeconds = Math.round((Date.now() - startTime) / 1000);

      trackLayoutSnapshot(layout, 'session_engaged', {
        duration_seconds: durationSeconds,
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
}

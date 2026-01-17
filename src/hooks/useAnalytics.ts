/**
 * Analytics hook for session tracking.
 * Uses visibilitychange to track engaged sessions reliably.
 * Sends Vercel heartbeat every 3 minutes while tab is visible.
 */

import { useEffect, useRef } from 'react';
import { track } from '@vercel/analytics';
import { useLayoutStore } from '../store';
import { trackLayoutSnapshot, getActivityContext } from '../utils/analytics';
import { STAGING_ID } from '../constants';

/** Heartbeat interval: 3 minutes (matches Vercel's "online" window) */
const HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000;

/**
 * Hook to track engaged sessions via visibilitychange.
 * Also sends Vercel heartbeat every 3 minutes while tab is visible.
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

    // --- Vercel Heartbeat (every 3 min while visible) ---
    const sendHeartbeat = () => {
      if (document.visibilityState !== 'visible') return;

      const startTime = sessionStartRef.current ?? Date.now();
      const sessionMinutes = Math.floor((Date.now() - startTime) / 60000);

      track('heartbeat', {
        context: getActivityContext(),
        session_minutes: sessionMinutes,
      });
    };

    // Send initial heartbeat after a short delay (let app stabilize)
    const initialTimeout = setTimeout(sendHeartbeat, 5000);
    const heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    // --- Session End Tracking (PostHog) ---
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

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}

/**
 * Analytics hook for session tracking.
 * Uses visibilitychange to track engaged sessions reliably.
 * Sends PostHog heartbeat every 3 minutes while tab is visible and user is active.
 */

import { useEffect, useRef } from 'react';
import { useLayoutStore } from '@/core/store';
import { trackLayoutSnapshot, trackHeartbeat } from '@/shared/analytics/posthog';
import { getGridBins } from '@/shared/utils';

/** Heartbeat interval: 3 minutes */
const HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000;

/** Idle threshold: skip heartbeat if no interaction for 60 seconds */
const IDLE_THRESHOLD_MS = 60 * 1000;

/**
 * Hook to track engaged sessions via visibilitychange.
 * Also sends PostHog heartbeat every 3 minutes while tab is visible and user is active.
 */
export function useAnalytics(): void {
  const sessionStartRef = useRef(0);
  const hasTrackedRef = useRef(false);
  const lastActivityRef = useRef(0);

  useEffect(() => {
    // Only track in production
    if (import.meta.env.DEV) return;

    // Initialize timestamps on first mount
    const now = Date.now();
    if (sessionStartRef.current === 0) sessionStartRef.current = now;
    if (lastActivityRef.current === 0) lastActivityRef.current = now;

    // --- Idle Detection ---
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };
    window.addEventListener('pointerdown', updateActivity);
    window.addEventListener('keydown', updateActivity);

    // --- PostHog Heartbeat (every 3 min while visible & active) ---
    const sendHeartbeat = () => {
      // Skip if tab not visible or offline
      if (document.visibilityState !== 'visible') return;
      if (!navigator.onLine) return;

      // Skip if user has been idle for more than 60 seconds
      if (Date.now() - lastActivityRef.current > IDLE_THRESHOLD_MS) return;

      const sessionMinutes = Math.floor((Date.now() - sessionStartRef.current) / 60000);
      trackHeartbeat(sessionMinutes);
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
      clearTimeout(initialTimeout);
      clearInterval(heartbeatInterval);
      window.removeEventListener('pointerdown', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}

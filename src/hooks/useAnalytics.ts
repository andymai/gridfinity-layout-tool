/**
 * Analytics hook for session tracking and real-time active user detection.
 * - Uses visibilitychange to track engaged sessions reliably.
 * - Sends periodic heartbeats while user is active for real-time user counts.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useLayoutStore } from '../store';
import { trackLayoutSnapshot, trackHeartbeat } from '../utils/analytics';
import { STAGING_ID } from '../constants';

// Heartbeat interval: 2 minutes while active
const HEARTBEAT_INTERVAL_MS = 120_000;
// Idle timeout: consider user idle after 2 minutes of no activity
const IDLE_TIMEOUT_MS = 120_000;

/**
 * Hook to track engaged sessions and real-time active users.
 * - Tracks session end via visibilitychange (reliable for session metrics)
 * - Sends heartbeats every 2 min while user is active (for real-time user counts)
 * - Pauses heartbeats when user is idle (no interaction for 2 minutes)
 */
export function useAnalytics(): void {
  const sessionStartRef = useRef<number | null>(null);
  const hasTrackedRef = useRef(false);
  const lastActivityRef = useRef<number>(0);
  const activityCountRef = useRef<number>(0);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef<boolean>(true);

  // Throttled activity handler - updates last activity time
  const handleActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    activityCountRef.current += 1;

    // Resume heartbeats if user was idle
    if (!isActiveRef.current) {
      isActiveRef.current = true;
    }
  }, []);

  useEffect(() => {
    // Initialize timestamps on mount (not during render to avoid impurity)
    if (sessionStartRef.current === null) {
      sessionStartRef.current = Date.now();
    }
    if (lastActivityRef.current === 0) {
      lastActivityRef.current = Date.now();
    }

    // Only track in production
    if (import.meta.env.DEV) return;

    // ========================================
    // HEARTBEAT MECHANISM (for real-time users)
    // ========================================

    // Throttle activity events to once per second
    let activityThrottleTimeout: ReturnType<typeof setTimeout> | null = null;
    const throttledActivity = () => {
      if (activityThrottleTimeout) return;
      handleActivity();
      activityThrottleTimeout = setTimeout(() => {
        activityThrottleTimeout = null;
      }, 1000);
    };

    // Activity events to listen for
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const;

    // Start listening for activity
    for (const event of activityEvents) {
      document.addEventListener(event, throttledActivity, { passive: true });
    }

    // Send heartbeat if user is active (not idle)
    const sendHeartbeatIfActive = () => {
      const timeSinceActivity = Date.now() - lastActivityRef.current;

      if (timeSinceActivity < IDLE_TIMEOUT_MS) {
        // User is active - send heartbeat
        isActiveRef.current = true;
        trackHeartbeat(activityCountRef.current);
        activityCountRef.current = 0; // Reset counter after sending
      } else {
        // User is idle - skip heartbeat
        isActiveRef.current = false;
      }
    };

    // Start heartbeat interval
    heartbeatIntervalRef.current = setInterval(sendHeartbeatIfActive, HEARTBEAT_INTERVAL_MS);

    // ========================================
    // SESSION END TRACKING (via visibilitychange)
    // ========================================

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

    // Cleanup
    return () => {
      // Remove activity listeners
      for (const event of activityEvents) {
        document.removeEventListener(event, throttledActivity);
      }

      // Clear throttle timeout
      if (activityThrottleTimeout) {
        clearTimeout(activityThrottleTimeout);
      }

      // Clear heartbeat interval
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      // Remove visibility listener
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleActivity]);
}

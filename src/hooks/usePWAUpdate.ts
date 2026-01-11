import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToastStore } from '../store/toast';

// Match the default toast duration for consistent UX
const RELOAD_DELAY_MS = 5000;

// Background polling interval (every 5 minutes when tab is active)
const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Minimum time between update checks to avoid hammering the server
const UPDATE_THROTTLE_MS = 30 * 1000; // 30 seconds

/**
 * Hook that handles PWA service worker updates following vite-plugin-pwa best practices.
 *
 * Checks for updates on:
 * - Initial page load (via onRegisteredSW callback)
 * - Tab visibility change (returning to tab)
 * - Window focus
 * - Every 5 minutes while active
 *
 * Update checks are throttled and skip when:
 * - Offline (navigator.onLine is false)
 * - SW is currently installing
 * - Checked within last 30 seconds
 *
 * When a new version is available, shows a toast and auto-reloads.
 */
export function usePWAUpdate(): void {
  const addToast = useToastStore(state => state.addToast);
  const hasTriggeredReload = useRef(false);
  const intervalRef = useRef<number | undefined>(undefined);
  const timeoutRef = useRef<number | undefined>(undefined);
  const lastCheckRef = useRef<number>(0);
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const swUrlRef = useRef<string | undefined>(undefined);

  /**
   * Check for SW updates following the advanced pattern from vite-plugin-pwa docs.
   * Fetches SW file with cache-busting headers before calling update().
   */
  const checkForUpdate = async () => {
    const registration = registrationRef.current;
    const swUrl = swUrlRef.current;

    // Skip if not registered yet
    if (!registration || !swUrl) return;

    // Skip if SW is currently installing
    if (registration.installing) return;

    // Skip if offline
    if ('connection' in navigator && !navigator.onLine) return;

    // Throttle checks
    const now = Date.now();
    if (now - lastCheckRef.current < UPDATE_THROTTLE_MS) return;
    lastCheckRef.current = now;

    try {
      // Fetch SW with cache-busting headers to ensure fresh check
      const resp = await fetch(swUrl, {
        cache: 'no-store',
        headers: {
          'cache': 'no-store',
          'cache-control': 'no-cache',
        },
      });

      if (resp?.status === 200) {
        await registration.update();
      }
    } catch (error) {
      // Silently handle network errors during update check
      console.warn('SW update check failed:', error);
    }
  };

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Store references for update checks
      swUrlRef.current = swUrl;
      registrationRef.current = registration;

      // Check immediately on registration (page load)
      checkForUpdate();

      // Set up periodic checks
      intervalRef.current = window.setInterval(() => {
        checkForUpdate();
      }, UPDATE_CHECK_INTERVAL_MS);
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  // Set up visibility and focus listeners for update checks
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    };

    const handleFocus = () => {
      checkForUpdate();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (intervalRef.current !== undefined) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Handle update notification and auto-reload
  useEffect(() => {
    if (needRefresh && !hasTriggeredReload.current) {
      hasTriggeredReload.current = true;

      // Show toast notification
      addToast('Updating to latest version...', 'info', RELOAD_DELAY_MS);

      // Reload after toast duration
      timeoutRef.current = window.setTimeout(() => {
        updateServiceWorker(true);
      }, RELOAD_DELAY_MS);
    }

    return () => {
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [needRefresh, addToast, updateServiceWorker]);
}

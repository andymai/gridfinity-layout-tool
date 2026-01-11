import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToastStore } from '../store/toast';

// Match the default toast duration for consistent UX
const RELOAD_DELAY_MS = 5000;

// Check for updates every hour
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Hook that handles PWA service worker updates.
 * When a new version is available, it shows a toast notification
 * and automatically reloads the page after the toast duration.
 */
export function usePWAUpdate(): void {
  const addToast = useToastStore(state => state.addToast);
  const hasTriggeredReload = useRef(false);
  const intervalRef = useRef<number | undefined>(undefined);
  const timeoutRef = useRef<number | undefined>(undefined);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  // Set up periodic update checks
  useEffect(() => {
    // Get registration and start interval
    navigator.serviceWorker?.ready.then((registration) => {
      intervalRef.current = window.setInterval(() => {
        registration.update();
      }, UPDATE_CHECK_INTERVAL_MS);
    });

    return () => {
      if (intervalRef.current !== undefined) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

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

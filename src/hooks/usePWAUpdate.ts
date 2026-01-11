import { useEffect, useRef, useCallback, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToastStore } from '../store/toast';

// Check for updates every hour
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

// Storage key to track if we've shown the offline-ready notification
const OFFLINE_READY_SHOWN_KEY = 'gridfinity-offline-ready-shown';

export interface PWAUpdateState {
  /** Whether a new version is available and waiting */
  needsUpdate: boolean;
  /** Whether the app is ready to work offline */
  isOfflineReady: boolean;
  /** Whether service worker registration failed */
  registrationError: Error | null;
  /** Trigger the update and reload the page */
  applyUpdate: () => Promise<void>;
  /** Dismiss the update notification (will update on next visit) */
  dismissUpdate: () => void;
}

/**
 * Hook that handles PWA service worker registration and updates.
 *
 * Improvements over simple auto-update:
 * - Shows offline-ready notification on first install
 * - Provides user control over when to apply updates
 * - Exposes update state for UI components
 * - Better error handling with user feedback
 */
export function usePWAUpdate(): PWAUpdateState {
  const addToast = useToastStore((state) => state.addToast);
  const intervalRef = useRef<number | undefined>(undefined);
  const [registrationError, setRegistrationError] = useState<Error | null>(null);
  const hasShownOfflineReadyRef = useRef(false);
  const hasShownUpdateRef = useRef(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      if (registration) {
        // Set up periodic update checks
        intervalRef.current = window.setInterval(() => {
          registration.update().catch((err) => {
            // Silently ignore update check failures (e.g., offline)
            console.warn('SW update check failed:', err);
          });
        }, UPDATE_CHECK_INTERVAL_MS);
      }
    },
    onRegisterError(error) {
      setRegistrationError(error);
      console.error('Service worker registration failed:', error);

      // Show user-friendly error message
      addToast(
        'Offline mode unavailable. The app will still work, but requires internet.',
        'error',
        8000
      );
    },
  });

  // Show offline-ready notification (only once per device)
  useEffect(() => {
    if (offlineReady && !hasShownOfflineReadyRef.current) {
      const hasShownBefore = localStorage.getItem(OFFLINE_READY_SHOWN_KEY);

      if (!hasShownBefore) {
        hasShownOfflineReadyRef.current = true;
        localStorage.setItem(OFFLINE_READY_SHOWN_KEY, 'true');

        addToast('App installed! Works offline now.', 'success', 5000);
      }
    }
  }, [offlineReady, addToast]);

  // Show update available notification
  useEffect(() => {
    if (needRefresh && !hasShownUpdateRef.current) {
      hasShownUpdateRef.current = true;

      addToast(
        'New version available! Refresh to update.',
        'info',
        0 // Don't auto-dismiss - user should take action
      );
    }
  }, [needRefresh, addToast]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current !== undefined) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const applyUpdate = useCallback(async () => {
    await updateServiceWorker(true);
  }, [updateServiceWorker]);

  const dismissUpdate = useCallback(() => {
    setNeedRefresh(false);
    hasShownUpdateRef.current = false;
  }, [setNeedRefresh]);

  return {
    needsUpdate: needRefresh,
    isOfflineReady: offlineReady,
    registrationError,
    applyUpdate,
    dismissUpdate,
  };
}

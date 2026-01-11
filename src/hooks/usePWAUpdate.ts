import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToastStore } from '../store/toast';

// Match the default toast duration for consistent UX
const RELOAD_DELAY_MS = 5000;

/**
 * Hook that handles PWA service worker updates.
 * When a new version is available, it shows a toast notification
 * and automatically reloads the page after the toast duration.
 */
export function usePWAUpdate(): void {
  const addToast = useToastStore(state => state.addToast);
  const hasTriggeredReload = useRef(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      // Check for updates periodically (every hour)
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  useEffect(() => {
    if (needRefresh && !hasTriggeredReload.current) {
      hasTriggeredReload.current = true;

      // Show toast notification
      addToast('Updating to latest version...', 'info', RELOAD_DELAY_MS);

      // Reload after toast duration
      setTimeout(() => {
        updateServiceWorker(true);
      }, RELOAD_DELAY_MS);
    }
  }, [needRefresh, addToast, updateServiceWorker]);
}

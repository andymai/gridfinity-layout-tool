import { useState, useEffect, useCallback, useRef } from 'react';

export interface NetworkStatus {
  /** Whether the browser reports being online */
  isOnline: boolean;
  /** Whether we've detected actual connectivity (via fetch) */
  isConnected: boolean;
  /** Timestamp of last successful connectivity check */
  lastOnlineAt: number | null;
  /** Whether we're currently checking connectivity */
  isChecking: boolean;
}

interface UseNetworkStatusOptions {
  /** URL to ping for connectivity check (should be small, fast, and CORS-enabled) */
  pingUrl?: string;
  /** How often to check connectivity when online (ms) */
  checkInterval?: number;
  /** Whether to show a toast when coming back online */
  showReconnectToast?: boolean;
}

const DEFAULT_PING_URL = '/icons/favicon.svg'; // Small local asset
const DEFAULT_CHECK_INTERVAL = 30000; // 30 seconds

/**
 * Hook that tracks network connectivity status.
 *
 * Uses navigator.onLine for immediate feedback, but also performs
 * periodic connectivity checks since navigator.onLine can be unreliable
 * (e.g., connected to WiFi but no internet).
 */
export function useNetworkStatus(options: UseNetworkStatusOptions = {}): NetworkStatus {
  const {
    pingUrl = DEFAULT_PING_URL,
    checkInterval = DEFAULT_CHECK_INTERVAL,
  } = options;

  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isConnected, setIsConnected] = useState(() => navigator.onLine);
  const [lastOnlineAt, setLastOnlineAt] = useState<number | null>(() =>
    navigator.onLine ? Date.now() : null
  );
  const [isChecking, setIsChecking] = useState(false);

  const intervalRef = useRef<number | undefined>(undefined);
  const wasOnlineRef = useRef(navigator.onLine);

  // Check actual connectivity by fetching a small resource
  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    if (!navigator.onLine) {
      return false;
    }

    setIsChecking(true);

    try {
      // Use HEAD request for efficiency, add cache-busting
      const response = await fetch(`${pingUrl}?_=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        mode: 'same-origin',
      });

      const connected = response.ok;
      setIsConnected(connected);

      if (connected) {
        setLastOnlineAt(Date.now());
      }

      return connected;
    } catch {
      setIsConnected(false);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [pingUrl]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Check actual connectivity when browser says we're online
      checkConnectivity();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkConnectivity]);

  // Periodic connectivity checks when online
  useEffect(() => {
    if (!isOnline) {
      return;
    }

    // Initial check
    checkConnectivity();

    // Set up interval for periodic checks
    intervalRef.current = window.setInterval(() => {
      checkConnectivity();
    }, checkInterval);

    return () => {
      if (intervalRef.current !== undefined) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isOnline, checkInterval, checkConnectivity]);

  // Track online state changes for potential toast notifications
  useEffect(() => {
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = isConnected;

    // Could trigger reconnect notification here if needed
    if (!wasOnline && isConnected) {
      // Back online - could show toast via callback
    }
  }, [isConnected]);

  return {
    isOnline,
    isConnected,
    lastOnlineAt,
    isChecking,
  };
}

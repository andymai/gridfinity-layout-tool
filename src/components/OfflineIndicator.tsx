import { useState, useEffect, useRef, useCallback } from 'react';

type IndicatorState = 'hidden' | 'offline' | 'reconnected';

/**
 * A subtle indicator that appears when the user is offline.
 * Shows when going offline and briefly shows "back online" when reconnecting.
 *
 * Uses window event listeners directly to avoid effect-setState patterns.
 */
export function OfflineIndicator() {
  const [state, setState] = useState<IndicatorState>(() =>
    navigator.onLine ? 'hidden' : 'offline'
  );
  const timeoutRef = useRef<number | undefined>(undefined);

  // Handle online event
  const handleOnline = useCallback(() => {
    // Clear any pending timeout
    if (timeoutRef.current !== undefined) {
      clearTimeout(timeoutRef.current);
    }

    // Show reconnected message
    setState('reconnected');

    // Hide after a delay
    timeoutRef.current = window.setTimeout(() => {
      setState('hidden');
    }, 3000);
  }, []);

  // Handle offline event
  const handleOffline = useCallback(() => {
    // Clear any pending timeout
    if (timeoutRef.current !== undefined) {
      clearTimeout(timeoutRef.current);
    }

    setState('offline');
  }, []);

  // Subscribe to online/offline events
  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleOnline, handleOffline]);

  if (state === 'hidden') {
    return null;
  }

  const isReconnected = state === 'reconnected';

  return (
    <div
      className={`
        fixed top-0 left-0 right-0 z-50
        flex items-center justify-center gap-2
        py-1.5 text-xs font-medium text-on-dark
        transition-colors duration-300
        ${isReconnected ? 'bg-success/90' : 'bg-warning/90'}
      `}
      role="status"
      aria-live="polite"
    >
      {isReconnected ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Back online</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
            />
          </svg>
          <span>You're offline - changes are saved locally</span>
        </>
      )}
    </div>
  );
}

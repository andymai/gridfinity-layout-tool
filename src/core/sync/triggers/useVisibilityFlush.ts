import { useEffect } from 'react';
import { flushNow } from '../engine';

/**
 * Drain the outbox when the page hides — bypasses the 3s debounce in
 * case the next thing the user does is close the tab.
 */
export function useVisibilityFlush(): void {
  useEffect(() => {
    const onVisibility = (): void => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        void flushNow();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}

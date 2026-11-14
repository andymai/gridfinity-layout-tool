import { useEffect } from 'react';

/**
 * Asks before the tab closes or reloads while `active` is true. The listener
 * exists only while active: a standing `beforeunload` listener keeps Firefox
 * from putting the page in the back/forward cache.
 */
export function useBeforeUnloadGuard(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    const guard = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };

    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [active]);
}

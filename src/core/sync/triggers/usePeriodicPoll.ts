import { useEffect } from 'react';
import { useSessionStore } from '../session/useSession';
import { pullNow } from '../poller';
import type { SyncAdapters } from '../adapters/types';

const POLL_INTERVAL_MS = 45_000;

/**
 * Run a manifest pull every 45 seconds while the tab is visible, plus
 * an immediate pull when the tab regains focus. Hidden tabs never poll
 * — they catch up on the next visibility flip. Anonymous and unknown
 * sessions skip the poll entirely; the manifest endpoint requires auth
 * and would otherwise log a 401 console error on every page load.
 */
export function usePeriodicPoll(adapters: SyncAdapters): void {
  const status = useSessionStore((s) => s.status);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let timer: number | undefined;

    const schedule = (): void => {
      if (timer !== undefined) clearInterval(timer);
      timer = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          void pullNow(adapters);
        }
      }, POLL_INTERVAL_MS);
    };

    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        void pullNow(adapters);
        schedule();
      } else if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    };

    if (document.visibilityState === 'visible') {
      void pullNow(adapters);
      schedule();
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (timer !== undefined) clearInterval(timer);
    };
  }, [adapters, status]);
}

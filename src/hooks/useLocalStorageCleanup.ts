/**
 * Hook to clean up stale localStorage layout backup copies.
 *
 * After IndexedDB migration, layout data exists in both IndexedDB and
 * localStorage. Since async saves now go only to IndexedDB, the localStorage
 * copies are stale waste. This hook runs once per session to remove
 * confirmed copies, reclaiming the ~5 MB localStorage quota.
 *
 * Modeled on useStorageMigration — runs once, non-blocking, idempotent.
 */

import { useEffect, useRef } from 'react';
import { cleanupLocalStorageBackups } from '@/core/storage/localStorageCleanup';
import { scheduleIdleCallback, cancelIdleCallback } from '@/shared/utils';

let cleanupAttempted = false;

/**
 * Run localStorage cleanup during idle time after app startup.
 * Call once in App.tsx.
 */
export function useLocalStorageCleanup(): void {
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current || cleanupAttempted) return;
    hasRun.current = true;
    cleanupAttempted = true;

    const handle = scheduleIdleCallback(
      () => {
        void cleanupLocalStorageBackups()
          .then((stats) => {
            if (stats && stats.removedCount > 0) {
              const freedKB = Math.round(stats.freedBytes / 1024);
              console.warn(
                `[Storage] Cleaned ${stats.removedCount} localStorage backup(s), freed ~${freedKB} KB`
              );
            }
          })
          .catch((error: unknown) => {
            console.warn('[Storage] localStorage cleanup failed:', error);
          });
      },
      { timeout: 10_000 }
    );

    return () => cancelIdleCallback(handle);
  }, []);
}

/**
 * Hook to recover layout data from IndexedDB after localStorage loss.
 *
 * When localStorage loses a layout's data (quota exceeded, storage pressure,
 * tab crash mid-write) but IndexedDB retains it, initializeLayoutLibrary()
 * creates an empty "Recovered layout" placeholder. This hook runs once per
 * session during idle time to check IndexedDB for the real layout data
 * and restore it if found.
 *
 * Modeled on useStorageMigration — runs once, non-blocking, idempotent.
 */

import { useEffect, useRef } from 'react';
import { loadLayoutAsync } from '@/core/storage';
import { computePreview } from '@/core/storage/LayoutManager';
import { useLayoutStore, useLibraryStore } from '@/core/store';
import { useToastStore } from '@/core/store/toast';
import { scheduleIdleCallback, cancelIdleCallback } from '@/shared/utils';
import { useTranslation } from '@/i18n';

let recoveryAttempted = false;

/**
 * Attempt IndexedDB recovery after a blank "Recovered layout" was created
 * during synchronous initialization.
 *
 * @param needsRecovery - Whether the init path flagged this session for recovery
 * @param originalLayoutIds - Layout IDs from before the library was overwritten;
 *   these are the keys that may still exist in IndexedDB
 */
export function useIndexedDBRecovery(needsRecovery: boolean, originalLayoutIds: string[]): void {
  const hasRun = useRef(false);
  const t = useTranslation();

  useEffect(() => {
    if (!needsRecovery || hasRun.current || recoveryAttempted) return;
    hasRun.current = true;
    recoveryAttempted = true;

    const runRecovery = async () => {
      try {
        // Scan the original layout IDs — IndexedDB may still have data
        // under these keys even though localStorage lost them.
        for (const originalId of originalLayoutIds) {
          const recovered = await loadLayoutAsync(originalId);

          if (recovered) {
            const activeLayoutId = useLibraryStore.getState().library.activeLayoutId;
            useLayoutStore.getState().importLayout(recovered, activeLayoutId, 'init');

            // Update library entry metadata to match the recovered layout
            useLibraryStore.getState().updateEntry(activeLayoutId, {
              name: recovered.name || 'Recovered layout',
              preview: computePreview(recovered),
              modifiedAt: Date.now(),
            });

            useToastStore.getState().addToast(t('toast.layoutRecovered'), 'success');
            return;
          }
        }
      } catch {
        // IndexedDB unavailable — the blank recovered layout stays
      }
    };

    const handle = scheduleIdleCallback(() => void runRecovery(), { timeout: 5000 });

    return () => cancelIdleCallback(handle);
  }, [needsRecovery, originalLayoutIds, t]);
}

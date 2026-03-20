/**
 * Hook that gathers storage usage information for the Storage settings tab.
 *
 * Fetches:
 * - Storage backend type (IndexedDB or localStorage)
 * - localStorage usage percentage
 * - IndexedDB estimated size (via Storage API)
 * - Layout and snapshot counts
 */

import { useState, useEffect } from 'react';
import { useLibraryStore } from '@/core/store';
import { getStorageBackend, getStorageUsage } from '@/core/storage';

export interface StorageInfo {
  /** Which backend is active for async operations */
  backend: 'indexeddb' | 'localstorage' | null;
  /** localStorage usage percentage (0–100) */
  localStoragePercent: number;
  /** Estimated IndexedDB size in bytes, or null if unavailable */
  indexedDBBytes: number | null;
  /** Total storage quota in bytes, or null if unavailable */
  quotaBytes: number | null;
  /** Number of layouts in the library */
  layoutCount: number;
  /** Whether async data is still loading */
  loading: boolean;
}

/**
 * Gather storage metrics for the Settings dashboard.
 */
export function useStorageInfo(): StorageInfo {
  const layoutCount = useLibraryStore((state) => state.library.entries.length);

  const [info, setInfo] = useState<StorageInfo>({
    backend: null,
    localStoragePercent: getStorageUsage(),
    indexedDBBytes: null,
    quotaBytes: null,
    layoutCount,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchInfo = async () => {
      const backend = await getStorageBackend();

      let indexedDBBytes: number | null = null;
      let quotaBytes: number | null = null;

      // Use Storage API to estimate IndexedDB usage
      try {
        const estimate = await navigator.storage.estimate();
        indexedDBBytes = estimate.usage ?? null;
        quotaBytes = estimate.quota ?? null;
      } catch {
        // Storage API unavailable in this browser
      }

      if (!cancelled) {
        setInfo({
          backend,
          localStoragePercent: getStorageUsage(),
          indexedDBBytes,
          quotaBytes,
          layoutCount,
          loading: false,
        });
      }
    };

    void fetchInfo();

    return () => {
      cancelled = true;
    };
  }, [layoutCount]);

  return info;
}

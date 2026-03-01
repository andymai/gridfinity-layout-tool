/**
 * Cleanup utility for removing localStorage layout backup copies.
 *
 * After IndexedDB migration, layout data exists in both IndexedDB and
 * localStorage. Since async saves now go only to IndexedDB, the localStorage
 * copies are stale and waste the ~5 MB quota.
 *
 * This module provides a one-time cleanup that:
 * 1. Verifies each localStorage layout exists in IndexedDB
 * 2. Removes confirmed copies from localStorage
 * 3. Sets a flag to avoid re-running
 *
 * Safety: The sync init path (initializeLayoutLibrary) may still read from
 * localStorage if a layout hasn't been saved via IndexedDB yet (e.g. freshly
 * created during init). Only copies that are confirmed in IndexedDB are removed.
 */

import * as localStorage from './backends/localStorage';
import * as indexedDB from './backends/indexedDB';
import { isIndexedDBAvailable } from './backends/indexedDB';
import { LAYOUT_KEY_PREFIX, CLEANUP_FLAG_KEY } from './storageKeys';

function getCleanupFlag(): boolean {
  try {
    return window.localStorage.getItem(CLEANUP_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

function setCleanupFlag(): void {
  try {
    window.localStorage.setItem(CLEANUP_FLAG_KEY, 'true');
  } catch {
    // Best-effort — flag avoids redundant work but isn't critical
  }
}

function removeCleanupFlag(): void {
  try {
    window.localStorage.removeItem(CLEANUP_FLAG_KEY);
  } catch {
    // Best-effort
  }
}

function getLocalStorageValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export interface CleanupStats {
  removedCount: number;
  keptCount: number;
  freedBytes: number;
}

/**
 * Remove localStorage layout copies that are confirmed in IndexedDB.
 *
 * Returns cleanup statistics, or null if cleanup was skipped
 * (already done, IndexedDB unavailable, or no copies to clean).
 */
export async function cleanupLocalStorageBackups(): Promise<CleanupStats | null> {
  // Skip if already cleaned this browser
  if (getCleanupFlag()) {
    return null;
  }

  // Only clean when IndexedDB is available
  if (!(await isIndexedDBAvailable())) {
    return null;
  }

  // Get layout keys from both backends
  const localStorageIds = localStorage.getAllLayoutIds(LAYOUT_KEY_PREFIX);

  if (localStorageIds.length === 0) {
    // Nothing to clean — set flag and return
    setCleanupFlag();
    return null;
  }

  const stats: CleanupStats = {
    removedCount: 0,
    keptCount: 0,
    freedBytes: 0,
  };

  for (const layoutId of localStorageIds) {
    const prefixedKey = `${LAYOUT_KEY_PREFIX}${layoutId}`;
    // Verify the layout actually loads from IndexedDB (not just key exists)
    // to avoid deleting localStorage backup when IndexedDB data is corrupt.
    const loaded = await indexedDB.loadLayout(prefixedKey);
    if (loaded) {
      // Confirmed readable in IndexedDB — safe to remove localStorage copy
      const value = getLocalStorageValue(prefixedKey);
      if (value) {
        stats.freedBytes += (prefixedKey.length + value.length) * 2; // UTF-16
      }
      localStorage.deleteFromLocalStorage(prefixedKey);
      stats.removedCount++;
    } else {
      // Not in IndexedDB or corrupt — keep the localStorage copy
      stats.keptCount++;
    }
  }

  // Only mark as done when all copies were cleaned; if some were kept
  // (not yet in IndexedDB), re-run next session to clean the rest.
  if (stats.keptCount === 0) {
    setCleanupFlag();
  }

  return stats;
}

/**
 * Clear the cleanup flag (for testing or re-running cleanup).
 */
export function clearCleanupFlag(): void {
  removeCleanupFlag();
}

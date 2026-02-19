/**
 * Hook to manage storage migration from localStorage to IndexedDB.
 *
 * This hook runs the migration on app startup (once per app lifecycle).
 * The migration is idempotent - it only runs if needed and won't
 * duplicate data.
 *
 * Migration strategy:
 * - Runs in background (doesn't block app startup)
 * - Individual layouts are moved to IndexedDB
 * - Library index is migrated to IndexedDB (cross-tab sync via BroadcastChannel)
 * - A flag tracks completion to avoid re-running
 * - localStorage backup copies are cleaned separately by useLocalStorageCleanup
 */

import { useEffect, useRef } from 'react';
import {
  migrateAllLayoutsToIndexedDB,
  isMigrationNeeded,
  runLocalStorageMigrations,
} from '@/core/storage';
import { initLabelSizesCache } from '@/shared/analytics/purposeInference';

// Track if migration has been attempted this session
let migrationAttempted = false;

/**
 * Run storage migration on app startup.
 * Call this hook once in App.tsx.
 *
 * @returns void - Migration runs in background, no return value needed
 */
export function useStorageMigration(): void {
  const hasRun = useRef(false);

  useEffect(() => {
    // Only run once per component lifecycle and once per session
    if (hasRun.current || migrationAttempted) return;
    hasRun.current = true;
    migrationAttempted = true;

    const runMigration = async () => {
      try {
        // Run one-time localStorage consolidation migrations
        await runLocalStorageMigrations();

        // Hydrate ML label sizes cache from IndexedDB
        await initLabelSizesCache();

        // Check if layout migration is needed
        if (!(await isMigrationNeeded())) return;

        console.warn('[Storage] Starting migration to IndexedDB...');

        const result = await migrateAllLayoutsToIndexedDB();

        if (result.success) {
          // localStorage backup copies are cleaned up separately by
          // useLocalStorageCleanup, which verifies each layout exists in
          // IndexedDB before removing the localStorage copy.
          console.warn(
            `[Storage] Migration complete: ${result.migratedCount} layouts migrated, ${result.skippedCount} skipped`
          );
        } else {
          console.error('[Storage] Migration failed:', result.errors);
        }
      } catch (error) {
        console.error('[Storage] Migration error:', error);
        // Don't throw - app should continue working with localStorage fallback
      }
    };

    // Defer migration to avoid blocking initial render
    const schedule =
      'requestIdleCallback' in window
        ? (fn: () => void) => window.requestIdleCallback(fn, { timeout: 5000 })
        : (fn: () => void) => setTimeout(fn, 100);

    schedule(() => void runMigration());
  }, []);
}

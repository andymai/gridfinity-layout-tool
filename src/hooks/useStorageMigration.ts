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
 * - Library index stays in localStorage (small, needs cross-tab sync)
 * - A flag tracks completion to avoid re-running
 */

import { useEffect, useRef } from 'react';
import {
  migrateAllLayoutsToIndexedDB,
  isMigrationNeeded,
  // cleanupLocalStorage - uncomment when ready to remove localStorage fallback
} from '../utils/migration';
import { getStorageBackend } from '../utils/asyncStorage';

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
        // Check if migration is needed
        const needed = await isMigrationNeeded();

        if (!needed) {
          // Log which backend we're using
          const backend = await getStorageBackend();
          console.warn(`[Storage] Using ${backend} backend`);
          return;
        }

        console.warn('[Storage] Starting migration to IndexedDB...');

        const result = await migrateAllLayoutsToIndexedDB();

        if (result.success) {
          console.warn(
            `[Storage] Migration complete: ${result.migratedCount} layouts migrated, ${result.skippedCount} skipped`
          );

          // Note: We intentionally keep localStorage copies for now as a fallback.
          // This ensures backwards compatibility while sync load operations
          // still read from localStorage. The cleanup will happen in a future
          // version once we're confident all load operations use IndexedDB.
          // TODO: Enable cleanup once loadLayoutById is fully async
          // if (result.migratedCount > 0) {
          //   const cleaned = cleanupLocalStorage();
          //   console.info(`[Storage] Cleaned ${cleaned} layouts from localStorage`);
          // }
        } else {
          console.error('[Storage] Migration failed:', result.errors);
        }
      } catch (error) {
        console.error('[Storage] Migration error:', error);
        // Don't throw - app should continue working with localStorage fallback
      }
    };

    // Run migration after a short delay to not block initial render
    // Using requestIdleCallback if available for better UX
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => runMigration(), { timeout: 5000 });
    } else {
      setTimeout(runMigration, 100);
    }
  }, []);
}

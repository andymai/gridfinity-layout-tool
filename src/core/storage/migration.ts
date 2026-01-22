/**
 * Migration utilities for moving layout data from localStorage to IndexedDB.
 *
 * This module handles the one-time migration of existing layout data to the
 * new IndexedDB storage system, which provides much larger capacity (50MB+
 * vs 5MB) and better performance for large datasets.
 *
 * Migration strategy:
 * - Individual layouts are moved to IndexedDB
 * - Library index stays in localStorage (small, needs cross-tab sync)
 * - Migration is idempotent (safe to run multiple times)
 * - A flag tracks completion to avoid re-running
 */

import * as backend from './backend';
import * as localStorage from './backends/localStorage';
import * as indexedDB from './backends/indexedDB';
import type { Layout } from '@/core/types';
import type { Result, Unit, StorageError } from '@/core/result';
import {
  ok,
  err,
  OK,
  isOk,
  storageNotFound,
  storageUnavailable,
  storageNetworkError,
} from '@/core/result';

// Storage keys
const LAYOUT_KEY_PREFIX = 'gridfinity-layout-';
const MIGRATION_FLAG_KEY = 'gridfinity-indexeddb-migrated';

// Result types
interface MigrationResult {
  success: boolean;
  error?: string;
}

interface BulkMigrationResult {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errors: string[];
}

interface MigrationStatus {
  localStorageCount: number;
  indexedDBCount: number;
  migrationComplete: boolean;
}

/**
 * Statistics returned by bulk migration Result functions.
 */
export interface MigrationStats {
  migratedCount: number;
  skippedCount: number;
}

/**
 * Get all layout IDs from localStorage.
 */
function getLocalStorageLayoutIds(): string[] {
  return localStorage.getAllLayoutIds(LAYOUT_KEY_PREFIX);
}

/**
 * Load a layout from localStorage by ID.
 */
function loadLayoutFromLocalStorage(layoutId: string): Layout | null {
  const key = `${LAYOUT_KEY_PREFIX}${layoutId}`;
  return localStorage.loadLayout(key);
}

/**
 * Check if migration from localStorage to IndexedDB is needed.
 */
export async function isMigrationNeeded(): Promise<boolean> {
  // Check if migration has already been completed
  if (window.localStorage.getItem(MIGRATION_FLAG_KEY) === 'true') {
    return false;
  }

  // Check if IndexedDB is available
  if (!(await backend.isIndexedDBAvailable())) {
    return false;
  }

  // Check if there are layouts in localStorage that need migration
  const localStorageIds = getLocalStorageLayoutIds();
  return localStorageIds.length > 0;
}

/**
 * Migrate a single layout from localStorage to IndexedDB.
 */
export async function migrateLayoutToIndexedDB(layoutId: string): Promise<MigrationResult> {
  try {
    // Load from localStorage
    const layout = loadLayoutFromLocalStorage(layoutId);

    if (!layout) {
      return {
        success: false,
        error: `Layout ${layoutId} not found in localStorage or failed to parse`,
      };
    }

    // Save to IndexedDB
    await indexedDB.saveLayout(layoutId, layout);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to migrate layout ${layoutId}: ${(error as Error).message}`,
    };
  }
}

/**
 * Migrate all layouts from localStorage to IndexedDB.
 * This is the main migration function to call during app initialization.
 */
export async function migrateAllLayoutsToIndexedDB(): Promise<BulkMigrationResult> {
  const result: BulkMigrationResult = {
    success: true,
    migratedCount: 0,
    skippedCount: 0,
    errors: [],
  };

  // Check if IndexedDB is available
  if (!(await backend.isIndexedDBAvailable())) {
    return {
      ...result,
      success: false,
      errors: ['IndexedDB is not available'],
    };
  }

  // Get all layout IDs from localStorage
  const localStorageIds = getLocalStorageLayoutIds();

  if (localStorageIds.length === 0) {
    // Nothing to migrate, but set flag to skip future checks
    window.localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    return result;
  }

  // Get existing IndexedDB layout IDs to avoid overwriting
  const indexedDBIds = new Set(await backend.getIndexedDBLayoutIds());

  // Migrate each layout
  for (const layoutId of localStorageIds) {
    // Skip if already in IndexedDB
    if (indexedDBIds.has(layoutId)) {
      result.skippedCount++;
      continue;
    }

    const migrationResult = await migrateLayoutToIndexedDB(layoutId);

    if (migrationResult.success) {
      result.migratedCount++;
    } else {
      result.errors.push(migrationResult.error || `Unknown error for ${layoutId}`);
    }
  }

  // Set migration flag
  window.localStorage.setItem(MIGRATION_FLAG_KEY, 'true');

  return result;
}

/**
 * Get the current migration status.
 */
export async function getMigrationStatus(): Promise<MigrationStatus> {
  const localStorageIds = getLocalStorageLayoutIds();

  let indexedDBIds: string[] = [];
  try {
    indexedDBIds = await backend.getIndexedDBLayoutIds();
  } catch {
    // IndexedDB not available
  }

  return {
    localStorageCount: localStorageIds.length,
    indexedDBCount: indexedDBIds.length,
    migrationComplete: window.localStorage.getItem(MIGRATION_FLAG_KEY) === 'true',
  };
}

/**
 * Clear the migration flag (for testing or re-migration).
 */
export function clearMigrationFlag(): void {
  window.localStorage.removeItem(MIGRATION_FLAG_KEY);
}

// =============================================================================
// Result-Based Migration Functions
// =============================================================================

/**
 * Migrate a single layout from localStorage to IndexedDB with Result-based error handling.
 *
 * @example
 * ```ts
 * const result = await migrateLayoutToIndexedDBResult('layout-123');
 * if (isOk(result)) {
 *   console.log('Migration succeeded');
 * } else {
 *   console.error(getUserMessage(result.error));
 * }
 * ```
 */
export async function migrateLayoutToIndexedDBResult(
  layoutId: string
): Promise<Result<Unit, StorageError>> {
  try {
    // Load from localStorage
    const layout = loadLayoutFromLocalStorage(layoutId);

    if (!layout) {
      return err(storageNotFound(`${LAYOUT_KEY_PREFIX}${layoutId}`));
    }

    // Save to IndexedDB
    await indexedDB.saveLayout(layoutId, layout);

    return OK;
  } catch (error) {
    return err(storageNetworkError(error));
  }
}

/**
 * Migrate all layouts from localStorage to IndexedDB with Result-based error handling.
 * This is the main migration function to call during app initialization.
 *
 * Returns Ok with migration statistics on success, or Err if IndexedDB is unavailable.
 * Individual layout migration failures are tracked but don't cause overall failure.
 *
 * @example
 * ```ts
 * const result = await migrateAllLayoutsToIndexedDBResult();
 * if (isOk(result)) {
 *   const { migratedCount, skippedCount } = result.value;
 *   console.log(`Migrated ${migratedCount}, skipped ${skippedCount}`);
 * } else {
 *   console.error(getUserMessage(result.error));
 * }
 * ```
 */
export async function migrateAllLayoutsToIndexedDBResult(): Promise<
  Result<MigrationStats, StorageError>
> {
  const stats: MigrationStats = {
    migratedCount: 0,
    skippedCount: 0,
  };

  // Check if IndexedDB is available
  if (!(await backend.isIndexedDBAvailable())) {
    return err(storageUnavailable('indexedDB'));
  }

  // Get all layout IDs from localStorage
  const localStorageIds = getLocalStorageLayoutIds();

  if (localStorageIds.length === 0) {
    // Nothing to migrate, but set flag to skip future checks
    window.localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    return ok(stats);
  }

  // Get existing IndexedDB layout IDs to avoid overwriting
  const indexedDBIds = new Set(await backend.getIndexedDBLayoutIds());

  // Migrate each layout
  for (const layoutId of localStorageIds) {
    // Skip if already in IndexedDB
    if (indexedDBIds.has(layoutId)) {
      stats.skippedCount++;
      continue;
    }

    const migrationResult = await migrateLayoutToIndexedDBResult(layoutId);

    if (isOk(migrationResult)) {
      stats.migratedCount++;
    }
    // Note: Individual failures are silently skipped - use legacy API for error details
  }

  // Set migration flag
  window.localStorage.setItem(MIGRATION_FLAG_KEY, 'true');

  return ok(stats);
}

/**
 * Get the current migration status with Result-based error handling.
 * This function doesn't fail, but uses Result for consistency with other migration APIs.
 */
export async function getMigrationStatusResult(): Promise<Result<MigrationStatus, StorageError>> {
  const localStorageIds = getLocalStorageLayoutIds();

  let indexedDBIds: string[] = [];
  try {
    indexedDBIds = await backend.getIndexedDBLayoutIds();
  } catch {
    // IndexedDB not available - return status without indexedDB count
    return ok({
      localStorageCount: localStorageIds.length,
      indexedDBCount: 0,
      migrationComplete: window.localStorage.getItem(MIGRATION_FLAG_KEY) === 'true',
    });
  }

  return ok({
    localStorageCount: localStorageIds.length,
    indexedDBCount: indexedDBIds.length,
    migrationComplete: window.localStorage.getItem(MIGRATION_FLAG_KEY) === 'true',
  });
}

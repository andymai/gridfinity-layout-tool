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

import {
  saveLayout as saveToIndexedDB,
  getAllLayoutIds as getIndexedDBLayoutIds,
  isIndexedDBAvailable,
} from './indexedDB';
import type { Layout } from '../types';

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
 * Get all layout IDs from localStorage.
 */
function getLocalStorageLayoutIds(): string[] {
  const ids: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LAYOUT_KEY_PREFIX)) {
      // Extract ID from key
      const id = key.slice(LAYOUT_KEY_PREFIX.length);
      ids.push(id);
    }
  }

  return ids;
}

/**
 * Load a layout from localStorage by ID.
 */
function loadLayoutFromLocalStorage(layoutId: string): Layout | null {
  const key = `${LAYOUT_KEY_PREFIX}${layoutId}`;
  const stored = localStorage.getItem(key);

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as Layout;
  } catch {
    return null;
  }
}

/**
 * Check if migration from localStorage to IndexedDB is needed.
 */
export async function isMigrationNeeded(): Promise<boolean> {
  // Check if migration has already been completed
  if (localStorage.getItem(MIGRATION_FLAG_KEY) === 'true') {
    return false;
  }

  // Check if IndexedDB is available
  if (!(await isIndexedDBAvailable())) {
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
    await saveToIndexedDB(layoutId, layout);

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
  if (!(await isIndexedDBAvailable())) {
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
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    return result;
  }

  // Get existing IndexedDB layout IDs to avoid overwriting
  const indexedDBIds = new Set(await getIndexedDBLayoutIds());

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
  localStorage.setItem(MIGRATION_FLAG_KEY, 'true');

  return result;
}

/**
 * Get the current migration status.
 */
export async function getMigrationStatus(): Promise<MigrationStatus> {
  const localStorageIds = getLocalStorageLayoutIds();

  let indexedDBIds: string[] = [];
  try {
    indexedDBIds = await getIndexedDBLayoutIds();
  } catch {
    // IndexedDB not available
  }

  return {
    localStorageCount: localStorageIds.length,
    indexedDBCount: indexedDBIds.length,
    migrationComplete: localStorage.getItem(MIGRATION_FLAG_KEY) === 'true',
  };
}

/**
 * Clear the migration flag (for testing or re-migration).
 */
export function clearMigrationFlag(): void {
  localStorage.removeItem(MIGRATION_FLAG_KEY);
}

/**
 * Remove migrated layouts from localStorage (optional cleanup).
 * Only call this after confirming migration was successful.
 */
export function cleanupLocalStorage(): number {
  const ids = getLocalStorageLayoutIds();
  let cleaned = 0;

  for (const id of ids) {
    const key = `${LAYOUT_KEY_PREFIX}${id}`;
    localStorage.removeItem(key);
    cleaned++;
  }

  return cleaned;
}

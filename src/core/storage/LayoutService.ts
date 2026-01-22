/**
 * Layout Service - all layout and library CRUD operations.
 *
 * This module provides the primary interface for managing layouts:
 * - Async operations (saveLayoutAsync, loadLayoutAsync): Runtime use
 * - Sync operations (saveLayoutSync, loadLayoutSync): Initialization only
 * - Library management (saveLibrary, loadLibrary, initializeLayoutLibrary)
 * - Result-based operations (*Result suffix): Type-safe error handling
 *
 * Naming convention:
 * - *Async suffix: Uses IndexedDB + localStorage dual-write, returns Promise
 * - *Sync suffix: Uses localStorage only, synchronous
 * - *Result suffix: Returns Result<T, StorageError> for explicit error handling
 */

import * as backend from './backend';
import { validateImport } from '@/shared/utils/validation';
import { generateId } from '@/core/constants';
import { generateLayoutId } from '@/shared/utils';
import { computePreview } from './LayoutManager';
import type {
  Layout,
  LayoutLibrary,
  LayoutEntry,
} from '@/core/types';
import type { Result } from '@/core/result';
import type { StorageError } from '@/core/result';
import {
  ok,
  err,
  tryCatchAsync,
  storageNotFound,
  storageCorrupted,
  storageUnavailable,
} from '@/core/result';
import { createStorageErrorClassifier, classifyStorageError } from './errorUtils';

// Storage keys
const LEGACY_STORAGE_KEY = 'gridfinity-layout-v1';
const LIBRARY_STORAGE_KEY = 'gridfinity-library-v1';
const LAYOUT_KEY_PREFIX = 'gridfinity-layout-';

/**
 * Get the storage key for a specific layout by ID.
 */
export function getLayoutStorageKey(layoutId: string): string {
  return `${LAYOUT_KEY_PREFIX}${layoutId}`;
}

/**
 * Get storage usage percentage (0-100).
 */
export function getStorageUsage(): number {
  return backend.getStorageUsagePercent();
}

// === Schema Migration ===

/**
 * Migrate old layout data to current schema.
 * Adds default values for any missing fields.
 */
function migrateLayout(data: Record<string, unknown>): Record<string, unknown> {
  if (data.gridUnitMm === undefined) {
    data.gridUnitMm = 42;
  }
  if (data.heightUnitMm === undefined) {
    data.heightUnitMm = 7;
  }
  // Migrate maxPrintSize (grid units) -> printBedSize (mm)
  const gridUnitMm = (data.gridUnitMm as number) || 42;
  if (data.maxPrintSize !== undefined && data.printBedSize === undefined) {
    data.printBedSize = (data.maxPrintSize as number) * gridUnitMm;
    delete data.maxPrintSize;
  }
  // Fix if printBedSize was saved in grid units (< 42 means it's probably not in mm)
  if (data.printBedSize !== undefined && (data.printBedSize as number) < 42) {
    data.printBedSize = (data.printBedSize as number) * gridUnitMm;
  }
  if (data.printBedSize === undefined) {
    data.printBedSize = 256; // Default 256mm
  }
  return data;
}

// === Async Layout Operations (Primary API) ===

/**
 * Save a layout asynchronously using dual-write pattern.
 * Uses IndexedDB as primary with localStorage backup.
 */
export async function saveLayoutAsync(layoutId: string, layout: Layout): Promise<void> {
  const key = getLayoutStorageKey(layoutId);
  await backend.saveAsync(key, layout);
}

/**
 * Load a layout asynchronously.
 * Tries IndexedDB first, falls back to localStorage.
 */
export async function loadLayoutAsync(layoutId: string): Promise<Layout | null> {
  const key = getLayoutStorageKey(layoutId);
  const data = await backend.loadAsync(key);

  if (!data) return null;

  const migrated = migrateLayout(data as unknown as Record<string, unknown>);
  const validation = validateImport(migrated);

  if (!validation.valid) {
    console.warn(`Layout ${layoutId} failed validation:`, validation.errors);
    return null;
  }

  return migrated as unknown as Layout;
}

/**
 * Delete a layout asynchronously from both storage backends.
 */
export async function deleteLayoutAsync(layoutId: string): Promise<void> {
  const key = getLayoutStorageKey(layoutId);
  await backend.deleteAsync(key);
}

// === Result-Based Async Operations ===
// These functions return Result<T, StorageError> for explicit error handling.
// Use these when you need detailed error information for user feedback.

/**
 * Save a layout asynchronously with Result-based error handling.
 * Returns Ok on success, or Err with specific StorageError on failure.
 *
 * @example
 * ```ts
 * const result = await saveLayoutResult(id, layout);
 * if (isErr(result)) {
 *   addToast(getUserMessage(result.error), 'error');
 * }
 * ```
 */
export async function saveLayoutResult(
  layoutId: string,
  layout: Layout
): Promise<Result<void, StorageError>> {
  const key = getLayoutStorageKey(layoutId);

  return tryCatchAsync(
    () => backend.saveAsync(key, layout),
    createStorageErrorClassifier('indexedDB')
  );
}

/**
 * Load a layout asynchronously with Result-based error handling.
 * Returns Ok with the layout, or Err with specific StorageError.
 *
 * Unlike loadLayoutAsync which returns null for both "not found" and "corrupted",
 * this function distinguishes between these cases for better error handling.
 *
 * @example
 * ```ts
 * const result = await loadLayoutResult(id);
 * match(result, {
 *   ok: (layout) => setLayout(layout),
 *   err: (error) => {
 *     if (error.code === 'STORAGE_NOT_FOUND') {
 *       // Handle missing layout
 *     } else if (error.code === 'STORAGE_CORRUPTED') {
 *       // Offer recovery options
 *     }
 *   }
 * });
 * ```
 */
export async function loadLayoutResult(
  layoutId: string
): Promise<Result<Layout, StorageError>> {
  const key = getLayoutStorageKey(layoutId);

  let data: Layout | null;
  try {
    data = await backend.loadAsync(key);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('unavailable') || message.includes('SecurityError')) {
      return err(storageUnavailable('indexedDB', error));
    }

    return err(storageUnavailable('indexedDB', error));
  }

  if (!data) {
    return err(storageNotFound(key));
  }

  const migrated = migrateLayout(data as unknown as Record<string, unknown>);
  const validation = validateImport(migrated);

  if (!validation.valid) {
    return err(storageCorrupted(key, validation.errors));
  }

  return ok(migrated as unknown as Layout);
}

/**
 * Delete a layout asynchronously with Result-based error handling.
 * Returns Ok on success (including when layout doesn't exist).
 */
export async function deleteLayoutResult(
  layoutId: string
): Promise<Result<void, StorageError>> {
  const key = getLayoutStorageKey(layoutId);

  return tryCatchAsync(
    () => backend.deleteAsync(key),
    (error): StorageError => {
      return storageUnavailable('indexedDB', error);
    }
  );
}

// === Sync Layout Operations (Initialization Only) ===

/**
 * Save a layout synchronously to localStorage.
 * Use only during initialization when async is not available.
 * @throws Error if storage is full
 */
export function saveLayoutSync(layoutId: string, layout: Layout): void {
  const key = getLayoutStorageKey(layoutId);
  backend.saveSync(key, layout);
}

/**
 * Load a layout synchronously from localStorage.
 * Use only during initialization.
 */
export function loadLayoutSync(layoutId: string): Layout | null {
  try {
    const key = getLayoutStorageKey(layoutId);
    const data = backend.loadSync(key);

    if (!data) return null;

    const migrated = migrateLayout(data as unknown as Record<string, unknown>);
    const validation = validateImport(migrated);

    if (!validation.valid) {
      console.warn(`Layout ${layoutId} failed validation:`, validation.errors);
      return null;
    }

    return migrated as unknown as Layout;
  } catch (error) {
    console.error(`Failed to load layout ${layoutId}:`, error);
    return null;
  }
}

/**
 * Delete a layout synchronously from localStorage.
 */
export function deleteLayoutSync(layoutId: string): void {
  const key = getLayoutStorageKey(layoutId);
  backend.deleteSync(key);
}

// === Library Management ===

/**
 * Save the layout library index to localStorage.
 * @throws Error if storage is full
 */
export function saveLibrary(library: LayoutLibrary): void {
  try {
    backend.saveSyncGeneric(LIBRARY_STORAGE_KEY, library);
  } catch {
    throw new Error('Storage full. Export your layouts to save them.');
  }
}

/**
 * Save the layout library index with Result-based error handling.
 * Returns Ok on success, or Err with StorageError on failure.
 */
export function saveLibraryResult(
  library: LayoutLibrary
): Result<void, StorageError> {
  try {
    backend.saveSyncGeneric(LIBRARY_STORAGE_KEY, library);
    return ok(undefined);
  } catch (error) {
    return err(classifyStorageError(error, 'localStorage'));
  }
}

/**
 * Load the layout library index from localStorage.
 */
export function loadLibrary(): LayoutLibrary | null {
  try {
    const parsed = backend.loadSyncGeneric<LayoutLibrary>(LIBRARY_STORAGE_KEY);

    if (!parsed) return null;

    // Basic validation
    if (!parsed.version || !parsed.activeLayoutId || !Array.isArray(parsed.entries)) {
      console.warn('Invalid library format');
      return null;
    }

    // Validate each entry exists in storage (clean up orphaned entries)
    const validEntries = parsed.entries.filter((entry: LayoutEntry) => {
      const key = getLayoutStorageKey(entry.id);
      try {
        const exists = backend.loadSync(key) !== null;
        if (!exists) {
          console.warn(`Layout ${entry.id} listed in library but not found in storage, removing`);
        }
        return exists;
      } catch {
        // Corrupted JSON is treated as "not found"
        console.warn(`Layout ${entry.id} listed in library but corrupted, removing`);
        return false;
      }
    });

    // If we lost some entries, update the library
    if (validEntries.length < parsed.entries.length) {
      parsed.entries = validEntries;

      // If active layout was removed, switch to first available
      if (!validEntries.some((e: LayoutEntry) => e.id === parsed.activeLayoutId)) {
        parsed.activeLayoutId = validEntries[0]?.id || '';
      }
    }

    return parsed;
  } catch (error) {
    console.error('Failed to load library:', error);
    return null;
  }
}

/**
 * Load the layout library index with Result-based error handling.
 * Distinguishes between "not found" (no library saved yet) and "corrupted" (invalid data).
 *
 * @example
 * ```ts
 * const result = loadLibraryResult();
 * match(result, {
 *   ok: (library) => initializeStore(library),
 *   err: (error) => {
 *     if (error.code === 'STORAGE_NOT_FOUND') {
 *       // First time user, create fresh library
 *     } else if (error.code === 'STORAGE_CORRUPTED') {
 *       // Offer recovery options
 *     }
 *   }
 * });
 * ```
 */
export function loadLibraryResult(): Result<LayoutLibrary, StorageError> {
  try {
    const parsed = backend.loadSyncGeneric<LayoutLibrary>(LIBRARY_STORAGE_KEY);

    if (!parsed) {
      return err(storageNotFound(LIBRARY_STORAGE_KEY));
    }

    // Basic validation
    if (!parsed.version || !parsed.activeLayoutId || !Array.isArray(parsed.entries)) {
      return err(storageCorrupted(LIBRARY_STORAGE_KEY, ['Invalid library format: missing required fields']));
    }

    // Validate each entry exists in storage (clean up orphaned entries)
    const validEntries = parsed.entries.filter((entry: LayoutEntry) => {
      const key = getLayoutStorageKey(entry.id);
      try {
        return backend.loadSync(key) !== null;
      } catch {
        return false;
      }
    });

    // If we lost some entries, update the library
    if (validEntries.length < parsed.entries.length) {
      parsed.entries = validEntries;

      // If active layout was removed, switch to first available
      if (!validEntries.some((e: LayoutEntry) => e.id === parsed.activeLayoutId)) {
        parsed.activeLayoutId = validEntries[0]?.id || '';
      }
    }

    return ok(parsed);
  } catch (error) {
    return err(storageUnavailable('localStorage', error));
  }
}

/**
 * Compute preview data from a layout.
 * @deprecated Use computePreview from LayoutManager instead
 */
export const computeLayoutPreview = computePreview;

/**
 * Check if legacy single-layout storage exists.
 */
export function hasLegacyLayout(): boolean {
  return backend.loadSync(LEGACY_STORAGE_KEY) !== null;
}

/**
 * Migrate from legacy single-layout storage to library system.
 * Returns the migrated library, or null if no legacy layout exists.
 */
export function migrateFromLegacyStorage(): LayoutLibrary | null {
  const legacyLayout = loadLegacyLayout();
  if (!legacyLayout) return null;

  const layoutId = generateLayoutId();
  const now = Date.now();

  // Create library with single entry
  const library: LayoutLibrary = {
    version: '1.0',
    activeLayoutId: layoutId,
    settings: {},
    entries: [{
      id: layoutId,
      name: legacyLayout.name || 'Untitled layout',
      createdAt: now,
      modifiedAt: now,
      preview: computeLayoutPreview(legacyLayout),
    }],
  };

  // Save layout under new key
  saveLayoutSync(layoutId, legacyLayout);

  // Save library index
  saveLibrary(library);

  // Remove legacy key
  backend.deleteSync(LEGACY_STORAGE_KEY);

  return library;
}

/**
 * Migrate from legacy single-layout storage with Result-based error handling.
 * Returns Ok with the migrated library, or Err if migration fails.
 * Returns Ok(undefined) if no legacy layout exists (nothing to migrate).
 *
 * @example
 * ```ts
 * const result = migrateFromLegacyStorageResult();
 * match(result, {
 *   ok: (library) => library ? initializeWithLibrary(library) : createFresh(),
 *   err: (error) => {
 *     if (error.code === 'STORAGE_CORRUPTED') {
 *       console.warn('Legacy layout corrupted, starting fresh');
 *     } else {
 *       console.error('Migration failed:', getUserMessage(error));
 *     }
 *   }
 * });
 * ```
 */
export function migrateFromLegacyStorageResult(): Result<LayoutLibrary | null, StorageError> {
  // Try to load legacy layout
  let legacyData: Layout | null;
  try {
    const data = backend.loadSync(LEGACY_STORAGE_KEY);
    if (!data) return ok(null); // No legacy layout exists

    const migrated = migrateLayout(data as unknown as Record<string, unknown>);
    const validation = validateImport(migrated);

    if (!validation.valid) {
      return err(storageCorrupted(LEGACY_STORAGE_KEY, validation.errors));
    }

    legacyData = migrated as unknown as Layout;
  } catch (error) {
    return err(storageUnavailable('localStorage', error));
  }

  // Create new library from legacy layout
  const layoutId = generateLayoutId();
  const now = Date.now();

  const library: LayoutLibrary = {
    version: '1.0',
    activeLayoutId: layoutId,
    settings: {},
    entries: [{
      id: layoutId,
      name: legacyData.name || 'Untitled layout',
      createdAt: now,
      modifiedAt: now,
      preview: computeLayoutPreview(legacyData),
    }],
  };

  // Save layout and library
  try {
    saveLayoutSync(layoutId, legacyData);
    saveLibrary(library);
    backend.deleteSync(LEGACY_STORAGE_KEY);
  } catch (error) {
    return err(classifyStorageError(error, 'localStorage'));
  }

  return ok(library);
}

/**
 * Initialize the layout library system.
 * Handles migration from legacy storage if needed.
 * Returns the library and the active layout.
 *
 * Note: This function is synchronous for fast startup. It reads/writes to
 * localStorage for immediate availability. New layouts are also saved to
 * IndexedDB asynchronously for future-proofing.
 */
export function initializeLayoutLibrary(): { library: LayoutLibrary; activeLayout: Layout } {
  // Try to load existing library
  let library = loadLibrary();

  if (!library) {
    // Check for legacy storage and migrate
    library = migrateFromLegacyStorage();
  }

  if (!library) {
    // Fresh start: create new library with default layout
    const layoutId = generateLayoutId();
    const defaultLayout: Layout = {
      version: '1.0',
      name: 'Untitled layout',
      drawer: { width: 10, depth: 8, height: 12 },
      printBedSize: 256,
      gridUnitMm: 42,
      heightUnitMm: 7,
      categories: [
        { id: generateId(), name: 'Coral', color: '#f87171' },
        { id: generateId(), name: 'Sky', color: '#38bdf8' },
        { id: generateId(), name: 'Green', color: '#4ade80' },
        { id: generateId(), name: 'Cloud', color: '#e2e8f0' },
        { id: generateId(), name: 'Charcoal', color: '#334155' },
      ],
      layers: [
        { id: generateId(), name: 'Layer 1', height: 3 },
      ],
      bins: [],
    };

    library = {
      version: '1.0',
      activeLayoutId: layoutId,
      settings: {},
      entries: [{
        id: layoutId,
        name: defaultLayout.name,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        preview: computeLayoutPreview(defaultLayout),
      }],
    };

    // Save to localStorage (sync for immediate availability)
    saveLayoutSync(layoutId, defaultLayout);
    saveLibrary(library);

    // Also save to IndexedDB (async, fire-and-forget)
    saveLayoutAsync(layoutId, defaultLayout).catch(() => {
      // Ignore errors - localStorage save is sufficient for now
    });
  }

  let activeLayout = loadLayoutSync(library.activeLayoutId);

  if (!activeLayout) {
    // Active layout is missing, try to recover
    console.warn(`Active layout ${library.activeLayoutId} not found, attempting recovery`);

    // Try loading any available layout
    for (const entry of library.entries) {
      activeLayout = loadLayoutSync(entry.id);
      if (activeLayout) {
        library.activeLayoutId = entry.id;
        saveLibrary(library);
        break;
      }
    }

    // If still nothing, create a fresh default
    if (!activeLayout) {
      const layoutId = generateLayoutId();
      activeLayout = {
        version: '1.0',
        name: 'Recovered layout',
        drawer: { width: 10, depth: 8, height: 12 },
        printBedSize: 256,
        gridUnitMm: 42,
        heightUnitMm: 7,
        categories: [
          { id: generateId(), name: 'Default', color: '#6b7280' },
        ],
        layers: [
          { id: generateId(), name: 'Layer 1', height: 3 },
        ],
        bins: [],
      };

      library.activeLayoutId = layoutId;
      library.entries = [{
        id: layoutId,
        name: activeLayout.name,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        preview: computeLayoutPreview(activeLayout),
      }];

      // Save to localStorage (sync)
      saveLayoutSync(layoutId, activeLayout);
      saveLibrary(library);

      // Also save to IndexedDB (async, fire-and-forget)
      saveLayoutAsync(layoutId, activeLayout).catch(() => {
        // Ignore errors - localStorage save is sufficient for now
      });
    }
  }

  return { library, activeLayout };
}

// === Legacy API (Deprecated) ===

/**
 * Load layout from legacy single-layout storage.
 * @deprecated Use loadLayoutSync for multi-layout support.
 */
function loadLegacyLayout(): Layout | null {
  try {
    const data = backend.loadSync(LEGACY_STORAGE_KEY);
    if (!data) return null;

    const migrated = migrateLayout(data as unknown as Record<string, unknown>);
    const validation = validateImport(migrated);

    if (!validation.valid) {
      return null;
    }

    return migrated as unknown as Layout;
  } catch (error) {
    console.error('Failed to load legacy layout:', error);
    return null;
  }
}

/**
 * Save layout to legacy single-layout storage.
 * @deprecated Use saveLayoutSync for multi-layout support.
 */
export function saveLayout(layout: Layout): void {
  backend.saveSync(LEGACY_STORAGE_KEY, layout);
}

/**
 * Load layout from legacy single-layout storage.
 * @deprecated Use loadLayoutSync for multi-layout support.
 */
export function loadLayout(): Layout | null {
  return loadLegacyLayout();
}

/**
 * Clear legacy storage.
 * @deprecated Use deleteLayoutSync for multi-layout support.
 */
export function clearStorage(): void {
  backend.deleteSync(LEGACY_STORAGE_KEY);
}


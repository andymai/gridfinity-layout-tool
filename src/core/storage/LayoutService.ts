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
import { generateCategoryId, generateLayerId } from '@/core/constants';
import { generateLayoutId } from '@/shared/utils';
import { computePreview } from './LayoutManager';
import type { Layout, LayoutId, LayoutLibrary, LayoutEntry } from '@/core/types';
import type { Result, StorageError } from '@/core/result';
import {
  ok,
  err,
  isErr,
  tryCatchAsync,
  storageNotFound,
  storageCorrupted,
  storageUnavailable,
} from '@/core/result';
import { createStorageErrorClassifier } from './errorUtils';

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

/**
 * Result of parsing storage data into a Layout.
 */
type ParseResult = { success: true; layout: Layout } | { success: false; errors: string[] };

/**
 * Parse and validate raw storage data into a typed Layout.
 * Migrates the schema and validates the data structure.
 *
 * The type assertion is justified by the validateImport check which
 * verifies all required Layout properties are present and valid.
 */
function parseLayoutData(data: unknown): ParseResult {
  if (!data || typeof data !== 'object') {
    return { success: false, errors: ['No data or invalid type'] };
  }

  const migrated = migrateLayout(data as Record<string, unknown>);
  const validation = validateImport(migrated);

  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  // Type assertion is safe after validation confirms Layout structure
  return { success: true, layout: migrated as unknown as Layout };
}

function validateLoadedData(layoutId: string, data: unknown, silent = false): Layout | null {
  if (!data) return null;

  const result = parseLayoutData(data);
  if (!result.success) {
    if (!silent) {
      console.warn(`Layout ${layoutId} failed validation:`, result.errors);
    }
    return null;
  }

  return result.layout;
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
  return validateLoadedData(layoutId, data);
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
export async function loadLayoutResult(layoutId: string): Promise<Result<Layout, StorageError>> {
  const key = getLayoutStorageKey(layoutId);

  let data: Layout | null;
  try {
    data = await backend.loadAsync(key);
  } catch (error) {
    return err(storageUnavailable('indexedDB', error));
  }

  if (!data) {
    return err(storageNotFound(key));
  }

  const result = parseLayoutData(data);
  if (!result.success) {
    return err(storageCorrupted(key, result.errors));
  }

  return ok(result.layout);
}

/**
 * Delete a layout asynchronously with Result-based error handling.
 * Returns Ok on success (including when layout doesn't exist).
 */
export async function deleteLayoutResult(layoutId: string): Promise<Result<void, StorageError>> {
  const key = getLayoutStorageKey(layoutId);

  return tryCatchAsync(
    () => backend.deleteAsync(key),
    (error): StorageError => storageUnavailable('indexedDB', error)
  );
}

// === Sync Layout Operations (Initialization Only) ===

/**
 * Save a layout synchronously to localStorage.
 * Use only during initialization when async is not available.
 * Returns Result with StorageError if storage is full.
 */
export function saveLayoutSync(layoutId: string, layout: Layout): Result<void, StorageError> {
  const key = getLayoutStorageKey(layoutId);
  return backend.saveSync(key, layout);
}

/**
 * Load a layout synchronously from localStorage.
 * Use only during initialization.
 */
export function loadLayoutSync(layoutId: string): Layout | null {
  try {
    const key = getLayoutStorageKey(layoutId);
    const data = backend.loadSync(key);
    return validateLoadedData(layoutId, data);
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
 * Returns Result with StorageError if storage is full.
 */
export function saveLibrary(library: LayoutLibrary): Result<void, StorageError> {
  return backend.saveSyncGeneric(LIBRARY_STORAGE_KEY, library);
}

/**
 * Save the layout library index with Result-based error handling.
 * @deprecated Use saveLibrary directly — it now returns Result.
 */
export function saveLibraryResult(library: LayoutLibrary): Result<void, StorageError> {
  return saveLibrary(library);
}

/**
 * Validate and clean a parsed library object.
 * Removes orphaned entries (layout data missing from storage) and
 * fixes the activeLayoutId if it points to a removed entry.
 *
 * Returns null if the library is structurally invalid or has no surviving entries.
 */
function validateAndCleanLibrary(parsed: LayoutLibrary): LayoutLibrary | null {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- validate structure from localStorage
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
      console.warn(`Layout ${entry.id} listed in library but corrupted, removing`);
      return false;
    }
  });

  // If we lost some entries, persist the cleaned library
  if (validEntries.length < parsed.entries.length) {
    parsed.entries = validEntries;

    if (validEntries.length === 0) {
      console.warn('All library entries are corrupted/missing, will recreate');
      return null;
    }

    // If active layout was removed, switch to first available
    if (!validEntries.some((e: LayoutEntry) => e.id === parsed.activeLayoutId)) {
      parsed.activeLayoutId = validEntries[0].id;
    }

    // Persist cleanup so orphaned entries don't reappear on next load
    try {
      backend.saveSyncGeneric(LIBRARY_STORAGE_KEY, parsed);
    } catch {
      // Best-effort: cleanup will re-run on next load if save fails
    }
  }

  return parsed;
}

/**
 * Load the layout library index from localStorage.
 */
export function loadLibrary(): LayoutLibrary | null {
  try {
    const parsed = backend.loadSyncGeneric<LayoutLibrary>(LIBRARY_STORAGE_KEY);
    if (!parsed) return null;
    return validateAndCleanLibrary(parsed);
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

    const cleaned = validateAndCleanLibrary(parsed);
    if (!cleaned) {
      return err(
        storageCorrupted(LIBRARY_STORAGE_KEY, [
          'Invalid library format or all entries corrupted/missing',
        ])
      );
    }

    return ok(cleaned);
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
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- migration from legacy format
  const legacyLayout = loadLegacyLayout();
  if (!legacyLayout) return null;

  const layoutId = generateLayoutId();
  const library = createLibraryWithLayout(layoutId, legacyLayout);

  saveLayoutSync(layoutId, legacyLayout);
  saveLibrary(library);
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
  let legacyData: Layout;
  try {
    const data = backend.loadSync(LEGACY_STORAGE_KEY);
    if (!data) return ok(null); // No legacy layout exists

    const result = parseLayoutData(data);
    if (!result.success) {
      return err(storageCorrupted(LEGACY_STORAGE_KEY, result.errors));
    }

    legacyData = result.layout;
  } catch (error) {
    return err(storageUnavailable('localStorage', error));
  }

  // Create new library from legacy layout
  const layoutId = generateLayoutId();
  const library = createLibraryWithLayout(layoutId, legacyData);

  // Save layout and library
  const layoutSaveResult = saveLayoutSync(layoutId, legacyData);
  if (isErr(layoutSaveResult)) {
    return err(layoutSaveResult.error);
  }
  const librarySaveResult = saveLibrary(library);
  if (isErr(librarySaveResult)) {
    return err(librarySaveResult.error);
  }
  backend.deleteSync(LEGACY_STORAGE_KEY);

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
function createLibraryEntry(layoutId: LayoutId, layout: Layout): LayoutEntry {
  const now = Date.now();
  return {
    id: layoutId,
    name: layout.name || 'Untitled layout',
    createdAt: now,
    modifiedAt: now,
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- migration helper
    preview: computeLayoutPreview(layout),
  };
}

function createLibraryWithLayout(layoutId: LayoutId, layout: Layout): LayoutLibrary {
  return {
    version: '1.0',
    activeLayoutId: layoutId,
    settings: {},
    entries: [createLibraryEntry(layoutId, layout)],
  };
}

function persistNewLayout(layoutId: string, layout: Layout, library: LayoutLibrary): void {
  saveLayoutSync(layoutId, layout);
  saveLibrary(library);
  saveLayoutAsync(layoutId, layout).catch(() => {
    // Ignore errors - localStorage save is sufficient for now
  });
}

export function initializeLayoutLibrary(): { library: LayoutLibrary; activeLayout: Layout } {
  let library = loadLibrary() ?? migrateFromLegacyStorage();

  if (!library) {
    const layoutId = generateLayoutId();
    const defaultLayout: Layout = {
      version: '1.0',
      name: 'Untitled layout',
      drawer: { width: 10, depth: 8, height: 12 },
      printBedSize: 256,
      gridUnitMm: 42,
      heightUnitMm: 7,
      categories: [
        { id: generateCategoryId(), name: 'Coral', color: '#f87171' },
        { id: generateCategoryId(), name: 'Sky', color: '#38bdf8' },
        { id: generateCategoryId(), name: 'Green', color: '#4ade80' },
        { id: generateCategoryId(), name: 'Cloud', color: '#e2e8f0' },
        { id: generateCategoryId(), name: 'Charcoal', color: '#334155' },
      ],
      layers: [{ id: generateLayerId(), name: 'Layer 1', height: 3 }],
      bins: [],
    };

    library = createLibraryWithLayout(layoutId, defaultLayout);
    persistNewLayout(layoutId, defaultLayout, library);
  }

  let activeLayout = loadLayoutSync(library.activeLayoutId);

  if (!activeLayout) {
    console.warn(`Active layout ${library.activeLayoutId} not found, attempting recovery`);

    for (const entry of library.entries) {
      activeLayout = loadLayoutSync(entry.id);
      if (activeLayout) {
        library.activeLayoutId = entry.id;
        saveLibrary(library);
        break;
      }
    }

    if (!activeLayout) {
      const layoutId = generateLayoutId();
      const recoveredLayout: Layout = {
        version: '1.0',
        name: 'Recovered layout',
        drawer: { width: 10, depth: 8, height: 12 },
        printBedSize: 256,
        gridUnitMm: 42,
        heightUnitMm: 7,
        categories: [{ id: generateCategoryId(), name: 'Default', color: '#6b7280' }],
        layers: [{ id: generateLayerId(), name: 'Layer 1', height: 3 }],
        bins: [],
      };

      activeLayout = recoveredLayout;
      library.activeLayoutId = layoutId;
      library.entries = [createLibraryEntry(layoutId, recoveredLayout)];
      persistNewLayout(layoutId, recoveredLayout, library);
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
    return validateLoadedData('legacy', data, true);
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
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- legacy compat wrapper
  return loadLegacyLayout();
}

/**
 * Clear legacy storage.
 * @deprecated Use deleteLayoutSync for multi-layout support.
 */
export function clearStorage(): void {
  backend.deleteSync(LEGACY_STORAGE_KEY);
}

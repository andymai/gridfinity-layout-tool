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
 * - *Async suffix: Uses IndexedDB (primary), returns Promise
 * - *Sync suffix: Uses localStorage only, synchronous
 * - *Result suffix: Returns Result<T, StorageError> for explicit error handling
 */

import * as backend from './backend';
import * as indexedDB from './backends/indexedDB';
import { salvageImport } from '@/shared/utils/validation';
import { generateCategoryId, generateLayerId } from '@/core/constants';
import { generateLayoutId } from '@/shared/utils';
import { computePreview } from './preview';
import type { Layout, LayoutId, LayoutLibrary, LayoutEntry } from '@/core/types';
import type { Result, StorageError } from '@/core/result';
import {
  ok,
  err,
  isOk,
  isErr,
  tryCatchAsync,
  storageNotFound,
  storageCorrupted,
  storageUnavailable,
} from '@/core/result';
import { notifyLibraryChanged } from './librarySync';

// Storage keys
const LEGACY_STORAGE_KEY = 'gridfinity-layout-v1';
const LIBRARY_STORAGE_KEY = 'gridfinity-library-v1';
const ACTIVE_ID_STORAGE_KEY = 'gridfinity-library-active-id';
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
 * Migrates the schema and uses lenient validation (salvageImport) so that
 * bins with placement issues (collisions, out-of-bounds) are moved to staging
 * instead of rejecting the entire layout.
 */
function parseLayoutData(data: unknown): ParseResult {
  if (!data || typeof data !== 'object') {
    return { success: false, errors: ['No data or invalid type'] };
  }

  const migrated = migrateLayout(data as Record<string, unknown>);
  const result = salvageImport(migrated);

  if (!result.valid) {
    return { success: false, errors: ['Layout structure is invalid'] };
  }

  if (result.salvaged.length > 0) {
    console.warn(
      `[LayoutService] Layout loaded with ${result.salvaged.length} bin(s) moved to staging:`,
      result.salvaged
    );
  }

  return { success: true, layout: result.layout };
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
 * Save a layout asynchronously to IndexedDB.
 * Falls back to localStorage when IndexedDB is unavailable.
 * Returns Result indicating success or storage failure.
 */
export async function saveLayoutAsync(
  layoutId: string,
  layout: Layout
): Promise<Result<void, StorageError>> {
  const key = getLayoutStorageKey(layoutId);
  return backend.saveAsync(key, layout);
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
  return saveLayoutAsync(layoutId, layout);
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
 *
 * Note: backend.loadSync already handles JSON parse errors internally,
 * and validateLoadedData returns null for invalid data, so no try-catch
 * is needed here.
 */
export function loadLayoutSync(layoutId: string): Layout | null {
  const key = getLayoutStorageKey(layoutId);
  const data = backend.loadSync(key);
  return validateLoadedData(layoutId, data);
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
 * Save the layout library index to IndexedDB (fire-and-forget).
 * Also writes activeLayoutId to localStorage for recovery.
 */
export function saveLibrary(library: LayoutLibrary): void {
  indexedDB
    .saveLibraryIndex(library)
    .then(() => {
      notifyLibraryChanged();
    })
    .catch((error: unknown) => {
      console.warn('[LayoutService] Library save to IndexedDB failed:', error);
    });
  // Best-effort write of activeLayoutId for recovery on next load.
  // Uses raw setItem to store as plain string (not JSON) since this is
  // a simple recovery breadcrumb, not structured data.
  try {
    window.localStorage.setItem(ACTIVE_ID_STORAGE_KEY, library.activeLayoutId);
  } catch {
    // localStorage may be full; IndexedDB holds the authoritative data
  }
}

/**
 * Save the layout library index with Result-based error handling.
 * @deprecated Use saveLibrary directly.
 */
export function saveLibraryResult(library: LayoutLibrary): void {
  saveLibrary(library);
}

/**
 * Validate the structural integrity of a parsed library object.
 * Does NOT check whether individual layouts exist in storage — that
 * is deferred to reconcileLibraryAsync() after mount.
 *
 * Returns null if the library is structurally invalid or has no entries.
 */
function validateLibraryStructure(parsed: LayoutLibrary): LayoutLibrary | null {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- validate structure from storage
  if (!parsed.version || !parsed.activeLayoutId || !Array.isArray(parsed.entries)) {
    console.warn('Invalid library format');
    return null;
  }

  if (parsed.entries.length === 0) {
    console.warn('Library has no entries, will recreate');
    return null;
  }

  // Ensure activeLayoutId references a valid entry
  if (!parsed.entries.some((e: LayoutEntry) => e.id === parsed.activeLayoutId)) {
    return { ...parsed, activeLayoutId: parsed.entries[0].id };
  }

  return parsed;
}

/**
 * Reconcile library entries against actual layout data in storage.
 * Removes orphaned entries whose layout data is missing from IndexedDB.
 * Call this after mount to clean up without blocking startup.
 */
export async function reconcileLibraryAsync(library: LayoutLibrary): Promise<LayoutLibrary | null> {
  const storedIds = new Set(await indexedDB.getAllLayoutIds());

  const validEntries = library.entries.filter((entry: LayoutEntry) => {
    const key = getLayoutStorageKey(entry.id);
    const exists = storedIds.has(key);
    if (!exists) {
      console.warn(`Layout ${entry.id} listed in library but not found in IndexedDB, removing`);
    }
    return exists;
  });

  if (validEntries.length === library.entries.length) {
    return null; // No changes needed
  }

  if (validEntries.length === 0) {
    console.warn('All library entries are orphaned — will not clear library');
    return null;
  }

  const cleaned: LayoutLibrary = {
    ...library,
    entries: validEntries,
    activeLayoutId: validEntries.some((e) => e.id === library.activeLayoutId)
      ? library.activeLayoutId
      : validEntries[0].id,
  };

  // Persist cleaned library and notify other tabs
  await indexedDB.saveLibraryIndex(cleaned).catch(() => {
    // Best-effort
  });
  notifyLibraryChanged();

  return cleaned;
}

/**
 * Load the layout library index from IndexedDB.
 */
export async function loadLibraryAsync(): Promise<LayoutLibrary | null> {
  try {
    const parsed = await indexedDB.loadLibraryIndex();
    if (!parsed) return null;
    return validateLibraryStructure(parsed);
  } catch {
    // IndexedDB unavailable or read failed — caller falls back to localStorage
    return null;
  }
}

/**
 * Load the layout library index from localStorage (sync fallback).
 * Routes through loadLibraryResult internally for consistent error handling.
 */
export function loadLibrary(): LayoutLibrary | null {
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional sync fallback path
  const result = loadLibraryResult();
  return isOk(result) ? result.value : null;
}

/**
 * Load the layout library index with Result-based error handling.
 * @deprecated Reads from localStorage only. Use loadLibraryAsync() for IndexedDB reads.
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

    const cleaned = validateLibraryStructure(parsed);
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
  saveLibrary(library);
  backend.deleteSync(LEGACY_STORAGE_KEY);

  return ok(library);
}

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

async function persistNewLayoutAsync(
  layoutId: string,
  layout: Layout,
  library: LayoutLibrary
): Promise<void> {
  const result = await saveLayoutAsync(layoutId, layout);
  if (isErr(result)) {
    throw new Error(`Failed to persist layout ${layoutId} during initialization`);
  }
  saveLibrary(library);
}

/**
 * Initialize the layout library system.
 * Handles migration from legacy storage if needed.
 * Returns the library and the active layout.
 *
 * Loads from IndexedDB (primary), falling back to localStorage for migration.
 * Uses React Suspense via throw-promise pattern in App.tsx.
 */
export async function initializeLayoutLibrary(): Promise<{
  library: LayoutLibrary;
  activeLayout: Layout;
}> {
  // Try IndexedDB first (primary), then localStorage fallback, then legacy migration
  const idbLibrary = await loadLibraryAsync();
  let library = idbLibrary ?? loadLibrary() ?? migrateFromLegacyStorage();

  // If library came from localStorage (not IDB), migrate it to IndexedDB now
  if (library && !idbLibrary) {
    try {
      await indexedDB.saveLibraryIndex(library);
      // Migration succeeded — remove stale localStorage copy to prevent future fallback reads
      try {
        window.localStorage.removeItem(LIBRARY_STORAGE_KEY);
      } catch {
        // Best-effort cleanup
      }
    } catch {
      // Best-effort migration — localStorage copy remains as fallback
    }
  }

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
    await persistNewLayoutAsync(layoutId, defaultLayout, library);
  }

  // Load active layout from IndexedDB, then localStorage fallback
  let activeLayout = await loadLayoutAsync(library.activeLayoutId);

  if (!activeLayout) {
    console.warn(`Active layout ${library.activeLayoutId} not found, attempting recovery`);

    for (const entry of library.entries) {
      activeLayout = await loadLayoutAsync(entry.id);
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
      await persistNewLayoutAsync(layoutId, recoveredLayout, library);
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
  const data = backend.loadSync(LEGACY_STORAGE_KEY);
  return validateLoadedData('legacy', data, true);
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

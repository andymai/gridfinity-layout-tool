/**
 * Storage Layer - Public API
 *
 * This module provides the unified interface for all storage operations.
 * Import from this module instead of individual service files.
 *
 * Organization:
 * - Atomic Operations: saveLayoutWithMetadata, createLayoutEntry, etc. (PREFERRED)
 * - Layout CRUD: saveLayoutAsync, loadLayoutAsync, etc. (legacy, use atomic ops instead)
 * - Library: saveLibrary, loadLibrary, initializeLayoutLibrary
 * - Import/Export: exportLayoutJSON, importLayoutJSON, exportPrintListTSV
 * - URL Sharing: encodeLayoutForURL, getCloudShareIdFromURL, etc.
 * - Utilities: copyToClipboard, downloadLayoutAsFile
 * - Migration: isMigrationNeeded, migrateAllLayoutsToIndexedDB
 */

// These functions provide atomic layout + library saves.
// Use these instead of separate saveLayout + updateEntry + saveLibrary calls.
export {
  saveLayoutWithMetadata,
  createLayoutEntry,
  deleteLayoutWithEntry,
  duplicateLayoutEntry,
  switchActiveLayout,
  updateCloudShare,
  renameLayoutEntry,
  computePreview,
} from './LayoutManager';
export type {
  SaveLayoutOptions,
  SaveResult,
  CreateLayoutOptions,
  CreateResult,
  SwitchResult,
  DeleteResult,
  DuplicateResult,
} from './LayoutManager';

// Consider using atomic operations above instead for automatic library sync.
export { saveLayoutAsync, loadLayoutAsync } from './LayoutService';

// Use these when you need explicit error handling with Result types
export { loadLayoutResult, deleteLayoutResult } from './LayoutService';

// Use only during app startup when async is not available
export { saveLayoutSync, loadLayoutSync, deleteLayoutSync } from './LayoutService';

export {
  saveLibrary,
  loadLibrary,
  loadLibraryAsync,
  initializeLayoutLibrary,
  reconcileLibraryAsync,
  getLayoutStorageKey,
  getStorageUsage,
  hasLegacyLayout,
  migrateFromLegacyStorage,
  migrateFromLegacyStorageResult,
} from './LayoutService';

export {
  exportLayoutJSON,
  exportLayoutJSONWithDesigns,
  importLayoutJSON,
  importLayoutResult,
  restoreEmbeddedDesigns,
  exportPrintListTSV,
  type PrintListTSVMeta,
} from './ShareService';

export {
  exportAllLayouts,
  downloadArchive,
  importArchive,
  parseArchive,
  isArchiveFormat,
} from './BulkArchiveService';
export type {
  LayoutArchive,
  ImportArchiveResult,
  ExportProgress,
  ExportResult,
} from './BulkArchiveService';

export {
  encodeLayoutForURL,
  decodeLayoutFromURL,
  decodeLayoutResult,
  generateShareableURL,
  getSharedLayoutFromURL,
  getSharedLayoutResult,
  clearSharedLayoutFromURL,
  getCloudShareIdFromURL,
  clearCloudShareFromURL,
} from './ShareService';

export { copyToClipboard, downloadLayoutAsFile } from './utils';

export { saveSharedWithMe, loadSharedWithMe, clearSharedWithMe } from './SharedWithMeService';

export {
  isMigrationNeeded,
  migrateAllLayoutsToIndexedDB,
  migrateLayoutToIndexedDB,
  getMigrationStatus,
  clearMigrationFlag,
} from './migration';

export {
  migrateLayoutToIndexedDBResult,
  migrateAllLayoutsToIndexedDBResult,
  getMigrationStatusResult,
} from './migration';
export type { MigrationStats } from './migration';

export {
  createSnapshot,
  loadSnapshots,
  restoreSnapshot,
  deleteSnapshot as deleteSnapshotById,
  deleteSnapshotsForLayout,
  updateSnapshotLabel,
} from './SnapshotService';

export { runLocalStorageMigrations } from './localStorageMigrations';

export { clearAllAppData } from './clearAppData';

export { cleanupLocalStorageBackups, clearCleanupFlag } from './localStorageCleanup';
export type { CleanupStats } from './localStorageCleanup';

export { getStorageBackend, resetStorageBackendCache } from './backend';

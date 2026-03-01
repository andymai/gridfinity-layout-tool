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

// === Atomic Operations (PREFERRED API) ===
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

// === Layout CRUD (Async - Legacy API) ===
// Consider using atomic operations above instead for automatic library sync.
export { saveLayoutAsync, loadLayoutAsync, deleteLayoutAsync } from './LayoutService';

// === Layout CRUD (Async - Result-Based) ===
// Use these when you need explicit error handling with Result types
export { loadLayoutResult, deleteLayoutResult } from './LayoutService';

// === Layout CRUD (Sync - Initialization Only) ===
// Use only during app startup when async is not available
export { saveLayoutSync, loadLayoutSync, deleteLayoutSync } from './LayoutService';

// === Library Management ===
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

// === Import/Export ===
export {
  exportLayoutJSON,
  exportLayoutJSONWithDesigns,
  importLayoutJSON,
  importLayoutResult,
  restoreEmbeddedDesigns,
  exportPrintListTSV,
  type PrintListTSVMeta,
} from './ShareService';

// === Bulk Archive ===
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

// === URL Sharing ===
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

// === Utilities ===
export { copyToClipboard, downloadLayoutAsFile } from './utils';

// === Shared With Me ===
export {
  saveSharedWithMe,
  loadSharedWithMe,
  clearSharedWithMe,
  saveSharedWithMeAsync,
  loadSharedWithMeAsync,
  clearSharedWithMeAsync,
} from './SharedWithMeService';

// === Migration ===
export {
  isMigrationNeeded,
  migrateAllLayoutsToIndexedDB,
  migrateLayoutToIndexedDB,
  migrateLibraryToIndexedDB,
  getMigrationStatus,
  clearMigrationFlag,
} from './migration';

// === Migration (Result-Based) ===
export {
  migrateLayoutToIndexedDBResult,
  migrateAllLayoutsToIndexedDBResult,
  getMigrationStatusResult,
} from './migration';
export type { MigrationStats } from './migration';

// === Snapshots ===
export {
  createSnapshot,
  loadSnapshots,
  restoreSnapshot,
  deleteSnapshot as deleteSnapshotById,
  deleteSnapshotsForLayout,
  updateSnapshotLabel,
} from './SnapshotService';

// === localStorage Migrations ===
export { runLocalStorageMigrations } from './localStorageMigrations';

// === Clear All Data ===
export { clearAllAppData } from './clearAppData';

// === localStorage Cleanup ===
export { cleanupLocalStorageBackups, clearCleanupFlag } from './localStorageCleanup';
export type { CleanupStats } from './localStorageCleanup';

// === Backend (Internal - for useStorageMigration hook) ===
export { getStorageBackend, resetStorageBackendCache } from './backend';

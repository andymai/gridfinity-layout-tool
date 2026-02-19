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
export { saveLayoutResult, loadLayoutResult, deleteLayoutResult } from './LayoutService';

// === Layout CRUD (Sync - Initialization Only) ===
// Use only during app startup when async is not available
export { saveLayoutSync, loadLayoutSync, deleteLayoutSync } from './LayoutService';

// === Library Management ===
export {
  saveLibrary,
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- re-exported for backward compat
  saveLibraryResult,
  loadLibrary,
  loadLibraryResult,
  initializeLayoutLibrary,
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- re-exported for backward compat
  computeLayoutPreview,
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
  saveSharedWithMeResult,
  loadSharedWithMeResult,
  clearSharedWithMeResult,
} from './SharedWithMeService';

// === Migration ===
export {
  isMigrationNeeded,
  migrateAllLayoutsToIndexedDB,
  migrateLayoutToIndexedDB,
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

// === Backend (Internal - for useStorageMigration hook) ===
export { getStorageBackend, resetStorageBackendCache } from './backend';

// === Legacy API (Deprecated) ===
// These are kept for backward compatibility only
// eslint-disable-next-line @typescript-eslint/no-deprecated -- legacy compat re-exports
export { saveLayout, loadLayout, clearStorage } from './LayoutService';

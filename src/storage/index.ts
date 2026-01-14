/**
 * Storage Layer - Public API
 *
 * This module provides the unified interface for all storage operations.
 * Import from this module instead of individual service files.
 *
 * Organization:
 * - Layout CRUD: saveLayoutAsync, loadLayoutAsync, etc.
 * - Library: saveLibrary, loadLibrary, initializeLayoutLibrary
 * - Import/Export: exportLayoutJSON, importLayoutJSON, exportPrintListTSV
 * - URL Sharing: encodeLayoutForURL, getCloudShareIdFromURL, etc.
 * - Utilities: copyToClipboard, downloadLayoutAsFile
 * - Migration: isMigrationNeeded, migrateAllLayoutsToIndexedDB
 */

// === Layout CRUD (Async - Primary API) ===
// Use these for runtime operations (auto-save, switching layouts)
export {
  saveLayoutAsync,
  loadLayoutAsync,
  deleteLayoutAsync,
} from './LayoutService';

// === Layout CRUD (Async - Result-Based) ===
// Use these when you need explicit error handling with Result types
export {
  saveLayoutResult,
  loadLayoutResult,
  deleteLayoutResult,
} from './LayoutService';

// === Layout CRUD (Sync - Initialization Only) ===
// Use only during app startup when async is not available
export {
  saveLayoutSync,
  loadLayoutSync,
  deleteLayoutSync,
} from './LayoutService';

// === Library Management ===
export {
  saveLibrary,
  saveLibraryResult,
  loadLibrary,
  loadLibraryResult,
  initializeLayoutLibrary,
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
  importLayoutJSON,
  importLayoutResult,
  exportPrintListTSV,
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
export {
  copyToClipboard,
  copyToClipboardResult,
  downloadLayoutAsFile,
} from './utils';

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

// === Backend (Internal - for useStorageMigration hook) ===
export {
  getStorageBackend,
  resetStorageBackendCache,
} from './backend';

// === Legacy API (Deprecated) ===
// These are kept for backward compatibility only
export {
  saveLayout,
  loadLayout,
  clearStorage,
} from './LayoutService';

// === Backward Compatibility Aliases ===
// Old function names mapped to new names for smooth migration
export {
  saveLayoutAsync as saveLayoutByIdAsync,
  loadLayoutAsync as loadLayoutByIdAsync,
  deleteLayoutAsync as deleteLayoutByIdAsync,
  saveLayoutSync as saveLayoutById,
  loadLayoutSync as loadLayoutById,
  deleteLayoutSync as deleteLayoutById,
} from './LayoutService';

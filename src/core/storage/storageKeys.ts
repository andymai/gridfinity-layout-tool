/**
 * Centralized storage key constants.
 *
 * This module centralizes commonly used localStorage / IndexedDB keys for reuse.
 * Some feature-specific keys may be defined closer to their usage, but using these
 * shared constants helps prevent typo-induced bugs from duplicated string literals.
 */

// Layout data
export const LAYOUT_KEY_PREFIX = 'gridfinity-layout-';
export const LEGACY_STORAGE_KEY = 'gridfinity-layout-v1';

// Library index
export const LIBRARY_STORAGE_KEY = 'gridfinity-library-v1';
export const ACTIVE_ID_STORAGE_KEY = 'gridfinity-library-active-id';
export const LIBRARY_CHANNEL_NAME = 'gridfinity-library-sync';

export const SETTINGS_STORAGE_KEY = 'gridfinity-settings-v1';

// Baseplate export byte cache (own IndexedDB database). Defined here so the
// full-data-clear path can delete it without importing the baseplate feature
// (core must not depend on features).
export const BASEPLATE_EXPORT_DB_NAME = 'gridfinity-baseplate-export-v1';

// Migration flags
export const MIGRATION_FLAG_KEY = 'gridfinity-indexeddb-migrated';
export const CLEANUP_FLAG_KEY = 'gridfinity-localstorage-cleaned';

import type {
  BinListSortOrder,
  STLSearchSite,
  SlicerSite,
  PrintViewSettings,
  UserSettings,
} from './settings.types';
import {
  DEFAULT_BIN_LIST_SORT_ORDER,
  DEFAULT_STL_SEARCH_SITES,
  STL_SEARCH_CONSTRAINTS,
  DEFAULT_SLICER_SITES,
  DEFAULT_PRINT_VIEW_SETTINGS,
  DEFAULT_SETTINGS,
} from './settings.types';
import type { Category } from '@/core/types';
import type { PrintSettings } from '@/shared/printSettings';
import { DEFAULT_PRINT_SETTINGS } from '@/shared/printSettings';
import { isOk } from '@/core/result';
import { loadFromLocalStorage, saveToLocalStorage } from '@/core/storage/backends/localStorage';
import type { Result, StorageError } from '@/core/result';
import { SETTINGS_STORAGE_KEY } from '@/core/storage/storageKeys';

/**
 * Ensure binListSortOrder has all required fields.
 * This handles migration when new sort fields are added.
 * Exported for testing.
 */
export function normalizeSortOrder(stored: BinListSortOrder | undefined): BinListSortOrder {
  if (!stored || !Array.isArray(stored)) {
    return [...DEFAULT_BIN_LIST_SORT_ORDER];
  }

  const allFields = new Set(DEFAULT_BIN_LIST_SORT_ORDER.map((s) => s.field));
  const storedFields = new Set(stored.map((s) => s.field));

  const result: BinListSortOrder = stored.filter((s) => allFields.has(s.field));

  for (const defaultConfig of DEFAULT_BIN_LIST_SORT_ORDER) {
    if (!storedFields.has(defaultConfig.field)) {
      result.push({ field: defaultConfig.field, enabled: false });
    }
  }

  return result;
}

/**
 * Normalize categories to ensure valid data structure.
 * Returns null if data is invalid (falls back to app defaults).
 */
export function normalizeCategories(stored: Category[] | null | undefined): Category[] | null {
  if (stored === null || stored === undefined) {
    return null;
  }
  if (!Array.isArray(stored) || stored.length === 0) {
    return null; // Invalid data, fall back to defaults
  }
  // Validate each category has required fields
  const valid = stored.filter(
    (c) => typeof c.id === 'string' && typeof c.name === 'string' && typeof c.color === 'string'
  );
  return valid.length > 0 ? valid : null;
}

/**
 * Normalize STL search sites to ensure all default sites are present.
 * Handles migration when default sites are added or removed.
 */
export function normalizeSTLSearchSites(stored: STLSearchSite[] | undefined): STLSearchSite[] {
  if (!stored || !Array.isArray(stored)) {
    return [...DEFAULT_STL_SEARCH_SITES];
  }

  const defaultIds = new Set(DEFAULT_STL_SEARCH_SITES.map((s) => s.id));
  const storedIds = new Set(stored.map((s) => s.id));

  // Filter out removed default sites, keep custom sites (non-default)
  const validStored = stored.filter((s) => !s.isDefault || defaultIds.has(s.id));

  // Separate defaults and custom sites
  const defaults = validStored.filter((s) => defaultIds.has(s.id));
  const custom = validStored.filter((s) => !defaultIds.has(s.id));

  // Add any missing default sites (disabled by default if user had customized)
  for (const defaultSite of DEFAULT_STL_SEARCH_SITES) {
    if (!storedIds.has(defaultSite.id)) {
      defaults.push({ ...defaultSite, enabled: false });
    }
  }

  // Enforce max sites limit while preserving defaults (trim custom sites first)
  const maxCustom = Math.max(0, STL_SEARCH_CONSTRAINTS.MAX_SITES - defaults.length);
  return [...defaults, ...custom.slice(0, maxCustom)];
}

/**
 * Normalize slicer sites to ensure all default sites are present.
 * Handles migration when new default slicers are added.
 */
export function normalizeSlicerSites(stored: SlicerSite[] | undefined): SlicerSite[] {
  if (!stored || !Array.isArray(stored)) {
    return [...DEFAULT_SLICER_SITES];
  }

  const defaultIds = new Set(DEFAULT_SLICER_SITES.map((s) => s.id));
  const storedIds = new Set(stored.map((s) => s.id));

  // Keep only known default slicer IDs. Unlike STL search sites, slicers are
  // default-only (no custom slicers can be added by the user), so non-default
  // entries are intentionally dropped rather than preserved.
  const validStored = stored.filter((s) => defaultIds.has(s.id));

  // Add any new default sites (disabled by default for existing users)
  for (const defaultSite of DEFAULT_SLICER_SITES) {
    if (!storedIds.has(defaultSite.id)) {
      validStored.push({ ...defaultSite, enabled: false });
    }
  }

  return validStored;
}

/**
 * Normalize view mode values from localStorage.
 * Ensures corrupted or invalid values fall back to the provided default.
 */
export function normalizeViewMode(value: unknown, fallback: 'grid' | 'list'): 'grid' | 'list' {
  return value === 'grid' || value === 'list' ? value : fallback;
}

/**
 * Load settings from localStorage.
 * Uses Result internally for structured error handling, but always returns
 * a valid UserSettings (falling back to defaults on any error).
 */
export function loadSettings(): UserSettings {
  const result = loadFromLocalStorage<Partial<UserSettings>>(SETTINGS_STORAGE_KEY);

  if (isOk(result) && result.value) {
    const parsed = result.value;
    // Deep merge printViewSettings to handle new fields
    const printViewSettings: PrintViewSettings = {
      ...DEFAULT_PRINT_VIEW_SETTINGS,
      ...parsed.printViewSettings,
      binListSortOrder: normalizeSortOrder(parsed.printViewSettings?.binListSortOrder),
    };
    // Normalize STL search sites
    const stlSearchSites = normalizeSTLSearchSites(parsed.stlSearchSites);
    // Normalize slicer sites
    const slicerSites = normalizeSlicerSites(parsed.slicerSites);
    // Normalize default categories
    const defaultCategories = normalizeCategories(parsed.defaultCategories);
    // Normalize view mode settings
    const layoutManagerViewMode = normalizeViewMode(
      parsed.layoutManagerViewMode,
      DEFAULT_SETTINGS.layoutManagerViewMode
    );
    const designListViewMode = normalizeViewMode(
      parsed.designListViewMode,
      DEFAULT_SETTINGS.designListViewMode
    );
    // Normalize print settings
    const printSettings: PrintSettings = {
      ...DEFAULT_PRINT_SETTINGS,
      ...parsed.printSettings,
    };
    // Merge with defaults to handle any missing fields
    const merged: UserSettings = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      printViewSettings,
      stlSearchSites,
      slicerSites,
      defaultCategories,
      layoutManagerViewMode,
      designListViewMode,
      printSettings,
    };
    return merged;
  }

  return { ...DEFAULT_SETTINGS };
}

/**
 * Save settings to localStorage.
 * Returns Result to let callers know if persistence succeeded.
 * On Err, settings are still updated in memory but won't survive a page reload.
 */
export function saveSettings(settings: UserSettings): Result<void, StorageError> {
  return saveToLocalStorage(SETTINGS_STORAGE_KEY, settings);
}

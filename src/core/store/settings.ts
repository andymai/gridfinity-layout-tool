import { create } from 'zustand';
import type { Category } from '@/core/types';
import type { Result, StorageError } from '@/core/result';
import type { UserSettings } from './settings.types';
import { DEFAULT_SETTINGS } from './settings.types';
import { loadSettings, saveSettings } from './settings.normalize';

// Re-export types and constants for existing consumers
export type {
  STLSearchSite,
  BinSortField,
  SortFieldConfig,
  BinListSortOrder,
  PrintOrientation,
  PrintViewSettings,
  UserSettings,
} from './settings.types';
export {
  STL_SEARCH_CONSTRAINTS,
  DEFAULT_STL_SEARCH_SITES,
  DEFAULT_BIN_LIST_SORT_ORDER,
  DEFAULT_PRINT_VIEW_SETTINGS,
  DEFAULT_SETTINGS,
} from './settings.types';
export { normalizeSortOrder } from './settings.normalize';

/**
 * Restore a single key to its default, cloning array defaults so the shared
 * DEFAULT_SETTINGS arrays are never aliased into live state. Generic over a
 * single key K so the assignment type-checks (a union key would widen to never).
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- K links target/key/value so the assignment type-checks; a union key would widen to never.
function restoreDefault<K extends keyof UserSettings>(target: UserSettings, key: K): void {
  const value = DEFAULT_SETTINGS[key];
  target[key] = Array.isArray(value) ? (value.slice() as UserSettings[K]) : value;
}

interface SettingsState {
  settings: UserSettings;

  /**
   * Update a single setting. Returns Result indicating persistence success.
   * State is always updated in memory; Err means it won't survive reload.
   */
  updateSetting: <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => Result<void, StorageError>;
  /**
   * Update multiple settings. Returns Result indicating persistence success.
   */
  updateSettings: (updates: Partial<UserSettings>) => Result<void, StorageError>;
  /** Reset all settings to defaults. Returns Result indicating persistence success. */
  resetSettings: () => Result<void, StorageError>;

  /**
   * Reset a subset of settings to their defaults (per-section reset). Each
   * listed key is restored from DEFAULT_SETTINGS; all other settings are left
   * untouched. Returns Result indicating persistence success.
   */
  resetSettingKeys: (keys: (keyof UserSettings)[]) => Result<void, StorageError>;

  /** Save current layout defaults. Returns Result indicating persistence success. */
  saveCurrentAsDefaults: (
    drawer: { width: number; depth: number; height: number },
    printBedSize: number,
    gridUnitMm: number,
    heightUnitMm: number,
    layerHeight: number,
    printBedDepth?: number
  ) => Result<void, StorageError>;

  /** Save categories as defaults for new layouts. Returns Result indicating persistence success. */
  saveCategoriesAsDefaults: (categories: Category[]) => Result<void, StorageError>;
}

/**
 * Settings store — user preferences persisted to localStorage (`gridfinity-settings-v1`).
 * Includes theme, locale, print settings, grid display options, and feature toggles.
 */
export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: loadSettings(),

  updateSetting: (key, value) => {
    const newSettings = { ...get().settings, [key]: value };
    set({ settings: newSettings });
    return saveSettings(newSettings);
  },

  updateSettings: (updates) => {
    const newSettings = { ...get().settings, ...updates };
    set({ settings: newSettings });
    return saveSettings(newSettings);
  },

  resetSettings: () => {
    // Deep clone so live state never aliases DEFAULT_SETTINGS' nested
    // arrays/objects (consistent with resetSettingKeys' per-key cloning).
    const newSettings = structuredClone(DEFAULT_SETTINGS);
    set({ settings: newSettings });
    return saveSettings(newSettings);
  },

  resetSettingKeys: (keys) => {
    const newSettings = { ...get().settings };
    for (const key of keys) {
      restoreDefault(newSettings, key);
    }
    set({ settings: newSettings });
    return saveSettings(newSettings);
  },

  saveCurrentAsDefaults: (
    drawer,
    printBedSize,
    gridUnitMm,
    heightUnitMm,
    layerHeight,
    printBedDepth
  ) => {
    const newSettings = {
      ...get().settings,
      defaultDrawerWidth: drawer.width,
      defaultDrawerDepth: drawer.depth,
      defaultDrawerHeight: drawer.height,
      defaultLayerHeight: layerHeight,
      defaultPrintBedSize: printBedSize,
      defaultPrintBedDepth: printBedDepth,
      defaultGridUnitMm: gridUnitMm,
      defaultHeightUnitMm: heightUnitMm,
    };
    set({ settings: newSettings });
    return saveSettings(newSettings);
  },

  saveCategoriesAsDefaults: (categories) => {
    // Deep copy categories to avoid reference issues
    const newSettings = {
      ...get().settings,
      defaultCategories: categories.length > 0 ? categories.map((c) => ({ ...c })) : null,
    };
    set({ settings: newSettings });
    return saveSettings(newSettings);
  },
}));

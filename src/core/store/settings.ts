import { create } from 'zustand';
import type { Locale } from '@/i18n/types';
import type { Category } from '@/core/types';
import type { PrintSettings } from '@/shared/printSettings';
import { DEFAULT_PRINT_SETTINGS } from '@/shared/printSettings';

// Storage key for settings
const SETTINGS_STORAGE_KEY = 'gridfinity-settings-v1';

// ============================================================================
// STL Search Sites Configuration
// ============================================================================

/**
 * Configuration for a single STL search site.
 * URL templates support {width} and {depth} placeholders.
 */
export interface STLSearchSite {
  id: string;
  name: string;
  /** URL template with {width} and {depth} placeholders */
  urlTemplate: string;
  /** Whether this site is enabled in the dropdown */
  enabled: boolean;
  /** Whether this is a default site (cannot be deleted, only disabled) */
  isDefault?: boolean;
}

/**
 * Constraints for STL search sites.
 */
export const STL_SEARCH_CONSTRAINTS = {
  MAX_SITES: 5,
  NAME_MAX_LENGTH: 24,
  URL_TEMPLATE_MAX_LENGTH: 256,
} as const;

/**
 * Default STL search sites shipped with the app.
 */
export const DEFAULT_STL_SEARCH_SITES: STLSearchSite[] = [
  {
    id: 'printables',
    name: 'Printables',
    urlTemplate: 'https://www.printables.com/search/models?q=gridfinity+{width}x{depth}',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'makerworld',
    name: 'MakerWorld',
    urlTemplate: 'https://makerworld.com/en/search/models?keyword=gridfinity+{width}x{depth}',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'thangs',
    name: 'Thangs',
    urlTemplate: 'https://thangs.com/search/gridfinity%20{width}x{depth}',
    enabled: false,
    isDefault: true,
  },
];

/**
 * Available fields for sorting the bin list.
 */
export type BinSortField = 'category' | 'layer' | 'position' | 'size' | 'height' | 'label';

/**
 * Configuration for a single sort field.
 */
export interface SortFieldConfig {
  field: BinSortField;
  enabled: boolean;
}

/**
 * Sort order configuration - array order determines priority.
 */
export type BinListSortOrder = SortFieldConfig[];

/**
 * Default bin list sort order.
 */
export const DEFAULT_BIN_LIST_SORT_ORDER: BinListSortOrder = [
  { field: 'category', enabled: true },
  { field: 'position', enabled: true },
  { field: 'layer', enabled: false },
  { field: 'size', enabled: false },
  { field: 'height', enabled: false },
  { field: 'label', enabled: false },
];

/**
 * Page orientation for print.
 */
export type PrintOrientation = 'portrait' | 'landscape';

/**
 * Print view settings for configuring what to display when printing.
 */
export interface PrintViewSettings {
  // Bin display options (what shows on each bin)
  showLabel: boolean;
  showCategoryColor: boolean;
  showSize: boolean;
  showHeight: boolean;
  showNotes: boolean;
  showCustomProperties: boolean;
  // Header options (what shows in the header section)
  showHeader: boolean;
  showLayoutName: boolean;
  showDrawerInfo: boolean;
  showDate: boolean;
  // Layout options (what shows around/below the grid)
  showGridCoordinates: boolean;
  showLegend: boolean;
  showBinList: boolean;
  // Page orientation (affects grid sizing for print)
  orientation: PrintOrientation;
  // Bin list sorting
  binListSortOrder: BinListSortOrder;
}

/**
 * Default print view settings.
 */
export const DEFAULT_PRINT_VIEW_SETTINGS: PrintViewSettings = {
  // Bin display - all details on by default for Cmd+P convenience
  showLabel: true,
  showCategoryColor: true,
  showSize: true,
  showHeight: true,
  showNotes: true,
  showCustomProperties: true,
  // Header - all on by default
  showHeader: true,
  showLayoutName: true,
  showDrawerInfo: true,
  showDate: true,
  // Layout options
  showGridCoordinates: true,
  showLegend: false,
  showBinList: false,
  // Page orientation for print sizing
  orientation: 'landscape',
  // Bin list sorting - category then position by default
  binListSortOrder: [...DEFAULT_BIN_LIST_SORT_ORDER],
};

/**
 * User preferences that persist across sessions.
 */
export interface UserSettings {
  // Default values for new layouts
  defaultDrawerWidth: number;
  defaultDrawerDepth: number;
  defaultDrawerHeight: number;
  defaultLayerHeight: number; // Default height for new layers (in height units)
  defaultPrintBedSize: number;
  defaultGridUnitMm: number;
  defaultHeightUnitMm: number;

  // UI preferences
  defaultZoom: number;
  rememberPanelState: boolean; // Whether to remember panel collapse state
  lastLeftPanelCollapsed: boolean;
  lastRightPanelCollapsed: boolean;
  lastStashCollapsed: boolean;
  /**
   * Custom max height for the stash panel in pixels.
   * null means use the default (33vh).
   */
  stashMaxHeight: number | null;
  /**
   * Preferred view mode for the layout manager modal.
   * 'grid' shows cards, 'list' shows compact rows.
   */
  layoutManagerViewMode: 'grid' | 'list';

  /**
   * Preferred view mode for the bin designer's saved designs modal.
   * 'grid' shows cards with thumbnails, 'list' shows compact rows.
   */
  designListViewMode: 'grid' | 'list';

  // Print view preferences
  printViewSettings: PrintViewSettings;

  // STL search sites configuration
  stlSearchSites: STLSearchSite[];

  // Privacy settings
  /**
   * Enable anonymous analytics and telemetry.
   * Controls both PostHog analytics and ML telemetry for bin suggestions.
   * Default: true (opt-out model)
   */
  analyticsEnabled: boolean;

  // Language preference
  /**
   * User's preferred locale. 'auto' means detect from browser.
   * Persisted to survive page reloads.
   */
  locale: Locale | 'auto';

  /**
   * Default categories for new layouts.
   * null means use built-in DEFAULT_CATEGORIES from constants.ts
   */
  defaultCategories: Category[] | null;

  /**
   * Show a banana model in the 3D preview as a real-world scale reference.
   */
  showBananaScale: boolean;

  /**
   * Print estimation settings (filament cost, layer height, infill %).
   * Used by both bin designer and print export for time/cost estimates.
   */
  printSettings: PrintSettings;

  // Appearance preferences
  /** Color theme: 'dark', 'light', or 'system' (follows OS preference). */
  theme: 'dark' | 'light' | 'system';
  /** Accent color preset applied to interactive elements. */
  accentColor: 'amber' | 'rose' | 'fuchsia' | 'emerald' | 'sky' | 'violet';
  /** UI density level affecting spacing and font size. */
  uiDensity: 'compact' | 'default' | 'comfortable';
  /** Override to reduce animations and transitions. */
  reduceMotion: boolean;

  /**
   * One-time UI hints that have been dismissed.
   * Replaces individual localStorage keys for hint tracking.
   * IDs: 'grid-resize', 'paint-mode', 'bin-resize', 'designer-touch'
   */
  dismissedHints: string[];
}

/**
 * Default settings values.
 */
export const DEFAULT_SETTINGS: UserSettings = {
  // Default layout values (match createDefaultLayout)
  defaultDrawerWidth: 10,
  defaultDrawerDepth: 8,
  defaultDrawerHeight: 12,
  defaultLayerHeight: 3, // Default to 3 (current hardcoded behavior)
  defaultPrintBedSize: 256,
  defaultGridUnitMm: 42,
  defaultHeightUnitMm: 7,

  // UI preferences
  defaultZoom: 1.0,
  rememberPanelState: true,
  lastLeftPanelCollapsed: false,
  lastRightPanelCollapsed: false,
  lastStashCollapsed: false,
  stashMaxHeight: null, // null = use default 33vh
  layoutManagerViewMode: 'grid',
  designListViewMode: 'grid',

  // Print view preferences
  printViewSettings: { ...DEFAULT_PRINT_VIEW_SETTINGS },

  // STL search sites
  stlSearchSites: [...DEFAULT_STL_SEARCH_SITES],

  // Privacy - opt-out by default (enabled)
  analyticsEnabled: true,

  // Language - auto-detect from browser by default
  locale: 'auto' as const,

  // Default categories - null means use app defaults
  defaultCategories: null,

  // 3D preview - banana for scale
  showBananaScale: false,

  // Print estimation settings
  printSettings: { ...DEFAULT_PRINT_SETTINGS },

  // Appearance
  theme: 'dark',
  accentColor: 'amber',
  uiDensity: 'default',
  reduceMotion: false,

  // Dismissed hints
  dismissedHints: [],
};

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
function normalizeCategories(stored: Category[] | null | undefined): Category[] | null {
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
function normalizeSTLSearchSites(stored: STLSearchSite[] | undefined): STLSearchSite[] {
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
 * Normalize view mode values from localStorage.
 * Ensures corrupted or invalid values fall back to the provided default.
 */
function normalizeViewMode(value: unknown, fallback: 'grid' | 'list'): 'grid' | 'list' {
  return value === 'grid' || value === 'list' ? value : fallback;
}

/**
 * Load settings from localStorage.
 */
function loadSettings(): UserSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<UserSettings>;
      // Deep merge printViewSettings to handle new fields
      const printViewSettings: PrintViewSettings = {
        ...DEFAULT_PRINT_VIEW_SETTINGS,
        ...parsed.printViewSettings,
        binListSortOrder: normalizeSortOrder(parsed.printViewSettings?.binListSortOrder),
      };
      // Normalize STL search sites
      const stlSearchSites = normalizeSTLSearchSites(parsed.stlSearchSites);
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
        defaultCategories,
        layoutManagerViewMode,
        designListViewMode,
        printSettings,
      };
      return merged;
    }
  } catch (e) {
    console.warn('Failed to load settings:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * Save settings to localStorage.
 */
function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save settings:', e);
  }
}

interface SettingsState {
  settings: UserSettings;

  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  updateSettings: (updates: Partial<UserSettings>) => void;
  resetSettings: () => void;

  // Save current layout defaults from the current layout
  saveCurrentAsDefaults: (
    drawer: { width: number; depth: number; height: number },
    printBedSize: number,
    gridUnitMm: number,
    heightUnitMm: number,
    layerHeight: number
  ) => void;

  // Save current categories as defaults for new layouts
  saveCategoriesAsDefaults: (categories: Category[]) => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  settings: loadSettings(),

  updateSetting: (key, value) => {
    set((state) => {
      const newSettings = { ...state.settings, [key]: value };
      saveSettings(newSettings);
      return { settings: newSettings };
    });
  },

  updateSettings: (updates) => {
    set((state) => {
      const newSettings = { ...state.settings, ...updates };
      saveSettings(newSettings);
      return { settings: newSettings };
    });
  },

  resetSettings: () => {
    const newSettings = { ...DEFAULT_SETTINGS };
    saveSettings(newSettings);
    set({ settings: newSettings });
  },

  saveCurrentAsDefaults: (drawer, printBedSize, gridUnitMm, heightUnitMm, layerHeight) => {
    set((state) => {
      const newSettings = {
        ...state.settings,
        defaultDrawerWidth: drawer.width,
        defaultDrawerDepth: drawer.depth,
        defaultDrawerHeight: drawer.height,
        defaultLayerHeight: layerHeight,
        defaultPrintBedSize: printBedSize,
        defaultGridUnitMm: gridUnitMm,
        defaultHeightUnitMm: heightUnitMm,
      };
      saveSettings(newSettings);
      return { settings: newSettings };
    });
  },

  saveCategoriesAsDefaults: (categories) => {
    set((state) => {
      // Deep copy categories to avoid reference issues
      const newSettings = {
        ...state.settings,
        defaultCategories: categories.length > 0 ? categories.map((c) => ({ ...c })) : null,
      };
      saveSettings(newSettings);
      return { settings: newSettings };
    });
  },
}));

import { create } from 'zustand';

// Storage key for settings
const SETTINGS_STORAGE_KEY = 'gridfinity-settings-v1';

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
 * Human-readable labels for sort fields.
 */
export const SORT_FIELD_LABELS: Record<BinSortField, string> = {
  category: 'Category',
  layer: 'Layer',
  position: 'Position',
  size: 'Size',
  height: 'Height',
  label: 'Label',
};

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
  // Layout options (what shows around/below the grid)
  showGridCoordinates: boolean;
  showLegend: boolean;
  showBinList: boolean;
  showDate: boolean;
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
  // Layout - all on by default
  showGridCoordinates: true,
  showLegend: true,
  showBinList: true,
  showDate: true,
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

  // Print view preferences
  printViewSettings: PrintViewSettings;
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

  // Print view preferences
  printViewSettings: { ...DEFAULT_PRINT_VIEW_SETTINGS },
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

  // Get all fields from default
  const allFields = new Set(DEFAULT_BIN_LIST_SORT_ORDER.map(s => s.field));
  const storedFields = new Set(stored.map(s => s.field));

  // Start with stored order
  const result: BinListSortOrder = stored.filter(s => allFields.has(s.field));

  // Add any missing fields at the end (disabled)
  for (const defaultConfig of DEFAULT_BIN_LIST_SORT_ORDER) {
    if (!storedFields.has(defaultConfig.field)) {
      result.push({ field: defaultConfig.field, enabled: false });
    }
  }

  return result;
}

/**
 * Load settings from localStorage.
 */
function loadSettings(): UserSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Deep merge printViewSettings to handle new fields
      const printViewSettings: PrintViewSettings = {
        ...DEFAULT_PRINT_VIEW_SETTINGS,
        ...parsed.printViewSettings,
        binListSortOrder: normalizeSortOrder(parsed.printViewSettings?.binListSortOrder),
      };
      // Merge with defaults to handle any missing fields
      return { ...DEFAULT_SETTINGS, ...parsed, printViewSettings };
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

  // Update a single setting
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;

  // Update multiple settings at once
  updateSettings: (updates: Partial<UserSettings>) => void;

  // Reset to defaults
  resetSettings: () => void;

  // Save current layout defaults from the current layout
  saveCurrentAsDefaults: (drawer: { width: number; depth: number; height: number }, printBedSize: number, gridUnitMm: number, heightUnitMm: number, layerHeight: number) => void;
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
}));

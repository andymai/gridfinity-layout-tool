import { create } from 'zustand';

// Storage key for settings
const SETTINGS_STORAGE_KEY = 'gridfinity-settings-v1';

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
};

/**
 * Load settings from localStorage.
 */
function loadSettings(): UserSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle any missing fields
      return { ...DEFAULT_SETTINGS, ...parsed };
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

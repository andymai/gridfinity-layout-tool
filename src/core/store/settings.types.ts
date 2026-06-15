import type { Locale } from '@/i18n/types';
import type { Category } from '@/core/types';
import type { PrintSettings } from '@/shared/printSettings';
import { DEFAULT_PRINT_SETTINGS } from '@/shared/printSettings';

// STL Search Sites Configuration

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

// Bin List Sort Configuration

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

// Print View Settings

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
  // Page options
  orientation: PrintOrientation;
  /** Scale the grid to fit on a single printed page */
  fitToPage: boolean;
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
  // Page options
  orientation: 'landscape',
  fitToPage: true,
  // Bin list sorting - category then position by default
  binListSortOrder: [...DEFAULT_BIN_LIST_SORT_ORDER],
};

// User Settings

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
  defaultPrintBedDepth?: number; // undefined = linked (same as defaultPrintBedSize)
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

  /**
   * Whether the wall-cutouts editor edits all active sides together.
   * Persisted so unlinking to adjust sides independently survives a reload.
   */
  wallCutoutsLinked: boolean;

  /**
   * Whether the handles editor edits all active sides together.
   * Persisted so unlinking to adjust sides independently survives a reload.
   */
  handlesLinked: boolean;

  /**
   * Whether angled (diagonal) divider editing is exposed in the bin designer.
   * Off by default — it's an advanced feature, so the editing UI (the tilt list
   * and the on-grid hit targets) stays hidden until the user opts in. Existing
   * tilts on a saved design still generate regardless of this flag; only the
   * editing affordances are gated.
   */
  angledDividersEnabled: boolean;

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

  /** Filament color for the baseplate 3D preview. */
  baseplateFilamentColor: string;

  /**
   * One-time UI hints that have been dismissed.
   * Replaces individual localStorage keys for hint tracking.
   * IDs: 'grid-resize', 'paint-mode', 'bin-resize', 'designer-touch',
   *      'multi-color-export'
   */
  dismissedHints: string[];

  /** Named multi-color palettes saved by the user. */
  savedColorPalettes: SavedColorPalette[];
}

/**
 * Per-zone color set saved by the user as a reusable palette. Structurally
 * matches the bin-designer's `FeatureColorConfig` so the value is directly
 * assignable, but declared here to avoid a core → feature import cycle.
 */
export interface SavedColorPalette {
  readonly id: string;
  readonly name: string;
  /** ISO timestamp of creation. */
  readonly createdAt: string;
  readonly colors: {
    readonly body: string;
    readonly lip: {
      readonly frontLeft: string;
      readonly frontRight: string;
      readonly backRight: string;
      readonly backLeft: string;
    };
    readonly labelTab: string;
    readonly base: string;
    readonly scoop: string;
    readonly dividers: string;
  };
}

export const COLOR_PALETTE_CONSTRAINTS = {
  MAX_PALETTES: 20,
  NAME_MAX_LENGTH: 40,
} as const;

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
  wallCutoutsLinked: true,
  handlesLinked: true,
  angledDividersEnabled: false,

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

  // Baseplate 3D preview
  baseplateFilamentColor: '#d4d8dc',

  // Dismissed hints
  dismissedHints: [],

  // Saved color palettes
  savedColorPalettes: [],
};

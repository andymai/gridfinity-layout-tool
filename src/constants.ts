import type { Layout, Category } from './types';

// === Constraints (from PRD) ===

export const CONSTRAINTS = {
  GRID_MIN: 1,
  GRID_MAX: 50,
  LAYERS_MIN: 1,
  LAYERS_MAX: 10,
  CATEGORIES_MIN: 1,
  CATEGORIES_MAX: 20,
  UNDO_LIMIT: 50,
  ZOOM_MIN: 0.25,
  ZOOM_MAX: 4.0,
  ZOOM_STEP: 0.1,
  MIN_VIEWPORT: 1024,
  LABEL_MAX_LENGTH: 24,
  NOTES_MAX_LENGTH: 256,
  NAME_MAX_LENGTH: 64,
  QUICK_FILL_MAX_BINS: 2500,
  QUICK_FILL_CONFIRM_THRESHOLD: 100,
  PRINT_GAP_MM: 10,  // Gap between bins on print bed
  // Layout library constraints
  LAYOUTS_MAX: 100,              // Max layouts in library (localStorage limit)
  LAYOUTS_WARNING_THRESHOLD: 80, // Show warning at this count
  RECENT_LAYOUTS_COUNT: 5,       // Number of recent layouts to show
} as const;

/**
 * Calculate max grid units for a single bin that fits on a print bed.
 * A bin of N grid units has size N * gridUnitMm, which must fit on the bed.
 * Formula: N * gridUnitMm ≤ printBedSizeMm → N ≤ printBedSizeMm / gridUnitMm
 */
export function calcMaxGridUnits(printBedSizeMm: number, gridUnitMm: number): number {
  return Math.max(1, Math.floor(printBedSizeMm / gridUnitMm));
}

// === Staging ===

export const STAGING_ID = '__staging__';

// === Half-bin Mode ===

/**
 * Scale factor for half-bin mode.
 * In half-bin mode, the grid is rendered at 2x resolution to support 0.5 unit increments.
 * Visual cells = internal grid * HALF_BIN_SCALE
 */
export const HALF_BIN_SCALE = 2;

/**
 * Snap a coordinate to the nearest 0.5 increment.
 * @param value - The raw coordinate value
 * @returns Value snapped to nearest 0.5 (e.g., 0, 0.5, 1, 1.5, 2, ...)
 */
export function snapToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * Snap a coordinate to grid based on half-bin mode.
 * @param value - The raw coordinate value
 * @param halfBinMode - Whether half-bin mode is active
 * @returns Value snapped to appropriate grid (0.5 increments if halfBinMode, whole numbers otherwise)
 */
export function snapToGrid(value: number, halfBinMode: boolean): number {
  return halfBinMode ? snapToHalf(value) : Math.floor(value);
}

/**
 * Check if a value has a fractional component (is at 0.5 position).
 * @param value - The value to check
 * @returns True if value is at a 0.5 position (e.g., 1.5, 2.5)
 */
export function isFractional(value: number): boolean {
  return value % 1 !== 0;
}

/**
 * Check if a bin or rect has any fractional dimensions or position.
 * @param rect - Object with x, y, width, depth properties
 * @returns True if any dimension is fractional
 */
export function hasFractionalDimensions(rect: { x: number; y: number; width: number; depth: number }): boolean {
  return isFractional(rect.x) || isFractional(rect.y) || isFractional(rect.width) || isFractional(rect.depth);
}

// === Default Colors ===

/** Default category color (slate gray) - used as fallback when category is undefined */
export const DEFAULT_CATEGORY_COLOR = '#6b7280';

// === Default Categories ===

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'coral', name: 'Coral', color: '#f87171' },
  { id: 'sky', name: 'Sky', color: '#38bdf8' },
  { id: 'green', name: 'Green', color: '#4ade80' },
  { id: 'cloud', name: 'Cloud', color: '#e2e8f0' },
  { id: 'charcoal', name: 'Charcoal', color: '#334155' },
];

// === ID Generation ===

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// === Default Layout ===

export const createDefaultLayout = (): Layout => ({
  version: '1.0',
  name: 'Untitled layout',
  drawer: { width: 10, depth: 8, height: 12 },
  printBedSize: 256,  // mm - typical print bed size
  gridUnitMm: 42,
  heightUnitMm: 7,
  categories: [...DEFAULT_CATEGORIES],
  layers: [
    { id: generateId(), name: 'Layer 1', height: 3 },
  ],
  bins: [],
});

/**
 * Create a new layout using user preferences.
 * Call this when creating new layouts from the UI.
 */
export interface LayoutSettings {
  defaultDrawerWidth: number;
  defaultDrawerDepth: number;
  defaultDrawerHeight: number;
  defaultLayerHeight: number;
  defaultPrintBedSize: number;
  defaultGridUnitMm: number;
  defaultHeightUnitMm: number;
}

export const createLayoutWithSettings = (settings: LayoutSettings): Layout => ({
  version: '1.0',
  name: 'Untitled layout',
  drawer: {
    width: settings.defaultDrawerWidth,
    depth: settings.defaultDrawerDepth,
    height: settings.defaultDrawerHeight,
  },
  printBedSize: settings.defaultPrintBedSize,
  gridUnitMm: settings.defaultGridUnitMm,
  heightUnitMm: settings.defaultHeightUnitMm,
  categories: [...DEFAULT_CATEGORIES],
  layers: [
    { id: generateId(), name: 'Layer 1', height: Math.min(settings.defaultDrawerHeight, settings.defaultLayerHeight) },
  ],
  bins: [],
});

// === Grid Sizing ===

export const BASE_CELL_SIZE = 32; // px at 100% zoom (default/desktop)

/**
 * Responsive breakpoints for adapting UI across device sizes.
 *
 * ## Breakpoint Guide
 * - < TINY_PHONE (375): Very small phones with reduced UI
 * - < SM (640): Small phones
 * - < MD (768): Mobile layout (stacked panels, bottom nav)
 * - < LG (900): Tablet layout (collapsible sidebars)
 * - >= LG (900): Desktop layout (persistent sidebars)
 * - >= XL (1280): Full desktop with extra space
 */
export const BREAKPOINTS = {
  /** Below this: extra small UI for tiny phones (iPhone SE 1st gen, small Android) */
  TINY_PHONE: 375,
  /** Small phones */
  SM: 640,
  /** At or above: tablet-size (large phones / small tablets) */
  MD: 768,
  /** At or above: desktop layout with sidebars */
  LG: 900,
  /** At or above: full desktop with extra space */
  XL: 1280,
} as const;

/**
 * Get adaptive base cell size based on viewport width.
 * Larger cells on tablets, smaller on tiny phones.
 */
export function getBaseCellSize(viewportWidth: number): number {
  if (viewportWidth < BREAKPOINTS.TINY_PHONE) return 28; // Tiny phones
  if (viewportWidth < BREAKPOINTS.MD) return 32; // Mobile (current default)
  if (viewportWidth < BREAKPOINTS.LG) return 36; // Tablet (more space available)
  return 32; // Desktop (current default)
}

// === Keyboard Shortcuts ===

export const SHORTCUTS = {
  DELETE: ['Delete', 'Backspace'],
  ESCAPE: ['Escape'],
  UNDO: 'z',        // with Ctrl/Cmd
  REDO: 'y',        // with Ctrl/Cmd
  REDO_ALT: 'Z',    // Shift+Ctrl/Cmd+Z
  DUPLICATE: 'd',   // with Ctrl/Cmd
  ROTATE: 'r',      // Rotate bin (swap width/depth) - standalone key, no Ctrl/Cmd
  ZOOM_IN: ['+', '='],
  ZOOM_OUT: ['-'],
  HELP: '?',
  // Navigation
  LAYER_UP: 'w',
  LAYER_DOWN: 's',
  SELECT_PREV_BIN: 'a',
  SELECT_NEXT_BIN: 'd',
  CATEGORY_PREV: '[',
  CATEGORY_NEXT: ']',
  QUICK_LABEL: 'l',
  NUDGE_UP: 'ArrowUp',
  NUDGE_DOWN: 'ArrowDown',
  NUDGE_LEFT: 'ArrowLeft',
  NUDGE_RIGHT: 'ArrowRight',
  // 3D Preview shortcuts
  PREVIEW_TOGGLE: 'v',
  PREVIEW_EXPAND: 'Space',
  // Camera preset shortcuts
  PRESET_ISOMETRIC: '1',
  PRESET_TOP: '2',
  PRESET_FRONT: '3',
  PRESET_SIDE: '4',
  // Half-bin mode
  HALF_BIN_TOGGLE: 'h',
  // Layout management
  LAYOUT_MANAGER: 'o',  // with Ctrl/Cmd - "Open" layouts
} as const;

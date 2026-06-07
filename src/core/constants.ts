import type {
  Layout,
  Category,
  BaseplateParams,
  PaddingAnchor,
  BinId,
  LayoutId,
  LayerId,
  CategoryId,
} from './types';
import { binId, layerId, categoryId, mm, gridUnits, heightUnits } from './types';
import { CONNECTOR_FIT_OFFSET_MIN, CONNECTOR_FIT_OFFSET_MAX } from '@/shared/constants/connectors';
export const CONSTRAINTS = {
  GRID_MIN: 0.5, // Minimum drawer dimension (supports half-unit increments)
  GRID_MAX: 50,
  LAYERS_MIN: 1,
  LAYERS_MAX: 10,
  CATEGORIES_MIN: 1,
  CATEGORIES_MAX: 20,
  UNDO_LIMIT: 100,
  ZOOM_MIN: 0.25,
  ZOOM_MAX: 4.0,
  ZOOM_STEP: 0.1,
  MIN_VIEWPORT: 1024,
  LABEL_MAX_LENGTH: 24,
  NOTES_MAX_LENGTH: 256,
  NAME_MAX_LENGTH: 64,
  QUICK_FILL_MAX_BINS: 2500,
  QUICK_FILL_CONFIRM_THRESHOLD: 100,
  MIN_BIN_HEIGHT: 2, // Minimum bin height in units (1U = base only, no usable cavity)
  MIN_LAYER_HEIGHT: 2, // Minimum layer height in units (1U = socket base only)
  PRINT_GAP_MM: 10, // Gap between bins on print bed
  // Physical unit bounds. Standard Gridfinity is 42mm grid / 7mm height; the
  // range here covers half-pitch (21mm) and mini-Gridfinity (25mm) variants
  // with a small buffer, while rejecting obviously-wrong values like "300".
  GRID_UNIT_MM_MIN: 20,
  GRID_UNIT_MM_MAX: 60,
  GRID_UNIT_MM_DEFAULT: 42,
  HEIGHT_UNIT_MM_MIN: 3,
  HEIGHT_UNIT_MM_MAX: 20,
  HEIGHT_UNIT_MM_DEFAULT: 7,
  // Layout library constraints
  LAYOUTS_MAX: 500, // Max layouts in library (IndexedDB storage)
  LAYOUTS_WARNING_THRESHOLD: 450, // Show warning at this count
  RECENT_LAYOUTS_COUNT: 5, // Number of recent layouts to show
  // Custom properties constraints
  CUSTOM_PROPERTY_MAX_COUNT: 50, // Max custom properties per bin
  CUSTOM_PROPERTY_KEY_MAX_LENGTH: 32, // Max length of property key
  CUSTOM_PROPERTY_VALUE_MAX_LENGTH: 256, // Max length of property value
} as const;

/** Reserved keys that cannot be used as custom property names */
export const RESERVED_PROPERTY_KEYS = [
  'id',
  'layerId',
  'x',
  'y',
  'width',
  'depth',
  'height',
  'clearanceHeight',
  'category',
  'label',
  'notes',
  'customProperties',
  // Prevent prototype pollution
  '__proto__',
  'constructor',
  'prototype',
] as const;

/**
 * Max grid units for a single axis.
 * N * gridUnitMm ≤ bedMm → N ≤ bedMm / gridUnitMm
 *
 * Floors down to the next lower 0.5 increment so that half-bin sizes
 * (e.g. 6.5 units) are correctly recognized as fitting when their mm
 * footprint is within the bed. Integer-only layouts are unaffected
 * because ⌊x⌋ === ⌊2x⌋/2 whenever x is already an integer.
 */
function calcMaxGridUnitsForAxis(bedMm: number, gridUnitMm: number): number {
  return Math.max(1, Math.floor((bedMm / gridUnitMm) * 2) / 2);
}

/**
 * Calculate max grid units that fit on a print bed for each axis.
 * When printBedDepthMm is omitted, depth uses the same value as width (square bed).
 */
export function calcMaxGridUnits(
  printBedWidthMm: number,
  gridUnitMm: number,
  printBedDepthMm?: number
): { width: number; depth: number } {
  return {
    width: calcMaxGridUnitsForAxis(printBedWidthMm, gridUnitMm),
    depth: calcMaxGridUnitsForAxis(printBedDepthMm ?? printBedWidthMm, gridUnitMm),
  };
}

/** Resolve effective print bed depth, falling back to width when undefined. */
export function getEffectivePrintBedDepth(layout: {
  printBedSize: number;
  printBedDepth?: number;
}): number {
  return layout.printBedDepth ?? layout.printBedSize;
}
export const STAGING_ID = '__staging__' as LayerId;
/** Sentinel layout ID used when viewing a shared layout in preview mode. */
export const SHARED_PREVIEW_ID = '__shared_preview__' as LayoutId;

/** Returns true if the ID represents a real persisted layout (not a preview sentinel). */
export function isRealLayoutId(id: LayoutId | null): id is LayoutId {
  return id !== null && id !== SHARED_PREVIEW_ID;
}
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
 * @param halfGridMode - Whether half-bin mode is active
 * @returns Value snapped to appropriate grid (0.5 increments if halfGridMode, whole numbers otherwise)
 */
export function snapToGrid(value: number, halfGridMode: boolean): number {
  return halfGridMode ? snapToHalf(value) : Math.floor(value);
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
export function hasFractionalDimensions(rect: {
  x: number;
  y: number;
  width: number;
  depth: number;
}): boolean {
  return (
    isFractional(rect.x) ||
    isFractional(rect.y) ||
    isFractional(rect.width) ||
    isFractional(rect.depth)
  );
}
/** Default category color (slate gray) - used as fallback when category is undefined */
export const DEFAULT_CATEGORY_COLOR = '#6b7280';

/** Curated color palette for categories, optimized for dark UI backgrounds. */
export const CATEGORY_COLOR_PALETTE = [
  { color: '#f87171', nameKey: 'colors.category.coral' },
  { color: '#fb923c', nameKey: 'colors.category.orange' },
  { color: '#fbbf24', nameKey: 'colors.category.amber' },
  { color: '#a3e635', nameKey: 'colors.category.lime' },
  { color: '#4ade80', nameKey: 'colors.category.green' },
  { color: '#2dd4bf', nameKey: 'colors.category.teal' },
  { color: '#38bdf8', nameKey: 'colors.category.sky' },
  { color: '#818cf8', nameKey: 'colors.category.indigo' },
  { color: '#c084fc', nameKey: 'colors.category.purple' },
  { color: '#f472b6', nameKey: 'colors.category.pink' },
  { color: '#e2e8f0', nameKey: 'colors.category.cloud' },
  { color: '#334155', nameKey: 'colors.category.charcoal' },
  { color: '#94a3b8', nameKey: 'colors.category.slate' },
  { color: '#a8a29e', nameKey: 'colors.category.stone' },
] as const;

/** Common 3D printing filament colors for the baseplate preview color picker. */
export const FILAMENT_COLORS = [
  { color: '#f5f5f5', nameKey: 'colors.filament.white' },
  { color: '#d4d8dc', nameKey: 'colors.filament.lightGrey' },
  { color: '#6b7280', nameKey: 'colors.filament.darkGrey' },
  { color: '#1f2937', nameKey: 'colors.filament.black' },
  { color: '#fef3c7', nameKey: 'colors.filament.cream' },
  { color: '#ef4444', nameKey: 'colors.filament.red' },
  { color: '#3b82f6', nameKey: 'colors.filament.blue' },
  { color: '#22c55e', nameKey: 'colors.filament.green' },
  { color: '#f97316', nameKey: 'colors.filament.orange' },
  { color: '#a855f7', nameKey: 'colors.filament.purple' },
] as const;

/** Curated 20-color preset grid for the filament palette editor popover. */
export const FILAMENT_PRESET_COLORS = [
  { color: '#f5f5f5', name: 'White' },
  { color: '#d4d8dc', name: 'Light Grey' },
  { color: '#6b7280', name: 'Grey' },
  { color: '#1f2937', name: 'Black' },
  { color: '#fef3c7', name: 'Cream' },
  { color: '#ef4444', name: 'Red' },
  { color: '#f97316', name: 'Orange' },
  { color: '#fbbf24', name: 'Yellow' },
  { color: '#d97706', name: 'Gold' },
  { color: '#92400e', name: 'Brown' },
  { color: '#3b82f6', name: 'Blue' },
  { color: '#0ea5e9', name: 'Sky Blue' },
  { color: '#06b6d4', name: 'Cyan' },
  { color: '#2dd4bf', name: 'Teal' },
  { color: '#22c55e', name: 'Green' },
  { color: '#84cc16', name: 'Lime' },
  { color: '#a855f7', name: 'Purple' },
  { color: '#ec4899', name: 'Pink' },
  { color: '#f43f5e', name: 'Rose' },
  { color: '#fcd34d', name: 'Neon Yellow' },
] as const;

/**
 * Smallest drawer-fit margin (mm) that over-tile fills with a clipped grid
 * pocket. Below this the pocket walls are too thin/short to print, so that side
 * stays solid padding. Single source for the worker geometry
 * (`MIN_PRINTABLE_TILE_MM`) and the baseplate UI's per-side tiling feedback.
 */
export const OVER_TILE_MIN_MARGIN_MM = 8;

/** Default baseplate parameters: no magnets, no padding */
export const DEFAULT_BASEPLATE_PARAMS: BaseplateParams = {
  magnetHoles: false,
  magnetDiameter: mm(6.5),
  magnetDepth: mm(2),
  paddingLeft: mm(0),
  paddingRight: mm(0),
  paddingFront: mm(0),
  paddingBack: mm(0),
  lightweight: true,
} as const;

/**
 * Migrate old baseplateParams to current shape.
 * Returns DEFAULT_BASEPLATE_PARAMS if the stored data lacks paddingLeft,
 * preserving magnet settings when possible.
 */
export function migrateBaseplateParams(stored: unknown): BaseplateParams {
  if (!stored || typeof stored !== 'object') return DEFAULT_BASEPLATE_PARAMS;
  const obj = stored as Record<string, unknown>;
  // Current shape has paddingLeft — if missing, it's an old format
  if (typeof obj.paddingLeft !== 'number') {
    return {
      ...DEFAULT_BASEPLATE_PARAMS,
      magnetHoles: typeof obj.magnetHoles === 'boolean' ? obj.magnetHoles : false,
      magnetDiameter: mm(clampNumber(obj.magnetDiameter, 0.5, 20, 6.5)),
      magnetDepth: mm(clampNumber(obj.magnetDepth, 0.5, 10, 2)),
    };
  }
  // Validate and clamp all fields from persisted/imported data
  const radii = obj.cornerRadii;
  const hasRadii =
    radii !== null &&
    typeof radii === 'object' &&
    typeof (radii as Record<string, unknown>).tl === 'number' &&
    typeof (radii as Record<string, unknown>).tr === 'number' &&
    typeof (radii as Record<string, unknown>).bl === 'number' &&
    typeof (radii as Record<string, unknown>).br === 'number';
  return {
    magnetHoles: typeof obj.magnetHoles === 'boolean' ? obj.magnetHoles : false,
    magnetDiameter: mm(clampNumber(obj.magnetDiameter, 0.5, 20, 6.5)),
    magnetDepth: mm(clampNumber(obj.magnetDepth, 0.5, 10, 2)),
    paddingLeft: mm(clampNumber(obj.paddingLeft, 0, 100, 0)),
    paddingRight: mm(clampNumber(obj.paddingRight, 0, 100, 0)),
    paddingFront: mm(clampNumber(obj.paddingFront, 0, 100, 0)),
    paddingBack: mm(clampNumber(obj.paddingBack, 0, 100, 0)),
    ...(isPaddingAnchor(obj.paddingAnchor) ? { paddingAnchor: obj.paddingAnchor } : {}),
    ...(typeof obj.overTile === 'boolean' ? { overTile: obj.overTile } : {}),
    ...(typeof obj.connectorNubs === 'boolean' ? { connectorNubs: obj.connectorNubs } : {}),
    ...(typeof obj.invertDovetails === 'boolean' ? { invertDovetails: obj.invertDovetails } : {}),
    ...(typeof obj.preferIdenticalPieces === 'boolean'
      ? { preferIdenticalPieces: obj.preferIdenticalPieces }
      : {}),
    ...(obj.connectorStyle === 'dovetail' ||
    obj.connectorStyle === 'dovetailKey' ||
    obj.connectorStyle === 'snapClip'
      ? { connectorStyle: obj.connectorStyle }
      : {}),
    ...(typeof obj.connectorFitOffset === 'number'
      ? {
          connectorFitOffset: clampNumber(
            obj.connectorFitOffset,
            CONNECTOR_FIT_OFFSET_MIN,
            CONNECTOR_FIT_OFFSET_MAX,
            0
          ),
        }
      : {}),
    ...(typeof obj.lightweight === 'boolean' ? { lightweight: obj.lightweight } : {}),
    ...(typeof obj.syncWithLayout === 'boolean' ? { syncWithLayout: obj.syncWithLayout } : {}),
    ...(typeof obj.baseplateWidth === 'number'
      ? {
          baseplateWidth: gridUnits(
            Math.min(CONSTRAINTS.GRID_MAX, Math.max(CONSTRAINTS.GRID_MIN, obj.baseplateWidth))
          ),
        }
      : {}),
    ...(typeof obj.baseplateDepth === 'number'
      ? {
          baseplateDepth: gridUnits(
            Math.min(CONSTRAINTS.GRID_MAX, Math.max(CONSTRAINTS.GRID_MIN, obj.baseplateDepth))
          ),
        }
      : {}),
    ...(typeof obj.cornerRadius === 'number'
      ? { cornerRadius: mm(clampNumber(obj.cornerRadius, 0, 200, 0)) }
      : {}),
    ...(hasRadii
      ? {
          cornerRadii: {
            tl: mm(clampNumber((radii as Record<string, unknown>).tl, 0, 200, 0)),
            tr: mm(clampNumber((radii as Record<string, unknown>).tr, 0, 200, 0)),
            bl: mm(clampNumber((radii as Record<string, unknown>).bl, 0, 200, 0)),
            br: mm(clampNumber((radii as Record<string, unknown>).br, 0, 200, 0)),
          },
        }
      : {}),
  };
}

/** Clamp a possibly-invalid value to [min, max], falling back to defaultVal if not a number. */
function clampNumber(value: unknown, min: number, max: number, defaultVal: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return defaultVal;
  return Math.min(max, Math.max(min, value));
}

const PADDING_ANCHOR_VALUES = new Set<string>([
  'tl',
  'tc',
  'tr',
  'ml',
  'c',
  'mr',
  'bl',
  'bc',
  'br',
  'custom',
]);

function isPaddingAnchor(value: unknown): value is PaddingAnchor {
  return typeof value === 'string' && PADDING_ANCHOR_VALUES.has(value);
}

/** Default layout name for new layouts */
export const DEFAULT_LAYOUT_NAME = 'Untitled layout';
export const DEFAULT_CATEGORIES: Category[] = [
  { id: categoryId('coral'), name: 'Coral', color: '#f87171' },
  { id: categoryId('sky'), name: 'Sky', color: '#38bdf8' },
  { id: categoryId('green'), name: 'Green', color: '#4ade80' },
  { id: categoryId('cloud'), name: 'Cloud', color: '#e2e8f0' },
  { id: categoryId('charcoal'), name: 'Charcoal', color: '#334155' },
];
export function generateId(): string {
  const bytes = new Uint8Array(5);
  globalThis.crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${Date.now().toString(36)}-${rand}`;
}

/** Generate a branded BinId. */
export function generateBinId(): BinId {
  return binId(generateId());
}

/** Generate a branded LayerId. */
export function generateLayerId(): LayerId {
  return layerId(generateId());
}

/** Generate a branded CategoryId. */
export function generateCategoryId(): CategoryId {
  return categoryId(generateId());
}
/**
 * Get default drawer dimensions based on viewport width.
 * Mobile devices get a portrait-oriented layout (like an IKEA Alex drawer)
 * since phones are typically held in portrait.
 */
export function getDefaultDrawerSize(viewportWidth?: number): {
  width: number;
  depth: number;
  height: number;
} {
  const vw = viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : BREAKPOINTS.LG);
  if (vw < BREAKPOINTS.MD) {
    // Mobile: portrait orientation (narrower, deeper) — similar to IKEA Alex drawer
    return { width: 6, depth: 9, height: 12 };
  }
  // Desktop/tablet: landscape orientation
  return { width: 10, depth: 8, height: 12 };
}

export const createDefaultLayout = (): Layout => {
  const size = getDefaultDrawerSize();
  return {
    version: '1.0',
    name: DEFAULT_LAYOUT_NAME,
    drawer: {
      width: gridUnits(size.width),
      depth: gridUnits(size.depth),
      height: heightUnits(size.height),
    },
    printBedSize: mm(256), // mm - typical print bed size
    gridUnitMm: mm(42),
    heightUnitMm: mm(7),
    categories: [...DEFAULT_CATEGORIES],
    layers: [{ id: generateLayerId(), name: 'Layer 1', height: heightUnits(3) }],
    bins: [],
  };
};

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
  defaultPrintBedDepth?: number;
  defaultGridUnitMm: number;
  defaultHeightUnitMm: number;
  /** Custom default categories. null means use DEFAULT_CATEGORIES. */
  defaultCategories: Category[] | null;
}

export const createLayoutWithSettings = (settings: LayoutSettings): Layout => {
  // Use custom categories if set, otherwise fall back to app defaults
  const categories = settings.defaultCategories
    ? settings.defaultCategories.map((c) => ({ ...c })) // Deep copy to avoid reference issues
    : [...DEFAULT_CATEGORIES];

  return {
    version: '1.0',
    name: DEFAULT_LAYOUT_NAME,
    drawer: {
      width: gridUnits(settings.defaultDrawerWidth),
      depth: gridUnits(settings.defaultDrawerDepth),
      height: heightUnits(settings.defaultDrawerHeight),
    },
    printBedSize: mm(settings.defaultPrintBedSize),
    printBedDepth:
      settings.defaultPrintBedDepth !== undefined ? mm(settings.defaultPrintBedDepth) : undefined,
    gridUnitMm: mm(settings.defaultGridUnitMm),
    heightUnitMm: mm(settings.defaultHeightUnitMm),
    categories,
    layers: [
      {
        id: generateLayerId(),
        name: 'Layer 1',
        height: heightUnits(Math.min(settings.defaultDrawerHeight, settings.defaultLayerHeight)),
      },
    ],
    bins: [],
  };
};
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
export const SHORTCUTS = {
  DELETE: ['Delete', 'Backspace'],
  ESCAPE: ['Escape'],
  UNDO: 'z', // with Ctrl/Cmd
  REDO: 'y', // with Ctrl/Cmd
  REDO_ALT: 'Z', // Shift+Ctrl/Cmd+Z
  DUPLICATE: 'd', // with Ctrl/Cmd
  ROTATE: 'r', // Rotate bin (swap width/depth) - standalone key, no Ctrl/Cmd
  ZOOM_IN: ['+', '='],
  ZOOM_OUT: ['-'],
  HELP: ['?', '/'],
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
  TOGGLE_XRAY: 'x',
  TOGGLE_PROJECTION: 'p',
  // Half-bin mode
  HALF_BIN_TOGGLE: 'h',
  // Layout management
  LAYOUT_MANAGER: 'o', // with Ctrl/Cmd - "Open" layouts
  // Tool switching
  TOOL_SWITCH: 'D', // Shift+D — toggle between Layout and Bins
} as const;

// === Core Data Model (from PRD 05-technical-reference.md) ===

export interface Layout {
  version: string;           // "1.0"
  name: string;              // max 64 chars
  drawer: Drawer;
  printBedSize: number;      // print bed size in mm (e.g., 256 for Prusa MK3)
  gridUnitMm: number;        // mm per grid unit (default 42)
  heightUnitMm: number;      // mm per height unit (default 7)
  categories: Category[];    // 1-20 items
  layers: Layer[];           // 1-10 items, index 0 = bottom
  bins: Bin[];
}

export interface Drawer {
  width: number;             // 1-50
  depth: number;             // 1-50
  height: number;            // >= sum of layer heights
}

export interface Category {
  id: string;
  name: string;              // max 24 chars, unique (case-insensitive)
  color: string;             // hex color
}

export interface Layer {
  id: string;
  name: string;              // max 24 chars
  height: number;            // >= 1
}

export interface Bin {
  id: string;
  layerId: string;           // base layer ID or STAGING_ID
  x: number;                 // 0-based, from left
  y: number;                 // 0-based, from bottom
  width: number;             // >= 1
  depth: number;             // >= 1
  height: number;            // >= base layer height, <= space to drawer top
  clearanceHeight?: number;  // additional blocked space above bin (for tall contents)
  category: string;          // references Category.id
  label: string;             // max 24 chars
  notes: string;             // max 256 chars
}

// === Coordinate Types ===

export interface Coord {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  depth: number;
}

export interface Rect3D extends Rect {
  zStart: number;
  zEnd: number;
}

// === Interaction State ===

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export type Interaction =
  | { type: 'draw'; start: Coord; current: Coord }
  | { type: 'drag'; binIds: string[]; startCoord: Coord; currentCoord: Coord; valid: boolean; isOverGrid: boolean; clickOffset?: { x: number; y: number } }
  | { type: 'resize'; binIds: string[]; handle: ResizeHandle; startRects: Map<string, Rect>; currentRects: Map<string, Rect>; valid: boolean }
  | { type: 'stagingDrag'; binId: string; currentCoord: Coord | null; valid: boolean }
  | { type: 'paint'; paintSize: { width: number; depth: number }; start: Coord; current: Coord };

// === UI State ===

export interface UIState {
  activeLayerId: string;
  selectedBinIds: string[];
  activeCategoryId: string;
  zoom: number;              // 0.5 - 2.0
  showOtherLayers: boolean;
}

// === Validation Results ===

export interface ValidationResult {
  valid: boolean;
  reason?: 'out_of_bounds' | 'exceeds_width' | 'exceeds_depth' | 'exceeds_height' |
           'invalid_layer' | 'collision' | 'blocked_zone';
}

/**
 * Standardized result type for store operations.
 * Use this pattern for operations that can fail with a user-facing error message.
 *
 * @example
 * // Success with data
 * return { success: true, data: newBin };
 *
 * // Success without data
 * return { success: true };
 *
 * // Failure
 * return { success: false, error: 'Cannot delete the last layer' };
 */
export type OperationResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// === Print List ===

export interface PrintPiece {
  width: number;
  depth: number;
  count: number;
}

export interface PrintRow {
  size: string;              // "3×2"
  height: number;
  binCount: number;
  pieces: PrintPiece[];
  totalPieces: number;
  needsSplit: boolean;
  filament: number;          // Estimated filament in meters
  categoryIds: string[];     // Category IDs for bins of this size (for color display)
  labels: string[];          // Non-empty labels from bins of this size
  notes: string;             // Notes (only for labeled/individual bins)
  binIds: string[];          // Original bin IDs for click-to-select
}

// === Enhanced Print List Types ===

export interface PrintListConfig {
  filamentCostPerKg: number;      // $/kg - user configurable (default 20)
  metersPerKg: number;            // Meters per 1kg spool (~330m for 1.75mm PLA)
}

export interface EnhancedPrintRow extends PrintRow {
  area: number;                   // width * depth (for sorting)
  costEstimate: number;           // $ based on filament usage
  spoolPercentage: number;        // % of 1kg spool
}

export interface PrintListGroup {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  rows: EnhancedPrintRow[];
  totalFilament: number;
  totalCost: number;
  totalBins: number;
}

export type PrintListSortKey = 'default' | 'area' | 'height' | 'filament';
export type PrintListSortOrder = 'asc' | 'desc';

export interface PrintListFilters {
  hiddenCategoryIds: Set<string>;
  sortKey: PrintListSortKey;
  sortOrder: PrintListSortOrder;
  groupByCategory: boolean;
}

// === Blocked Zone ===

export interface BlockedZone {
  x: number;
  y: number;
  width: number;
  depth: number;
  sourceBinId: string;
  sourceLayerId: string;
}
